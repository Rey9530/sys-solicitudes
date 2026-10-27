# Plazapp — app móvil (Flutter)

App iOS y Android (teléfono y tablet) que hace lo mismo que el portal web de Plazapp para los tres
roles (superadmin, administrador de plaza e inquilino), hablando directo con el backend NestJS.

- Diseño: `../docs/superpowers/specs/2026-10-27-app-movil-flutter-design.md`
- Reglas de código: [`AGENTS.md`](AGENTS.md)
- Versiones de paquetes: [`CHANGELOG.md`](CHANGELOG.md)

## Requisitos

- Flutter **3.47.8** (Dart 3.13.7): `flutter --version`.
- Xcode (simulador iOS) y/o Android Studio (emulador Android, JDK incluido).
- Backend local levantado en `:4000` (ver `../README.md`: `docker compose up -d` y
  `npm run start:dev` en `backend/`).

## Correr la app

```bash
cd frontend_mobil
flutter pub get

# Simulador iOS (el backend local se ve como localhost)
open -a Simulator
flutter run

# Emulador Android (el backend local se ve como 10.0.2.2, ya es el valor por defecto)
flutter emulators --launch Medium_Phone_API_36.1
flutter run

# Otro backend (dispositivo físico en la LAN, staging, producción)
flutter run --dart-define=API_BASE_URL=http://192.168.0.50:4000/api/v1
```

En debug se permite HTTP sin TLS solo hacia la red local (Android: manifest de `debug`; iOS:
`NSAllowsLocalNetworking`). Un build release exige HTTPS.

Cuentas de desarrollo (seed del backend): `superadmin@plazapp.com`, `admin@demo.com`,
`inquilino@demo.com`, contraseña `Plazapp2026!`.

## Pruebas

```bash
flutter analyze
flutter test                      # unitarias + widget tests (incluye barrido responsive)
```

Los widget tests corren sin dispositivo ni backend: la API se simula con `apiFalsa`
(`test/helpers/api_falsa.dart`) y `probarEnTamanos` (`test/helpers/pantallas.dart`) pinta
cada pantalla a 360, 390, 768 y 1024 px, en claro y oscuro, y falla si algo se desborda.

## Pruebas E2E (simulador / emulador)

Playwright no maneja emuladores; el equivalente oficial de Flutter es
[`integration_test`](https://docs.flutter.dev/testing/integration-tests): la app real corre
en el simulador/emulador contra el **backend local** y la prueba toca la UI como un usuario.

Requisitos: stack local levantado (`docker compose up -d` y `npm run start:dev` en `backend/`,
API en `:4000`) con el seed de desarrollo.

```bash
scripts/e2e.sh ios-phone                     # todas, iPhone 17 Pro
scripts/e2e.sh ios-tablet                    # todas, iPad Pro 11"
scripts/e2e.sh android                       # todas, emulador Android (lo arranca si hace falta)
scripts/e2e.sh ios-phone integration_test/flujo_solicitud_test.dart   # una sola
```

Los simuladores se pueden cambiar con `IPHONE_UDID`, `IPAD_UDID` y `ANDROID_AVD`
(`xcrun simctl list devices`, `emulator -list-avds`). Las capturas quedan en
`build/capturas/<dispositivo>/` para revisión visual.

| Prueba | Qué cubre |
|---|---|
| `humo_test.dart` | Login de admin e inquilino, shell del rol y cierre de sesión. |
| `login_roles_test.dart` | Credenciales inválidas, inicio de cada rol, rutas de otro rol que redirigen, puerta de plaza del superadmin, rutas protegidas sin sesión. |
| `navegacion_completa_test.dart` | Todas las pantallas del menú de cada rol (y del superadmin con plaza): ninguna termina en error; una captura por pantalla. |
| `flujo_solicitud_test.dart` | Ciclo completo: wizard → borrador → enviar → tomar → subsanación → reenviar → tomar → aprobar → cerrar, con historial. Crea una solicitud `E2E-MOVIL-…` en la plaza demo. |

> El login está limitado a 5 intentos/min por IP: `iniciarSesion` (`integration_test/helpers.dart`)
> espera el `Retry-After` y reintenta, así que una corrida completa puede pausar ~1 min.
