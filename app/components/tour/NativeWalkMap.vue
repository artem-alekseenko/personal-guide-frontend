<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from "vue";
import mapboxgl from "mapbox-gl";
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
}>();
const emit = defineEmits<{ select: [point: WalkPoint] }>();
const map = shallowRef<mapboxgl.Map | null>(null);
const colorMode = useColorMode();
const coordinates = computed<[number, number][]>(
  () =>
    props.plan?.geometry.map(
      (point) => [point.lng, point.lat] as [number, number],
    ) ?? [],
);
let marker: mapboxgl.Marker | null = null;
let fittedPlan = "";
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
}
function select(event: mapboxgl.MapMouseEvent) {
  if (props.selectable)
    emit("select", { lat: event.lngLat.lat, lng: event.lngLat.lng });
}
watch([() => props.plan, () => props.origin], draw);
watch(
  () => colorMode.value,
  () => {
    if (map.value?.isStyleLoaded()) updateStoredRouteAppearance(map.value);
  },
);
onBeforeUnmount(() => {
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
      :show-user-location="!selectable"
      :initial-pitch="0"
      :route-coordinates="coordinates"
      :initial-center="origin ? [origin.lng, origin.lat] : undefined"
      :on-map-click="select"
      @map-initialized="initialize"
    />
  </ClientOnly>
</template>
