import { describe, expect, it } from "vitest";

import { generatePassword, hashPassword, verifyPassword } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("accepts the password it hashed", async () => {
    const hash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  it("rejects a different password", async () => {
    const hash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("correct horse battery stapler", hash)).resolves.toBe(false);
  });

  it("produces a different hash each time, so the salt is doing its job", async () => {
    const first = await hashPassword("same input");
    const second = await hashPassword("same input");

    expect(first).not.toBe(second);
    await expect(verifyPassword("same input", first)).resolves.toBe(true);
    await expect(verifyPassword("same input", second)).resolves.toBe(true);
  });

  it("writes its parameters into the stored hash", async () => {
    const hash = await hashPassword("whatever");
    const [prefix, cost, blockSize, parallelisation] = hash.split("$");

    expect(prefix).toBe("scrypt");
    expect(Number(cost)).toBe(2 ** 17);
    expect(Number(blockSize)).toBe(8);
    expect(Number(parallelisation)).toBe(1);
  });

  it("treats a malformed hash as a failed check rather than an error", async () => {
    for (const malformed of ["", "not-a-hash", "scrypt$1$2$3", "argon2$1$2$3$aa$bb"]) {
      await expect(verifyPassword("anything", malformed)).resolves.toBe(false);
    }
  });

  it("normalises unicode, so the same password typed two ways still works", async () => {
    // U+00E9 versus e + U+0301 — visually identical, different bytes.
    const hash = await hashPassword("cafépassphrase");

    await expect(verifyPassword("cafépassphrase", hash)).resolves.toBe(true);
  });
});

describe("generatePassword", () => {
  it("returns the requested length", () => {
    expect(generatePassword()).toHaveLength(24);
    expect(generatePassword(32)).toHaveLength(32);
  });

  it("does not repeat itself", () => {
    const generated = new Set(Array.from({ length: 50 }, () => generatePassword()));

    expect(generated.size).toBe(50);
  });

  it("leaves out glyphs that are ambiguous when read off a screen", () => {
    const sample = Array.from({ length: 40 }, () => generatePassword()).join("");

    expect(sample).not.toMatch(/[0OIl1]/);
  });
});
