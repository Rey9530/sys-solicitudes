import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';

/**
 * Hashing de contraseñas con bcrypt cost 12 (RN-AU-2, RI-5).
 * Decisión de sesión 2026-06-06: bcrypt (no argon2).
 */
@Injectable()
export class PasswordService {
  private readonly cost = 12;

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.cost);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  /** RI-5: todo password_hash debe ser bcrypt ($2a$/$2b$/$2y$). */
  isBcryptHash(hash: string): boolean {
    return /^\$2[aby]\$/.test(hash);
  }
}
