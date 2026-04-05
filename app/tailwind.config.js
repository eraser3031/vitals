/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1a1a1a',
          hover: '#333333',
          light: '#f0f0f0',
        },
        success: {
          DEFAULT: '#2d8a2d',
          light: '#e8f5e8',
        },
        danger: {
          DEFAULT: '#d33',
          light: '#fde8e8',
        },
        surface: '#f5f5f7',
        border: '#e5e5e5',
        muted: '#bbb',
        subtle: '#777',
        dim: '#666',
        soft: '#555',
        mid: '#444',
        faded: '#888',
        selected: '#e8e8e8',
        'hover-bg': '#eaeaec',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
