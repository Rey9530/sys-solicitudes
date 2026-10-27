# CHANGELOG — app móvil Plazapp

Versiones de paquetes verificadas en pub.dev antes de instalar (`https://pub.dev/api/packages/<pkg>`),
con publisher y adopción. Regla del owner: solo paquetes oficiales o de publisher verificado,
mantenidos y muy usados.

## 2026-10-27 — Proyecto nuevo con Riverpod (reemplaza el prototipo con `provider`)

Flutter **3.47.8** / Dart **3.13.7** (actualizado desde 3.41.7 el mismo día: Riverpod 3.4 y
go_router 18 exigen Dart ≥ 3.12).

| Paquete | Versión | Publisher | Descargas/mes | Uso |
|---|---|---|---|---|
| `flutter_riverpod` | 3.4.3 | dash-overflow.net ✔ | 4,0 M | estado e inyección |
| `go_router` | 18.1.1 | flutter.dev ✔ (oficial) | 5,1 M | navegación por rol |
| `http` | 1.6.0 | dart.dev ✔ (oficial) | 14 M | cliente HTTP, multipart |
| `http_parser` | 4.1.2 | dart.dev ✔ (oficial) | — | `MediaType` del multipart |
| `mime` | 2.1.0 | tools.dart.dev ✔ (oficial) | — | MIME por extensión |
| `flutter_secure_storage` | 11.2.0 | steenbakker.dev ✔ | 5,6 M | tokens en Keychain/Keystore |
| `shared_preferences` | 2.5.6 | flutter.dev ✔ (oficial) | 8,6 M | tema y plaza elegida |
| `intl` | 0.20.3 | dart.dev ✔ (oficial) | 12,8 M | formatos en español |
| `file_picker` | 13.3.0 | victorcarreras.dev ✔ | 4,7 M | elegir archivos |
| `image_picker` | 1.2.4 | flutter.dev ✔ (oficial) | 5,6 M | cámara / galería |
| `path_provider` | 2.1.6 | flutter.dev ✔ (oficial) | 9,8 M | archivos temporales |
| `share_plus` | 13.3.1 | fluttercommunity.dev ✔ | 4,9 M | abrir/compartir PDF, CSV, ICS |
| `url_launcher` | 6.3.3 | flutter.dev ✔ (oficial) | 8,9 M | URLs pre-firmadas de adjuntos |
| `fl_chart` | 1.3.0 | flchart.dev ✔ | 2,1 M | gráficas del dashboard |
| `flutter_lints` (dev) | 6.0.0 | flutter.dev ✔ (oficial) | 10 M | lints |
| `flutter_localizations`, `flutter_test`, `integration_test` | SDK | flutter.dev | — | i18n y pruebas |

**Descartados:** `dio` (se usa `http`, oficial), `table_calendar` (sin publisher verificado; el
calendario se dibuja con widgets propios), `provider` / `bloc` (decisión del owner: Riverpod),
`freezed` / `retrofit` / `riverpod_generator` / `build_runner` (sin generación de código),
`lucide_icons` (se usan los iconos Material del SDK), `firebase_*` (no hay push en v1),
`cupertino_icons` (no se usan iconos Cupertino).
