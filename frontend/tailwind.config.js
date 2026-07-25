/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Syne', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: '#070b14',
        panel: '#0d1524',
        'panel-2': '#121c2e',
        muted: '#94a3b8',
        accent: '#3ddea8',
        'accent-2': '#5b8cff',
        danger: '#f07178',
        warning: '#e6b84d',
      },
    },
  },
  plugins: [],
}
