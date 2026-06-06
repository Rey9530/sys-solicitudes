/**
 * Parseo de duraciones tipo `3600s`, `14d`, `30min`, `1h` a ms/segundos.
 * Se usa para los TTL de tokens y ventanas de lockout (T-V13), leídos de `.env`.
 */
const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  min: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function durationToMs(input: string): number {
  const match = String(input)
    .trim()
    .match(/^(\d+)\s*(ms|min|s|m|h|d)?$/i);
  if (!match) {
    throw new Error(`Duración inválida: "${input}"`);
  }
  const value = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  return value * (UNIT_MS[unit] ?? 1_000);
}

export function durationToSeconds(input: string): number {
  return Math.floor(durationToMs(input) / 1_000);
}
