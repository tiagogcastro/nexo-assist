import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { failure, success } from '@/lib/result';

function getEncryptionKey() {
  const value = process.env.PROVIDER_ENCRYPTION_KEY;
  if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) {
    return failure('ENCRYPTION_UNAVAILABLE', 'Chave de criptografia não configurada.');
  }

  return success(Buffer.from(value, 'hex'));
}

export function encryptProviderKey(plaintext: string) {
  const key = getEncryptionKey();
  if (key.error) {
    return key;
  }

  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key.data, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return success(
      `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`,
    );
  } catch {
    return failure('ENCRYPTION_UNAVAILABLE', 'Não foi possível proteger a chave.');
  }
}

export function decryptProviderKey(value: string) {
  const key = getEncryptionKey();
  if (key.error) {
    return key;
  }

  const parts = value.split(':');
  if (parts.length !== 3) {
    return failure('ENCRYPTION_UNAVAILABLE', 'Chave de provedor inválida.');
  }

  try {
    const decipher = createDecipheriv('aes-256-gcm', key.data, Buffer.from(parts[0], 'hex'));
    decipher.setAuthTag(Buffer.from(parts[1], 'hex'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(parts[2], 'hex')),
      decipher.final(),
    ]);
    return success(plaintext.toString('utf8'));
  } catch {
    return failure('ENCRYPTION_UNAVAILABLE', 'Não foi possível acessar a chave do provedor.');
  }
}
