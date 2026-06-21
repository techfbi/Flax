import type { Config } from "tailwindcss";

const config: Config = {
  // Dark mode via class on <html>. we control it, not just the OS.
  darkMode: "class",

  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],

  theme: {
    extend: {
      colors: {
        // Exact tokens from your Figma variables. never use raw hex elsewhere in the codebase.
        pawpaw:        "#E8623C",
        moringa:       "#2F5D4B",
        "moringa-faded": "#7FB096",
        cocoa:         "#1C1A17",
        "off-white":   "#F6F1E7",
        "accent-yellow": "#FFCC00",

        // Semantic aliases so components don't need to know token names
        primary:       "#E8623C",
        "primary-dark": "#cf5232",
        secondary:     "#2F5D4B",
        "secondary-light": "#7FB096",
      },

      fontFamily: {
        // Montserrat for all headlines and display text
        display: ["Montserrat", "sans-serif"],
        // Inter for all body, labels, buttons, data
        body:    ["Inter", "sans-serif"],
      },

      borderRadius: {
        // Button radius from Figma
        btn:  "19px",
        // Card radius from Figma
        card: "26px",
      },

      boxShadow: {
        // Button shadow from Figma
        btn: "4px 6px 6.8px rgba(0,0,0,0.25)",
        card: "0 4px 24px rgba(0,0,0,0.08)",
      },

      backgroundImage: {
        // Landing page gradient from Figma
        "brand-gradient": "linear-gradient(160deg, #F6F1E7 0%, #2F5D4B 100%)",
        "brand-gradient-dark": "linear-gradient(160deg, #1C1A17 0%, #0e2b21 100%)",
      },
    },
  },

  plugins: [],
};

export default config;