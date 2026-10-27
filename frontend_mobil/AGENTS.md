# AGENTS.md — App móvil Plazapp (Flutter)

Reglas para cualquier persona o agente que toque `frontend_mobil/`. Diseño aprobado:
`docs/superpowers/specs/2026-10-27-app-movil-flutter-design.md`. Plan:
`docs/superpowers/plans/2026-10-27-app-movil-flutter.md`. Qué hace cada pantalla del web
(endpoints, payloads, textos): `docs/superpowers/specs/2026-10-27-inventario-web-para-movil.md`.

## Principio

**Simple pero fuerte.** La app hace lo mismo que el web (paridad, sin funciones nuevas). El código
debe entenderlo un desarrollador Flutter junior: pocas capas, sin generación de código, sin
patrones pesados. Lo que sí es innegociable: tokens, errores, estados de carga y tamaños de
pantalla se manejan siempre igual y en un solo lugar.

## Estructura

```
lib/
├── main.dart · app.dart
├── core/          # lo compartido: config, api, auth, navegación, tema, formato, widgets
└── features/<x>/  # una carpeta por módulo del web
    ├── <x>_modelos.dart    # clases inmutables con fromJson/toJson a mano
    ├── <x>_api.dart        # funciones que llaman a ApiClient y devuelven modelos
    ├── <x>_providers.dart  # providers de Riverpod de LECTURA
    ├── <x>_rutas.dart      # List<RouteBase> con las mismas URLs del web
    └── *_page.dart / widgets/
```

## Reglas de Riverpod

1. **Leer** = `FutureProvider.autoDispose` (con `.family` si hay id o filtros). La pantalla hace
   `ref.watch(...)` y pinta con `AsyncView`.
2. **Escribir** = la pantalla llama a la función de `<x>_api.dart` en un `try/catch`, muestra
   `mostrarExito` / `mostrarError` y hace `ref.invalidate(...)`. No hay providers de mutación.
3. **Estado global** solo `sesionProvider` y `plazaSeleccionadaProvider`. Los filtros de una lista
   viven en el `State` de su widget.
4. Prohibido: `riverpod_generator`, `build_runner`, `StateNotifier`, `ChangeNotifier`, BLoC.
5. Reintentos: la app usa `ProviderScope(retry: politicaReintentos)` (solo red/5xx, máx. 2). En
   pruebas, `envolver(...)` ya lo aplica; un `ProviderScope` nuevo debe pasarlo también.

## Reglas de código

- Paquetes: solo los del `pubspec.yaml`. Para agregar uno: oficial o publisher verificado con
  mucha adopción y releases recientes; verificar en pub.dev, anotarlo en `CHANGELOG.md` y
  consultarlo antes con el owner.
- Todo HTTP pasa por `ApiClient` (`core/api/api_client.dart`). Nunca `http.get` directo.
- Errores: mostrar `ApiError.mensaje`; decidir por `ApiError.code`, nunca por el status.
- Payloads: campos opcionales vacíos se omiten o van `null`, nunca `''`. El PATCH de solicitud
  siempre lleva `esEmergencia`. Textos recibidos → `decodificarHtml` antes de mostrarlos.
- Fechas: hora de la plaza = UTC−6 fijo. Horas en 12 h (`2:00 pm`), fechas civiles `DD-MM-YYYY`,
  instantes `dd/MM/yyyy`. Usar siempre `core/format/fechas.dart`.
- Diálogos de decisión: `confirmar()` / `pedirTexto()`. Cerrar el diálogo = no hacer nada.
- Botones de acciones con permiso granular: envolver en `Can(permiso: …)`.
- Iconos `Icons.*` de Material. Colores siempre desde el tema (`ColoresPlazapp`), nunca fijos.
- Responsive: probar cada pantalla con `probarEnTamanos` (360, 390, 768 y 1024 px, claro y
  oscuro). Nada de anchos fijos para texto.

## Núcleo disponible (`lib/core/`) — usarlo, no reinventarlo

| Necesito… | Uso |
|---|---|
| Llamar al backend | `ref.read(apiClientProvider)` → `get(path, query:, sinPlaza:)` (`sinPlaza: true` = sin `x-plaza-id`, para vistas globales del superadmin), `post/patch/put/delete(path, body:)`, `bytes(path, query:)` (PDF/CSV/ICS), `subir(path, nombreArchivo:, contenido:, mimeType:)`. Devuelven JSON decodificado; fallan con `ApiError` (`code`, `mensaje`, `status`, `retryAfter`). |
| Paginación | `Paginado.fromJson(json, Modelo.fromJson)` → `items`, `total`, `page`, `totalPages`. |
| Sesión y permisos | `ref.watch(sesionProvider).value` → `Sesion` (`usuario`, `rol`, `permisos`, `puede('x')`). Widget `Can(permiso: 'x' / ['a','b'], child: …)`. |
| Plaza | `plazaSeleccionadaProvider` (superadmin), `plazaActualProvider` (`PlazaResumen`). |
| Estructura de pantalla | `ContenidoPagina(children: [...], onRefresh:)` + `EncabezadoPagina(titulo:, subtitulo:, badges:, acciones:, rutaVolver:)` + `Seccion(titulo:, child:)` (`core/widgets/pagina.dart`). |
| Cargar datos | `AsyncView(value: ref.watch(p), data: (d) => …, onRetry: () => ref.invalidate(p))`; vacíos `EmptyState`, errores `ErrorView`. |
| Listados | `ListaResponsive<T>(items:, columnas: [ColumnaLista(titulo:, celda:, principal:)], acciones:, onTap:)` + `Paginador(pagina:, totalPaginas:, onCambiar:)`. |
| Badges | `EstadoSolicitudBadge`, `PrioridadBadge`, `SlaSemaforo`, `ResultadoCierreBadge`, `EstadoLocalBadge`, `EstadoContratoBadge`, `BadgePlazapp(texto, Tono.x)`. |
| Detalle | `KeyValueGrid([('Etiqueta', Text(…)), …])`. |
| Formularios | `TextFormField` + `CampoFecha(valorYmd:, onChanged:)` + `CampoHora(valorHhmm:, onChanged:)`; validaciones de email/contraseña en `features/auth/auth_api.dart`. |
| Decisiones | `await confirmar(context, titulo:, mensaje:, textoConfirmar: 'Sí, …', destructiva:)`; `await pedirTexto(context, …, obligatorio:)` (`null` = cancelado → no hacer nada). |
| Avisos | `mostrarExito(context, '…')`, `mostrarError(context, error)`, `AvisoBanner(tono:, child:)`. |
| Adjuntos | `AdjuntosSeccion(adjuntos:, subir: (nombre, bytes, mime) => …, puedeSubir:, alCambiar:)`; modelo `Adjunto`. |
| Descargas | `descargarYCompartir(context, descargar: () => api.bytes(...), nombreArchivo:, mimeType:)`. |
| Formato | `core/format/fechas.dart` (`formatFecha`, `formatFechaHora`, `formatFechaDMY`, `formatHora12`, `fechaPlazaHoy`, `instanteDePlaza`, `tiempoRelativo`), `montos.dart` (`formatMonto`), `texto.dart` (`decodificarHtml`). |
| Colores | `ColoresPlazapp.of(context)` (`text2`, `text3`, `surface2`, `tono(Tono.x)`…). Nunca colores fijos. |
| Navegación | Menú: `context.go(ruta)`. Abrir detalle/formulario: `context.push(ruta)`. Las rutas de cada módulo viven en `features/<x>/<x>_rutas.dart` (mismas URLs que el web). |

Modelos de solicitudes compartidos (`features/solicitudes/solicitudes_modelos.dart`): `SolicitudItem`,
`SolicitudDetalle`, `Comentario`, `HistorialItem`, `UsuarioRef`, `estadosTerminales`,
`etiquetaTipoSolicitud`.

## Pruebas

- Widget tests con `test/helpers/api_falsa.dart` (`apiFalsa({'GET /ruta/:id': (req) => json})`,
  `RespuestaFalsa(status, body)`, `peticionesFalsas`, `cuerpoDe(req)`) y
  `test/helpers/pantallas.dart` (`prepararPruebas`, `sesionDe(Rol.x, permisos:)`,
  `overridesBase(api, sesion:)`, `envolver(...)`, `probarEnTamanos(tester, () => Pantalla(),
  overrides:)`). **Toda pantalla nueva pasa por `probarEnTamanos`** con textos largos.
- E2E en simulador/emulador: `integration_test/` + `test_driver/integration_test.dart`
  (capturas en `build/capturas/<dispositivo>/`), contra el backend local.

## Antes de cada commit

```bash
dart format lib test integration_test
flutter analyze        # sin issues
flutter test           # todo en verde
```

Commits convencionales (`feat(movil): …`, `fix(movil): …`, `test(movil): …`).
