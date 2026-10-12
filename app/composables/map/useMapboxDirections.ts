import {
  renderStoredRoute,
  clearStoredRoute,
  updateStoredRouteAppearance,
} from "~/utils/storedRoute";
import type mapboxgl from "mapbox-gl";
import type { LayerSpecification } from "mapbox-gl";
import MapboxDirections from "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions";
import {
  shallowRef,
  readonly,
  watch,
  getCurrentScope,
  onScopeDispose,
} from "vue";
import type { Ref, ShallowRef } from "vue";
import { useLogger } from "@/composables/utils/useLogger";
import type { ICreatedTour } from "~/types";
import { decodeRouteGeometry } from "#shared/utils/routeMovement";
import type { MapPoint } from "#shared/utils/routeMovement";

interface RouteEvent {
  route: Array<{
    geometry: string | { coordinates: MapPoint[] };
  }>;
}

interface MapboxDirectionsOptions {
  enableBounds?: boolean;
  interactive?: boolean;
  profile?:
    | "mapbox/driving-traffic"
    | "mapbox/driving"
    | "mapbox/walking"
    | "mapbox/cycling";
  controls?: {
    inputs?: boolean;
    instructions?: boolean;
    profileSwitcher?: boolean;
  };
}

const WAYPOINTS_MAX_COUNT = 25;
// The plugin fills in any missing default IDs, so override every default layer
// through its supported styles option rather than deleting layers after routing.
const PROVIDER_STYLES: LayerSpecification[] = [
  ...[
    "directions-route-line-alt",
    "directions-route-line-casing",
    "directions-route-line",
  ].map((id): LayerSpecification => ({
    id,
    type: "line",
    source: "directions",
    layout: { visibility: "none" },
  })),
  ...[
    "directions-hover-point-casing",
    "directions-hover-point",
    "directions-waypoint-point-casing",
    "directions-waypoint-point",
    "directions-origin-point",
    "directions-destination-point",
  ].map((id): LayerSpecification => ({
    id,
    type: "circle",
    source: "directions:markers",
    layout: { visibility: "none" },
  })),
  ...["directions-origin-label", "directions-destination-label"].map(
    (id): LayerSpecification => ({
      id,
      type: "symbol",
      source: "directions:markers",
      layout: { visibility: "none" },
    }),
  ),
];

export function useMapboxDirections(
  mapInstance: ShallowRef<mapboxgl.Map | null> | Ref<mapboxgl.Map | null>,
  options: MapboxDirectionsOptions = {},
) {
  const logger = useLogger();
  const { public: publicConfig } = useRuntimeConfig();
  const config: Required<MapboxDirectionsOptions> = {
    enableBounds: true,
    interactive: false,
    profile: "mapbox/walking",
    controls: { inputs: false, instructions: false, profileSwitcher: false },
    ...options,
  };

  const directions = shallowRef<MapboxDirections | null>(null);
  const isDirectionsReady = shallowRef(false);
  const routeCoordinates = shallowRef<MapPoint[]>([]);
  const routeLegStarts = shallowRef<readonly number[]>([]);
  let ownedMap: mapboxgl.Map | null = null;
  let controlMap: mapboxgl.Map | null = null;
  let acceptProviderRoute = false;
  let disposed = false;

  let pendingIdleRestore = false;
  let pendingInitialFit = false;
  const restoreDisplayedRoute = () => {
    if (disposed || !ownedMap || !routeCoordinates.value.length) return;
    if (!ownedMap.isStyleLoaded()) {
      pendingIdleRestore = true;
      return;
    }
    pendingIdleRestore = false;
    if (
      routeCoordinates.value.length &&
      !renderStoredRoute(
        ownedMap,
        routeCoordinates.value,
        pendingInitialFit,
        routeLegStarts.value,
      )
    ) {
      routeCoordinates.value = [];
    }
    pendingInitialFit = false;
  };
  const restoreOnIdle = () => {
    if (pendingIdleRestore) restoreDisplayedRoute();
  };
  const updateAppearance = () => {
    if (ownedMap) updateStoredRouteAppearance(ownedMap);
  };
  const releaseControl = () => {
    const client = directions.value;
    const map = controlMap;
    directions.value = null;
    controlMap = null;
    isDirectionsReady.value = false;
    acceptProviderRoute = false;
    if (!client || !map) return;
    try {
      map.removeControl(client);
    } catch (error) {
      logger.warn("Error removing directions control:", error);
    }
  };

  const stopMapWatch = watch(
    mapInstance,
    (map) => {
      if (ownedMap) {
        ownedMap.off("pg:appearance", updateAppearance);
        ownedMap.off("style.load", restoreDisplayedRoute);
        ownedMap.off("idle", restoreOnIdle);
        clearStoredRoute(ownedMap);
      }
      releaseControl();
      pendingIdleRestore = false;
      pendingInitialFit = false;
      ownedMap = map;
      if (!map) return;
      map.on("pg:appearance", updateAppearance);
      map.on("style.load", restoreDisplayedRoute);
      map.on("idle", restoreOnIdle);
      restoreDisplayedRoute();
    },
    { immediate: true, flush: "sync" },
  );

  const clearDirections = (): void => {
    acceptProviderRoute = false;
    pendingIdleRestore = false;
    pendingInitialFit = false;
    routeCoordinates.value = [];
    routeLegStarts.value = [];
    clearStoredRoute(ownedMap);
    try {
      directions.value?.removeRoutes();
    } catch (error) {
      logger.error("Error clearing directions routes:", error);
    }
  };

  const displayRoute = (
    coordinates: MapPoint[],
    legStarts: readonly number[] = [],
  ): boolean => {
    const decoded = decodeRouteGeometry({ coordinates });
    const first = decoded[0];
    if (
      !ownedMap ||
      decoded.length < 2 ||
      !first ||
      !decoded.some(([lng, lat]) => lng !== first[0] || lat !== first[1])
    ) {
      pendingIdleRestore = false;
      pendingInitialFit = false;
      routeCoordinates.value = [];
      clearStoredRoute(ownedMap);
      return false;
    }
    routeCoordinates.value = decoded;
    routeLegStarts.value = legStarts;
    // A newly supplied path gets its initial fit even if sources are still
    // loading. Restoring an existing path after a style reload never refits.
    pendingInitialFit = config.enableBounds;
    if (!ownedMap.isStyleLoaded()) {
      pendingIdleRestore = true;
      return true;
    }
    pendingIdleRestore = false;
    const rendered = renderStoredRoute(
      ownedMap,
      decoded,
      pendingInitialFit,
      legStarts,
    );
    pendingInitialFit = false;
    if (rendered) return true;
    routeCoordinates.value = [];
    return false;
  };

  const initializeDirections = (): MapboxDirections | null => {
    if (disposed) return null;
    if (directions.value) return directions.value;
    const map = ownedMap;
    if (!map) {
      logger.error("Map instance not available for directions initialization");
      return null;
    }
    try {
      const client = new MapboxDirections({
        accessToken: publicConfig.mapboxGlAccessToken,
        unit: "metric",
        profile: config.profile,
        controls: config.controls,
        interactive: config.interactive,
        styles: PROVIDER_STYLES,
      });
      directions.value = client;
      controlMap = map;
      acceptProviderRoute = true;
      // This plugin has no public off API. Detached clients are fenced by
      // identity; removing the control releases its map/store subscriptions.
      client.on("route", (event: RouteEvent) => {
        if (
          directions.value !== client ||
          ownedMap !== map ||
          !acceptProviderRoute
        )
          return;
        const geometry = event.route?.[0]?.geometry;
        displayRoute(geometry ? decodeRouteGeometry(geometry) : []);
      });
      client.on("clear", () => {
        if (directions.value !== client || !acceptProviderRoute) return;
        pendingIdleRestore = false;
        pendingInitialFit = false;
        routeCoordinates.value = [];
        clearStoredRoute(map);
      });
      client.on("error", (error: Error) => {
        if (directions.value !== client || !acceptProviderRoute) return;
        pendingIdleRestore = false;
        pendingInitialFit = false;
        routeCoordinates.value = [];
        clearStoredRoute(map);
        logger.error("Directions error:", error);
      });
      map.addControl(client);
      isDirectionsReady.value = true;
      return client;
    } catch (error) {
      logger.error("Error initializing MapboxDirections:", error);
      releaseControl();
      return null;
    }
  };

  const setRoute = (
    coordinates: MapPoint[],
    legStarts: readonly number[] = [],
  ): boolean => {
    clearDirections();
    return !disposed && displayRoute(coordinates, legStarts);
  };

  const addRouteToMap = (
    tour: ICreatedTour,
    isMapFullyLoaded: Ref<boolean>,
  ): void => {
    if (disposed || !ownedMap || !isMapFullyLoaded.value) return;
    // Legacy tours serialize missing geometry as []. Nonempty stored geometry
    // remains authoritative: invalid paths clear instead of requesting a new one.
    if (tour.route.geometry != null && tour.route.geometry.length !== 0) {
      setRoute(
        tour.route.geometry.map((point) => [
          Number(point.lng),
          Number(point.lat),
        ]),
        tour.route.geometry_leg_starts,
      );
      return;
    }
    const client = directions.value;
    if (!client || !isDirectionsReady.value) {
      clearDirections();
      logger.warn("Directions not initialized for legacy tour routing");
      return;
    }
    const coordinates = decodeRouteGeometry({
      coordinates: tour.route.points.map((point) => [
        Number(point.lng),
        Number(point.lat),
      ]),
    });
    clearDirections();
    if (coordinates.length < 2) {
      logger.warn("Not enough valid coordinates for route");
      return;
    }
    const trimmed =
      coordinates.length <= WAYPOINTS_MAX_COUNT
        ? coordinates
        : [
            ...coordinates.slice(0, WAYPOINTS_MAX_COUNT - 1),
            coordinates[coordinates.length - 1]!,
          ];
    try {
      acceptProviderRoute = true;
      client.setOrigin(trimmed[0]!);
      trimmed
        .slice(1, -1)
        .forEach((waypoint, index) => client.addWaypoint(index, waypoint));
      client.setDestination(trimmed[trimmed.length - 1]!);
    } catch (error) {
      clearDirections();
      logger.error("Error while setting route:", error);
    }
  };

  const removeDirections = (): void => {
    clearDirections();
    releaseControl();
  };
  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    stopMapWatch();
    if (ownedMap) {
      ownedMap.off("pg:appearance", updateAppearance);
      ownedMap.off("style.load", restoreDisplayedRoute);
      ownedMap.off("idle", restoreOnIdle);
    }
    removeDirections();
    ownedMap = null;
  };
  if (getCurrentScope()) onScopeDispose(cleanup);

  return {
    routeCoordinates: readonly(routeCoordinates),
    routeLegStarts: readonly(routeLegStarts),
    directions: readonly(directions),
    isDirectionsReady: readonly(isDirectionsReady),
    initializeDirections,
    clearDirections,
    removeDirections,
    cleanup,
    getDirections: (): MapboxDirections | null => directions.value,
    isInitialized: (): boolean => directions.value !== null,
    setRoute,
    addRouteToMap,
  };
}
