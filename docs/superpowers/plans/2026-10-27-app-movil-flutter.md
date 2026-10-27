# App móvil Plazapp (Flutter + Riverpod) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar `frontend_mobil/` por una app Flutter (iOS + Android, teléfono y tablet) que hace todo lo que hace el frontend web, hablando directo con el backend NestJS.

**Architecture:** Carpetas por feature con cuatro tipos de archivo (`*_modelos.dart`, `*_api.dart`, `*_providers.dart`, páginas). Riverpod sin codegen: `FutureProvider` para leer, llamadas directas a `*_api.dart` + `ref.invalidate` para escribir, y dos `Notifier` globales (sesión y plaza elegida). Un único `ApiClient` concentra HTTP, tokens, refresh *single-flight*, `x-plaza-id` y errores RFC 7807. Rutas con las mismas URLs del web (`/admin/solicitudes/:id`…) para que notificaciones y enlaces se traduzcan 1:1.

**Tech Stack:** Flutter 3.47.8 / Dart 3.13.7 · flutter_riverpod 3.4.x · go_router 18.x · http 1.6.x · flutter_secure_storage 11.x · shared_preferences · intl · file_picker 13.x · image_picker · mime · path_provider · share_plus 13.x · url_launcher · fl_chart 1.3.x · flutter_test · integration_test.

**Spec:** `docs/superpowers/specs/2026-10-27-app-movil-flutter-design.md` (aprobado). Referencia funcional pantalla por pantalla (endpoints, payloads, reglas, textos): `docs/superpowers/specs/2026-10-27-inventario-web-para-movil.md` — citado abajo como **Inv §x**.

## Global Constraints

- **Paridad con el web:** la app hace lo mismo que el web, sin funciones nuevas. Solo se adapta la presentación al móvil (panel de decisión fijo abajo en teléfono, botones sin permiso ocultos en vez de fallar) y se replica el comportamiento **corregido** donde el web tenía bugs de cliente (diálogos que no ejecutan al cancelar, campos vacíos, comentario de cierre).

- Proyecto en `frontend_mobil/` (se reemplaza el contenido actual). Android `com.helixsys.frontend_mobil`, iOS `com.helixsys.frontendMobil`.
- Solo los paquetes de la tabla §4.1 del spec, con la última versión verificada en pub.dev al instalar (anotar en `frontend_mobil/CHANGELOG.md`). Nada de `dio`, `bloc`, `provider`, `freezed`, `retrofit`, `riverpod_generator`, `build_runner`, `table_calendar`, paquetes de iconos o de color picker.
- Iconos: `Icons.*` de Material (equivalente visual al lucide del web).
- Textos de UI en español, iguales a los del web (Inv cita los textos exactos).
- Fechas: zona fija `America/El_Salvador` = UTC−6 sin horario de verano. Horas visibles en 12 h (`2:00 pm`); fechas civiles `DD-MM-YYYY`; instantes `dd/MM/yyyy`.
- Payloads: campos opcionales vacíos se omiten o van `null`, nunca `''`. PATCH de solicitud siempre incluye `esEmergencia`. Textos recibidos pasan por `decodificarHtml` antes de mostrarse.
- Errores: mensaje = `detail` (string o lista unida con `"; "`); la UI decide por `code`, nunca por status.
- Diálogos de decisión: `confirmar()` / `pedirTexto()`; cerrar el diálogo = no hacer nada.
- `API_BASE_URL` por `--dart-define`; por defecto `http://localhost:4000/api/v1` (iOS) y `http://10.0.2.2:4000/api/v1` (Android). HTTP sin TLS solo en debug (Android manifest `debug`, iOS `NSAllowsLocalNetworking`).
- `flutter analyze` sin issues y `dart format` aplicado en cada commit. Commits convencionales en la rama `feat/app-movil-riverpod`.

## Review Focus

1. **Token vencido con varias peticiones a la vez** (p. ej. dashboard que carga 3 endpoints tras 1 h): un solo refresh, todas reintentan una vez y la sesión sigue. → test en Task 2 (`refresh single-flight`).
2. **Teléfono de 360 px con textos largos** (razón social larga, título de 120 caracteres, código `SOL-carga-qa-1234`): nada desborda. → `probarEnTamanos` con fixtures de textos largos en cada task de pantallas.
3. **Login limitado (429)**: mensaje "Demasiados intentos, espera N s" distinto de "Cuenta bloqueada" (`ACCOUNT_LOCKED`) y de `PLAZA_INACTIVA`. → test en Task 3.
4. **Superadmin sin plaza elegida** entrando a una pantalla de plaza: ve "Selecciona una plaza para operar", nunca un error 400/403. → test en Task 3.
5. **Adjunto con extensión correcta pero MIME desconocido** (`.dwg`, `.mov`): se envía con el MIME de la lista del web, no `application/octet-stream`. → test en Task 4 (`mimeParaArchivo`).

---

### Task 1: Proyecto base, dependencias y configuración de plataformas

**Files:**
- Delete: todo `frontend_mobil/` excepto `.git` (no existe) — borrar `lib/`, `test/`, `android/`, `ios/`, `assets/`, `pubspec.*`, `AGENTS.md`, `CHANGELOG.md`, `README.md`, `analysis_options.yaml`, `devtools_options.yaml`, `.metadata`, `.dart_tool/`, `.flutter-plugins-dependencies`.
- Create (con `flutter create --org com.helixsys --project-name frontend_mobil --platforms android,ios frontend_mobil`): proyecto nuevo.
- Modify: `frontend_mobil/pubspec.yaml`, `frontend_mobil/analysis_options.yaml`, `android/app/src/debug/AndroidManifest.xml`, `android/app/src/main/AndroidManifest.xml`, `ios/Runner/Info.plist`.
- Create: `frontend_mobil/README.md`, `frontend_mobil/AGENTS.md`, `frontend_mobil/CHANGELOG.md`, `frontend_mobil/lib/main.dart`, `frontend_mobil/lib/app.dart`, `frontend_mobil/lib/core/config.dart`, `frontend_mobil/assets/plantillas/plantilla-carga-inicial.xlsx` (copia de `frontend/public/plantillas/plantilla-carga-inicial.xlsx`).
- Test: `frontend_mobil/test/app_test.dart`

**Interfaces:**
- Produces: `const String apiBaseUrl` en `core/config.dart` (`String.fromEnvironment('API_BASE_URL', defaultValue: …)` con el default por plataforma resuelto en una función `String resolverApiBaseUrl()`); `class PlazappApp extends ConsumerWidget` en `app.dart`.

- [ ] **Step 1:** Borrar el contenido viejo y ejecutar `flutter create` con los ids de arriba. Verificar en `android/app/build.gradle.kts` y en `ios/Runner.xcodeproj/project.pbxproj` que los ids coinciden.
- [ ] **Step 2:** `flutter pub add` de cada paquete de la tabla del spec (y `dev:integration_test:{"sdk":"flutter"}`, `flutter_localizations:{"sdk":"flutter"}`). Antes de cada uno, comprobar versión y publisher en `https://pub.dev/api/packages/<pkg>` y anotar versión instalada + publisher en `CHANGELOG.md` (formato de tabla del `CLAUDE.md` raíz).
- [ ] **Step 3:** Permisos y red: `INTERNET` en el manifest principal; `android:usesCleartextTraffic="true"` solo en `src/debug/AndroidManifest.xml`; en `Info.plist` `NSAppTransportSecurity > NSAllowsLocalNetworking = true`, `NSCameraUsageDescription` = "Plazapp usa la cámara para adjuntar fotos a tus solicitudes." y `NSPhotoLibraryUsageDescription` = "Plazapp usa tus fotos para adjuntarlas a tus solicitudes.".
- [ ] **Step 4:** `analysis_options.yaml` con `flutter_lints` + `prefer_single_quotes`, `always_declare_return_types`, `avoid_print`, `require_trailing_commas`.
- [ ] **Step 5: Test** `test/app_test.dart` → `testWidgets('arranca y muestra el login', …)`: bombea `ProviderScope(child: PlazappApp())` con almacenamiento de tokens vacío (override del provider de Task 2 cuando exista; en este task, `PlazappApp` muestra un `Text('Plazapp')`) y espera `find.text('Plazapp')`.
- [ ] **Step 6:** `flutter analyze && flutter test` → sin issues, 1 test pasa. `flutter build apk --debug` y `flutter build ios --simulator --debug` compilan.
- [ ] **Step 7:** Reescribir `README.md` (cómo correr en simulador iOS/Android, `--dart-define`, cómo correr pruebas) y `AGENTS.md` (las reglas de Global Constraints + estructura del spec §4.2/§4.3). Commit `feat(movil): proyecto Flutter base con Riverpod`.

### Task 2: Núcleo — formato, errores, cliente HTTP y almacenamiento de tokens

**Files:**
- Create: `lib/core/format/fechas.dart`, `lib/core/format/montos.dart`, `lib/core/format/texto.dart`, `lib/core/api/api_error.dart`, `lib/core/api/api_client.dart`, `lib/core/api/paginado.dart`, `lib/core/auth/token_storage.dart`
- Test: `test/core/format_test.dart`, `test/core/api_client_test.dart`

**Interfaces:**
- Produces (`fechas.dart`): `DateTime aHoraPlaza(DateTime instante)` (UTC−6, devuelve DateTime "de pared"); `String formatFechaDMY(String? ymd)` → `'—'` si null; `String formatFecha(String? iso)` → `dd/MM/yyyy` en hora plaza; `String formatFechaHora(String? iso)` → `dd/MM/yyyy h:mm am`; `String formatHora12(String? hhmm)`; `String formatHoraInstante(String iso)`; `String tiempoRelativo(DateTime instante, {DateTime? ahora})` (reglas Inv §5.3); `String ymd(DateTime d)`; `String fechaPlazaHoy({int dias = 0})`.
- Produces (`montos.dart`): `String formatMonto(num? valor, {String moneda = 'USD'})` → `USD 1,250.00`.
- Produces (`texto.dart`): `String decodificarHtml(String? s)` (`&amp; &lt; &gt; &quot; &#39; &#x27;`), `String iniciales(String nombre)`.
- Produces (`api_error.dart`): `class ApiError implements Exception { final int status; final String code; final String mensaje; final Map<String, dynamic>? meta; }` + `factory ApiError.desdeRespuesta(int status, String body)` + `ApiError.sinConexion()` (`code: 'SIN_CONEXION'`, mensaje "No se pudo conectar con el servidor.").
- Produces (`paginado.dart`): `class Paginado<T> { final List<T> items; final int total, page, pageSize, totalPages; factory Paginado.fromJson(Map<String, dynamic> j, T Function(Map<String, dynamic>) item); }`.
- Produces (`token_storage.dart`): `class Tokens { final String accessToken, refreshToken; final DateTime expiraEn; }`; `abstract class TokenStorage { Future<Tokens?> leer(); Future<void> guardar(Tokens t); Future<void> borrar(); }`; `class SecureTokenStorage implements TokenStorage`; `class MemoryTokenStorage implements TokenStorage`.
- Produces (`api_client.dart`): `class ApiClient { ApiClient({required String baseUrl, required TokenStorage tokens, http.Client? http, String? Function()? plazaSeleccionada, void Function()? onSesionExpirada}); Future<dynamic> get(String path, {Map<String, Object?>? query}); post/patch/put/delete(String path, {Object? body}); Future<Uint8List> bytes(String path, {Map<String, Object?>? query}); Future<dynamic> subir(String path, {required String nombreArchivo, required Uint8List contenido, required String mimeType}); Future<Map<String, dynamic>> login(String email, String password); Future<void> logout(); }`. Query: omite `null` y `''`, booleanos como `'true'/'false'`, listas unidas por coma. `subir` usa el campo multipart `file` con `MediaType` explícito. `login` guarda los tokens y devuelve el JSON completo; `logout` revoca el refresh (ignora fallo) y borra tokens.
- Riverpod: `final tokenStorageProvider = Provider<TokenStorage>((ref) => SecureTokenStorage());` y `final apiClientProvider = Provider<ApiClient>(…)` (lee `plazaSeleccionadaProvider` de Task 3 vía callback; en este task el callback devuelve `null`).

- [ ] **Step 1: Tests de formato** en `format_test.dart`: `formatHora12('15:27') == '3:27 pm'`, `formatHora12('00:05') == '12:05 am'`; `formatFechaDMY('2026-10-02') == '02-10-2026'`; `formatFechaHora('2026-09-28T18:00:00Z') == '28/09/2026 12:00 pm'`; `formatFecha('2026-09-29T03:00:00Z') == '28/09/2026'` (cruce de día por UTC−6); `formatMonto(1250) == 'USD 1,250.00'`; `decodificarHtml('Pintura &amp; Acabados') == 'Pintura & Acabados'`; `tiempoRelativo(ahora - 30 s) == 'hace un momento'`, `(ahora - 5 min) == 'hace 5 minutos'`, `(ahora - 1 día) == 'ayer'`, `(ahora - 9 días)` == `formatFechaHora`.
- [ ] **Step 2:** `flutter test test/core/format_test.dart` → falla (no existen). Implementar `fechas.dart`, `montos.dart`, `texto.dart` con `intl` (`NumberFormat('#,##0.00', 'en_US')`). → pasa.
- [ ] **Step 3: Tests del cliente** en `api_client_test.dart` con `MockClient` de `package:http/testing.dart`:
  - `'agrega Bearer y x-plaza-id solo si hay plaza'`: headers capturados contienen `Authorization: Bearer A1` y `x-plaza-id` igual al callback.
  - `'401 TOKEN_EXPIRED → refresca una vez y reintenta'`: primera respuesta 401 `{"code":"TOKEN_EXPIRED"}`, `POST /auth/refresh` devuelve par nuevo, reintento 200; `tokens.leer()` devuelve el par nuevo.
  - `'refresh single-flight'`: 3 `get` simultáneos reciben 401 → `POST /auth/refresh` se llama **exactamente 1 vez** y los 3 resuelven 200.
  - `'REFRESH_INVALID cierra sesión'`: refresh 401 `REFRESH_INVALID` → `onSesionExpirada` llamado, tokens borrados, se lanza `ApiError` con `code == 'REFRESH_INVALID'`.
  - `'refresh proactivo'`: con `expiraEn` a 30 s, el `get` refresca antes de pedir.
  - `'error 400 con detail lista'`: body `{"code":"VALIDATION_ERROR","detail":["a: x","b: y"]}` → `ApiError.mensaje == 'a: x; b: y'`.
  - `'query omite vacíos'`: `get('/x', query: {'a': null, 'b': '', 'c': true, 'd': ['1','2']})` → URL `?c=true&d=1,2`.
  - `'subir manda multipart con MIME declarado'`: el `MultipartRequest` lleva el campo `file` con `contentType` `application/dwg` y filename.
  - `'sin conexión'`: `MockClient` lanza `SocketException` → `ApiError.code == 'SIN_CONEXION'`.
- [ ] **Step 4:** Ejecutar → fallan. Implementar `api_error.dart`, `paginado.dart`, `token_storage.dart`, `api_client.dart` (refresh en un `Future<void>? _refrescando` compartido; persistir el par antes de completar). → pasan.
- [ ] **Step 5:** `flutter analyze` limpio. Commit `feat(movil): núcleo HTTP, tokens y formato`.

### Task 3: Sesión, permisos, tema, navegación por rol y login

**Files:**
- Create: `lib/core/auth/sesion.dart`, `lib/core/auth/sesion_controller.dart`, `lib/core/auth/permisos.dart`, `lib/core/plaza/plaza_seleccionada.dart`, `lib/core/theme/colores.dart`, `lib/core/theme/tema.dart`, `lib/core/navegacion/menu.dart`, `lib/core/navegacion/router.dart`, `lib/core/navegacion/rutas.dart`, `lib/core/widgets/app_scaffold.dart`, `lib/features/auth/login_page.dart`, `lib/features/auth/reset_password_page.dart`, `lib/features/auth/cambiar_password_dialog.dart`, `lib/features/auth/auth_api.dart`, `lib/features/shell/plaza_selector.dart`, `lib/features/shell/campana.dart` (stub: `SizedBox.shrink()` hasta Task 10), un archivo `lib/features/<feature>/<feature>_rutas.dart` **stub** por feature (ver Interfaces).
- Modify: `lib/app.dart`, `lib/core/api/api_client.dart` (callback de plaza).
- Test: `test/core/permisos_test.dart`, `test/core/router_test.dart`, `test/features/login_test.dart`, `test/helpers/api_falsa.dart`, `test/helpers/pantallas.dart`

**Interfaces:**
- Produces: `enum Rol { superadmin, adminPlaza, inquilino }` (`Rol.desdeCodigo('admin_plaza')`); `class Usuario { id, email, nombre, rol, plazaId, rolStaffId, inquilinoId }`; `class Sesion { final Usuario usuario; final List<String> permisos; bool puede(Object permiso); }`.
- Produces: `bool puede(List<String> permisos, Object permiso)` — `'*'` pasa todo; `String` o `List<String>` (OR); lista vacía requerida = deniega (Inv §1.6).
- Produces: `final sesionProvider = AsyncNotifierProvider<SesionController, Sesion?>(SesionController.new);` con `Future<void> iniciarSesion(String email, String password)`, `Future<void> cerrarSesion()`, `Future<void> refrescarPermisos()`; `build()` restaura (tokens → `GET /auth/me` + `GET /auth/me/permisos`) o devuelve `null`.
- Produces: `final plazaSeleccionadaProvider = NotifierProvider<PlazaSeleccionadaController, String?>(…)` (persistida en `shared_preferences`, clave `sa_plaza`; `seleccionar(String? id)`).
- Produces: `class ColoresPlazapp extends ThemeExtension<ColoresPlazapp>` con los tokens del web (Inv §6.4: `bg, surface, surface2, surface3, border, text, text2, text3, primary`, tonos `ok/info/warn/orange/indigo/cyan/danger/violet/neutral` como `(fg, bg, bd)`), `ThemeData temaClaro(Color primario)`, `ThemeData temaOscuro(Color primario)`; `final temaModoProvider` (`ThemeMode`, persistido).
- Produces: `class ItemMenu { final String etiqueta; final IconData icono; final String ruta; final Object? permiso; final String? grupo; }`, `List<ItemMenu> menuPara(Sesion s, {bool conPlaza})` con la tabla exacta de Inv §2.1 (más "Mis contratos" para inquilino; sin Calendario/Configuración para superadmin, spec §9).
- Produces: `String homePara(Rol rol)` (Inv §2.2); `final routerProvider = Provider<GoRouter>(…)` con `refreshListenable` atado a `sesionProvider`, redirect: sin sesión → `/login?expired=1` (si había sesión); rol que no corresponde al prefijo (`/admin`, `/inquilino`, `/superadmin`) → home del rol; superadmin en `/admin/*` sin plaza → página `SeleccionaPlazaPage`.
- Produces (stubs que cada feature task reemplaza; **la firma no cambia**): `List<RouteBase> rutasDashboard()`, `rutasSolicitudesAdmin()`, `rutasSolicitudesInquilino()`, `rutasCalendario()`, `rutasLocales()`, `rutasInquilinos()`, `rutasContratos()`, `rutasCatalogos()`, `rutasUsuarios()`, `rutasReportes()`, `rutasAuditoria()`, `rutasNotificaciones()`, `rutasConfiguracion()`, `rutasSuperadmin()`. Los stubs devuelven `GoRoute`s con las rutas del web (Inv §3) apuntando a `EnConstruccionPage(titulo)`.
- Produces: `class AppScaffold extends ConsumerWidget { AppScaffold({required Widget child, required String rutaActual}); }` — < 600: `Drawer`; 600–1023: `NavigationRail` compacto; ≥ 1024: `NavigationRail` extendido. AppBar con selector de plaza (superadmin), chip de plaza, toggle de tema, campana y avatar; pie del menú: usuario, rol, "Cambiar contraseña", "Cerrar sesión".
- Test helpers: `ApiClient apiFalsa(Map<String, Object? Function(http.Request)> rutas)` (clave `'GET /solicitudes'`; 404 si no hay ruta); `Future<void> probarEnTamanos(WidgetTester t, Widget Function() pantalla, {List<Override> overrides = const []})` que recorre `Size(360,740), Size(390,844), Size(768,1024), Size(1024,768)` en claro y oscuro, hace `pumpAndSettle` y falla ante cualquier `FlutterError` (desborde).

- [ ] **Step 1: Tests** `permisos_test.dart`: `puede(['*'], 'x')`, `puede(['a'], ['b','a'])` true, `puede([], 'a')` false, `puede(['a'], <String>[])` false.
- [ ] **Step 2: Tests** `router_test.dart` (router con `sesionProvider` sobreescrito): inquilino que abre `/admin/dashboard` termina en `/inquilino/solicitudes`; admin que abre `/superadmin/plazas` termina en `/admin/dashboard`; sin sesión `/admin/locales` → `/login`; superadmin sin plaza en `/admin/locales` → muestra `'Selecciona una plaza para operar'`; con plaza → la página de locales.
- [ ] **Step 3: Tests** `login_test.dart` con `apiFalsa`: credenciales correctas → navega a la home del rol; 401 → `'Email o contraseña incorrectos'`; 429 `ACCOUNT_LOCKED` → `'Cuenta bloqueada temporalmente por varios intentos fallidos. Intenta más tarde.'`; 429 `TOO_MANY_REQUESTS` con `Retry-After: 42` → `'Demasiados intentos. Espera 42 s e intenta de nuevo.'`; 403 `PLAZA_INACTIVA` → `'La plaza de este usuario está desactivada. Contacta al administrador de la plataforma.'`; email inválido → validación local sin llamar a la API. Login en `probarEnTamanos`.
- [ ] **Step 4:** Ejecutar → fallan. Implementar los archivos listados. Reset de contraseña: pantalla "Restablecer contraseña" (Inv §1.8) que llama `POST /auth/reset-password` y muestra el banner verde; "Cambiar contraseña" (Inv §1.7) cierra sesión al terminar y vuelve al login con el aviso de contraseña actualizada.
- [ ] **Step 5:** `flutter test` → pasan; `flutter analyze` limpio. Commit `feat(movil): sesión, permisos, tema y navegación por rol`.

### Task 4: Widgets compartidos y adjuntos

**Files:**
- Create: `lib/core/widgets/async_view.dart`, `lista_responsive.dart`, `paginador.dart`, `badges.dart`, `estados.dart` (EmptyState, ErrorView), `can.dart`, `dialogos.dart`, `campos_fecha.dart`, `key_value_grid.dart`, `avisos.dart` (Banner, SnackBars), `lib/core/adjuntos/adjuntos_modelos.dart`, `adjuntos_api.dart`, `adjuntos_seccion.dart`, `mime_permitidos.dart`, `lib/core/descargas/descargar_y_compartir.dart`
- Test: `test/core/widgets_test.dart`, `test/core/adjuntos_test.dart`

**Interfaces:**
- Produces: `AsyncView<T>({required AsyncValue<T> value, required Widget Function(T) data, VoidCallback? onRetry})`; `class ColumnaLista<T> { ColumnaLista({required String titulo, required Widget Function(T) celda, bool principal = false, bool ocultarEnTarjeta = false}); }`; `ListaResponsive<T>({required List<T> items, required List<ColumnaLista<T>> columnas, Widget Function(T)? acciones, void Function(T)? onTap, Widget? vacio})` — tabla (`DataTable` en scroll horizontal) si `ancho ≥ 900`, si no tarjetas con la columna `principal` como título; `Paginador({required int pagina, required int totalPaginas, required ValueChanged<int> onCambiar})`.
- Produces: `enum Tono { ok, info, warn, orange, indigo, cyan, danger, violet, neutral }`; `BadgePlazapp(String texto, Tono tono, {bool punto = true})`; `EstadoSolicitudBadge(String estado)`, `PrioridadBadge(String prioridad)`, `EstadoLocalBadge`, `EstadoContratoBadge`, `SlaSemaforo(String? status)` con etiquetas y tonos de Inv §6.1; `const etiquetaEstadoSolicitud = <String, String>{…}` (Inv §6.1).
- Produces: `EmptyState({required IconData icono, required String titulo, String? mensaje})`, `ErrorView({required Object error, VoidCallback? onRetry})`, `Can({required Object permiso, required Widget child, Widget otherwise = const SizedBox.shrink()})`, `AvisoBanner({required Tono tono, required Widget child})`, `void mostrarExito(BuildContext c, String m)`, `void mostrarError(BuildContext c, Object e)`.
- Produces: `Future<bool> confirmar(BuildContext c, {required String titulo, String? mensaje, required String textoConfirmar, bool destructiva = false})`; `Future<String?> pedirTexto(BuildContext c, {required String titulo, String? mensaje, String? hint, required String textoConfirmar, bool obligatorio = false, int maxLength = 1000})` — `null` al cancelar, `''` si vacío y no obligatorio.
- Produces: `CampoFecha({required String label, String? valorYmd, required ValueChanged<String?> onChanged, DateTime? primera, DateTime? ultima})`, `CampoHora({required String label, String? valorHhmm, required ValueChanged<String?> onChanged})` (muestra 12 h, entrega `HH:mm`); `KeyValueGrid(List<(String, Widget)> pares)` (1 columna < 600, 2 columnas ≥ 600).
- Produces: `class Adjunto { id, nombreOriginal, mimeType, tamanoBytes, usuarioSubioId, createdAt }`; `String? mimeParaArchivo(String nombre)` desde la tabla de Inv §4.2.4 (null si no permitido); `const tamanoMaxAdjuntoBytes = 50 * 1024 * 1024`; `AdjuntosSeccion({required List<Adjunto> adjuntos, required Future<void> Function(String nombre, Uint8List bytes, String mime) subir, Future<void> Function(Adjunto)? eliminar, required bool puedeSubir, int maximo = 10})` (botones "Subir archivo" y "Tomar foto"; descarga con `GET /adjuntos/:id/download` + `url_launcher`); `Future<void> descargarYCompartir(BuildContext c, {required Future<Uint8List> Function() descargar, required String nombreArchivo, required String mimeType})`.

- [ ] **Step 1: Tests** `adjuntos_test.dart`: `mimeParaArchivo('plano.DWG') == 'application/dwg'`, `('video.mov') == 'video/quicktime'`, `('foto.jpeg') == 'image/jpeg'`, `('script.exe') == null`; `AdjuntosSeccion` rechaza un archivo de 51 MB con el texto `'El archivo supera el máximo de 50 MB.'` y oculta "Subir" con 10 adjuntos.
- [ ] **Step 2: Tests** `widgets_test.dart`: `pedirTexto` → tocar "Volver" devuelve `null`; con `obligatorio: true` el botón confirmar queda deshabilitado con texto vacío; `ListaResponsive` muestra tarjetas a 390 px y `DataTable` a 1024 px; `EstadoSolicitudBadge('requerida_subsanacion')` muestra `'Requiere subsanación'`; `Paginador(pagina: 5, totalPaginas: 20)` cabe en 360 px; todos con `probarEnTamanos` y textos de 120 caracteres.
- [ ] **Step 3:** Ejecutar → fallan. Implementar. → pasan. `flutter analyze` limpio. Commit `feat(movil): widgets compartidos y adjuntos`.

### Task 5: Solicitudes del inquilino (lista, detalle, wizard, edición)

**Files:**
- Create: `lib/features/solicitudes/solicitudes_modelos.dart`, `solicitudes_api.dart`, `solicitudes_providers.dart`, `reglas_fechas.dart`, `lib/features/solicitudes/inquilino/mis_solicitudes_page.dart`, `detalle_inquilino_page.dart`, `wizard_page.dart` (+ `wizard/` con un widget por paso), `lib/features/solicitudes/comun/comentarios_tab.dart`, `historial_tab.dart`, `detalle_campos.dart`
- Modify: `lib/features/solicitudes/solicitudes_rutas.dart` (`rutasSolicitudesInquilino()`)
- Test: `test/features/solicitudes/reglas_fechas_test.dart`, `modelos_test.dart`, `inquilino_pages_test.dart`

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces (modelos, usados también por Tasks 6 y 8): `class SolicitudItem` (campos de `SolicitudListItem`, Inv §4.1), `class SolicitudDetalle extends SolicitudItem` (+ `adjuntos`, `comentarios`, `historial`, `camposExtra`, empresa, emergencia, fechas, horas), `class Comentario`, `class HistorialItem`; `const estadosTerminales = {'cerrada','rechazada','cancelada'}`.
- Produces (api): `Future<Paginado<SolicitudItem>> listarSolicitudes(ApiClient api, FiltroSolicitudes f)`, `Future<SolicitudDetalle> obtenerSolicitud(ApiClient, String id)`, `crearSolicitud(ApiClient, Map<String, Object?> body)`, `actualizarSolicitud(ApiClient, String id, Map<String, Object?> body)` (añade `esEmergencia` si falta → lanza `ArgumentError`), `enviar`, `subsanar`, `cancelar(…, {String? motivo})`, `duplicar`, `comentar(…, String cuerpo)`, `subirAdjuntoSolicitud`, `Future<Uint8List> pdfPermiso(ApiClient, String id)` (`GET /reportes/solicitudes/:id/permiso.pdf`), `listarTiposActivos`, `listarCategoriasConSubcategorias`, `buscarDuplicados(localId, tipo)`, `locales del inquilino` (`GET /contratos?estado=vigente`).
- Produces (providers): `misSolicitudesProvider` (`FutureProvider.autoDispose.family<Paginado<SolicitudItem>, FiltroSolicitudes>`), `solicitudProvider` (`FutureProvider.autoDispose.family<SolicitudDetalle, String>`).
- Produces (`reglas_fechas.dart`, espejo de `frontend/src/lib/solicitud-fechas.ts`): `String? validarFechasSolicitud({required DateTime ahora, required String? inicio, required String? fin, required String? horaInicio, required String? horaFin, required bool emergencia})` → mensaje de error o `null`; `DateTime minInicio(DateTime ahora, bool emergencia)`, `DateTime maxInicio(…)`, `DateTime maxFin(String inicio, DateTime ahora, bool emergencia)`.
- Rutas: `/inquilino/solicitudes`, `/inquilino/solicitudes/nueva` (acepta `?tipo=evento&fecha=YYYY-MM-DD&hora=HH:mm`), `/inquilino/solicitudes/:id`, `/inquilino/solicitudes/:id/editar`.

- [ ] **Step 1: Tests** `reglas_fechas_test.dart` copiando los casos de `frontend/src/lib/solicitud-fechas.ts`: estándar con inicio a 24 h → error 48 h; inicio a 6 días → error 5 días; fin a 8 días del inicio → error 7 días; emergencia inicio a 12 h → OK; fin antes que inicio → error; hora fin ≤ hora inicio el mismo día → error.
- [ ] **Step 2: Tests** `modelos_test.dart`: `SolicitudDetalle.fromJson` con un JSON real capturado de `GET /solicitudes/:id` (guardarlo en `test/fixtures/solicitud_detalle.json`) decodifica entidades HTML del título y deja `camposExtra` como mapa.
- [ ] **Step 3: Tests** `inquilino_pages_test.dart` con `apiFalsa`: lista con filtros (estado/tipo/fechas) y paginador; detalle en `requerida_subsanacion` muestra el aviso `'La administración pidió correcciones.'` con el motivo del último historial; botones por estado según la matriz Inv §4.3.2.1 (borrador: Editar/Enviar/Duplicar/Cancelar; enviada: Duplicar/Cancelar; aprobada: Duplicar + texto de pendiente de cierre; cerrada: solo resultado); cancelar → `pedirTexto` → "Volver" no llama a la API; wizard: paso 1 sin categoría no avanza, paso 2 exige asistentes (mín. 1) y fechas válidas, paso 3 "Guardar borrador" hace `POST /solicitudes` y "Enviar ahora" además `POST /:id/enviar`; edición de remodelación manda `tipo` + `camposExtra` + `esEmergencia`. Cada página en `probarEnTamanos`.
- [ ] **Step 4:** Ejecutar → fallan. Implementar (textos y validaciones de Inv §4.2). → pasan. Commit `feat(movil): solicitudes del inquilino`.

### Task 6: Bandeja y detalle del admin; solicitudes globales del superadmin

**Files:**
- Create: `lib/features/solicitudes/admin/bandeja_page.dart`, `detalle_admin_page.dart`, `panel_decision.dart`, `dialogos_decision.dart`, `lib/features/superadmin/solicitudes_globales_page.dart`, `solicitud_global_page.dart`
- Modify: `solicitudes_api.dart` (acciones admin), `solicitudes_rutas.dart` (`rutasSolicitudesAdmin()`), `lib/features/superadmin/superadmin_rutas.dart` (rutas de solicitudes globales)
- Test: `test/features/solicitudes/admin_pages_test.dart`

**Interfaces:**
- Consumes: modelos/api de Task 5.
- Produces (api): `bandeja(ApiClient, FiltroBandeja)` (`GET /solicitudes/bandeja`, con `asignadasAMi`, `orden`), `tomar`, `aprobar({String? comentario})`, `rechazar(String comentario)`, `pedirSubsanacion(String comentario)`, `pausar({String? motivo})`, `reanudar`, `cerrar({required String resultado, String? comentario})` (envía el comentario también con `exitoso`), `reasignar(String nuevoResponsableId, {String? comentario})`, `liberar({String? motivo})`, `cancelarAdmin(String motivo)`, `cambiarPrioridad(String p)`, `listarAdminsPlaza()`, `solicitudesGlobales(FiltroGlobal)`, `solicitudGlobal(id)`, `Future<Uint8List> exportarCsvGlobal(FiltroGlobal)`.
- Rutas: `/admin/solicitudes`, `/admin/solicitudes/:id`, `/superadmin/solicitudes`, `/superadmin/solicitudes/:id`.

- [ ] **Step 1: Tests** `admin_pages_test.dart`: bandeja con selector "Todas / Asignadas a mí", filtros estado/tipo/prioridad/orden, SLA visible; detalle muestra exactamente los botones de Inv §4.3.2.1 según estado, `soyAsignado` y permisos (`Can`); rechazar/pedir subsanación con comentario vacío → botón deshabilitado; cerrar exige resultado y comentario si ≠ `exitoso`; selector de prioridad oculto en `borrador`, `aprobada` y terminales (F14); "Liberar" con `pedirTexto` cancelado no llama a la API; en teléfono el panel de decisión es una barra fija inferior con la acción principal + "Más acciones" (mejora M2); superadmin: lista global con filtro de plaza, detalle de solo lectura con comentarios/historial/adjuntos, botón "Exportar CSV" que llama a `descargarYCompartir`. Todo en `probarEnTamanos`.
- [ ] **Step 2:** Ejecutar → fallan. Implementar. → pasan. Commit `feat(movil): bandeja y decisiones del admin, vista global`.

### Task 7: Calendario (mes, semana/día con rejilla de horas, agenda)

**Files:**
- Create: `lib/features/calendario/calendario_modelos.dart`, `calendario_api.dart`, `calendario_providers.dart`, `calendario_page.dart`, `vistas/vista_mes.dart`, `vistas/vista_rejilla.dart` (semana y día), `vistas/vista_agenda.dart`, `detalle_evento_sheet.dart`, `filtros_calendario.dart`, `layout_eventos.dart`
- Modify: `lib/features/calendario/calendario_rutas.dart`
- Test: `test/features/calendario/layout_eventos_test.dart`, `calendario_page_test.dart`

**Interfaces:**
- Produces: `class EventoCalendario { id, titulo, inicio (DateTime UTC), fin (DateTime? UTC), color, todoElDia, tipo, solicitudId, solicitudCodigo, localCodigo, estado, prioridad, choque }`; `feedCalendario(ApiClient, {required DateTime desde, required DateTime hasta, List<String>? locales, List<String>? inquilinos, Set<String>? tipos})` (`from`/`to` ISO con `-06:00`); `moverEvento(ApiClient, String eventoId, DateTime inicio, DateTime fin)` (`PATCH /calendario/eventos/:id/fechas`, id sin prefijo `evt-`); `Future<Uint8List> exportarIcs(ApiClient, {List<String>? locales})`.
- Produces (`layout_eventos.dart`, lógica pura de la rejilla): `List<EventoPosicionado> posicionarEventosDia(List<EventoCalendario> eventos, DateTime diaPlaza)` → columnas para solapes (`columna`, `totalColumnas`) y `top/alto` en minutos desde 00:00 hora plaza; eventos de todo el día van a una fila superior.
- Comportamiento (Inv §5.5): vistas Mes / Semana / Día / Agenda; teléfono arranca en Agenda; colores por tipo/estado; leyenda; filtros (admin: local, inquilino, tipo; inquilino: local, tipo; hitos según config); recarga cada 5 min mientras está visible; hoja de detalle con código, rango en 12 h, local, tipo, estado, aviso de choque y "Ver solicitud CODIGO"; admin con `calendario.mover_evento` en eventos `evento` no cerrados ve "Cambiar fechas" (selectores de fecha/hora); inquilino toca un día/hora libre → "Crear solicitud de evento" (abre el wizard con `?tipo=evento&fecha=&hora=`), o aviso de horario ocupado; botón "Exportar iCal" con `calendario.exportar_ics`.

- [ ] **Step 1: Tests** `layout_eventos_test.dart`: dos eventos solapados 10:00–11:00 y 10:30–12:00 → columnas 0 y 1 de 2; evento 21:42Z → top = 15:42 hora plaza (942 min); evento que cruza medianoche se recorta al día.
- [ ] **Step 2: Tests** `calendario_page_test.dart`: agenda agrupa por día con horas `3:42 pm – 5:42 pm` y el código en negrita; mes marca puntos en los días con eventos; hoja de detalle con "Cambiar fechas" solo para admin con permiso; inquilino en hueco ocupado ve `'Ya hay un evento aprobado en este horario. Elige otro slot del calendario.'`. Todo en `probarEnTamanos`.
- [ ] **Step 3:** Ejecutar → fallan. Implementar. → pasan. Commit `feat(movil): calendario con rejilla de horas`.

### Task 8: Locales, inquilinos y contratos (incluye carga inicial Excel)

**Files:**
- Create: `lib/features/locales/{locales_modelos,locales_api,locales_providers}.dart`, `locales_page.dart`, `local_form_page.dart`, `local_detalle_page.dart`; `lib/features/inquilinos/{…}` con `inquilinos_page.dart`, `inquilino_form_page.dart`, `inquilino_detalle_page.dart`, `usuarios_inquilino_tab.dart`; `lib/features/contratos/{…}` con `contratos_page.dart`, `contrato_form_page.dart`, `contrato_detalle_page.dart`, `renovar_contrato_sheet.dart`, `cerrar_contrato_sheet.dart`, `carga_inicial_page.dart`, `mis_contratos_page.dart`, `mi_contrato_page.dart`
- Modify: `locales_rutas.dart`, `inquilinos_rutas.dart`, `contratos_rutas.dart`
- Test: `test/features/catalogo_base_test.dart`

**Interfaces:**
- Consumes: Tasks 2–4; `SolicitudItem` (pestaña solicitudes de local/inquilino).
- Produces: modelos `Local`, `Inquilino`, `UsuarioInquilino`, `Contrato`, `ResultadoAnalisisCarga`; funciones de api según Inv §5.1 (listar con `search`/filtros, crear, actualizar, desactivar, adjuntos de local y contrato, usuarios de inquilino: alta con contraseña temporal `Tmp{base64url(9 bytes)}1a` mostrada una vez, resetear clave, deshabilitar/reactivar; contratos: crear con monto calculado `área × (canon + CAM)`, renovar, cerrar; carga inicial: `POST /importacion/carga-inicial/analizar` y `/ejecutar` con el `.xlsx` elegido; plantilla desde el asset de Task 1 compartida con `share_plus`).
- Rutas: las de Inv §3 filas 13–22 y 41–42.

- [ ] **Step 1: Tests** `catalogo_base_test.dart` con `apiFalsa`: alta de inquilino solo con razón social manda un body **sin** claves vacías (bug B1-R3 del web); alta de contrato calcula el monto (`50 × (20 + 4.5) = 1225.00`) y no permite editarlo; botones ocultos sin permiso (`locales.crear`, `contratos.renovar`, …) (mejora M7); alta de usuario de inquilino muestra la contraseña temporal una sola vez con botón copiar; carga inicial muestra resumen de filas válidas/avisos/errores antes de "Ejecutar". Todas las páginas en `probarEnTamanos` con razones sociales largas.
- [ ] **Step 2:** Ejecutar → fallan. Implementar. → pasan. Commit `feat(movil): locales, inquilinos y contratos`.

### Task 9: Catálogos, usuarios de plaza, roles de staff y matriz de permisos

**Files:**
- Create: `lib/features/catalogos/{categorias_modelos,categorias_api,categorias_providers}.dart`, `categorias_page.dart`, `categoria_form_page.dart`, `subcategorias_page.dart` (responsable y supervisores), `tipos_solicitud_page.dart`, `tipo_solicitud_page.dart`; `lib/features/usuarios/{usuarios_modelos,usuarios_api,usuarios_providers}.dart`, `usuarios_plaza_page.dart` (pestañas Usuarios / Roles de staff / Permisos), `usuario_plaza_page.dart`, `rol_staff_sheet.dart`, `matriz_permisos_page.dart`
- Modify: `catalogos_rutas.dart`, `usuarios_rutas.dart`
- Test: `test/features/catalogos_usuarios_test.dart`

**Interfaces:**
- Produces: endpoints de Inv §5.2. Usuarios: filtro Activos/Deshabilitados (`activo=false`, fix F6) con "Reactivar"; editar usuario cambia nombre, teléfono y rol de staff (fix F5; muestra el error `ULTIMO_ADMIN_SISTEMA`); matriz: selector de rol + lista por módulo con "todos" por módulo, "Guardar cambios" (`PUT /permisos/roles/:id`) y "Descartar"; el rol de sistema se muestra bloqueado.

- [ ] **Step 1: Tests**: filtro de deshabilitados pide `activo=false` y muestra "Reactivar"; editar rol envía `rolStaffId`; matriz marca "todos" de un módulo y el botón guardar manda el set completo; subcategoría con 5 supervisores bloquea agregar más (`'1/5'`…`'5/5'`). `probarEnTamanos` en cada página.
- [ ] **Step 2:** Ejecutar → fallan. Implementar. → pasan. Commit `feat(movil): catálogos, usuarios y permisos`.

### Task 10: Dashboard, reportes, auditoría, notificaciones, configuración, campana y superadmin

**Files:**
- Create: `lib/features/dashboard/{dashboard_api,dashboard_providers,dashboard_page}.dart`, `widgets/kpis.dart`, `widgets/graficas.dart` (fl_chart); `lib/features/reportes/reportes_page.dart` (+ api); `lib/features/auditoria/auditoria_page.dart` (+ api); `lib/features/notificaciones/{log_emails_page,campana_api,campana_providers}.dart`; `lib/features/configuracion/configuracion_page.dart` (pestañas General / Branding / SLA / Adjuntos / Calendario); `lib/features/superadmin/{plazas_page,nueva_plaza_sheet,dashboard_global_page}.dart`
- Modify: `lib/features/shell/campana.dart` (implementación real), sus `*_rutas.dart`
- Test: `test/features/paneles_test.dart`

**Interfaces:**
- Campana (Inv §5.3): `conteoNoLeidasProvider` con *polling* de 45 s mientras la app está en primer plano (`AppLifecycleListener`), lista de 20, marcar una / todas, navegación por `solicitudId` / `contratoId` a las rutas del rol, `tiempoRelativo` de Task 2, tipos con icono y tono de la tabla de Inv §5.3.
- Dashboard (Inv §5.7): KPIs + tendencia mensual (línea) + distribuciones (barras) con `fl_chart`; si faltan `reportes.kpis.ver`/`reportes.dashboard.ver` muestra aviso en lugar de error (C-R3); dashboard global sin `x-plaza-id` (C-R4).
- Reportes (Inv §5.6): filtros por entidad, vista previa (10 filas) y exportar CSV/XLSX/PDF vía `descargarYCompartir`.
- Configuración (Inv §5.2.1.10): branding con paleta de 12 colores + campo hex `#RRGGBB` y logo con `image_picker`.
- Superadmin (Inv §5.9): plazas (nueva, desactivar con `confirmar` destructiva, "Entrar" = seleccionar plaza e ir a `/admin/dashboard`), dashboard global.

- [ ] **Step 1: Tests**: campana muestra `'9+'` con 12 no leídas y desaparece con 0; tocar una notificación con `solicitudId` navega a `/admin/solicitudes/<id>` (admin) o `/inquilino/solicitudes/<id>` (inquilino); dashboard sin permisos muestra `'No tienes permiso para ver los indicadores.'`; reportes "Generar CSV" llama a `GET /reportes/solicitudes/export.csv` con los filtros; color hex inválido bloquea "Guardar"; "Entrar" en una plaza guarda `sa_plaza` y navega. `probarEnTamanos` en cada página.
- [ ] **Step 2:** Ejecutar → fallan. Implementar. → pasan. Commit `feat(movil): dashboard, reportes, notificaciones, configuración y superadmin`.

### Task 11: Pruebas E2E en simulador y emulador (`integration_test`)

**Files:**
- Create: `integration_test/helpers.dart`, `integration_test/login_roles_test.dart`, `integration_test/flujo_solicitud_test.dart`, `integration_test/navegacion_completa_test.dart`, `test_driver/integration_test.dart`, `scripts/e2e.sh`
- Modify: widgets clave con `Key('...')` estables donde los tests lo necesiten (`Key('login-email')`, `Key('login-password')`, `Key('login-enviar')`, `Key('menu-<ruta>')`, `Key('accion-<nombre>')`).

**Interfaces:**
- `helpers.dart`: `Future<void> iniciarSesion(WidgetTester t, String email)` (reintenta tras el `Retry-After` si el login responde 429), `Future<void> captura(IntegrationTestWidgetsFlutterBinding b, String nombre)` (`convertFlutterSurfaceToImage` en Android antes de la primera captura), `Future<void> irA(WidgetTester t, String ruta)` vía menú.
- `test_driver/integration_test.dart`: `integrationDriver(onScreenshot: …)` que guarda PNG en `build/capturas/<dispositivo>/<nombre>.png`.
- `scripts/e2e.sh <ios-phone|ios-tablet|android>`: arranca el simulador (`xcrun simctl boot F49D78DC-69BF-4D74-8993-AA06CC6936D9` iPhone 17 Pro / `797C30DA-29F4-4C13-80D6-C9AB6D0CB71A` iPad Pro 11) o el emulador `Medium_Phone_API_36.1`, y ejecuta `flutter drive --driver=test_driver/integration_test.dart --target=integration_test/<archivo> -d <id> --dart-define=API_BASE_URL=<url>` para cada archivo.

- [ ] **Step 1:** `login_roles_test.dart`: inquilino, admin y superadmin inician sesión y llegan a su home; acceso cruzado por URL redirige; cerrar sesión vuelve al login. Captura de cada home.
- [ ] **Step 2:** `flujo_solicitud_test.dart`: el inquilino crea una solicitud de mantenimiento en el wizard (título `E2E-MOVIL-<timestamp>`, asistentes, fechas a +3 días), adjunta una imagen de prueba (`assets` de test), la envía; el admin la toma, pide subsanación; el inquilino ve el aviso y reenvía; el admin la toma, aprueba y la cierra con resultado "Cerrada con éxito"; el historial muestra las 5 transiciones. Capturas en cada paso.
- [ ] **Step 3:** `navegacion_completa_test.dart`: por cada rol recorre todos los ítems del menú y abre el primer detalle de cada listado; falla si aparece `ErrorView` o una excepción de layout. Captura por pantalla.
- [ ] **Step 4:** Ejecutar `scripts/e2e.sh ios-phone`, `ios-tablet` y `android` con el backend local levantado → todos pasan; revisar las capturas (texto cortado, solapes). Corregir lo que aparezca en la task dueña de la pantalla.
- [ ] **Step 5:** Documentar en `README.md` cómo correr las E2E y dónde quedan las capturas. Commit `test(movil): E2E en simulador iOS (teléfono y tablet) y emulador Android`.

---

## Bitácora de ejecución

**2026-10-27 — Tasks 1–4 (núcleo, ejecutadas en la sesión principal)**

- Commits: `e3a8ebb` (T1), `b04c36f` (T2), `9c1e8de` (T3), `ab69fba` (T4), `4886c71` (humo E2E +
  modelos de solicitudes compartidos), `a79fc25` (script E2E), `ea85ab1` (`sinPlaza`).
- Desviaciones de nombres respecto a las Interfaces del plan (el código manda):
  - `puede(...)` libre se llama `puedeCon(permisos, permiso)`; la sesión expone `Sesion.puede(...)`.
  - `enum Tono` vive en `core/theme/colores.dart` (lo usan el tema y los badges).
  - Los providers HTTP están en `core/api/api_providers.dart` (`tokenStorageProvider`,
    `apiClientProvider`), no en `api_client.dart`, para que `ApiClient` no dependa de Riverpod.
  - Campos y grillas en `core/widgets/campos.dart` (`CampoFecha`, `CampoHora`, `KeyValueGrid`);
    estructura de pantalla en `core/widgets/pagina.dart` (`ContenidoPagina`, `EncabezadoPagina`,
    `Seccion`) — no estaban en el plan y los usan todas las pantallas.
  - Adjuntos: modelo, API y `SelectorArchivos` (inyectable en pruebas) en `core/adjuntos/adjuntos.dart`.
  - `ApiClient.get/bytes` aceptan `sinPlaza: true` (dashboard global sin `x-plaza-id`, bug F16).
  - Las rutas `/superadmin/solicitudes*` pasaron a `rutasSolicitudesGlobales()` en el módulo de
    solicitudes (dueño único por archivo para paralelizar).
- ⚠️ Verificado en dispositivo: prueba de humo (login real de admin e inquilino) en simulador
  iPhone 17 Pro (iOS 26.2) y emulador Android `Medium_Phone_API_36.1`. En Android,
  `convertFlutterSurfaceToImage` solo puede llamarse una vez por ejecución.
- Tasks 5–10 se ejecutan en paralelo (un agente por grupo, worktrees aislados): solicitudes (T5+T6),
  calendario (T7), locales/inquilinos/contratos (T8), catálogos/usuarios (T9), paneles/campana/
  superadmin (T10).
