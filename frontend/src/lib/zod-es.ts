import { z } from 'zod';

/**
 * Mensajes de validación en español para todos los schemas (incluidos los de
 * `@app/contracts`, que comparten la misma instancia de zod). Antes los
 * formularios mostraban "Invalid email address" o "Invalid option" (auditoría
 * 2026-10-27).
 *
 * Prioridad de zod: el mensaje definido en el schema gana; si no hay, se usa
 * `customError` (los casos comunes, redactados para el usuario) y, como
 * último recurso, el locale `es` de zod.
 */
z.config(z.locales.es());
z.config({
  customError: (issue) => {
    if (issue.code === 'invalid_type' && issue.input === undefined) {
      return 'Este campo es obligatorio.';
    }
    if (issue.code === 'too_small' && issue.origin === 'string' && Number(issue.minimum) === 1) {
      return 'Este campo es obligatorio.';
    }
    if (issue.code === 'invalid_format' && issue.format === 'email') {
      return 'Correo electrónico inválido.';
    }
    if (issue.code === 'invalid_format' && issue.format === 'date') {
      return 'Fecha inválida.';
    }
    if (issue.code === 'invalid_value') return 'Selecciona una opción válida.';
    return undefined;
  },
});
