import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#020205",
        hud: {
          cyan: "#7ee8ff",
          amber: "#ffc14d",
          lime: "#9dff7a",
          rose: "#ff6b8a",
          panel: "rgba(8, 14, 28, 0.82)",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular"],
      },
      boxShadow: {
        hud: "0 0 24px rgba(126, 232, 255, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
