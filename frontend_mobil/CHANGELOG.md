# CHANGELOG — Hallazgos de versiones

Registro de las versiones investigadas vs. instaladas, y desviaciones del plan original. Mismo formato que el `CLAUDE.md` raíz.

---

## 2026-07-27 — Bootstrap inicial

**Investigado en:** `https://pub.dev/packages/<pkg>` y `https://registry.npmjs.org/`

### Dependencias (16 prod + 3 dev)

| Paquete | Versión instalada | Notas de compatibilidad |
|---|---|---|
| `provider` | `^6.1.5` | resolved `6.1.5+1`. Flutter Favorite. `ValueListenableProvider` ya no existe en 6.x → usar `ValueListenableBuilder` con `Provider`. |
| `dio` | `^5.11.0` | resolved `5.11.0`. Usar `QueuedInterceptor` (no el viejo `Interceptor`) para evitar refresh paralelo en 401s concurrentes. |
| `flutter_secure_storage` | `^10.3.1` | resolved `10.3.1`. Flutter Favorite. ⚠️ `AndroidOptions.encryptedSharedPreferences` está deprecado en 10.x → ignorar (Flutter usa cifrado propio). |
| `shared_preferences` | `^2.5.5` | resolved `2.5.5`. Solo primitivas + List<String>. Para objetos → JSON string + decode manual. |
| `go_router` | `^17.3.0` | resolved `17.3.0`. Flutter Favorite (official). `StatefulShellRoute.indexedStack` para bottom-nav preserva estado por branch. |
| `flutter_form_builder` | `^10.3.0` | resolved `10.3.0+2`. peer `intl >=0.20.0 <0.21.0`. Para formularios grandes; los pequeños pueden ser `TextFormField` a mano. |
| `form_builder_validators` | `^11.3.0` | resolved `11.3.0`. peer `intl >=0.20.0 <0.21.0`. ~50 validators listos (email, phone, RUT, etc.). |
| `table_calendar` | `^3.2.0` | resolved `3.2.0`. Mirror del FullCalendar del web. Sin dialog de creación built-in → bottom sheet propio. |
| `fl_chart` | `^1.2.0` | resolved `1.2.0`. Line/bar/pie/radar/scatter — cubre todos los dashboards. API verbose (~30-50 líneas por chart). |
| `image_picker` | `^1.2.3` | resolved `1.2.3`. Peer `flutter`. Requiere permisos en `Info.plist` (iOS) + `AndroidManifest.xml`. |
| `file_picker` | `^11.0.2` | resolved `11.0.2`. API distinta a 8.x → leer migration notes si encuentras código viejo. Genera 2 warnings Kotlin no bloqueantes en build. |
| `firebase_messaging` | `^16.4.3` | resolved `16.4.3`. Peer `firebase_core ^4.12.1`. **No integrado todavía** (Fase 2 — requiere Firebase project + credenciales). |
| `firebase_core` | `^4.12.1` | resolved `4.12.1`. Scaffolding para `firebase_messaging`. |
| `intl` | `^0.20.2` | resolved `0.20.2`. ⚠️ **PIN** por `flutter_localizations` → no se puede subir a `0.20.3`. Llamar `initializeDateFormatting('es')` en `main()` antes de usar. |
| `logger` | `^2.7.0` | resolved `2.7.0`. Pretty console + opcional file output. |
| `cupertino_icons` | `^1.0.8` | (default scaffold) |
| `lucide_icons` | `^0.257.0` | resolved `0.257.0`. ⚠️ **Versión real `0.x`, no `1.x`** (corregido durante la implementación). Iconos en camelCase: `LucideIcons.calendarDays`, `LucideIcons.barChart3`, `LucideIcons.user` (no `userRound` — no existe en este package). |
| `flutter_lints` | `^6.0.0` | (dev) |
| `build_runner` | `^2.15.1` | resolved `2.15.1`. ⚠️ **2.15.2+ requiere `meta ^1.18.3`** pero `flutter_test` está pinned a `1.17.0` → conflicto. Usar `^2.15.1`. |
| `json_serializable` | `^6.14.0` | resolved `6.14.0`. |

### Desviaciones del plan original

| # | Desviación | Por qué | Acción |
|---|---|---|---|
| 1 | `lucide_icons: ^0.257.0` (no `1.x`) | Versión real consultada en pub.dev | Documentado en `pubspec.yaml` y AGENTS.md |
| 2 | `intl: ^0.20.2` (no `^0.20.3`) | Pin por `flutter_localizations` | Documentado |
| 3 | `build_runner: ^2.15.1` (no `^2.15.2`) | Conflicto de `meta` con `flutter_test` | Documentado |
| 4 | Algunos nombres de iconos lucide cambiados (`userRound` → `user`) | Nombres exactos de `lucide_icons 0.257.0` | Verificado contra el source de la lib |

### Fuentes (bundled, no via `google_fonts`)

| Familia | Versión | Pesos | Licencia |
|---|---|---|---|
| General Sans | Indian Type Foundry, 2023 | 400/500/600/700 | SIL OFL 1.1 (gratis con atribución) |
| JetBrains Mono | JetBrains s.r.o. | 400/500/600/700 (v2.304) | SIL OFL 1.1 |

Descargadas desde:
- General Sans: `https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700` (URLs directas de los `.ttf`)
- JetBrains Mono: `https://github.com/JetBrains/JetBrainsMono/releases/tag/v2.304` (zip)

Atribuciones completas en `assets/fonts/LICENSE.md`.

### Estado del build

- `flutter analyze`: 0 errores, ~20 info-level warnings (estilo, no bloqueantes).
- `flutter build apk --debug`: ✅ build successful. APK en `build/app/outputs/flutter-apk/app-debug.apk` (~160 MB debug).
- 2 warnings Kotlin del plugin `file_picker` (`unchecked cast`) — son del package, no afectan funcionalidad.

### Lo que NO se instaló (justificación)

- `freezed`, `riverpod`, `flutter_bloc`, `auto_route`, `retrofit`, `get_it`, `hive`, `isar`, `drift`, `dio_smart_retry`, `flutter_hooks`, `talker`, `syncfusion_*`, `easy_localization`, `flutter_animate`, `sentry_flutter`, `flutter_dotenv`, `connectivity_plus`.

Justificación detallada en el plan original (`docs/superpowers/plans/...`) y AGENTS.md.