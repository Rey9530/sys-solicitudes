# AGENTS.md — frontend_mobil (Plazapp)

> Reglas operativas para Claude Code y humanos trabajando en este proyecto.

---

## Stack confirmado

- **Flutter:** 3.41.8 (stable, abril 2026) con Dart 3.11.5
- **State management:** `provider` ^6.1.5 (NO BLoC, NO Riverpod, NO GetIt)
- **HTTP:** `dio` ^5.11.0 con `QueuedInterceptor` propio para JWT refresh
- **Routing:** `go_router` ^17.3.0 con `StatefulShellRoute.indexedStack`
- **Storage:** `flutter_secure_storage` ^10.3.1 (JWT, plazaId) + `shared_preferences` ^2.5.5 (tema, filtros cacheados)
- **Forms:** `flutter_form_builder` ^10.3.0 + `form_builder_validators` ^11.3.0 (solo formularios grandes)
- **Calendar:** `table_calendar` ^3.2.0
- **Charts:** `fl_chart` ^1.2.0
- **Files:** `image_picker` ^1.2.3 + `file_picker` ^11.0.2
- **Push:** `firebase_messaging` ^16.4.3 + `firebase_core` ^4.12.1 (Fase 2)
- **i18n:** `intl` ^0.20.2 (pinned por flutter_localizations)
- **Icons:** `lucide_icons` ^0.257.0 (mirror de lucide-react del web)
- **Linting:** `flutter_lints` ^6.0.0
- **Codegen:** `build_runner` ^2.15.1 (⚠️ NO 2.15.2; conflicto con `flutter_test`) + `json_serializable` ^6.14.0

---

## Reglas de código

### Naming
- `PascalCase` para clases públicas y widgets.
- `snake_case` para archivos.
- `camelCase` para variables, métodos y parámetros.

### Comentarios
- Español en español (UI, mensajes). Inglés para JSDoc técnico.
- Un bloque `///` por clase pública; documenta el propósito y referencia al archivo del web que espeja.

### Lint
- `flutter analyze` debe pasar **sin errors ni warnings** antes de commit.
- `prefer_const_constructors`, `always_declare_return_types`, `avoid_print` activos.
- **NO** `print()` directo → usar `logger().i()` (paquete `logger`).

### Estado
- **Una `ChangeNotifier` por feature** (`SolicitudesListController`, `SolicitudDetailController`).
- **NO** `AppState` global. **NO** singletons fuera de Provider.
- Usar `Selector<T, S>` para granularidad en listas; `context.watch<T>()` para reactividad; `context.read<T>()` para one-shots.

### Multi-tenant (regla SC-1 — paridad con el web)
- Todo request HTTP lleva `Authorization: Bearer <jwt>`. El `plaza_id` viene adentro del JWT; **nunca** del body.
- Color de marca se carga de `GET /api/v1/plazas/:id` al login y se cachea en `BrandColors`.
- Cambio de tenant → rebuild del ThemeData vía `copyWith(brand: newBrand)`.
- **Verificación manual:** login con token de plaza A vs B; confirmar aislamiento total.

### NO hacer
- **NO** BLoC. **NO** Riverpod. **NO** GetIt. **NO** freezed. **NO** Hive/Isar/Drift.
- **NO** `window.confirm`/`window.alert`/SnackBar nativo para errores de negocio → usar `showPlazConfirm` o `BannerPlaz`.
- **NO** `google_fonts` runtime → bundle local en `assets/fonts/`.
- **NO** SnackBar nativo con colores por defecto → siempre `ScaffoldMessenger` con `backgroundColor: danger.bg`.

---

## Estructura de carpetas

```
frontend_mobil/
├── lib/
│   ├── main.dart                     # bootstrap (storage + Dio + runApp)
│   ├── app.dart                      # MaterialApp.router + ThemeData + Providers
│   ├── core/
│   │   ├── theme/                    # design system (colors, spacing, text, theme builder)
│   │   ├── network/                  # Dio + interceptor JWT + endpoints
│   │   ├── storage/                  # TokenStore + PrefsStore
│   │   └── router/                   # go_router config + nombres de rutas
│   ├── features/
│   │   ├── auth/                     # login + role selector + repositorio + controller
│   │   ├── shell/                    # inquilino_shell + admin_shell + inicio_page
│   │   ├── solicitudes/              # list + detail + dominio + seed data
│   │   ├── dashboard/                # fl_chart dashboard
│   │   └── profile/                  # (Fase 2)
│   ├── widgets/                      # widgets compartidos cross-feature
│   └── shared/
│       ├── errors/
│       └── utils/
├── assets/fonts/                     # GeneralSans + JetBrainsMono (8 TTFs + LICENSE.md)
├── test/                             # placeholder; tests reales en fase posterior
├── pubspec.yaml
├── analysis_options.yaml
├── AGENTS.md                         # este archivo
├── README.md
└── CHANGELOG.md                      # hallazgos de versiones
```

---

## Convenciones de UI (paridad con el web)

- **Spacing:** padding base 28 (desktop) / 18 (móvil). Gutter entre cards = 12. Card padding = 22.
- **Radius:** xs 5, sm 7, md 10, lg 14, xl 18, pill 999.
- **Tipografía:** General Sans para todo (sans 400/500/600/700) + JetBrains Mono para IDs, kbd, contadores, prioridad chip.
- **Botones:** 38px default, 32px sm, 44px lg. Radius sm (7).
- **Inputs:** 40px alto. Radius sm. Focus border 2px color primario.
- **Cards:** border 1px `border`, radius lg (14), sombra `--shadow-sm`.
- **Sidebar (admin tablet):** 76px collapsed, fondo navy con gradiente `#0d1521 → #111c2c`.
- **Logo "P":** gradiente `brand.p300 → brand.primary`. Caja 34x34 (sidebar) / 44x44 (login).
- **Empty state:** caja 56x56 con icono, radius 15, fondo `surface3`.
- **Status badge:** pill 999, fg/bg/bd del tone correspondiente, dot interior 6x6.
- **SLA semáforo:** punto 12x12 con halo `BoxShadow` spread 1 blur 8 alpha 0.45.

---

## Theming dinámico por tenant

El color de marca se inyecta al `ThemeData` en `app.dart` vía `PlazappTheme.light(brand: brand)` / `PlazappTheme.dark(brand: brand)`. Para refrescarlo (ej. cambio de tenant en superadmin):

```dart
setState(() {
  _brand = buildBrandColorsFromHex(nuevoColorPrimario);
});
```

El `ThemeExtension<PlazappColors>` reinyecta automáticamente todas las referencias a `brand.p50..p700` y a `brand.primary/soft/ring`.

---

## Git

- **Branches:** `feat/mobile-*`, `fix/mobile-*`, `refactor/mobile-*`, `chore/mobile-*`.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`).
- **NO** commit directo a `main`. PR + 1 aprobación + CI verde.

---

## Comandos

```bash
# Resolver deps
flutter pub get

# Lint
flutter analyze

# Compilar APK debug
flutter build apk --debug

# Correr con backend local (emulador Android)
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api/v1

# Correr con backend local (iOS simulator)
flutter run --dart-define=API_BASE_URL=http://localhost:4000/api/v1

# Correr contra staging
flutter run --dart-define=API_BASE_URL=https://staging.plazapp.com/api/v1

# Generar código (json_serializable)
dart run build_runner build --delete-conflicting-outputs
dart run build_runner watch --delete-conflicting-outputs
```

---

## Verificación manual end-to-end

Antes de cerrar un PR:

1. **Compilación:** `flutter analyze` (0 errores) + `flutter build apk --debug` (sin errores).
2. **Multi-tenancy:** login con dos plazas distintas (tokens con `plaza_id` A y B); confirmar que cada uno solo ve sus datos.
3. **Theme switching:** toggle light/dark; verificar persistencia entre reinicios.
4. **JWT refresh:** dejar pasar el access token (>15 min) y ejecutar una acción → confirmar que el interceptor pide refresh sin perder la sesión.
5. **Sesión perdida:** borrar manualmente el refresh token del secure storage y ejecutar una acción → confirmar redirect a `/login`.
6. **Comparación visual:** capturas del login en light + dark contra el web en mismo navegador.

---

## Lo que NO está en MVP (Fase 2+)

- Push notifications (Fase 2 — requiere Firebase project + credenciales backend).
- Wizard de nueva solicitud (Fase 2 — usa `flutter_form_builder`).
- Adjuntos upload (Fase 2 — `dio` `FormData` + `file_picker`).
- Calendario interactivo (Fase 2 — `table_calendar`).
- Generación de reportes PDF.
- i18n full (solo español).
- Tablet/desktop layouts pulidos (>600dp).
- Tests automatizados (alineado con `CLAUDE.md` raíz: sin tests).