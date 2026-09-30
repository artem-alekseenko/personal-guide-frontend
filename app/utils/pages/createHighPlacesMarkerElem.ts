import { escapeHtml } from "../safeText";
export default (title: string) => {
  const el = document.createElement("div");
  el.className = "pg-landmark-marker";
  el.role = "img";
  el.ariaLabel = title;
  el.title = title;
  el.innerHTML = `<span class="pg-landmark-marker__label">${escapeHtml(title)}</span><span class="pg-place-marker__badge" aria-hidden="true">✦</span>`;

  return el;
};
