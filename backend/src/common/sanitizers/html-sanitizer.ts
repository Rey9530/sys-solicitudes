import sanitize from 'sanitize-html';

/**
 * T-151 (SEC-6): sanitización HTML server-side con `sanitize-html@2.17.4`.
 *
 * - `sanitizeHtml`: whitelist del plan para campos de texto rico
 *   (descripciones y comentarios). `a[href]` solo http/https/mailto —
 *   `javascript:` se elimina (queda `<a>` sin href).
 * - `sanitizePlainText`: SIN tags (títulos y campos de una línea).
 */
const OPCIONES_RICO: sanitize.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'em',
    'u',
    'ul',
    'ol',
    'li',
    'a',
    'blockquote',
    'code',
    'pre',
  ],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  // No dejar el contenido de <script>/<style> como texto suelto.
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript'],
  disallowedTagsMode: 'discard',
};

const OPCIONES_PLANO: sanitize.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript'],
};

/** Texto rico: descripciones de solicitudes y cuerpos de comentarios. */
export function sanitizeHtml(input: string): string {
  return sanitize(input, OPCIONES_RICO).trim();
}

/** Texto plano (sin ningún tag): títulos y campos de una línea. */
export function sanitizePlainText(input: string): string {
  return sanitize(input, OPCIONES_PLANO).trim();
}
