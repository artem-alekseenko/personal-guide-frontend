export default (title = "", number?: number) => {
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
  // Opening a place should not reposition the simulated walker underneath it.
  el.addEventListener("click", (event) => event.stopPropagation());
  return el;
};
