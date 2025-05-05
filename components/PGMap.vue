<template>
  <!-- <PGMap> -->
  <div ref="mapContainerRef" class="h-[60vh] w-full"></div>
  <!-- </PGMap> -->
</template>

<script lang="ts" setup>
import mapboxgl from "mapbox-gl";
import { onMounted, watch } from "#imports";
import MapboxDirections from "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions";
import createHighPlacesMarkerElem from "~/utils/pages/createHighPlacesMarkerElem";

const MAP_PITCH = 45;
const WAYPOINTS_MAX_COUNT = 25;
const { map_config } = useAppConfig();
const mabboxglAccessToken = unref(map_config.mapbox_gl_access_token);
mapboxgl.accessToken = mabboxglAccessToken;

useHead({
  link: [
    {
      rel: "stylesheet",
      href: "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css",
      type: "text/css",
    },
    {
      rel: "stylesheet",
      href: "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-directions/v4.3.1/mapbox-gl-directions.css",
      type: "text/css",
    },
  ],
});

const routeStore = useRouteStore();

const selectedInitialArea = defineModel("selectedArea", {});

const mapContainerRef = ref(null);
let mapInstance: mapboxgl.Map | null = null;
let directions: MapboxDirections | null = null;
let marker: mapboxgl.Marker | null = null;

const addMarker = (lat: number, lng: number) => {
  if (!mapInstance) {
    return;
  }
  marker?.remove();
  const coordinates: [number, number] = [lng, lat];

  marker = new mapboxgl.Marker().setLngLat(coordinates).addTo(mapInstance);
};

const selectPoint = (e: mapboxgl.MapMouseEvent) => {
  selectedInitialArea.value = { lng: e.lngLat.lng, lat: e.lngLat.lat };
  addMarker(e.lngLat.lat, e.lngLat.lng);
};

const initializeMap = () => {
  if (!mapContainerRef.value) return;

  const { lng, lat, zoom, bearing, pitch } = {
    lng: -79.3832,
    lat: 43.6532,
    bearing: 0,
    pitch: MAP_PITCH,
    zoom: 16,
  };

  mapInstance = new mapboxgl.Map({
    container: mapContainerRef.value,
    center: [lng, lat],
    style: {
      version: 8,
      sources: {},
      imports: [
        {
          id: "basemap",
          url: "mapbox://styles/mapbox/standard",
        },
      ],
      layers: [],
    },
    zoom,
    bearing,
    pitch,
  });

  mapInstance.addControl(
    new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: true,
      showUserHeading: true,
    }),
  );

  mapInstance.on("style.load", () => {
    if (!mapInstance) {
      return;
    }
    mapInstance.setConfigProperty("basemap", "showRoadLabels", false);
    mapInstance.setConfigProperty("basemap", "showTransitLabels", false);
    mapInstance.setConfigProperty("basemap", "theme", "faded");
    mapInstance.setConfigProperty(
      "basemap",
      "showPointOfInterestLabels",
      false,
    );
    mapInstance.setConfigProperty("basemap", "showTransitLabels", false);
  });

  mapInstance.on("click", selectPoint);
};

const initializeDirections = () => {
  if (!mapInstance) {
    return;
  }

  directions = new MapboxDirections({
    accessToken: mabboxglAccessToken,
    unit: "metric",
    profile: "mapbox/walking",
    controls: {
      inputs: false,
      instructions: false,
      profileSwitcher: false,
    },
  });

  if (!directions) {
    return;
  }

  mapInstance.addControl(directions, "top-left");
};

const decreaseWaypoints = (
  coordinates: [number, number][],
): [number, number][] => {
  return coordinates.slice(0, WAYPOINTS_MAX_COUNT);
};

const addHighPlacesToMap = () => {
  if (!mapInstance) return;

  const highPlaces = routeStore.routeSuggestion?.high_places;

  if (!highPlaces) return;

  const geojson = {
    type: "FeatureCollection",
    features: highPlaces.map((place) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [Number(place.point.lng), Number(place.point.lat)],
      },
      properties: {
        title: place.name,
      },
    })),
  };

  geojson.features.forEach((marker) => {
    const el = createHighPlacesMarkerElem(marker.properties.title);

    new mapboxgl.Marker(el)
      .setLngLat(marker.geometry.coordinates as [number, number])
      .addTo(mapInstance!);
  });
};

const addWaypointMarkers = (coordinates: [number, number][]) => {
  if (!mapInstance) {
    return;
  }
  const geojson = {
    type: "FeatureCollection",
    features: coordinates.map((coordinate) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [coordinate[0], coordinate[1]],
      },
    })),
  };

  for (const [index, feature] of geojson.features.entries()) {
    const el = document.createElement("div");
    el.className = "waypoint-marker";
    el.innerHTML = `<span><b>${index + 1}</b></span>`;

    new mapboxgl.Marker(el)
      .setLngLat(feature.geometry.coordinates as [number, number])
      .addTo(mapInstance);
  }
};

watch(
  () => routeStore.routeSuggestion?.coordinates,
  async (newCoords) => {
    if (!newCoords?.length || !mapInstance) return;

    await initializeDirections();

    const trimmedCoordinates = decreaseWaypoints(newCoords);

    const start = trimmedCoordinates[0];
    const finish = trimmedCoordinates.at(-1);
    const waypoints = trimmedCoordinates.slice(1, -1);

    if (
      !finish ||
      !start ||
      !start[0] ||
      !start[1] ||
      !finish[0] ||
      !finish[1] ||
      !directions
    ) {
      return;
    }

    directions.setOrigin([start[0], start[1]]);

    waypoints.map((waypoint: [number, number], index: number) => {
      directions!.addWaypoint(index, waypoint);
    });

    directions.setDestination([finish[0], finish[1]]);

    directions.interactive(false);

    mapInstance.setPitch(MAP_PITCH);

    // addWaypointMarkers(waypoints);

    mapInstance.off("click", selectPoint);
  },
);

watch(
  () => routeStore.routeSuggestion?.high_places,
  (newHighPlaces) => {
    if (!newHighPlaces || !mapInstance) return;

    addHighPlacesToMap();
  },
);

onMounted(() => {
  initializeMap();
});
</script>

<style>
.waypoint-marker {
  background-color: oklch(0.8 0.1 19);
  border-radius: 50%;
  width: 2rem;
  height: 2rem;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
