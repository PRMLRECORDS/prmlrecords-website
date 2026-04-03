/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream:    '#F5F0E8',
        charcoal: '#2C2C2C',
        red:      '#E01010',
        black:    '#111111',
      },
      fontFamily: {
        mono:  ['"Rubik Mono One"', 'monospace'],
        label: ['"Odibee Sans"', 'sans-serif'],
        body:  ['"Roboto Slab"', 'serif'],
      },
    },
  },
  plugins: [],
};
