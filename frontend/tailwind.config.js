/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Safaricom green — brand-600 is #2DA043, measured from the Safaricom app
        brand: {
          50: '#EAF7ED',
          100: '#CDEDD4',
          200: '#9FDCAB',
          300: '#6BC97F',
          400: '#45B65C',
          500: '#34A94B',
          600: '#2DA043',
          700: '#248537',
          800: '#1D6A2C',
          900: '#155021',
          950: '#0C3214',
        },
        ink: {
          50: '#F7F9F8',
          100: '#EEF2F0',
          200: '#E3E9E6',
          300: '#CBD5D0',
          400: '#AAB6B0',
          500: '#8A9690',
          600: '#5E6B65',
          700: '#46514C',
          800: '#2B3631',
          900: '#17201C',
          950: '#10251F',
        },
        // Semantic theme tokens — resolved from CSS variables so the app shell
        // can switch between the light (auth) and dark "Shevify" themes.
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        'surface-3': 'rgb(var(--surface-3) / <alpha-value>)',
        field: 'rgb(var(--field) / <alpha-value>)',
        edge: 'rgb(var(--edge) / <alpha-value>)',
        'edge-2': 'rgb(var(--edge-2) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        'foreground-2': 'rgb(var(--foreground-2) / <alpha-value>)',
        'foreground-3': 'rgb(var(--foreground-3) / <alpha-value>)',
        'foreground-4': 'rgb(var(--foreground-4) / <alpha-value>)',
        'foreground-5': 'rgb(var(--foreground-5) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-strong': 'rgb(var(--accent-strong) / <alpha-value>)',
        'accent-soft': 'rgb(var(--accent-soft) / <alpha-value>)',
        'accent-soft-2': 'rgb(var(--accent-soft-2) / <alpha-value>)',
        'accent-border': 'rgb(var(--accent-border) / <alpha-value>)',
        'accent-text': 'rgb(var(--accent-text) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        'success-strong': 'rgb(var(--success-strong) / <alpha-value>)',
        'success-soft': 'rgb(var(--success-soft) / <alpha-value>)',
        'success-border': 'rgb(var(--success-border) / <alpha-value>)',
        'success-text': 'rgb(var(--success-text) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        'warning-strong': 'rgb(var(--warning-strong) / <alpha-value>)',
        'warning-soft': 'rgb(var(--warning-soft) / <alpha-value>)',
        'warning-border': 'rgb(var(--warning-border) / <alpha-value>)',
        'warning-text': 'rgb(var(--warning-text) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        'danger-strong': 'rgb(var(--danger-strong) / <alpha-value>)',
        'danger-soft': 'rgb(var(--danger-soft) / <alpha-value>)',
        'danger-border': 'rgb(var(--danger-border) / <alpha-value>)',
        'danger-text': 'rgb(var(--danger-text) / <alpha-value>)',
        info: 'rgb(var(--info) / <alpha-value>)',
        'info-soft': 'rgb(var(--info-soft) / <alpha-value>)',
        'info-border': 'rgb(var(--info-border) / <alpha-value>)',
        'info-text': 'rgb(var(--info-text) / <alpha-value>)',
        // Desktop navy sidebar
        nav: {
          bg: 'rgb(var(--nav-bg) / <alpha-value>)',
          text: 'rgb(var(--nav-text) / <alpha-value>)',
          muted: 'rgb(var(--nav-muted) / <alpha-value>)',
          active: 'rgb(var(--nav-active) / <alpha-value>)',
          hover: 'rgb(var(--nav-hover) / <alpha-value>)',
        },
        // Static "Shevify" brand accents used for gradients & highlights.
        shevify: {
          red: '#eb4537',
          'red-dark': '#d13c30',
          redsoft: '#5a1816',
          green: '#1fc341',
          yellow: '#ffd166',
          wine: '#3a2222',
          'wine-light': '#4a2a2a',
          ink: '#160404',
          'ink-deep': '#0a0101',
        },
      },
      fontFamily: {
        // Resolved from --font-sans (index.css): Figtree, like the Safaricom app
        sans: ['var(--font-sans)'],
        display: ['var(--font-sans)'],
        poppins: ['var(--font-sans)'],
        quicksand: ['var(--font-sans)'],
      },
      boxShadow: {
        soft: '0 1px 3px 0 rgb(20 40 30 / 0.04), 0 4px 12px -4px rgb(20 40 30 / 0.06)',
        lift: '0 2px 6px -1px rgb(20 40 30 / 0.06), 0 12px 24px -8px rgb(20 40 30 / 0.12)',
        'brand-glow':
          '0 8px 20px -6px rgb(8 127 91 / 0.4), 0 2px 6px -2px rgb(8 127 91 / 0.3)',
        glow:
          '0 8px 24px -6px rgb(235 69 55 / 0.45), 0 2px 8px -2px rgb(235 69 55 / 0.3)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-down': {
          from: { opacity: '0', transform: 'translateY(-12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.94)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { opacity: '0' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'otp-wave': {
          '0%, 100%': {
            transform: 'translateY(0)',
            boxShadow: '0 0 0 0 rgb(10 108 78 / 0)',
          },
          '50%': {
            transform: 'translateY(-8px)',
            boxShadow: '0 10px 18px -6px rgb(10 108 78 / 0.5)',
          },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out both',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-down': 'fade-down 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        'float': 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        'pulse-ring': 'pulse-ring 2.2s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        marquee: 'marquee 40s linear infinite',
        'otp-wave': 'otp-wave 1.1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};