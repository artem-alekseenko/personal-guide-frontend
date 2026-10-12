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
  const number = element.classList.contains("pg-place-marker--stop")
    ? element.querySelector<HTMLElement>(".pg-place-marker__badge")?.textContent
    : null;
  const accessibleName = number ? `${number}. ${name}` : name;
  element.ariaLabel = highlight.highlighted
    ? `${highlight.label}: ${accessibleName}`
    : accessibleName;
  element.title = element.ariaLabel;
  const label = element.querySelector<HTMLElement>(".pg-place-marker__label");
  if (label) label.textContent = name;
}
export default (title = "", number?: number, highlight?: PlaceHighlight) => {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `pg-place-marker${number ? " pg-place-marker--stop" : ""}`;
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
  setPlaceMarkerHighlight(
    el,
    title,
    highlight ?? { highlighted: false, label: "" },
  );
  // Opening a place should not reposition the simulated walker underneath it.
  el.addEventListener("click", (event) => event.stopPropagation());
  return el;
};
