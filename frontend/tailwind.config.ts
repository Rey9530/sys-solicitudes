import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // CSS variable de color primario por plaza (se inyecta dinámicamente)
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary, #2563eb)',
          50: 'color-mix(in srgb, var(--color-primary, #2563eb) 5%, white)',
          100: 'color-mix(in srgb, var(--color-primary, #2563eb) 10%, white)',
          200: 'color-mix(in srgb, var(--color-primary, #2563eb) 20%, white)',
          300: 'color-mix(in srgb, var(--color-primary, #2563eb) 30%, white)',
          400: 'color-mix(in srgb, var(--color-primary, #2563eb) 40%, white)',
          500: 'var(--color-primary, #2563eb)',
          600: 'color-mix(in srgb, var(--color-primary, #2563eb) 80%, black)',
          700: 'color-mix(in srgb, var(--color-primary, #2563eb) 60%, black)',
          800: 'color-mix(in srgb, var(--color-primary, #2563eb) 40%, black)',
          900: 'color-mix(in srgb, var(--color-primary, #2563eb) 20%, black)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
