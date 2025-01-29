import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: [],
  theme: {
    extend: {},
    fill: (theme) => theme("colors"),
  },
  plugins: [typography],
};
