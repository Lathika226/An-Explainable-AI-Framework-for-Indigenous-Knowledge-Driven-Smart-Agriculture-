/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        agri: {
          50: "#f4f8f2",
          100: "#e5efdf",
          500: "#4c8b5b",
          600: "#397047",
          700: "#285943"
        },
        earth: "#8b6f47"
      }
    }
  },
  plugins: []
};
