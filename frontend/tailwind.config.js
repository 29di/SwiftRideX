/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#172554',
        },
        midnight: '#0f172a',
        slatecard: '#1e293b',
        glow: '#38bdf8',
        textsoft: '#e2e8f0',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(56, 189, 248, 0.14), 0 18px 60px rgba(15, 23, 42, 0.45)',
        panel: '0 20px 70px rgba(15, 23, 42, 0.55)',
      },
      backgroundImage: {
        'hero-radial': 'radial-gradient(circle at top left, rgba(37, 99, 235, 0.32), transparent 36%), radial-gradient(circle at top right, rgba(56, 189, 248, 0.18), transparent 30%), linear-gradient(180deg, #0f172a 0%, #111c34 100%)',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Manrope"', 'sans-serif'],
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        floaty: 'floaty 6s ease-in-out infinite',
        shimmer: 'shimmer 1.8s linear infinite',
      },
    },
  },
  plugins: [],
};
