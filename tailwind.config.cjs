const colors = require("tailwindcss/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Inter", "ui-sans-serif", "system-ui"],
      },
      colors: {
        brand: {
          DEFAULT: "#22c55e",
          subtle: "#14532d",
        },
        slate: colors.slate,
      },
      boxShadow: {
        glow: "0 0 40px -20px rgba(34,197,94,0.75)",
      },
    },
  },
  plugins: [],
};
