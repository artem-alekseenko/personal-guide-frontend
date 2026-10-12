import { expect, it } from "vitest";
import {
  createHighlightedText,
  formatTextWithParagraphs,
} from "../app/utils/textUtils";

it("renders untrusted narration as text while preserving paragraphs", () => {
  expect(
    formatTextWithParagraphs('<img src=x onerror="alert(1)"> & text\n\nNext'),
  ).toBe(
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; text</p><p>Next",
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
