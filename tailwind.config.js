/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Tambahkan/perbarui konfigurasi ini
      boxShadow: {
        'neon-green': '0 0 5px #B45330, 0 0 10px #B45330',
        'neon-purple': '0 0 5px #8B7355, 0 0 10px #8B7355',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: 0.7, transform: 'scale(1)' },
          '50%': { opacity: 1, transform: 'scale(1.02)' },
        }
      },
      animation: {
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
      }
    },
  },
  plugins: [],
};