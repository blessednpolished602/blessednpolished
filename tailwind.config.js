/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        blush: {
          50: '#fdecea',
          100: '#f9d6d1', // hero gradient start
          200: '#f3beb6',
        },
        brand: {
          50: '#fff7e6',
          100: '#ffebbf',
          200: '#ffd98a',
          300: '#ffc652',
          400: '#ffb224',
          500: '#ff9e0a', // primary accent
          600: '#e18200',
          700: '#b86202',
          800: '#8f4a07',
          900: '#733c0a',
        },
      },
      fontFamily: {
        display: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: '0 10px 30px rgba(0,0,0,0.12)'
      }
    },
  },
  plugins: [],
}

