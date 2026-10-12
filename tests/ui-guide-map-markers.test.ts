import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { shallowRef } from "vue";
import type { Map as MapboxMap } from "mapbox-gl";
import createPlacesMarkerElem from "../app/utils/pages/createPlacesMarkerElem";
import { useMarkers } from "../app/composables/map/useMarkers";
import { createGuideMapMarkers } from "../app/utils/guideMapMarkers";
interface MarkerEvent {
  key: string;
  preventDefault: () => void;
  stopPropagation: () => void;
  stopImmediatePropagation: () => void;
}
interface PopupDouble {
  html: string;
  parent?: Element;
  element: Element;
  isOpen: () => boolean;
  open: () => void;
  remove: () => void;
}
interface MarkerDouble {
  element: Element;
  position: number[];
  popup: PopupDouble;
  removed: boolean;
}

class Element {
  className = "";
  textContent = "";
  ariaLabel = "";
  ariaExpanded = "";
  title = "";
  type = "";
  children: Element[] = [];
  parent?: Element;
  listeners: Record<
    string,
    { callback: (event: MarkerEvent) => void; capture: boolean }[]
  > = {};
  classList = {
    contains: (name: string) => this.className.split(" ").includes(name),
    add: (name: string) => this.classList.toggle(name, true),
    toggle: (name: string, enabled: boolean) => {
      this.className = this.className
        .split(" ")
        .filter((c) => c !== name)
        .concat(enabled ? [name] : [])
        .join(" ");
    },
  };
  constructor(public tag: string) {}
  appendChild(child: Element) {
    this.children.push(child);
    child.parent = this;
  }
  addEventListener(
    name: string,
    callback: (event: MarkerEvent) => void,
    capture = false,
  ) {
    const listeners = (this.listeners[name] ??= []);
    if (!listeners.some((listener) => listener.callback === callback)) {
      listeners.push({ callback, capture });
    }
  }
  querySelector(selector: string): Element | null {
    return (
      this.children.find((c) => c.classList.contains(selector.slice(1))) ?? null
    );
  }
  focus() {
    // The document test seam tracks focus without a browser DOM.
    const testDocument = document as unknown as {
      activeElement: Element | null;
    };
    testDocument.activeElement = this;
  }
  fire(name: string, key = "") {
    let stopped = false,
      immediate = false;
    const event = {
      key,
      preventDefault: vi.fn(),
      stopPropagation: () => {
        stopped = true;
      },
      stopImmediatePropagation: () => {
        immediate = stopped = true;
      },
    };
    for (const listener of [...(this.listeners[name] ?? [])].sort(
      (a, b) => Number(b.capture) - Number(a.capture),
    )) {
      listener.callback(event);
      if (immediate) break;
    }
    if (!stopped) this.parent?.fire(name, key);
    return event;
  }
}
const fixtures = vi.hoisted(() => ({ markers: [] as MarkerDouble[] }));
vi.mock("mapbox-gl", () => ({
  default: {
    Marker: class {
      position: number[] = [];
      popup!: PopupDouble;
      removed = false;
      constructor(public element: Element) {
        fixtures.markers.push(this);
      }
      setLngLat(point: number[]) {
        this.position = point;
        return this;
      }
      setPopup(popup: PopupDouble) {
        this.popup = popup;
        // GL JS also registers a legacy keypress activation on markers.
        this.element.addEventListener("keypress", (event) => {
          if (event.key === "Enter" || event.key === " ") this.togglePopup();
        });
        return this;
      }
      getPopup() {
        return this.popup;
      }
      togglePopup() {
        if (this.popup.isOpen()) this.popup.remove();
        else this.popup.open();
        return this;
      }
      addTo(map: { container: Element }) {
        this.element.parent = map.container;
        this.popup.parent = map.container;
        return this;
      }
      remove() {
        this.removed = true;
        this.popup?.remove();
      }
    },
    Popup: class {
      html = "";
      opened = false;
      parent?: Element;
      element = new Element("div");
      events: Record<string, (() => void)[]> = {};
      setHTML(html: string) {
        this.html = html;
        return this;
      }
      on(name: string, callback: () => void) {
        (this.events[name] ??= []).push(callback);
        return this;
      }
      isOpen() {
        return this.opened;
      }
      getElement() {
        return this.element;
      }
      open() {
        this.opened = true;
        this.element.parent = this.parent;
        this.events.open?.forEach((callback) => callback());
      }
      remove() {
        this.opened = false;
        this.events.close?.forEach((callback) => callback());
      }
    },
  },
}));
beforeEach(() => {
  fixtures.markers.length = 0;
  vi.stubGlobal("document", {
    createElement: (tag: string) => new Element(tag),
    activeElement: null,
  });
});
afterEach(() => vi.unstubAllGlobals());
const mapFixture = () => {
  const fixture = { container: new Element("div") };
  // Only marker attachment is exercised; GL JS itself is mocked.
  const map = fixture as unknown as MapboxMap & typeof fixture;
  return map;
};

it("keeps untrusted names as text and exposes both stop number and discussion status", () => {
  const title = '<img src=x onerror="alert(1)">' + "long name ".repeat(60);
  // The factory creates the document seam's button, not a browser HTMLElement.
  const element = createPlacesMarkerElem(title, 2, {
    highlighted: true,
    label: "Discussing",
  }) as unknown as Element;
  expect(element.tag).toBe("button");
  expect(element.type).toBe("button");
  expect(element.ariaLabel).toContain(title);
  expect(element.ariaLabel).toContain("2.");
  expect(element.ariaLabel).toContain("Discussing");
  expect(element.querySelector(".pg-place-marker__label")?.textContent).toBe(
    title,
  );
  expect(element.querySelector(".pg-place-marker__label")).not.toHaveProperty(
    "innerHTML",
  );
});

it("opens creation landmarks and numbered stops with pointer or keyboard without a simulation map click", () => {
  const map = mapFixture();
  const relocateSimulation = vi.fn();
  map.container.addEventListener("click", relocateSimulation);
  const markers = useMarkers(shallowRef(map));
  const title = "<script>unsafe</script>" + "title ".repeat(60);
  markers.addHighPlacesToMap([{ name: title, point: { lng: 19, lat: 47 } }]);
  markers.addWaypointMarkers([[19, 47]], [title]);
  const landmark = fixtures.markers[0]!;
  const stop = fixtures.markers[1]!;
  for (const marker of [landmark, stop]) {
    expect(marker.element.tag).toBe("button");
    expect(
      marker.element.querySelector(".pg-place-marker__label")?.textContent,
    ).toBe(title);
    expect(marker.popup.html).toContain("&lt;script&gt;");
    expect(marker.popup.html).not.toContain("<script>");
    marker.element.fire("click");
    expect(marker.popup.isOpen()).toBe(true);
    expect(marker.element.ariaExpanded).toBe("true");
    expect(marker.element.classList.contains("pg-place-marker--selected")).toBe(
      true,
    );
    marker.popup.element.fire("click");
    marker.element.fire("keydown", "Escape");
    expect(marker.popup.isOpen()).toBe(false);
    for (const key of ["Enter", " "]) {
      const event = marker.element.fire("keydown", key);
      expect(event.preventDefault).toHaveBeenCalledOnce();
      marker.element.fire("keypress", key);
      expect(marker.popup.isOpen()).toBe(true);
      marker.element.fire("keydown", "Escape");
    }
  }
  expect(relocateSimulation).not.toHaveBeenCalled();
  expect(stop.element.ariaLabel).toContain("1.");
  markers.clearAllMarkers();
  expect(landmark.removed).toBe(true);
  expect(stop.removed).toBe(true);
});

it("preserves focused stop elements and open popups across discussion, title and coordinate updates", () => {
  const controller = createGuideMapMarkers();
  const map = mapFixture();
  const stops = [
    { name: "Museum", lat: "47", lng: "19" },
    { name: "Square", lat: "47.001", lng: "19.001" },
  ];
  controller.update(
    map,
    stops,
    [
      { name: "Museum", coordinates: [19, 47], stopPosition: 1 },
      { name: "Statue", coordinates: [19.002, 47.002], stopPosition: null },
    ],
    "Discussing",
  );
  const museum = fixtures.markers[0]!;
  const square = fixtures.markers[1]!;
  const statue = fixtures.markers[2]!;
  museum.element.focus();
  museum.element.fire("click");
  controller.update(
    map,
    [{ ...stops[0]!, name: "<b>Renamed</b>", lat: "47.002" }, stops[1]!],
    [{ name: "Square", coordinates: [19.001, 47.001], stopPosition: 2 }],
    "Discussing",
  );
  expect(fixtures.markers).toHaveLength(3);
  expect(document.activeElement).toBe(museum.element);
  expect(museum.removed).toBe(false);
  expect(museum.position).toEqual([19, 47.002]);
  expect(museum.popup.isOpen()).toBe(true);
  expect(museum.popup.html).toContain("&lt;b&gt;Renamed&lt;/b&gt;");
  expect(
    museum.element.querySelector(".pg-place-marker__label")?.textContent,
  ).toBe("<b>Renamed</b>");
  expect(museum.element.classList.contains("pg-place-marker--discussed")).toBe(
    false,
  );
  expect(square.element.classList.contains("pg-place-marker--discussed")).toBe(
    true,
  );
  expect(square.element.ariaLabel).toContain("2.");
  expect(statue.removed).toBe(true);
  controller.clear();
  expect(museum.removed).toBe(true);
  expect(square.removed).toBe(true);
});

it("rejects invalid marker coordinates without renumbering subsequent stops and clears stale creation markers", () => {
  const markers = useMarkers(shallowRef(mapFixture()));
  markers.addWaypointMarkers(
    [
      [NaN, 47],
      [19, 91],
      [19, 47],
    ],
    ["Invalid", "Invalid", "Museum"],
  );
  const stop = fixtures.markers[0]!;
  expect(fixtures.markers).toHaveLength(1);
  expect(
    stop.element.querySelector(".pg-place-marker__badge")?.textContent,
  ).toBe("3");
  markers.addWaypointMarkers([]);
  expect(stop.removed).toBe(true);
  expect(
    markers.addHighPlacesToMap([
      { name: "Invalid", point: { lng: 181, lat: 47 } },
    ]),
  ).toEqual([]);
});

it("cleans up markers when the map changes or becomes unavailable", () => {
  const controller = createGuideMapMarkers();
  const objects = [
    {
      name: "Statue",
      coordinates: [19, 47] as [number, number],
      stopPosition: null,
    },
  ];
  controller.update(mapFixture(), [], objects, "Discussing");
  controller.update(mapFixture(), [], objects, "Discussing");
  expect(fixtures.markers[0]!.removed).toBe(true);
  expect(fixtures.markers).toHaveLength(2);
  controller.update(null, [], [], "Discussing");
  expect(fixtures.markers[1]!.removed).toBe(true);
});
it("keeps route-wide Google leads unnumbered and persistent when discussion changes", () => {
  const controller = createGuideMapMarkers();
  const map = mapFixture();
  const stops = [{ name: "Museum", lat: "47", lng: "19" }];
  const leads = [{ id: "public-school", source: "google" as const, source_id: "g-school", name: "Public school", lat: "47.01", lng: "19.01", types: ["school"], address: null, distance_to_route_meters: 5, along_route_meters: 500 }];
  controller.update(map, stops, [], "Discussing", leads, "Google map leads");
  const stop = fixtures.markers[0]!, lead = fixtures.markers[1]!;
  expect(stop.element.querySelector(".pg-place-marker__badge")?.textContent).toBe("1");
  expect(lead.element.querySelector(".pg-place-marker__badge")?.textContent).toBe("✦");
  expect(lead.element.ariaLabel).toBe("Google map leads: Public school");
  expect(lead.element.classList.contains("pg-place-marker--discussed")).toBe(false);
  controller.update(map, stops, [{ name: "Museum", coordinates: [19, 47], stopPosition: 1 }], "Discussing", leads, "Google map leads");
  expect(fixtures.markers).toHaveLength(2);
  expect(lead.removed).toBe(false);
  expect(lead.element.classList.contains("pg-place-marker--discussed")).toBe(false);
  controller.clear();
  expect(lead.removed).toBe(true);
});
