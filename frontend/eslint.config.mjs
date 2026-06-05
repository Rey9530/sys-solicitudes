/**
 * ESLint flat config para Next.js 16.
 *
 * En Next.js 16 se eliminó el comando `next lint`. La recomendación oficial
 * (https://nextjs.org/docs/app/api-reference/config/eslint) es usar el ESLint
 * CLI directamente con `eslint-config-next` (que ya viene con flat config).
 *
 * Detalles: PLANIFICACION/01-setup-base.md (T-003, T-012).
 */
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig([
  // Confs de Next.js (Core Web Vitals + TypeScript)
  ...nextVitals,
  ...nextTypescript,

  // Reglas custom del proyecto
  {
    rules: {
      // Prettier maneja el formateo; evitamos warnings duplicados
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'react/no-unescaped-entities': 'off',
    },
  },

  // Integración con Prettier (debe ir al final para sobrescribir reglas conflictivas)
  prettier,

  // Ignores por defecto
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'dist/**',
    'node_modules/**',
    'next-env.d.ts',
    '*.config.{js,mjs,ts}',
  ]),
]);
