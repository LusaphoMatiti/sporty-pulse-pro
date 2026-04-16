/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sp: {
          bg: "var(--sp-bg)",
          surface: "var(--sp-surface)",
          surface2: "var(--sp-surface2)",
          accent: "var(--sp-accent)",
          "accent-dim": "var(--sp-accent-dim)",
          muted: "var(--sp-muted)",
          muted2: "var(--sp-muted2)",
          text: "var(--sp-text)",
          border: "var(--sp-border)",
        },
      },
      fontFamily: {
        barlow: ["var(--font-barlow)", "sans-serif"],
        dm: ["var(--font-dm)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
