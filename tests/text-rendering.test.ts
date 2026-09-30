import { expect, it, vi } from "vitest";
import {
  createHighlightedText,
  formatTextWithParagraphs,
} from "../app/utils/textUtils";
import createHighPlacesMarkerElem from "../app/utils/pages/createHighPlacesMarkerElem";
import { addMarkerElemToMap } from "../app/utils/mapMarkers";
const emitted = vi.hoisted(() => ({ popup: "" }));
vi.mock("mapbox-gl", () => ({
  default: {
    Popup: class {
      setHTML(html: string) {
        emitted.popup = html;
        return this;
      }
    },
    Marker: class {
      setLngLat() {
        return this;
      }
      setPopup() {
        return this;
      }
      addTo() {
        return this;
      }
    },
  },
}));

it("renders untrusted narration as text while preserving paragraphs", () => {
  expect(
    formatTextWithParagraphs('<img src=x onerror="alert(1)"> & text\n\nNext'),
  ).toBe(
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; text</p><p>Next",
  );
});
it("escapes provider titles in map labels and popups", () => {
  Object.assign(globalThis, {
    document: { createElement: () => ({ innerHTML: "" }) },
  });
  const label = createHighPlacesMarkerElem('<img src=x onerror="alert(1)">');
  expect(label.innerHTML).not.toContain("<img");
  expect(label.innerHTML).toContain("&lt;img");
  addMarkerElemToMap(
    {} as any,
    {} as any,
    {
      geometry: { coordinates: [19, 47] },
      properties: { title: '<img src=x onerror="alert(1)">' },
    } as any,
  );
  expect(emitted.popup).toBe(
    "<h3>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</h3>",
  );
});
it("highlights plain sentences before escaping and keeps trailing text", () => {
  const html = createHighlightedText(
    "First.\n\nLook at <b>this</b>. Unfinished",
    "Look at <b>this</b>.",
  );
  expect(html).toBe(
    '<p>First.</p><p><span class="bg-yellow-200 active-sentence">Look at &lt;b&gt;this&lt;/b&gt;.</span> Unfinished</p>',
  );
  expect(html).not.toContain("<b>");
});
