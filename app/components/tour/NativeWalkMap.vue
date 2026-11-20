<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from "vue";
import mapboxgl from "mapbox-gl";
import { createPositionMarker } from "~/utils/positionMarker";
import BaseMap from "~/components/base/BaseMap.vue";
import {
  clearStoredRoute,
  renderStoredRoute,
  updateStoredRouteAppearance,
} from "~/utils/storedRoute";
import type { WalkingRoutePlan, WalkPoint } from "#shared/types/nativeWalk";
const props = defineProps<{
  plan?: WalkingRoutePlan | null;
  origin?: WalkPoint | null;
  selectable?: boolean;
  simulation?: boolean;
  simulationPoint?: WalkPoint | null;
}>();
const emit = defineEmits<{
  select: [point: WalkPoint];
  move: [point: WalkPoint];
}>();
const map = shallowRef<mapboxgl.Map | null>(null);
const colorMode = useColorMode();
const { t } = useI18n();
const coordinates = computed<[number, number][]>(
  () =>
    props.plan?.geometry.map(
      (point) => [point.lng, point.lat] as [number, number],
    ) ?? [],
);
let marker: mapboxgl.Marker | null = null;
let simulatedMarker: mapboxgl.Marker | null = null;
let fittedPlan = "";
function drawPosition() {
  if (!map.value) return;
  const point = props.simulationPoint;
  if (!props.simulation || !point) {
    simulatedMarker?.remove();
    simulatedMarker = null;
    return;
  }
  if (!simulatedMarker) {
    simulatedMarker = new mapboxgl.Marker({
      draggable: true,
      element: createPositionMarker(
        "simulation",
        t("components.tourPage.geolocationSimulation"),
      ),
    })
      .setLngLat([point.lng, point.lat])
      .addTo(map.value);
    simulatedMarker.on("dragend", () => {
      const value = simulatedMarker?.getLngLat();
      if (value && props.simulation)
        emit("move", { lat: value.lat, lng: value.lng });
    });
  } else simulatedMarker.setLngLat([point.lng, point.lat]);
}
function draw() {
  if (!map.value?.isStyleLoaded()) return;
  if (props.plan) {
    const identity = `${props.plan.id}:${props.plan.revision}`;
    renderStoredRoute(
      map.value,
      coordinates.value,
      identity !== fittedPlan,
      props.plan.leg_starts,
    );
    fittedPlan = identity;
  } else clearStoredRoute(map.value);
  marker?.remove();
  marker = null;
  if (props.origin)
    marker = new mapboxgl.Marker()
      .setLngLat([props.origin.lng, props.origin.lat])
      .addTo(map.value);
}
function initialize(instance: mapboxgl.Map) {
  map.value = instance;
  instance.on("load", draw);
  instance.on("style.load", draw);
  draw();
  drawPosition();
}
function select(event: mapboxgl.MapMouseEvent) {
  const point = { lat: event.lngLat.lat, lng: event.lngLat.lng };
  if (props.selectable) emit("select", point);
  else if (props.simulation) emit("move", point);
}
watch([() => props.simulation, () => props.simulationPoint], drawPosition);
watch([() => props.plan, () => props.origin], draw);
watch(
  () => colorMode.value,
  () => {
    if (map.value?.isStyleLoaded()) updateStoredRouteAppearance(map.value);
  },
);
onBeforeUnmount(() => {
  simulatedMarker?.remove();
  marker?.remove();
  if (map.value) {
    map.value.off("load", draw);
    map.value.off("style.load", draw);
    clearStoredRoute(map.value);
  }
});
</script>
<template>
  <ClientOnly>
    <BaseMap
      :show-user-location="!selectable && !simulation"
      :initial-pitch="0"
      :route-coordinates="coordinates"
      :initial-center="origin ? [origin.lng, origin.lat] : undefined"
      :on-map-click="select"
      @map-initialized="initialize"
    />
  </ClientOnly>
</template>
