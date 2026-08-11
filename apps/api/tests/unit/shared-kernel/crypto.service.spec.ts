import { CryptoService } from '../../../src/shared-kernel/infrastructure/crypto/crypto.service';

function makeService(): CryptoService {
  return new CryptoService({ MASTER_KEY: '2690fb5c07a40c33377b0fb365b55d81ded9e1e5277292a6ead8ceb2a5c92bad' } as never);
}

describe('CryptoService (AES-256-GCM envelope encryption)', () => {
  it('encrypt then decrypt returns the original plaintext', () => {
    const svc = makeService();
    const plaintext = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.long-lived-token';
    const encrypted = svc.encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(svc.decrypt(encrypted)).toBe(plaintext);
  });

  it('different plaintexts produce different ciphertexts', () => {
    const svc = makeService();
    const enc1 = svc.encrypt('token-one');
    const enc2 = svc.encrypt('token-two');
    expect(enc1).not.toBe(enc2);
  });

  it('same plaintext produces different ciphertexts (random IV)', () => {
    const svc = makeService();
    const enc1 = svc.encrypt('same-token');
    const enc2 = svc.encrypt('same-token');
    expect(enc1).not.toBe(enc2);
    expect(svc.decrypt(enc1)).toBe('same-token');
    expect(svc.decrypt(enc2)).toBe('same-token');
  });

  it('mask returns **** + last 4 chars', () => {
    const svc = makeService();
    expect(svc.mask('ABCDEFGHIJ')).toBe('****GHIJ');
    expect(svc.mask('1234567890')).toBe('****7890');
  });

  it('mask returns **** for short values', () => {
    const svc = makeService();
    expect(svc.mask('ab')).toBe('****');
    expect(svc.mask('abcd')).toBe('****');
  });

  it('empty string round-trips', () => {
    const svc = makeService();
    expect(svc.encrypt('')).toBe('');
    expect(svc.decrypt('')).toBe('');
  });

  it('ciphertext is base64-encoded', () => {
    const svc = makeService();
    const encrypted = svc.encrypt('test-token');
    expect(encrypted).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });

  it('decrypt throws on tampered ciphertext (auth tag verification)', () => {
    const svc = makeService();
    const encrypted = svc.encrypt('secret-token');
    const tampered = encrypted.slice(0, -4) + 'AAAA';
    expect(() => svc.decrypt(tampered)).toThrow();
  });
});
