/**
 * Commitlint relajado: acepta cualquier subject (sin tipo Conventional Commits obligatorio).
 * El husky pre-commit sigue corriendo lint/test. Detalles: PLANIFICACION/01-setup-base.md (T-012).
 */
module.exports = {
  extends: [],
  rules: {
    'header-max-length': [2, 'always', 200],
    'body-max-line-length': [2, 'always', 200],
  },
};
