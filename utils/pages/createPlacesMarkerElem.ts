export default () => {
  const el = document.createElement("div");

  el.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="-0.5 0 25 25" fill="none">
        <path d="M12 12a4 4 0 1 0 0-9 4 4 0 0 0 0 9ZM12 14v8" stroke="currentColor" stroke-miterlimit="10" stroke-linecap="round"/>
      </svg>
    `;

  el.classList.add(
    "rounded-full",
    "w-16",
    "h-16",
    "flex",
    "items-center",
    "justify-center",
    "text-green-600",
  );

  return el;
};
