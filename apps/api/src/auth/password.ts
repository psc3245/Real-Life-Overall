/**
 * Password hashing with WebCrypto PBKDF2-SHA256. Native in Workers (unlike JS scrypt, which can
 * exceed the free plan's CPU budget). Format: pbkdf2$sha256$<iterations>$<salt b64>$<hash b64>.
 */
const encoder = new TextEncoder();
const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export function passwordHasher(iterations: number) {
  return {
    async hash(password: string): Promise<string> {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await derive(password, salt, iterations);
      return `pbkdf2$sha256$${iterations}$${toB64(salt)}$${toB64(hash)}`;
    },
    async verify({ hash, password }: { hash: string; password: string }): Promise<boolean> {
      const [scheme, digest, iters, salt, expected] = hash.split("$");
      if (scheme !== "pbkdf2" || digest !== "sha256" || !iters || !salt || !expected) return false;
      const actual = await derive(password, fromB64(salt), Number(iters));
      const want = fromB64(expected);
      if (actual.length !== want.length) return false;
      let diff = 0; // constant-time compare
      for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ want[i]!;
      return diff === 0;
    },
  };
}
