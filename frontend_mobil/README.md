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

Las pruebas E2E en simulador/emulador (`integration_test`) se documentan en la sección
"Pruebas E2E" cuando se agregan (tarea 11 del plan).
