export function createPositionMarker(
  kind: "gps" | "simulation",
  label: string,
) {
  const element = document.createElement("div");
  element.className = `pg-position-marker pg-position-marker--${kind}`;
  element.role = "img";
  element.ariaLabel = label;
  element.title = label;
  element.innerHTML =
    kind === "gps"
      ? '<span class="pg-position-marker__dot" aria-hidden="true"></span>'
      : '<span class="pg-position-marker__walker" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="2" fill="currentColor" stroke="none"/><path d="m7 21 3-7 3 3v4M10 14l2-7 3 4h3M12 7 8 10v3"/></svg></span>';
  return element;
}
