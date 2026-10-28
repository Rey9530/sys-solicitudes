'use server';

import { AuthError } from 'next-auth';
import { LoginSchema } from '@app/contracts';
import { signIn, auth } from '@/auth';

/**
 * Server Action de login (T-034). Llama a `signIn` de Auth.js (Credentials
 * Provider → backend NestJS). No expone tokens; devuelve solo el resultado.
 */
export type LoginResult =
  | { ok: true; rol: string }
  | { ok: false; error: 'invalid' | 'locked' | 'plaza_inactiva' | 'unknown' };

export async function loginAction(input: { email: string; password: string }): Promise<LoginResult> {
  const parsed = LoginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalid' };
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === 'CredentialsSignin') {
        const code = (error as AuthError & { code?: string }).code;
        if (code === 'locked' || code === 'plaza_inactiva') return { ok: false, error: code };
        return { ok: false, error: 'invalid' };
      }
      return { ok: false, error: 'unknown' };
    }
    throw error;
  }

  const session = await auth();
  return { ok: true, rol: session?.user?.rol ?? 'inquilino' };
}
