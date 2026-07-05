import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./context/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#132A3A", // deep slate-blue, primary
          50: "#EEF3F6",
          100: "#D7E2E9",
          200: "#AFC5D3",
          300: "#87A8BD",
          400: "#5F8BA7",
          500: "#3A6E8F",
          600: "#255771",
          700: "#1A4258",
          800: "#132A3A", // primary
          900: "#0B1B26",
        },
        amber: {
          DEFAULT: "#F2A93B", // energetic accent for CTAs
          50: "#FEF6E9",
          100: "#FCE9C6",
          200: "#F9D89A",
          300: "#F6C76D",
          400: "#F4B854",
          500: "#F2A93B",
          600: "#D98E1F",
          700: "#B0721A",
        },
        moss: {
          DEFAULT: "#2E7D5B", // success / "Hot" green not used, kept for stat accents
        },
      },
      fontFamily: {
        display: ["var(--font-poppins)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 10px rgba(19, 42, 58, 0.06), 0 1px 2px rgba(19, 42, 58, 0.08)",
        cardHover: "0 8px 24px rgba(19, 42, 58, 0.12)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        "slide-up": {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "toast-in": {
          "0%": { transform: "translateY(-16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.35s ease-out",
        "toast-in": "toast-in 0.3s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
