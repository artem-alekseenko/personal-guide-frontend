export interface PlaceHighlight {
  highlighted: boolean;
  label: string;
}
export function setPlaceMarkerHighlight(
  element: HTMLElement,
  name: string,
  highlight: PlaceHighlight,
) {
  element.classList.toggle("pg-place-marker--discussed", highlight.highlighted);
  element.ariaLabel = highlight.highlighted
    ? `${highlight.label}: ${name}`
    : name;
  element.title = element.ariaLabel;
  const label = element.querySelector<HTMLElement>(".pg-place-marker__label");
  if (label) label.textContent = name;
}
export default (title = "", number?: number, highlight?: PlaceHighlight) => {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `pg-place-marker${number ? " pg-place-marker--stop" : ""}`;
  el.title = title;
  el.ariaLabel = title;
  const badge = document.createElement("span");
  badge.className = "pg-place-marker__badge";
  badge.ariaHidden = "true";
  badge.textContent = number ? String(number) : "✦";
  el.appendChild(badge);
  const label = document.createElement("span");
  label.className = "pg-place-marker__label";
  label.ariaHidden = "true";
  label.textContent = title;
  el.appendChild(label);
  if (highlight) setPlaceMarkerHighlight(el, title, highlight);
  // Opening a place should not reposition the simulated walker underneath it.
  el.addEventListener("click", (event) => event.stopPropagation());
  return el;
};
