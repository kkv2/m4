import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

/**
 * `promisify` cannot see through scrypt's overloads, so the options-taking
 * signature is restated here. Without it the options argument is dropped and
 * the cost parameters below would silently not apply.
 */
const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * scrypt parameters. OWASP lists scrypt as an acceptable choice behind Argon2id,
 * and it is in the Node standard library — which is why this feature adds no
 * runtime dependency to hash a password.
 *
 * They are written into every stored hash rather than assumed, so raising the
 * cost later is a rehash-on-next-sign-in change instead of a migration.
 */
const SCRYPT_COST = 2 ** 17;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELISATION = 1;
const SCRYPT_KEY_BYTES = 64;
const SALT_BYTES = 16;

/** Node's default is 32 MiB, which is far below what N=2^17 needs. */
const SCRYPT_MAX_MEMORY = 256 * 1024 * 1024;

const PREFIX = "scrypt";

/**
 * Alphabet for generated passwords. Ambiguous glyphs are left out because these
 * passwords are read off a screen and typed by hand, or dictated.
 */
const GENERATED_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const GENERATED_LENGTH = 24;

async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return scrypt(password.normalize("NFKC"), salt, SCRYPT_KEY_BYTES, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELISATION,
    maxmem: SCRYPT_MAX_MEMORY,
  });
}

/**
 * Hash a password for storage. The result is self-describing:
 * `scrypt$N$r$p$salt$key`, both binary parts base64url-encoded.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt);

  return [
    PREFIX,
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELISATION,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

/**
 * Check a password against a stored hash. Returns false rather than throwing on
 * a malformed hash: a corrupt row must not become an authentication bypass, and
 * it must not become a crash that distinguishes one account from another.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 6) return false;

  const [prefix, costRaw, blockSizeRaw, parallelisationRaw, saltRaw, keyRaw] = parts;
  if (prefix !== PREFIX) return false;
  if (!costRaw || !blockSizeRaw || !parallelisationRaw || !saltRaw || !keyRaw) return false;

  const cost = Number(costRaw);
  const blockSize = Number(blockSizeRaw);
  const parallelisation = Number(parallelisationRaw);
  if (
    !Number.isInteger(cost) ||
    !Number.isInteger(blockSize) ||
    !Number.isInteger(parallelisation)
  ) {
    return false;
  }

  const salt = Buffer.from(saltRaw, "base64url");
  const expected = Buffer.from(keyRaw, "base64url");
  if (salt.length === 0 || expected.length === 0) return false;

  const actual = await scrypt(password.normalize("NFKC"), salt, expected.length, {
    N: cost,
    r: blockSize,
    p: parallelisation,
    maxmem: SCRYPT_MAX_MEMORY,
  });

  return timingSafeEqual(actual, expected);
}

/**
 * A strong random password, for the operator bootstrap CLI and for every
 * credential an operator issues. 24 characters from a 56-glyph alphabet is
 * about 139 bits, so it satisfies the strength policy by a wide margin.
 *
 * `randomInt`-style rejection is unnecessary here: 256 is not a multiple of 56,
 * so bytes are drawn and the out-of-range tail discarded to keep the
 * distribution uniform.
 */
export function generatePassword(length: number = GENERATED_LENGTH): string {
  const alphabet = GENERATED_ALPHABET;
  const limit = Math.floor(256 / alphabet.length) * alphabet.length;
  let out = "";

  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= limit) continue;
      out += alphabet[byte % alphabet.length];
      if (out.length === length) break;
    }
  }

  return out;
}
