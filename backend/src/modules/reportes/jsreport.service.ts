import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BadGatewayException,
  Injectable,
  Logger,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Registro de plantillas jsreport (T-137). Nombres VERSIONADOS (decisión del
 * plan): si una plantilla cambia de forma incompatible se sube como `-v2` y
 * el registro apunta al nombre nuevo (el volumen de jsreport persiste las
 * anteriores sin romper renders en vuelo).
 */
export const REPORT_TEMPLATES: Record<string, { archivo: string; recipe: string }> = {
  'solicitudes-pdf': { archivo: 'solicitudes-pdf', recipe: 'chrome-pdf' },
  'solicitudes-xlsx': { archivo: 'solicitudes-xlsx', recipe: 'html-to-xlsx' },
  'locales-pdf': { archivo: 'locales-pdf', recipe: 'chrome-pdf' },
  'locales-xlsx': { archivo: 'locales-xlsx', recipe: 'html-to-xlsx' },
  'inquilinos-pdf': { archivo: 'inquilinos-pdf', recipe: 'chrome-pdf' },
  'inquilinos-xlsx': { archivo: 'inquilinos-xlsx', recipe: 'html-to-xlsx' },
  'local-detalle-pdf': { archivo: 'local-detalle-pdf', recipe: 'chrome-pdf' },
  'inquilino-detalle-pdf': { archivo: 'inquilino-detalle-pdf', recipe: 'chrome-pdf' },
};

/** Versión de las plantillas en jsreport: `plazapp-{key}-v1`. */
const TEMPLATE_VERSION = 'v1';

const CHROME_PDF_OPTIONS = {
  marginTop: '1.5cm',
  marginBottom: '1.8cm',
  marginLeft: '1.2cm',
  marginRight: '1.2cm',
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate:
    '<div style="width:100%;font-size:8px;color:#71717a;padding:0 1.2cm;display:flex;justify-content:space-between;">' +
    '<span>Generado el <span class="date"></span> · Plazapp</span>' +
    '<span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>',
};

/**
 * Cliente BFF hacia jsreport 4.13 (T-136, S-JSReport). `fetch` nativo de
 * Node 24 — NO se instala `@jsreport/nodejs-client` ni ninguna librería de
 * generación (puppeteer/exceljs/pdfkit). Basic Auth con JSREPORT_USER/PASSWORD.
 *
 * `onModuleInit` sube las plantillas del registro (idempotente, best-effort:
 * si jsreport está caído el backend arranca igual y se reintenta en el
 * primer render).
 */
@Injectable()
export class JsreportService implements OnModuleInit {
  private readonly logger = new Logger(JsreportService.name);
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly templatesDir: string;
  private templatesListas = false;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('JSREPORT_URL', 'http://localhost:5488').replace(/\/$/, '');
    const user = config.get<string>('JSREPORT_USER', 'admin');
    const password = config.get<string>('JSREPORT_PASSWORD', 'password');
    this.authHeader = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
    const candidatos = [
      join(__dirname, 'templates'),
      join(process.cwd(), 'src', 'modules', 'reportes', 'templates'),
    ];
    this.templatesDir = candidatos.find((c) => existsSync(c)) ?? candidatos[0]!;
  }

  async onModuleInit(): Promise<void> {
    await this.ensureTemplates().catch((err: unknown) => {
      this.logger.warn(
        `jsreport no disponible al arranque (${String(err)}); se reintenta en el primer render.`,
      );
    });
  }

  /** Nombre versionado en jsreport para una key del registro. */
  jsreportName(key: string): string {
    return `plazapp-${key}-${TEMPLATE_VERSION}`;
  }

  async renderPdf(templateKey: string, data: Record<string, unknown>): Promise<Buffer> {
    return this.render(templateKey, data);
  }

  async renderXlsx(templateKey: string, data: Record<string, unknown>): Promise<Buffer> {
    return this.render(templateKey, data);
  }

  /** Render por NOMBRE de plantilla persistida (la recipe vive en la plantilla). */
  private async render(templateKey: string, data: Record<string, unknown>): Promise<Buffer> {
    if (!REPORT_TEMPLATES[templateKey]) {
      throw new BadGatewayException({
        code: 'JSREPORT_ERROR',
        title: 'Error del servicio de reportes',
        message: `La plantilla "${templateKey}" no existe en el registro.`,
      });
    }
    if (!this.templatesListas) await this.ensureTemplates();

    const res = await this.doFetch('/api/report', {
      method: 'POST',
      body: JSON.stringify({ template: { name: this.jsreportName(templateKey) }, data }),
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      this.logger.error(
        `jsreport render "${templateKey}" -> ${res.status}: ${detalle.slice(0, 300)}`,
      );
      throw new BadGatewayException({
        code: 'JSREPORT_ERROR',
        title: 'Error del servicio de reportes',
        message: 'No se pudo generar el reporte; intenta de nuevo en unos minutos.',
      });
    }
    return Buffer.from(await res.arrayBuffer());
  }

  /** Sube cada plantilla del registro si no existe (idempotente, T-137). */
  async ensureTemplates(): Promise<void> {
    for (const [key, def] of Object.entries(REPORT_TEMPLATES)) {
      const content = readFileSync(join(this.templatesDir, `${def.archivo}.html`), 'utf8');
      await this.ensureTemplate(this.jsreportName(key), content, def.recipe);
    }
    this.templatesListas = true;
    this.logger.log(`plantillas jsreport verificadas (${Object.keys(REPORT_TEMPLATES).length})`);
  }

  /**
   * Crea la plantilla si no existe; si existe con contenido distinto la
   * ACTUALIZA (PATCH) — mantiene dev iterable sin tocar el nombre versionado.
   * ⚠️ API real de jsreport 4.x: `/odata/templates` (el plan decía
   * `/api/templates`, que no existe — ver bitácora T-136).
   */
  async ensureTemplate(name: string, content: string, recipe: string): Promise<void> {
    const buscar = await this.doFetch(
      `/odata/templates?$filter=${encodeURIComponent(`name eq '${name}'`)}`,
      { method: 'GET' },
    );
    if (!buscar.ok) throw new Error(`jsreport odata ${buscar.status}`);
    const lista = (await buscar.json()) as { value: Array<{ _id: string; content: string }> };
    const existente = lista.value[0];

    const body = {
      name,
      content,
      engine: 'handlebars',
      recipe,
      // html-to-xlsx usa el htmlEngine default (chrome) — la imagen oficial
      // no incluye cheerio (verificado: 400 "htmlEngine cheerio not found").
      ...(recipe === 'chrome-pdf' ? { chrome: CHROME_PDF_OPTIONS } : {}),
    };

    if (!existente) {
      const res = await this.doFetch('/odata/templates', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`jsreport crear plantilla "${name}" -> ${res.status}`);
      this.logger.log(`plantilla "${name}" creada en jsreport`);
    } else if (existente.content !== content) {
      const res = await this.doFetch(`/odata/templates('${existente._id}')`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`jsreport actualizar plantilla "${name}" -> ${res.status}`);
      this.logger.log(`plantilla "${name}" actualizada en jsreport`);
    }
  }

  /** Subida directa (API del plan); delega en ensureTemplate. */
  async uploadTemplate(name: string, content: string, recipe = 'chrome-pdf'): Promise<void> {
    await this.ensureTemplate(name, content, recipe);
  }

  private async doFetch(path: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authHeader,
          ...(init.headers ?? {}),
        },
      });
    } catch (err) {
      throw new BadGatewayException({
        code: 'JSREPORT_ERROR',
        title: 'Error del servicio de reportes',
        message: `jsreport no está disponible (${String(err)}).`,
      });
    }
  }
}
