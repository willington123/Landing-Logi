import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          blue: "#0A6CF0",
          green: "#10C569",
          navy: "#0047C2",
          navyDark: "#011B52",
          light: "#F5F7FA",
          gray: {
            50: "#F9FAFB",
            100: "#F3F4F6",
            200: "#E5E7EB",
            300: "#D1D5DB",
            400: "#9CA3AF",
            500: "#6B7280",
            600: "#4B5563",
            700: "#374151",
            800: "#1F2937",
            900: "#111827",
          }
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(120deg, #0047C2 0%, #0A6CF0 55%, #12B886 100%)',
        'navy-gradient': 'linear-gradient(135deg, #0047C2 0%, #011B52 100%)',
        'glow-gradient': 'radial-gradient(circle at 50% 0%, rgba(10, 108, 240, 0.14) 0%, rgba(16, 197, 105, 0.05) 70%, transparent 100%)',
      },
      boxShadow: {
        'glow-blue': '0 0 25px -5px rgba(10, 108, 240, 0.45)',
        'glow-green': '0 0 25px -5px rgba(16, 197, 105, 0.4)',
        'glow-navy': '0 0 25px -5px rgba(0, 71, 194, 0.3)',
      },
      animation: {
        'pulse-subtle': 'pulseSubtle 2.5s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        pulseSubtle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.92', transform: 'scale(1.02)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      }
    },
  },
  plugins: [],
};
export default config;
