import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        zibuke: {
          bg: "#0B1120",      // The very dark navy background from the original Vercel app
          card: "#141C2F",    // The slightly lighter inner login card
          accent: "#00DF73",  // The vibrant green button and shadow
          text: "#F8FAFC",    // Crisp white for headers and primary text
          muted: "#94A3B8",   // Muted blue-grey for the small labels
        }
      },
      keyframes: {
        'float-up': {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '1' },
          '100%': { transform: 'translateY(-200px) scale(1.5)', opacity: '0' },
        }
      },
      animation: {
        'float-up': 'float-up 3s ease-out forwards',
      }
    },
  },
  plugins: [],
};

export default config;