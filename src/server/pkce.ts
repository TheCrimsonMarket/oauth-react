import { createHash } from 'node:crypto';

export function toPkceS256Challenge(codeVerifier: string): string {
  if (!codeVerifier || typeof codeVerifier !== 'string') {
    throw new TypeError('codeVerifier must be a non-empty string');
  }

  return createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
