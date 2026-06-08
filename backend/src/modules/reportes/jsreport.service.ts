import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Registro de plantillas jsreport. El `archivo` apunta al `.html` en disco
 * (`templates/`), que es la ÚNICA fuente de verdad (versionada en git).
 *
 * ⚠️ T-137 originalmente PERSISTÍA estas plantillas en el store de jsreport
 * (`/odata/templates`). Se eliminó: la licencia gratuita de jsreport limita a
 * 5 plantillas persistidas y el registro tiene 8 → activaba el trial de 1 mes.
 * Ahora se renderiza INLINE (se envía el contenido en cada `/api/report`), lo
 * que NO cuenta contra ese límite. Ver bitácora del fix.
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
 * Render INLINE: el contenido `.html` se lee de disco (cacheado en memoria al
 * primer uso) y se envía en cada `/api/report`. NO se persiste ninguna
 * plantilla en jsreport → no aplica el límite de 5 de la licencia gratuita.
 */
@Injectable()
export class JsreportService {
  private readonly logger = new Logger(JsreportService.name);
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly templatesDir: string;
  /** Cache en memoria del contenido de cada `.html` (key del registro → html). */
  private readonly contentCache = new Map<string, string>();

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

  async renderPdf(templateKey: string, data: Record<string, unknown>): Promise<Buffer> {
    return this.render(templateKey, data);
  }

  async renderXlsx(templateKey: string, data: Record<string, unknown>): Promise<Buffer> {
    return this.render(templateKey, data);
  }

  /** Lee el `.html` del registro (cacheado en memoria tras el primer acceso). */
  private templateContent(templateKey: string): string {
    const cached = this.contentCache.get(templateKey);
    if (cached !== undefined) return cached;
    const def = REPORT_TEMPLATES[templateKey]!;
    const content = readFileSync(join(this.templatesDir, `${def.archivo}.html`), 'utf8');
    this.contentCache.set(templateKey, content);
    return content;
  }

  /**
   * Render INLINE: envía `template: { content, engine, recipe }` directamente
   * (sin nombre persistido). `chrome-pdf` lleva las opciones de márgenes/footer;
   * `html-to-xlsx` usa el htmlEngine default (la imagen oficial no trae cheerio).
   */
  private async render(templateKey: string, data: Record<string, unknown>): Promise<Buffer> {
    const def = REPORT_TEMPLATES[templateKey];
    if (!def) {
      throw new BadGatewayException({
        code: 'JSREPORT_ERROR',
        title: 'Error del servicio de reportes',
        message: `La plantilla "${templateKey}" no existe en el registro.`,
      });
    }

    const template = {
      content: this.templateContent(templateKey),
      engine: 'handlebars',
      recipe: def.recipe,
      ...(def.recipe === 'chrome-pdf' ? { chrome: CHROME_PDF_OPTIONS } : {}),
    };

    const res = await this.doFetch('/api/report', {
      method: 'POST',
      body: JSON.stringify({ template, data }),
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
