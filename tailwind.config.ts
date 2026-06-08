import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          50: "#effaf3",
          100: "#d9f1e2",
          600: "#16794b",
          800: "#0d4f37",
          950: "#06251e"
        },
        cup: {
          gold: "#d6a647",
          red: "#d83535",
          ink: "#10212b",
          sky: "#dbeafe"
        }
      },
      boxShadow: {
        lift: "0 14px 36px rgba(10, 25, 38, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
