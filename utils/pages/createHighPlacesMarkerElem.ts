export default (title: string) => {
  const el = document.createElement("div");

  el.innerHTML = `
    <div class="flex flex-col items-center justify-center px-2 pt-2 rounded-xl bg-gradient-to-b from-neutral-200 to-transparent text-green-600">
      <p class="line-clamp-2 font-bold">${title}</p>
      <svg class="w-16 h-16" xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 48 48">
          <path class="fill-current" d="M24 6c7.4 0 13 6 13 14s-8.6 16.7-13 21.2C19.6 36.7 11 27.5 11 20S16.6 6 24 6m0-4C14.1 2 7 10.1 7 20s11.5 21.3 15.6 25.4a1.9 1.9 0 0 0 2.8 0C29.5 41.3 41 30.1 41 20S33.9 2 24 2Z"/>
          <path class="fill-yellow-500"  fill="gold" d="m29.1 16.9-2.9-.4-1.3-2.9a1 1 0 0 0-1.8 0l-1.3 2.9-2.9.4a1.1 1.1 0 0 0-.6 1.8l2.1 2-.5 3.1a1.1 1.1 0 0 0 1.5 1.1L24 23l2.6 1.9a1.1 1.1 0 0 0 1.5-1.1l-.5-3.1 2.1-2a1.1 1.1 0 0 0-.6-1.8Z"/>
      </svg>
    </div>
  `;

  return el;
};
