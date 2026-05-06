/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#FFFFFF',
        surface: '#FFFFFF',
        'surface-elevated': '#F9FAFB',
        border: '#E5E7EB',
        primary: '#93D500',
        'primary-dark': '#2E7D32',
        'primary-light': '#E8F5E9',
        secondary: '#007BFF',
        'pri-text': '#009D4F',
        success: '#22c55e',
        warning: '#eab308',
        danger: '#ef4444',
        text: '#111827',
        muted: '#6B7280',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
