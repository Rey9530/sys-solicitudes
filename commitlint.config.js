/**
 * Conventional Commits (config-basada).
 * Detalles: PLANIFICACION/01-setup-base.md (T-012).
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // nueva funcionalidad
        'fix',      // corrección de bug
        'docs',     // cambios solo en documentación
        'style',    // formato, sin cambio de lógica
        'refactor', // cambio de código sin fix ni feat
        'perf',     // mejora de performance
        'test',     // añadir/ajustar tests
        'chore',    // build, CI, deps, etc.
        'revert',   // revertir commit previo
        'build',    // build system / dependencias externas
        'ci',       // cambios solo en CI
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
    'header-max-length': [2, 'always', 100],
  },
};
