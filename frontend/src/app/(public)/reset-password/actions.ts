'use server';

import { ResetPasswordRequestSchema, ResetPasswordConfirmSchema } from '@app/contracts';

/**
 * Server Actions del flujo de reset (T-035). Actúan como BFF: llaman al backend
 * NestJS desde el servidor. La solicitud siempre responde neutro (no revela si
 * el email existe).
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function requestResetAction(input: { email: string }): Promise<{ ok: true }> {
  const parsed = ResetPasswordRequestSchema.safeParse(input);
  if (parsed.success) {
    try {
      await fetch(`${API_URL}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: parsed.data.email }),
        cache: 'no-store',
      });
    } catch {
      // Silencioso: respuesta neutra siempre.
    }
  }
  return { ok: true };
}

export type ConfirmResetResult = { ok: true } | { ok: false; error: 'invalid' | 'token' };

export async function confirmResetAction(input: {
  token: string;
  newPassword: string;
}): Promise<ConfirmResetResult> {
  const parsed = ResetPasswordConfirmSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalid' };
  }
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/reset-password/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    });
    if (!res.ok) {
      return { ok: false, error: 'token' };
    }
  } catch {
    return { ok: false, error: 'token' };
  }
  return { ok: true };
}
