/**
 * Schemas de autenticación.
 * Detalles: PLANIFICACION/02-autenticacion-usuarios.md (T-022).
 *
 * Decisión T-V13:
 *   - Política de contraseña: 8+ chars, mayúscula, minúscula y dígito (3 tipos).
 *   - Tokens: access 1h, refresh 14d.
 */
import { z } from 'zod';
import { EmailSchema } from '../common/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Política de contraseñas (8 chars + 3 tipos)

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
export const PasswordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128)
  .regex(
    PASSWORD_REGEX,
    'La contraseña debe incluir mayúscula, minúscula y dígito',
  );
export type Password = z.infer<typeof PasswordSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Login

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1), // no validamos formato aquí, el backend compara
});
export type LoginInput = z.infer<typeof LoginSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Refresh

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof RefreshSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Reset de contraseña

export const ResetPasswordRequestSchema = z.object({
  email: EmailSchema,
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export const ResetPasswordConfirmSchema = z.object({
  token: z.string().min(1),
  newPassword: PasswordSchema,
});
export type ResetPasswordConfirm = z.infer<typeof ResetPasswordConfirmSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Cambio de contraseña (sesión activa)

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: PasswordSchema,
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Respuestas

export const TokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(), // segundos hasta expirar access
  user: z.object({
    id: z.string(),
    email: EmailSchema,
    nombre: z.string(),
    rol: z.enum(['superadmin', 'admin_plaza', 'inquilino']),
    plazaId: z.string().nullable(),
    rolStaffId: z.string().nullable(),
    inquilinoId: z.string().nullable(),
    /**
     * T-RBAC-1: códigos de permisos efectivos del usuario. `['*']` para
     * superadmin. Lista vacía para inquilino en v1.
     */
    permisos: z.array(z.string()),
  }),
});
export type TokenResponse = z.infer<typeof TokenResponseSchema>;
