import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import Handlebars from 'handlebars';
import { getTemplateDef } from './email-templates.registry';

/** Límite del plan T-120: 100 KB por plantilla renderizada. */
const MAX_RENDER_BYTES = 100 * 1024;

export interface RenderResult {
  subject: string;
  html: string;
}

/**
 * Renderer de plantillas Handlebars (T-120). Los `.html` viven en
 * `templates/`; los que empiezan con `_` se registran como parciales
 * (header con branding de la plaza, footer con unsubscribe condicional).
 *
 * Resolución del directorio: `__dirname/templates` (dist, copiado por
 * `scripts/copy-templates.mjs` en el build) con fallback a `src/` para
 * ejecución con ts-node/watch.
 */
@Injectable()
export class TemplateRendererService {
  private readonly logger = new Logger(TemplateRendererService.name);
  private readonly templatesDir: string;
  private readonly hbs = Handlebars.create();
  private readonly cache = new Map<string, Handlebars.TemplateDelegate>();
  private readonly subjectCache = new Map<string, Handlebars.TemplateDelegate>();

  constructor() {
    const candidatos = [
      join(__dirname, 'templates'),
      join(process.cwd(), 'src', 'modules', 'notificaciones', 'templates'),
    ];
    const dir = candidatos.find((c) => existsSync(c));
    if (!dir) {
      throw new Error(
        `TemplateRendererService: no se encontró el directorio de plantillas (${candidatos.join(' | ')})`,
      );
    }
    this.templatesDir = dir;
    // Parciales: _header.html, _footer.html
    for (const archivo of readdirSync(this.templatesDir)) {
      if (archivo.startsWith('_') && archivo.endsWith('.html')) {
        const nombre = archivo.replace(/\.html$/, '');
        this.hbs.registerPartial(nombre, readFileSync(join(this.templatesDir, archivo), 'utf8'));
      }
    }
  }

  /**
   * Renderiza subject + body de una plantilla del registro con las variables
   * dadas (deben incluir `plaza { nombreComercial, logoUrl, colorPrimario }`
   * y opcionalmente `unsubscribeUrl`).
   */
  render(plantilla: string, variables: Record<string, unknown>): RenderResult {
    const def = getTemplateDef(plantilla);
    if (!def) {
      throw new InternalServerErrorException({
        code: 'PLANTILLA_DESCONOCIDA',
        title: 'Error interno',
        message: `La plantilla de email "${plantilla}" no existe en el registro.`,
      });
    }
    const html = this.compileBody(def.archivo)(variables);
    if (Buffer.byteLength(html, 'utf8') > MAX_RENDER_BYTES) {
      // Límite del plan: 100 KB renderizados. No bloquea el envío, pero queda trazado.
      this.logger.warn(`plantilla "${plantilla}" renderizada supera 100 KB`);
    }
    const subject = this.compileSubject(plantilla, def.subject)(variables);
    return { subject, html };
  }

  private compileBody(archivo: string): Handlebars.TemplateDelegate {
    let tpl = this.cache.get(archivo);
    if (!tpl) {
      const ruta = join(this.templatesDir, `${archivo}.html`);
      tpl = this.hbs.compile(readFileSync(ruta, 'utf8'));
      this.cache.set(archivo, tpl);
    }
    return tpl;
  }

  private compileSubject(plantilla: string, subject: string): Handlebars.TemplateDelegate {
    let tpl = this.subjectCache.get(plantilla);
    if (!tpl) {
      tpl = this.hbs.compile(subject);
      this.subjectCache.set(plantilla, tpl);
    }
    return tpl;
  }
}
