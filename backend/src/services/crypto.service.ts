import crypto from 'node:crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(env.ENCRYPTION_KEY, 'utf8'); // 32 bytes exactos

/**
 * Encripta un string con AES-256-GCM.
 * Devuelve "iv:authTag:ciphertext" en hex — seguro para guardar en DB.
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12); // 96 bits recomendado para GCM
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

/**
 * Desencripta un valor producido por encrypt().
 * Lanza si el authTag no coincide (dato corrompido o manipulado).
 */
export function decrypt(encryptedValue: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encryptedValue.split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) throw new Error('Formato de valor encriptado inválido');

  const iv         = Buffer.from(ivHex, 'hex');
  const authTag    = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
