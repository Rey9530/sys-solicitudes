# Plazapp — App móvil Flutter

Cliente móvil nativo (Android + iOS) del portal SaaS multi-plaza Plazapp.

- **Backend:** NestJS 10 + Prisma 7 + PostgreSQL (compartido con el web en `../backend`).
- **Web counterpart:** Next.js 16 en `../frontend` (sistema de diseño espejo).
- **Repo raíz:** `F:\sys-solicitudes\` (monorepo).

---

## Quickstart

### Pre-requisitos

- Flutter 3.41+ estable ([instalar](https://docs.flutter.dev/get-started/install))
- Dart 3.11+
- Android SDK 34+ (o Xcode 15+ para iOS)
- Backend Plazapp corriendo en `localhost:4000` (ver `../backend/README.md`)

### Setup

```bash
cd F:\sys-solicitudes\frontend_mobil
flutter pub get
flutter run
```

### Conectar al backend

Por defecto el app apunta a `http://10.0.2.2:4000/api/v1` (loopback al backend desde un emulador Android).

```bash
# Android emulator (loopback automático al host)
flutter run

# iOS simulator
flutter run --dart-define=API_BASE_URL=http://localhost:4000/api/v1

# Backend en LAN (device físico)
flutter run --dart-define=API_BASE_URL=http://192.168.0.50:4000/api/v1

# Staging
flutter run --dart-define=API_BASE_URL=https://staging.plazapp.com/api/v1
```

### Build

```bash
flutter build apk --debug                # debug APK
flutter build apk --release              # release APK
flutter build ios --debug --no-codesign  # debug iOS (sin firma)
```

---

## Estructura

```
lib/
├── main.dart                     # bootstrap
├── app.dart                      # MaterialApp + theme + providers
├── core/
│   ├── theme/                    # design system (colors, text, spacing)
│   ├── network/                  # Dio + JWT interceptor
│   ├── storage/                  # secure storage + prefs
│   └── router/                   # go_router
├── features/
│   ├── auth/                     # login + role selector
│   ├── shell/                    # inquilino + admin shells + inicio
│   ├── solicitudes/              # list + detail + dominio
│   └── dashboard/                # KPI dashboard (admin)
├── widgets/                      # widgets compartidos cross-feature
└── shared/

assets/fonts/                     # GeneralSans + JetBrainsMono TTFs
```

Ver [`AGENTS.md`](./AGENTS.md) para las reglas operativas completas (lints, multi-tenancy, naming, etc.).

---

## Sistema de diseño

Réplica 1:1 del frontend web (`../frontend/src/app/globals.css`). Tokens semánticos + componentes custom + light/dark + theming dinámico por tenant.

### Componentes incluidos en MVP

| Widget | Archivo | Réplica de |
|---|---|---|
| `PlazButton` | `lib/widgets/plaz_button.dart` | `.btn`, `.btn-*` |
| `PlazCard` | `lib/widgets/plaz_card.dart` | `.card`, `.card-head`, `.card-foot` |
| `StatusBadge` | `lib/widgets/status_badge.dart` | `.badge`, `.b-{tone}` |
| `PriorityChip` | `lib/widgets/priority_chip.dart` | `.prio .prio-{A..F}` |
| `SlaSemaphore` | `lib/widgets/sla_semaphore.dart` | `.sla .sla-{green,amber,red}` |
| `KpiCard` | `lib/widgets/kpi_card.dart` | `.kpi`, `.tint-*` |
| `EmptyState` | `lib/widgets/empty_state.dart` | `.empty` |
| `BannerPlaz` | `lib/widgets/banner_plaz.dart` | `.banner .banner-*` |
| `AvatarHsl` | `lib/widgets/avatar_hsl.dart` | `.avatar` (gradiente HSL por hash) |
| `showPlazConfirm` | `lib/widgets/confirm_dialog.dart` | SweetAlert2 wrapper |

### Tema por tenant

`PlazappColors.brand` se inyecta desde `GET /api/v1/plazas/:id` (campo `colorPrimario`). La escala completa (`p50..p700`, `soft`, `ring`) se deriva con `Color.lerp(primary, white|black, factor)` — replica exacta del `color-mix(in srgb, ...)` del CSS.

---

## Credenciales de prueba (del backend seed)

| Email | Password | Rol |
|---|---|---|
| `inquilino@demo.com` | (ver seed) | `inquilino` |
| `admin@demo.com` | (ver seed) | `admin_plaza` |
| `superadmin@demo.com` | (ver seed) | `superadmin` |

Consultar `backend/prisma/seed.ts` para los passwords exactos.

---

## Roadmap

### MVP (en este repo)
- ✅ Login + role selector + 2 shells (inquilino/admin)
- ✅ Bandeja de solicitudes + detalle + acciones contextuales
- ✅ Dashboard admin con KPIs + charts
- ✅ Tema light/dark + brand por tenant
- ✅ Multi-tenancy (plaza_id en JWT)
- ✅ JWT refresh transparente

### Fase 2
- Wizard de nueva solicitud (flutter_form_builder + adjuntos)
- Calendario interactivo (table_calendar)
- Push notifications (firebase_messaging + deep-links)
- Tests automatizados

### Fase 3
- Generación de reportes PDF (vía jsreport)
- i18n full
- Tablet/desktop layouts pulidos

---

## Referencias

- **Plan original:** `C:\Users\Reynaldo\.claude\plans\analiza-el-diseno-de-purring-sonnet.md`
- **Diseño web tokens:** `../frontend/src/app/globals.css`
- **API docs:** `http://localhost:4000/api/docs` (Swagger, cuando el backend está levantado)
- **Zod contracts:** `../packages/contracts/`
- **CLAUDE.md raíz:** `../CLAUDE.md`