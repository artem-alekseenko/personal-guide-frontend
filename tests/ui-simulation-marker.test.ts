import { expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { useSimulationMarker } from "../app/composables/map/useSimulationMarker";
import { usePositionMode } from "../app/composables/map/usePositionMode";
const markers = vi.hoisted(() => [] as any[]);
vi.mock("mapbox-gl", () => ({
  default: {
    Marker: class {
      position: [number, number] = [0, 0];
      events: Record<string, () => void> = {};
      removed = false;
      constructor(public options: any) {
        markers.push(this);
      }
      setLngLat(point: [number, number]) {
        this.position = point;
        return this;
      }
      getLngLat() {
        return { lng: this.position[0], lat: this.position[1] };
      }
      addTo() {
        return this;
      }
      on(event: string, callback: () => void) {
        this.events[event] = callback;
        return this;
      }
      remove() {
        this.removed = true;
      }
    },
  },
}));
it("updates the same walker without firing drag callbacks and detaches map listeners on cleanup", () => {
  markers.length = 0;
  Object.assign(globalThis, { document: { createElement: () => ({}) } });
  const scope = effectScope();
  const marker = scope.run(() =>
    useSimulationMarker({ label: "Simulated walker" }),
  )!;
  const events: Record<string, Function> = {};
  const map = {
    on: (name: string, callback: Function) => {
      events[name] = callback;
    },
    off: (name: string) => {
      delete events[name];
    },
  };
  marker.initialize(map as any);
  marker.setupMapClickHandler(map as any);
  let interrupted = 0,
    dragged = 0,
    gestures = 0;
  marker.setMoveStartCallback(() => interrupted++);
  marker.setDragEndCallback(() => dragged++);
  marker.setMapGestureCallback(() => gestures++);
  marker.addSimulationMarker([19, 47]);
  marker.addSimulationMarker([19.001, 47.001]);
  expect(markers).toHaveLength(1);
  expect(marker.getMarkerPosition()).toEqual([19.001, 47.001]);
  expect(markers[0].options.element.ariaLabel).toBe("Simulated walker");
  expect(markers[0].options.element.className).toContain(
    "pg-position-marker--simulation",
  );
  expect(dragged).toBe(0);
  events.movestart({});
  expect(gestures).toBe(0);
  events.movestart({ originalEvent: {} });
  expect(gestures).toBe(1);
  markers[0].events.dragstart();
  expect(interrupted).toBe(1);
  scope.run(() => usePositionMode().setSimulationMode());
  events.click({ lngLat: { lng: 19.002, lat: 47.002 } });
  expect(interrupted).toBe(2);
  expect(marker.getMarkerPosition()).toEqual([19.002, 47.002]);
  marker.cleanup();
  expect(marker.getMarkerPosition()).toBeNull();
  expect(markers[0].removed).toBe(true);
  expect(events.click).toBeUndefined();
  expect(events.movestart).toBeUndefined();
  scope.stop();
});
