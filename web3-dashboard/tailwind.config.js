/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Uniswap-inspired dark palette
        bg: {
          primary: '#0d0e12',
          secondary: '#13141a',
          tertiary: '#1a1b23',
          card: '#1c1d26',
          hover: '#22232e',
          border: '#2c2d3a',
        },
        accent: {
          pink: '#fc72ff',
          purple: '#9b59ff',
          blue: '#4c82fb',
          cyan: '#00d2ff',
          green: '#40b66b',
          red: '#f25f5c',
          orange: '#f77f00',
          yellow: '#ffd700',
        },
        text: {
          primary: '#ffffff',
          secondary: '#9b9caa',
          tertiary: '#5d5e6e',
          muted: '#3d3e4e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-pink-purple': 'linear-gradient(135deg, #fc72ff 0%, #9b59ff 100%)',
        'gradient-blue-cyan': 'linear-gradient(135deg, #4c82fb 0%, #00d2ff 100%)',
        'gradient-dark': 'linear-gradient(180deg, #13141a 0%, #0d0e12 100%)',
      },
      boxShadow: {
        'glow-pink': '0 0 20px rgba(252, 114, 255, 0.3)',
        'glow-purple': '0 0 20px rgba(155, 89, 255, 0.3)',
        'glow-blue': '0 0 20px rgba(76, 130, 251, 0.3)',
        'glow-green': '0 0 20px rgba(64, 182, 107, 0.3)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 40px rgba(0, 0, 0, 0.6)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-slow': 'bounce 2s infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
}
