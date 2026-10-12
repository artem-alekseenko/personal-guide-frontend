import type { Map } from "mapbox-gl";

export type MapTheme = "light" | "dark";

export const MAP_APPEARANCES = {
  light: {
    surface: "#fffdf8",
    text: "#26342f",
    muted: "#59665f",
    border: "#d9dfd4",
    route: "#245ec7",
    routeOutline: "#fffdf8",
    stop: "#24704d",
    gps: "#245ec7",
    simulation: "#7040ae",
    discussed: "#a85812",
    halo: "#e9b86066",
    land: "#f4f1e9",
    water: "#b8d7df",
    greenspace: "#d8e4cb",
    buildings: "#ddd7ca",
    roads: "#ffffff",
    roadLabels: "#566259",
    placeLabels: "#35483e",
    shadow: "#1b33291f",
  },
  dark: {
    surface: "#202b2a",
    text: "#f2f3e9",
    muted: "#c0ccc3",
    border: "#45534c",
    route: "#84b5ff",
    routeOutline: "#182322",
    stop: "#72d4a3",
    gps: "#84b5ff",
    simulation: "#c5a2ff",
    discussed: "#f2bf70",
    halo: "#f2bf7040",
    land: "#1c2827",
    water: "#24464f",
    greenspace: "#304339",
    buildings: "#3b4540",
    roads: "#54625a",
    roadLabels: "#d1d8cd",
    placeLabels: "#edf0de",
    shadow: "#00000055",
  },
} as const;

export const MAP_APPEARANCE_VARS = Object.fromEntries(
  Object.entries(MAP_APPEARANCES).map(([theme, palette]) => [
    theme,
    Object.fromEntries(
      Object.entries(palette).map(([key, value]) => [
        `--pg-map-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
        value,
      ]),
    ),
  ]),
) as Record<MapTheme, Record<string, string>>;

/** Mapbox paint cannot resolve CSS variables; use the same concrete palette. */
export function getMapAppearance(map: Pick<Map, "getContainer">) {
  return MAP_APPEARANCES[
    map.getContainer().dataset.pgMapTheme === "dark" ? "dark" : "light"
  ];
}

export function standardMapConfig(theme: MapTheme, explore3d: boolean) {
  const palette = MAP_APPEARANCES[theme];
  return {
    theme: "faded",
    lightPreset: theme === "dark" ? "night" : "day",
    font: "Inter",
    showRoadLabels: true,
    showPlaceLabels: true,
    showPointOfInterestLabels: false,
    showTransitLabels: false,
    showPedestrianRoads: true,
    showHdRoads: false,
    show3dObjects: explore3d,
    show3dBuildings: explore3d,
    show3dLandmarks: explore3d,
    show3dTrees: false,
    show3dFacades: false,
    colorLand: palette.land,
    colorWater: palette.water,
    colorGreenspace: palette.greenspace,
    colorBuildings: palette.buildings,
    colorRoads: palette.roads,
    colorMotorways: palette.roads,
    colorTrunks: palette.roads,
    colorRoadLabels: palette.roadLabels,
    colorPlaceLabels: palette.placeLabels,
  };
}
