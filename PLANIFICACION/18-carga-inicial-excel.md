# 18 · Carga inicial desde Excel (locales + inquilinos + contratos)

> **Estado:** ✅ Implementada (2026-10-22).
> ⚠️ **Reabre T-V07 / S-CSV** ("sin importador en v1") por pedido explícito del owner. Ver la `actualización: 2026-10-22` en la bitácora de T-V07 (`00-INDICE.md`).

## Contexto

Para dar de alta una plaza había que crear cada local, cada inquilino y cada contrato a mano desde tres pantallas. El cliente entregó la plantilla `Formato_App_Locales_e_Inquilinos_PV.xlsx` (Paseo Venecia: 124 filas, una hoja "INFORMACION A LLENAR", ~46 columnas). **Cada fila es un local con su inquilino y su contrato.** Se añadió el botón **"Importar Excel"** junto a "Nuevo contrato" en `/admin/contratos`. El botón lleva a `/admin/contratos/importar`, donde se sube la plantilla, se revisa una vista previa por fila y se crea todo en un solo paso.

### Excel vs. modelos

El Excel trae todos los campos **obligatorios** de los tres modelos:
- `local.codigo` sale de LOCAL.
- `inquilino.razon_social` sale de RAZÓN SOCIAL.
- Del contrato: `fecha_inicio` sale de FECHA INICIO y `monto_mensual` de TOTAL. El local y el inquilino se toman de la misma fila.

Todas las demás columnas ya tenían campo opcional (migraciones `*_campos_excel`). **No hubo migración de esquema.** El mapa columna → campo vive en `CARGA_INICIAL_COLUMNAS` (`packages/contracts/src/importacion`).

| Columnas | Destino |
|---|---|
| MÓDULO · NIVEL · LOCAL · ÁREA · MEDIDORES | `local` (código = `MODULO-LOCAL`, D1) |
| NOMBRE COMERCIAL … SUBCATEGORÍA | `inquilino` (NIT → `identificacion`; TIPO CLIENTE en minúsculas) |
| PLAZO (AÑOS) | `contrato.plazo_meses` = round(años × 12) |
| TOTAL | `monto_mensual`. Si falta, se usa TOTAL CANON + TOTAL CAM; si también faltan, ÁREA REAL × (CUOTA + CAM). |
| FECHA FIN (respaldo: VENCIMIENTO) | `fecha_fin`; vacía → NULL (indefinido, D2) |
| COMENTARIOS | `contrato.condiciones`; si la fila no genera contrato, va a `inquilino.comentarios` (solo inquilinos nuevos) |
| TOTAL CANON, TOTAL CAM | No se guardan (solo sirven de respaldo para calcular el monto) |

**Resultado con el archivo real:**
- Se crean 121 locales, 107 inquilinos y 101 contratos.
- 19 filas quedan con advertencia:
  - 14 sin FECHA INICIO;
  - 3 cajeros sin MÓDULO/LOCAL;
  - la fila 73, sin razón social;
  - 1 medidor de agua corrupto en notación científica.

## Decisiones

| # | Decisión |
|---|---|
| D1 | ✅ (owner) El código del local es `MODULO-LOCAL`, en mayúsculas, sin acentos y con lo no alfanumérico convertido en `-` (`K-1`, `PAD-1`, `CP-2-Y-3`, `K-F-29-ISLA-1`). LOCAL se repite entre módulos y `local.codigo` es único por plaza. Si LOCAL ya empieza por el módulo, no se duplica el prefijo. Módulo y nivel se guardan también en sus campos. |
| D2 | ✅ (owner) Si faltan FECHA FIN y VENCIMIENTO, el contrato queda **indefinido**. Si se calculara inicio + plazo, 66 de 101 contratos nacerían vencidos aunque los inquilinos siguen operando. El plazo se guarda solo como dato. |
| D3 | ✅ (owner) Se quitaron de `CreateContratoSchema` los refines `fechaPagoDeposito ≥ fechaInicio` y `fechaEntregaLocal ≥ fechaInicio`; aplica también al alta manual. En el archivo real, 41 depósitos y 22 entregas son anteriores al inicio, algo normal en la práctica. Se mantienen `fin ≥ inicio` y `aviso ≤ fin`. |
| D4 | ✅ (owner) **Importar lo válido.** El flujo tiene vista previa (análisis sin escribir) y luego confirmación. Al confirmar, todo lo válido se crea en **una sola transacción**: si falla algo inesperado, no se escribe nada. Hay dos niveles por fila: **error** (no crea ni reutiliza nada) y **advertencia** (se omitió una parte o un campo). |
| D5 | **Idempotente:** re-importar el Excel corregido no duplica nada. Locales por código; inquilinos por NIT y, si no hay, por razón social normalizada (sin acentos ni signos). Un contrato vigente igual (mismo local, inquilino y fecha de inicio) se marca "Ya existe". No se crea contrato si el local ya tiene otro vigente o está en mantenimiento/fuera de servicio. Locales e inquilinos existentes **no se modifican**, y los deshabilitados no se reactivan. |
| D6 | Las razones sociales repetidas generan **un solo inquilino con varios contratos**. Los nombres comerciales distintos se unen con " / " (máximo 160 caracteres), y una fila posterior completa los datos vacíos de la primera. Sin RAZÓN SOCIAL se usa NOMBRE COMERCIAL, con advertencia. |
| D7 | **No se crean cuentas de usuario** ni se envían correos. El archivo no trae correos de acceso; las cuentas se dan de alta luego con "Alta de usuario" del inquilino. |
| D8 | Los medidores aceptan dígitos y guiones (`MEDIDOR_REGEX = /^[0-9]+(-[0-9]+)*$/`, schema compartido; aplica también al alta y edición manual). Un medidor inválido se omite con advertencia. |
| D9 | El Excel se lee en el **backend** con `read-excel-file@9.3.12` (`read-excel-file/node`, salida CJS, solo lectura). Se descartaron `exceljs` (vetado por docs/02 §2.12.7) y `xlsx@0.18.5` (abandonado en npm y con CVEs). Las columnas se ubican **por encabezado normalizado**, no por letra; "CARGO" repetido se resuelve por orden. Se usa la hoja "INFORMACION A LLENAR" o, si no existe, la primera. |
| D10 | Permiso nuevo `contratos.importar`. La migración `20261022000001_permiso_contratos_importar` lo otorga a todo `rol_staff` que ya tenía `contratos.crear`. |
| D11 | Stateless: el navegador reenvía el mismo archivo al confirmar y el backend recalcula el plan. Límites: `.xlsx`, 5 MB, magic bytes `PK`, 2000 filas. La transacción de ejecución usa `timeout` de 60 s (`withTenant` acepta ahora `TenantTxOptions`). |
| D12 | La plantilla descargable trae **3 filas de ejemplo** (filas 4–6, en amarillo) y una nota en la fila 1:
- un local con contrato completo;
- el mismo inquilino en un segundo local, con contrato indefinido;
- un local disponible.

Se marcan porque COMENTARIOS empieza con «EJEMPLO» (`CARGA_INICIAL_MARCA_EJEMPLO`), y el importador las **ignora** y las informa en `filasEjemplo`, así que subir la plantilla sin borrarlas no crea datos ficticios. Si el archivo solo trae ejemplos, responde `IMPORTACION_SIN_FILAS` con un mensaje específico. La plantilla se genera con `scripts/generar-plantilla-carga-inicial.py` (stdlib, idempotente). |

## Archivos tocados

- **`packages/contracts`:**
  - `src/importacion/index.ts` (nuevo): `CARGA_INICIAL_COLUMNAS`, límites, `normalizarEncabezado` y `CargaInicialResultadoSchema` con sus tipos.
  - `contratos/index.ts`: D3.
  - `locales/index.ts`: `MEDIDOR_REGEX`, D8.
- **`backend/src/modules/importacion/`** (nuevo, registrado en `app.module.ts`):
  - `importacion.controller.ts`: `POST /api/v1/importacion/carga-inicial/{analizar,ejecutar}`, multipart `file`, `@Roles('admin_plaza','superadmin')` + `@RequirePermission('contratos.importar')`.
  - `carga-inicial.parser.ts`: validación del archivo, detección de la fila de encabezados y lectura tipada de celdas (fechas `Date`, serial de Excel, `AAAA-MM-DD` o `DD/MM/AAAA`).
  - `carga-inicial.service.ts`: plan por fila (Zod tolerante: un campo opcional inválido se descarta con advertencia), resolución contra la BD, escritura en una transacción y auditoría (`local.create` / `inquilino.create` / `contrato.create` por entidad, más el resumen `carga_inicial.ejecutar`).
- **`backend/src/modules/locales/local.mapper.ts`, `inquilinos/inquilino.mapper.ts`** (nuevos): mappers extraídos de los services para reutilizarlos en la auditoría de la importación.
- **`backend/src/prisma/prisma.service.ts`:** `withTenant(plazaId, fn, options?)`.
- **`backend/prisma/seed-data/permisos.ts`** y la migración del permiso.
- **`frontend/src/app/(admin-plaza)/admin/contratos/`:**
  - `page.tsx`: botón "Importar Excel" dentro de `<Can permiso="contratos.importar">`.
  - `importar/page.tsx` (nuevo).
  - `actions.ts`: `analizarCargaInicialAction` y `ejecutarCargaInicialAction`.
- **`frontend/src/components/client/carga-inicial-importer.tsx`** (nuevo):
  - dropzone (react-dropzone) y totales con `KpiCard`;
  - barra de acciones encima de la tabla;
  - pestañas Todas / Con advertencia / Con error con `ResponsiveDataView`;
  - confirmación con `confirmAction`.
- **`frontend/public/plantillas/plantilla-carga-inicial.xlsx`** (nuevo): la plantilla del cliente sin sus datos reales. Se quitaron las filas de datos, la tabla de textos compartidos de esas filas, `calcChain.xml` y la ruta local del autor. Desde D12 lleva 3 filas de ejemplo ficticias y encabezados fijos.
- **`scripts/generar-plantilla-carga-inicial.py`** (nuevo, D12): regenera los ejemplos sobre la plantilla publicada con los estilos originales por columna (moneda, `dd/mm/aaaa`, bordes) y relleno amarillo.
- **Documentación:** `docs/02` §2.12.7 (excepción de lectura), `docs/03` (CU-LO-9, S-LO-C, S-CSV), `CLAUDE.md` (hallazgos de versiones) y `00-INDICE.md`.

## Verificación realizada (2026-10-22, stack local)

- **Plaza aislada:** se creó la plaza de prueba `carga-qa` con admin propio.
- **Excel real, análisis:** 121 locales, 107 inquilinos, 101 contratos, 0 errores, 19 advertencias; 50 ms.
- **Excel real, ejecución:** 0,5 s. En BD quedó:
  - 121 locales, 101 de ellos `alquilado`;
  - 107 inquilinos;
  - 101 contratos vigentes con `fecha_fin` NULL;
  - "CHELY, S.A. DE C.V." con 2 contratos y los nombres comerciales unidos;
  - B-9 con depósito y entrega anteriores al inicio;
  - auditoría: 121 + 107 + 101 filas más el resumen.
- **Re-ejecución del mismo archivo:** 0 creados; 121/107/101 "existentes".
- **Archivos inválidos:**
  - `.pdf` renombrado → `IMPORTACION_ARCHIVO_INVALIDO`;
  - extensión distinta de `.xlsx` → `IMPORTACION_ARCHIVO_INVALIDO`;
  - sin archivo → `IMPORTACION_ARCHIVO_REQUERIDO`;
  - Excel sin la fila de encabezados → `IMPORTACION_PLANTILLA_INVALIDA`;
  - plantilla vacía → `IMPORTACION_SIN_FILAS`;
  - más de 5 MB → 413.
- **Casos límite** (Excel sintético):
  - fecha `DD/MM/AAAA` en texto;
  - monto `$1,250.50`;
  - local repetido en el archivo;
  - razón social igual con otra capitalización y puntuación (→ "Igual a fila N");
  - correo inválido omitido;
  - FECHA FIN anterior al inicio omitida;
  - `31/02/2026` → contrato omitido;
  - código de más de 16 caracteres;
  - local con contrato vigente;
  - fila solo con comentario (error).
- **Permisos y multi-tenancy:**
  - inquilino → 403;
  - admin_plaza con rol `supervisor` (sin el permiso) → 403 `PERMISSION_DENIED`, sin botón y la página muestra "Sin permiso";
  - admin de `demo` → no ve nada de `carga-qa` (RLS), y su propio análisis reutiliza sus 7 inquilinos previos.
- **Alta manual:** un contrato con depósito y entrega anteriores al inicio se crea; un local con medidor `18-622259-1` se crea; `18--1` sigue rechazado.
- **UI (Playwright):**
  - el botón aparece en Contratos y la plantilla se descarga (200, MIME xlsx);
  - el flujo vista previa → confirmar (SweetAlert2) → "Importación completada" funciona;
  - sin desborde de página a 390, 768, 1024 y 1280 px; a 1280 px la tabla entra completa y a menos ancho pasa a tarjetas.
- **Calidad de código:**
  - `tsc --noEmit` y ESLint en backend;
  - `npm run type-check` y ESLint en frontend;
  - build de `packages/contracts`.

## Bitácora de cambios

- 2026-10-22 · Implementación inicial (D1–D11).
  - ⚠️ Desviación de T-V07 / S-CSV: autorizada por el owner en esta sesión.
  - ⚠️ Nueva dependencia de backend `read-excel-file@9.3.12`. Es la latest en npm (publicada el 2026-10-07) y solo lee archivos, no los genera; ver la excepción en docs/02 §2.12.7.
  - Hallazgo: el backend no validaba que el local estuviera disponible al crear un contrato manual (solo filtra el frontend). La importación sí lo valida (D5); el alta manual queda igual, sin cambios.
- **actualización: 2026-10-22** · Plantilla con 3 ejemplos (D12), a pedido del owner.
  - Cambios:
    - el botón pasa a "Descargar plantilla con ejemplos";
    - la tarjeta 1 explica los ejemplos;
    - la vista previa avisa "Se ignoraron las filas de ejemplo (4, 5, 6)";
    - `CargaInicialResultado` suma `filasEjemplo`.
  - Verificado:
    - la plantilla sola → `IMPORTACION_SIN_FILAS` («solo trae las filas de ejemplo…»);
    - plantilla + 1 fila propia → `filasEjemplo` [4, 5, 6] y solo se crea la fila propia;
    - los ejemplos sin la marca → 3 filas OK sin advertencias (A-101, A-102 «Igual a fila 4», B-201 disponible), lo que confirma que los datos de ejemplo son válidos;
    - la descarga desde la UI es idéntica al archivo generado;
    - Quick Look de macOS la renderiza;
    - el generador es idempotente (dos corridas dan el mismo `styles.xml`).
