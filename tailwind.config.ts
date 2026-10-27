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
          red: "#FF252B",
          orange: "#FF5A16",
          navy: "#172C8A",
          navyDark: "#0d1b54",
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
        'brand-gradient': 'linear-gradient(135deg, #FF252B 0%, #FF5A16 100%)',
        'navy-gradient': 'linear-gradient(135deg, #172C8A 0%, #0d1b54 100%)',
        'glow-gradient': 'radial-gradient(circle at 50% 0%, rgba(255, 37, 43, 0.15) 0%, rgba(23, 44, 138, 0.05) 70%, transparent 100%)',
      },
      boxShadow: {
        'glow-red': '0 0 25px -5px rgba(255, 37, 43, 0.4)',
        'glow-orange': '0 0 25px -5px rgba(255, 90, 22, 0.4)',
        'glow-navy': '0 0 25px -5px rgba(23, 44, 138, 0.3)',
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
