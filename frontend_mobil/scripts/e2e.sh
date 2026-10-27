#!/usr/bin/env bash
# Pruebas E2E (integration_test) en simulador/emulador contra el backend local.
#
# Uso:  scripts/e2e.sh <ios-phone|ios-tablet|android> [archivo_test ...]
#       (sin archivos corre todos los de integration_test/*_test.dart)
#
# Requisitos: backend en :4000 (docker compose + npm run start:dev en backend/).
# Capturas: build/capturas/<dispositivo>/<nombre>.png
set -euo pipefail
cd "$(dirname "$0")/.."

DISPOSITIVO="${1:?Uso: scripts/e2e.sh <ios-phone|ios-tablet|android> [tests...]}"
shift || true
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"

# Simuladores/emulador usados por el equipo (cambiar aquí si se usan otros).
IPHONE="${IPHONE_UDID:-F49D78DC-69BF-4D74-8993-AA06CC6936D9}"   # iPhone 17 Pro
IPAD="${IPAD_UDID:-797C30DA-29F4-4C13-80D6-C9AB6D0CB71A}"       # iPad Pro 11"
AVD="${ANDROID_AVD:-Plazapp_E2E}"                               # AVD propio (README)

case "$DISPOSITIVO" in
  ios-phone|ios-tablet)
    UDID=$([ "$DISPOSITIVO" = ios-phone ] && echo "$IPHONE" || echo "$IPAD")
    xcrun simctl boot "$UDID" 2>/dev/null || true
    xcrun simctl bootstatus "$UDID" -b >/dev/null
    DEVICE_ID="$UDID"
    API_URL="${API_BASE_URL:-http://localhost:4000/api/v1}"
    ;;
  android)
    if ! "$SDK/platform-tools/adb" devices | grep -q "emulator-"; then
      nohup "$SDK/emulator/emulator" -avd "$AVD" -no-window -no-audio -no-boot-anim \
        -no-snapshot-save >/tmp/plazapp-emulador.log 2>&1 &
      "$SDK/platform-tools/adb" wait-for-device
      until [ "$("$SDK/platform-tools/adb" shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do
        sleep 2
      done
    fi
    DEVICE_ID=$("$SDK/platform-tools/adb" devices | awk '/emulator-/{print $1; exit}')
    API_URL="${API_BASE_URL:-http://10.0.2.2:4000/api/v1}"
    ;;
  *) echo "Dispositivo desconocido: $DISPOSITIVO" >&2; exit 2 ;;
esac

TESTS=("$@")
if [ ${#TESTS[@]} -eq 0 ]; then
  TESTS=(integration_test/*_test.dart)
fi

FALLOS=0
for t in "${TESTS[@]}"; do
  echo "▶ $t en $DISPOSITIVO ($DEVICE_ID)"
  if ! CAPTURAS_DISPOSITIVO="$DISPOSITIVO" flutter drive \
      --driver=test_driver/integration_test.dart \
      --target="$t" -d "$DEVICE_ID" \
      --dart-define=API_BASE_URL="$API_URL"; then
    FALLOS=$((FALLOS + 1))
  fi
done
echo "Capturas en build/capturas/$DISPOSITIVO/"
exit $FALLOS
