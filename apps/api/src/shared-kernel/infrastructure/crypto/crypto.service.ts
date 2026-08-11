import { Injectable, Inject } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Env } from '../config/env';

/**
 * AES-256-GCM envelope encryption for per-tenant secrets stored in the database.
 * The MASTER_KEY is loaded once from .env (Zod-validated at startup) and never
 * leaves this service. Encrypted values are stored as base64(iv:ciphertext:tag).
 *
 * Usage: repositories call encrypt() before persisting, decrypt() after reading.
 * Domain/application code receives plaintext in memory only — never serialized
 * to API responses (masked in DTOs).
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(@Inject('ENV_CONFIG') config: Env) {
    const raw = config.MASTER_KEY;
    // Accept hex (64 chars = 32 bytes) or base64 (44 chars = 32 bytes)
    let key: Buffer;
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      key = Buffer.from(raw, 'hex');
    } else {
      key = Buffer.from(raw, 'base64');
      if (key.length !== 32) {
        throw new Error('MASTER_KEY must be 32 bytes (hex or base64 encoded)');
      }
    }
    this.key = key;
  }

  encrypt(plaintext: string): string {
    if (plaintext == null || plaintext === '') return '';
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, ciphertext, tag]).toString('base64');
  }

  decrypt(encrypted: string): string {
    if (!encrypted) return '';
    const buf = Buffer.from(encrypted, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(buf.length - 16);
    const ciphertext = buf.subarray(12, buf.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  }

  mask(value: string): string {
    if (!value || value.length <= 4) return '****';
    return '****' + value.slice(-4);
  }
}
