import { beforeEach, expect, it, vi } from "vitest";
import createPlacesMarkerElem from "../app/utils/pages/createPlacesMarkerElem";

class Element {
  className = "";
  textContent = "";
  ariaLabel = "";
  title = "";
  children: Element[] = [];
  listeners: Record<string, Function> = {};
  classList = {
    contains: (name: string) => this.className.split(" ").includes(name),
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
  }
  addEventListener(name: string, callback: Function) {
    this.listeners[name] = callback;
  }
  querySelector(selector: string): Element | null {
    return (
      this.children.find((c) => c.classList.contains(selector.slice(1))) ?? null
    );
  }
}
const fixtures = vi.hoisted(() => ({ markers: [] as any[] }));
vi.mock("mapbox-gl", () => ({
  default: {
    Marker: class {
      element: Element;
      position: number[] = [];
      popup: any;
      removed = false;
      constructor(element: Element) {
        this.element = element;
        fixtures.markers.push(this);
      }
      setLngLat(point: number[]) {
        this.position = point;
        return this;
      }
      setPopup(popup: any) {
        this.popup = popup;
        return this;
      }
      addTo() {
        return this;
      }
      remove() {
        this.removed = true;
      }
    },
    Popup: class {
      html = "";
      setHTML(html: string) {
        this.html = html;
        return this;
      }
    },
  },
}));
beforeEach(() => {
  fixtures.markers.length = 0;
  Object.assign(globalThis, {
    document: { createElement: (tag: string) => new Element(tag) },
  });
});

it("gives discussed objects a visible safe name and accessible status without moving the walker on click", () => {
  const title = '<img src=x onerror="alert(1)">';
  const element = createPlacesMarkerElem(title, 2, {
    highlighted: true,
    label: "Guide is discussing",
  }) as unknown as Element;
  expect(element.classList.contains("pg-place-marker--discussed")).toBe(true);
  expect(element.ariaLabel).toBe(`Guide is discussing: ${title}`);
  expect(element.querySelector(".pg-place-marker__label")?.textContent).toBe(
    title,
  );
  expect(element.querySelector(".pg-place-marker__label")).not.toHaveProperty(
    "innerHTML",
  );
  let stopped = false;
  element.listeners.click({
    stopPropagation: () => {
      stopped = true;
    },
  });
  expect(stopped).toBe(true);
});

it("changes the highlighted stop in place and removes stale off-route objects", async () => {
  const { createGuideMapMarkers } =
    await import("../app/utils/guideMapMarkers");
  const stops = [
    { name: "Museum", lat: "47", lng: "19" },
    { name: "Square", lat: "47.001", lng: "19.001" },
  ];
  const controller = createGuideMapMarkers();
  const map = {} as any;
  controller.update(
    map,
    stops,
    [
      { name: "Museum", coordinates: [19, 47], stopPosition: 1 },
      { name: "Statue", coordinates: [19.002, 47.002], stopPosition: null },
    ],
    "Guide is discussing",
  );
  const museum = fixtures.markers[0],
    square = fixtures.markers[1],
    statue = fixtures.markers[2];
  expect(museum.element.classList.contains("pg-place-marker--discussed")).toBe(
    true,
  );
  expect(square.element.classList.contains("pg-place-marker--discussed")).toBe(
    false,
  );
  controller.update(
    map,
    stops,
    [{ name: "Square", coordinates: [19.001, 47.001], stopPosition: 2 }],
    "Guide is discussing",
  );
  expect(fixtures.markers).toHaveLength(3);
  expect(museum.removed).toBe(false);
  expect(museum.element.classList.contains("pg-place-marker--discussed")).toBe(
    false,
  );
  expect(square.element.classList.contains("pg-place-marker--discussed")).toBe(
    true,
  );
  expect(square.element.ariaLabel).toBe("Guide is discussing: Square");
  expect(statue.removed).toBe(true);
  controller.clear();
  expect(museum.removed).toBe(true);
  expect(square.removed).toBe(true);
});

it("cleans up when the map changes and escapes untrusted popup names", async () => {
  const { createGuideMapMarkers } =
    await import("../app/utils/guideMapMarkers");
  const controller = createGuideMapMarkers();
  const objects = [
    {
      name: "<script>unsafe</script>",
      coordinates: [19, 47] as [number, number],
      stopPosition: null,
    },
  ];
  controller.update({} as any, [], objects, "Discussing");
  expect(fixtures.markers[0].popup.html).toContain("&lt;script&gt;");
  expect(fixtures.markers[0].popup.html).not.toContain("<script>");
  controller.update({} as any, [], objects, "Discussing");
  expect(fixtures.markers[0].removed).toBe(true);
  expect(fixtures.markers).toHaveLength(2);
  controller.update(null, [], [], "Discussing");
  expect(fixtures.markers[1].removed).toBe(true);
});
