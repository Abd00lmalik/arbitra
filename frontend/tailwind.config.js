/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#020714",
          900: "#0A0F1C",
          800: "#0D1526",
          700: "#111E35",
          600: "#162440",
        },
        neon: {
          cyan: "#00F0FF",
          purple: "#7B2FFF",
          green: "#00FF88",
          pink: "#FF2D9B",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "glass-card":
          "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
        "neon-gradient": "linear-gradient(135deg, #00F0FF 0%, #7B2FFF 100%)",
        "neon-glow":
          "radial-gradient(ellipse at center, rgba(0,240,255,0.15) 0%, transparent 70%)",
        "hero-mesh":
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(123,47,255,0.25) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 50%, rgba(0,240,255,0.15) 0%, transparent 60%)",
      },
      backdropBlur: { glass: "12px" },
      boxShadow: {
        glass:
          "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
        "neon-cyan":
          "0 0 20px rgba(0,240,255,0.4), 0 0 60px rgba(0,240,255,0.15)",
        "neon-purple":
          "0 0 20px rgba(123,47,255,0.4), 0 0 60px rgba(123,47,255,0.15)",
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "scan-line": "scan-line 3s linear infinite",
        float: "float 6s ease-in-out infinite",
        "fade-in": "fade-in 0.6s ease-out forwards",
        "slide-up": "slide-up 0.5s ease-out forwards",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": {
            opacity: "1",
            boxShadow: "0 0 20px rgba(0,240,255,0.4)",
          },
          "50%": { opacity: "0.7", boxShadow: "0 0 40px rgba(0,240,255,0.7)" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
