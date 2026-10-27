# App móvil Plazapp (Flutter + Riverpod) — Diseño

> Fecha: 2026-10-27 · Estado: **aprobado por el owner el 2026-10-27** (calendario con rejilla semana/día; v1 para pruebas internas)
> Reemplaza el contenido actual de `frontend_mobil/` (prototipo con `provider` y datos de prueba).
> Fuente funcional: inventario del web (`frontend/`) contrastado con los 138 endpoints del backend
> (resumen en §9 y en `docs/08-auditoria-qa-y-mejoras.md`).

## 1. Intención

Que los tres roles (`superadmin`, `admin_plaza`, `inquilino`) puedan hacer **desde el teléfono o la
tablet todo lo que hoy hacen en el web**, con las mismas reglas de negocio, hablando **directo** con
el backend NestJS (`/api/v1`). La app no inventa funcionalidad nueva: es una segunda puerta al mismo
sistema.

El código debe poder leerlo un desarrollador Flutter junior: pocas capas, nombres en español del
dominio, sin generación de código ni patrones de arquitectura pesados. "Simple pero fuerte": lo
simple no puede ser frágil (tokens, errores, estados de carga y tamaños de pantalla se manejan
siempre igual, en un solo lugar).

## 2. Objetivos, no-objetivos y anti-objetivos

**Objetivos**
- Paridad con las 42 rutas del web + campana de notificaciones + selector de plaza del superadmin +
  cambio de contraseña (§5).
- Teléfono y tablet, vertical y horizontal, sin desbordes (verificado con pruebas, §8).
- Tema claro/oscuro con los mismos tokens de color del web; color de marca por plaza.
- Sesión robusta: refresh *single-flight*, cierre limpio de sesión, permisos granulares.

**No-objetivos (v1 de la app)**
- Notificaciones push (FCM/APNs). La campana usa *polling* como el web (45 s, solo en primer plano).
- Modo offline / caché persistente de datos.
- Builds Flutter web o escritorio.
- Corregir bugs del backend: la app replica el comportamiento **corregido** del web donde es solo
  de cliente (p. ej. cancelar un diálogo no ejecuta la acción) y documenta el resto.

**Anti-objetivos (aunque "funcione", sería un fracaso)**
- BLoC, Clean Architecture con casos de uso/entidades/mappers, `freezed`, `retrofit`,
  `riverpod_generator` u otro *build_runner*.
- Paquetes poco conocidos o sin mantenimiento (regla del owner: oficiales o muy adoptados).
- Pantallas que solo se ven bien en un tamaño.

## 3. Restricciones

- Flutter **3.47.8** (Dart 3.13.7), actualizado el 2026-10-27 desde 3.41.7.
- Identificadores existentes conservados: Android `com.helixsys.frontend_mobil`,
  iOS `com.helixsys.frontendMobil`.
- Backend local: iOS simulador → `http://localhost:4000/api/v1`; emulador Android →
  `http://10.0.2.2:4000/api/v1`. Se configura con `--dart-define=API_BASE_URL=…`.
- Zona horaria fija `America/El_Salvador` (UTC-6, sin horario de verano, decisión T-V08): se
  convierte con un desplazamiento fijo, sin paquete de zonas horarias.
- Horas visibles en 12 h (`2:00 pm`); fechas civiles `DD-MM-YYYY`; instantes `dd/MM/yyyy`.

## 4. Cómo se construye (decisiones)

### 4.1 Paquetes (verificados en pub.dev el 2026-10-27)

| Paquete | Versión | Publisher | Para qué |
|---|---|---|---|
| `flutter_riverpod` | 3.4.3 | dash-overflow.net (verificado, 4 M desc./mes) | estado e inyección |
| `go_router` | 18.1.1 | flutter.dev | rutas + redirección por rol |
| `http` | 1.6.0 | dart.dev | cliente HTTP (incluye multipart) |
| `flutter_secure_storage` | 11.2.0 | steenbakker.dev (verificado, 5,6 M) | tokens en Keychain/Keystore |
| `shared_preferences` | 2.5.6 | flutter.dev | tema y plaza elegida |
| `intl` + `flutter_localizations` | 0.20.x / SDK | dart.dev / SDK | formatos y textos en español |
| `file_picker` | 13.3.0 | victorcarreras.dev (verificado, 4,7 M) | elegir archivos (adjuntos, Excel) |
| `image_picker` | 1.2.4 | flutter.dev | foto desde cámara/galería |
| `mime` | última | dart.dev | MIME declarado del multipart (el backend lo exige) |
| `path_provider` | 2.1.6 | flutter.dev | guardar descargas temporales |
| `share_plus` | 13.3.1 | fluttercommunity.dev (4,9 M) | abrir/compartir PDF, CSV, XLSX, ICS |
| `url_launcher` | 6.3.3 | flutter.dev | abrir URLs pre-firmadas de adjuntos |
| `fl_chart` | 1.3.0 | flchart.dev (verificado, 2,1 M) | gráficas del dashboard |
| `integration_test`, `flutter_test` | SDK | flutter.dev | pruebas |

Descartados: `dio` (se usa `http`, oficial), `table_calendar` (sin publisher verificado; el
calendario se dibuja con widgets propios), `provider`/`bloc`, cualquier generador de código.

### 4.2 Estructura de carpetas

```
frontend_mobil/lib/
├── main.dart                 # runApp(ProviderScope(child: PlazappApp()))
├── app.dart                  # MaterialApp.router, temas, locale es
├── core/
│   ├── config.dart           # API_BASE_URL, constantes
│   ├── api/
│   │   ├── api_client.dart   # ÚNICO lugar que habla HTTP (tokens, refresh, x-plaza-id, errores)
│   │   └── api_error.dart    # ApiError(status, code, mensaje) desde RFC 7807
│   ├── auth/
│   │   ├── sesion.dart            # modelo Sesion (usuario, rol, plaza, permisos)
│   │   ├── sesion_controller.dart # Notifier: iniciar, restaurar, cerrar, refrescar permisos
│   │   └── token_storage.dart     # flutter_secure_storage
│   ├── router.dart           # GoRouter + redirect por rol y por plaza (superadmin)
│   ├── theme/                # colores (tokens del web), tipografía, ThemeData claro/oscuro
│   ├── format/               # fechas.dart (TZ fija, 12 h), montos.dart, html.dart (decodificar entidades)
│   └── widgets/              # piezas compartidas (§4.5)
└── features/
    ├── auth/                 # login, reset, cambiar contraseña
    ├── shell/                # menú por rol, campana, selector de plaza
    ├── dashboard/
    ├── solicitudes/          # bandeja, detalle admin, mis solicitudes, detalle inquilino, wizard
    ├── calendario/
    ├── locales/  inquilinos/  contratos/   # (contratos incluye importar Excel)
    ├── categorias/  tipos_solicitud/
    ├── usuarios/             # staff, roles de staff, matriz de permisos
    ├── reportes/  auditoria/  notificaciones/  configuracion/
    └── superadmin/           # plazas, dashboard global, solicitudes globales
```

Cada carpeta de feature tiene a lo sumo **cuatro tipos de archivo**:
- `*_modelos.dart`: clases inmutables con `fromJson`/`toJson` escritos a mano (sin codegen).
- `*_api.dart`: funciones que llaman a `ApiClient` y devuelven modelos (el "repositorio").
- `*_providers.dart`: providers de Riverpod de lectura.
- `*_page.dart` / `widgets/`: pantallas.

### 4.3 Reglas de Riverpod (las mismas en toda la app)

1. **Leer datos** = `FutureProvider.autoDispose` (con `.family` cuando hay id o filtros). La pantalla
   hace `ref.watch(...)` y pinta `AsyncValue` con el widget compartido `AsyncView` (carga / error con
   "Reintentar" / datos).
2. **Escribir datos** (crear, aprobar, subir…) = la pantalla llama directo a la función de `*_api.dart`
   dentro de un `try/catch`, muestra `SnackBar` y hace `ref.invalidate(...)` del provider afectado.
   No hay "providers de mutación".
3. **Estado global** solo dos `Notifier`: la sesión (`sesionProvider`) y la plaza elegida por el
   superadmin (`plazaSeleccionadaProvider`). Los filtros de cada lista viven en el `State` del widget.
4. Nada de `riverpod_generator`, `StateNotifier` legado ni `ChangeNotifier`.

### 4.4 Cliente HTTP y sesión

- `ApiClient` agrega `Authorization: Bearer`, `Content-Type`, `x-plaza-id` (solo superadmin con
  plaza elegida) y un `User-Agent` propio.
- **Refresh single-flight**: un solo `Future` de refresh en vuelo; las peticiones que reciben
  `401 TOKEN_EXPIRED` lo esperan y reintentan **una** vez. Refresh proactivo si al access le quedan
  menos de 60 s. El par nuevo se guarda antes de liberar a los que esperan (el backend revoca todas
  las sesiones si un refresh se reusa).
- `401 REFRESH_INVALID/EXPIRED` → cerrar sesión local y volver al login con "Tu sesión expiró".
- Errores: `ApiError.mensaje` sale de `detail` (string **o** lista de strings, unidas con "; ").
  La UI reacciona por `code`, nunca por status (hay códigos con status inconsistentes).
- `429`: se distingue `ACCOUNT_LOCKED` (cuenta bloqueada) de `TOO_MANY_REQUESTS` (esperar
  `Retry-After`).
- Permisos: `GET /auth/me/permisos` tras login, al restaurar y al volver a primer plano. Widget
  `Can(permiso: …)` y función `puede(…)` con las reglas del web (`*` pasa todo, lista = OR).
- Al abrir la app: si hay tokens guardados → refresh → `GET /auth/me` → entra a la home del rol.

### 4.5 Widgets compartidos (`core/widgets/`)

`AppScaffold` (menú adaptable, §4.6), `AsyncView`, `ListaResponsive` (tarjetas en teléfono, tabla
cuando cabe — equivalente a `ResponsiveDataView`), `Paginador`, `EstadoBadge`, `PrioridadBadge`,
`SlaSemaforo`, `EmptyState`, `ErrorView`, `Can`, `confirmar()` y `pedirTexto()` (equivalentes a
`confirmAction`/`promptAction`: cerrar el diálogo = no hacer nada), `CampoFecha`/`CampoHora`
(selectores nativos, 12 h), `KeyValueGrid` (pares etiqueta/valor del detalle), `AdjuntosSeccion`
(lista + subir + descargar + eliminar), `DescargarYCompartir` (bytes → archivo temporal → hoja de
compartir).

### 4.6 Responsive

Un solo criterio por ancho disponible (`LayoutBuilder`/`MediaQuery.sizeOf`):

| Ancho | Navegación | Listados | Detalle |
|---|---|---|---|
| < 600 (teléfono) | `Drawer` + `AppBar` | tarjetas | una columna; panel de acciones fijo abajo en solicitudes |
| 600–1023 (tablet vertical) | `NavigationRail` compacto | tarjetas en 2 columnas o tabla si cabe | una columna ancha |
| ≥ 1024 (tablet horizontal) | `NavigationRail` extendido | tabla si cabe (si no, tarjetas) | dos columnas (detalle + panel lateral) |

Contenido con ancho máximo de 1100 px. Formularios: una columna en teléfono, dos en tablet. Objetivos
táctiles ≥ 48 px (Material). Textos largos con `softWrap`/`ellipsis`, nunca ancho fijo.

### 4.7 Equivalencias de UI web → móvil

| Web | App | Por qué |
|---|---|---|
| FullCalendar mes/semana/día/lista + arrastrar evento | **Aprobado por el owner (2026-10-27):** vistas **Mes**, **Semana** y **Día** con rejilla de horas dibujada con widgets propios, y **Agenda**; el admin cambia fechas desde la hoja de detalle del evento (selectores de fecha/hora → mismo endpoint `PATCH /calendario/eventos/:id/fechas`), sin arrastrar | Arrastrar en una rejilla horaria es frágil en pantallas táctiles y requeriría un paquete externo |
| `<input type=color>` en branding | Paleta de colores predefinidos + campo hex | Flutter no trae selector de color y no se agrega paquete |
| Descargar archivo (PDF/CSV/XLSX/ICS) | Descargar a temporal y abrir la hoja de compartir del sistema | Patrón nativo de iOS/Android |
| Plantilla Excel de carga inicial (estático del web) | Empaquetada como asset de la app | No depende del dominio web |
| Reset de contraseña: el enlace del email abre el web | La app pide el email; el enlace del correo se completa en el navegador | Evita deep links en v1 (decisión de producto pendiente) |
| Rutas huérfanas del web (`/inquilino/contratos`, `/admin/usuarios-plaza/[id]`) | Accesibles: "Mis contratos" en el menú del inquilino y el detalle de usuario desde la lista | Existen en el web; esconderlas no aporta |

## 5. Pantallas (paridad con el web)

**Público:** Login · Restablecer contraseña (solicitar) · Confirmar con token (si se abre la app
desde un enlace en el futuro).

**Comunes:** campana (admin/inquilino, polling 45 s, marcar leída / todas) · cambiar contraseña ·
cerrar sesión · tema claro/oscuro.

**Inquilino:** Mis solicitudes (filtros estado/tipo/fechas) · Nueva solicitud (wizard 3 pasos,
reglas de fechas 48 h/5 d/7 d y emergencia, campos por tipo, asistentes, adjuntos con cámara o
archivo) · Detalle (enviar, editar, reenviar subsanada, duplicar, cancelar con motivo, comentarios,
historial, adjuntos, PDF del permiso) · Editar · Calendario (mes/agenda, crear solicitud de evento
desde un día libre, exportar iCal) · Mis contratos + detalle (+ adjuntos del contrato).

**Admin de plaza** (todo filtrado por permisos): Dashboard (KPIs + gráficas) · Bandeja (todas /
asignadas a mí, filtros, orden, SLA) · Detalle (tomar, aprobar, rechazar, pedir subsanación,
pausar/reanudar, cerrar con resultado, reasignar, liberar, cancelar, prioridad, comentar, adjuntos,
PDF) · Calendario (filtros local/inquilino/tipo, cambiar fechas de un evento, iCal) · Locales (lista,
nuevo, detalle con pestañas datos/contratos/adjuntos/solicitudes, desactivar) · Inquilinos (lista,
nuevo, detalle con datos/contratos/usuarios/solicitudes; alta rápida de usuario, resetear clave,
deshabilitar/reactivar usuario) · Contratos (lista con filtros, nuevo, detalle, renovar, cerrar,
adjuntos, importar Excel: analizar → vista previa → ejecutar) · Categorías y subcategorías
(responsable y supervisores) · Tipos de solicitud · Usuarios de plaza (usuarios / roles de staff /
matriz de permisos) · Reportes (vista previa + exportar CSV/XLSX/PDF) · Auditoría · Notificaciones
(log de emails, ver, reintentar, desuscripciones) · Configuración (general, branding con logo, SLA,
adjuntos, calendario).

**Superadmin:** Plazas (lista, nueva, desactivar, entrar) · selector de plaza (impersonación con
`x-plaza-id`; sin plaza, las pantallas de plaza muestran el aviso "Selecciona una plaza") · Dashboard
global · Solicitudes globales (filtros, detalle de solo lectura, exportar CSV) · todas las pantallas
del admin al impersonar.

## 6. Comportamiento a copiar con cuidado

- Botones de transición por estado y rol según la matriz del web (inventario §4.3.2.1).
- `aprobada` **no** es terminal (falta el cierre); terminales: `cerrada`, `rechazada`, `cancelada`.
- Prioridad `A|B|C|D|F`.
- Campos opcionales vacíos: omitirlos o `null`, nunca `''`.
- Adjuntos: un archivo por request en el campo `file`, con el MIME **declarado** correcto; máximo 10
  por solicitud; lista de MIME y tope de 50 MB como el web.
- El PATCH de solicitud siempre incluye `esEmergencia` (bug A1-R2 del backend).
- Textos que vienen con entidades HTML (`&amp;`) se decodifican al mostrar (bug A1-R4).

## 7. Manejo de errores y estados

Toda pantalla de datos tiene cuatro estados visibles: cargando (esqueleto o spinner), vacío
(`EmptyState` con el mismo texto del web), error (`ErrorView` con el `detail` del backend y
"Reintentar") y datos. Formularios: validación en cliente con los mismos mensajes del web y, al
fallar el backend, el `detail` en un `SnackBar` (o bajo el campo si el `code` lo identifica).

## 8. Pruebas (equivalente a Playwright)

1. **Unitarias** (`flutter test`): formateo de fechas/horas, parseo de errores RFC 7807, reglas de
   permisos (`puede`), reglas de fechas del wizard, decodificación de entidades HTML.
2. **Widget tests responsive** (`flutter test`): cada pantalla se pinta con datos falsos
   (providers sobreescritos) en **360×740, 390×844, 768×1024 y 1024×768**, en claro y oscuro. Flutter
   hace fallar la prueba ante cualquier desborde (`RenderFlex overflowed`), que es el equivalente al
   barrido responsive de Playwright.
3. **E2E en simulador/emulador** (`integration_test`, oficial): contra el backend local, en simulador
   iPhone y iPad (iOS) y en el emulador Android `Medium_Phone_API_36.1`. Flujos: login de cada rol,
   ciclo completo de una solicitud (wizard → enviar → tomar → subsanación → reenviar → aprobar →
   cerrar), adjunto, campana, acceso denegado por rol, superadmin con selector de plaza. Guarda
   capturas por dispositivo.

Comando de referencia: `flutter test` y
`flutter test integration_test -d <simulador> --dart-define=API_BASE_URL=…`.

## 9. Bugs del backend que la app tiene en cuenta

Detalle y reproducción en `docs/08-auditoria-qa-y-mejoras.md`. Los que cambian lo que hace la app:
editar remodelación falla (422) → la app muestra el error del backend sin ocultarlo; PATCH parcial
apaga emergencia → la app siempre envía `esEmergencia`; entidades HTML → se decodifican al mostrar;
el superadmin no puede usar Calendario ni Configuración (403) → la app oculta esas opciones para el
superadmin; el inquilino sí puede gestionar adjuntos de sus contratos en el backend → la app lo
permite (el web lo bloquea por error).

## 10. Entornos y distribución (decisiones mías, revisables)

- `API_BASE_URL` por `--dart-define`; por defecto el backend local según plataforma.
- HTTP sin TLS permitido **solo** para desarrollo local: Android `usesCleartextTraffic` en el
  manifest de `debug`; iOS `NSAllowsLocalNetworking` (no se desactiva ATS en general).
- Textos de permisos de cámara y fotos en `Info.plist` y permisos en `AndroidManifest.xml`.
- `frontend_mobil/AGENTS.md` y `README.md` se reescriben: las reglas viejas (provider, dio,
  table_calendar, lucide_icons, Firebase) quedan reemplazadas por este diseño.
- **Requisitos previos para usuarios reales** (fuera del código de la app, documentados en
  `docs/08-auditoria-qa-y-mejoras.md`): rate limit por usuario en vez de por IP (F17) y
  `MINIO_PUBLIC_ENDPOINT` alcanzable desde el teléfono para descargar adjuntos.

## 11. Qué queda al criterio del implementador

Textos de ayuda menores, iconografía Material equivalente a lucide, animaciones, orden de las
pestañas en tablet y el detalle visual de tarjetas, siempre dentro de los tokens de color del web.
