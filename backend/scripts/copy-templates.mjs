// Copia los assets no-TS al dist (tsc no copia .html).
// Hoy: plantillas de email del módulo de notificaciones (T-120).
import { cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pares = [
  [
    join(root, 'src', 'modules', 'notificaciones', 'templates'),
    join(root, 'dist', 'modules', 'notificaciones', 'templates'),
  ],
];

for (const [desde, hasta] of pares) {
  cpSync(desde, hasta, { recursive: true });
  console.log(`[copy-templates] ${desde} -> ${hasta}`);
}
