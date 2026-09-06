import { describe, expect, it } from "vitest";

import { COMMON_PASSWORDS } from "./common-passwords";
import { generatePassword } from "./password";
import { MINIMUM_PASSWORD_LENGTH, checkPasswordPolicy } from "./password-policy";

const subject = { email: "hanako@example.com", displayName: "Hanako Tanaka" };

function failureOf(password: string, who = subject) {
  const result = checkPasswordPolicy(password, who);
  return result.ok ? null : result.failure;
}

describe("checkPasswordPolicy", () => {
  it("accepts a long password that is none of the forbidden things", () => {
    expect(checkPasswordPolicy("tumbling walnut ledger", subject)).toEqual({ ok: true });
  });

  it("rejects a password shorter than the minimum, and says so", () => {
    expect(failureOf("short")).toEqual({
      rule: "too-short",
      minimumLength: MINIMUM_PASSWORD_LENGTH,
    });
  });

  it("accepts exactly the minimum length", () => {
    const exact = "a".repeat(MINIMUM_PASSWORD_LENGTH - 1) + "b";

    expect(exact).toHaveLength(MINIMUM_PASSWORD_LENGTH);
    expect(checkPasswordPolicy(exact, subject)).toEqual({ ok: true });
  });

  it("rejects a password on the deny-list", () => {
    expect(failureOf("passwordpassword")).toEqual({ rule: "too-common" });
    expect(failureOf("qwertyuiop123")).toEqual({ rule: "too-common" });
  });

  it("matches the deny-list regardless of case", () => {
    expect(failureOf("PasswordPassword")).toEqual({ rule: "too-common" });
  });

  it("rejects the user's own email address, whole or local part", () => {
    expect(failureOf("hanako@example.com")).toEqual({ rule: "matches-email" });
    expect(failureOf("HANAKO@EXAMPLE.COM")).toEqual({ rule: "matches-email" });
    expect(
      failureOf("hanakolongenough@example.com", {
        email: "hanakolongenough@example.com",
        displayName: "H",
      }),
    ).toEqual({ rule: "matches-email" });
  });

  it("rejects the user's own display name", () => {
    expect(failureOf("Hanako Tanaka")).toEqual({ rule: "matches-display-name" });
    expect(failureOf("  hanako tanaka  ")).toEqual({ rule: "matches-display-name" });
  });

  it("does not reject a password that merely contains the display name", () => {
    expect(checkPasswordPolicy("Hanako Tanaka rides again", subject)).toEqual({ ok: true });
  });

  it("requires no mix of character classes", () => {
    expect(checkPasswordPolicy("aaaaaaaaaaaabbbb", subject)).toEqual({ ok: true });
  });

  it("reports the length failure first, so the message is the actionable one", () => {
    // "password" is on the deny-list and is also too short.
    expect(failureOf("password")).toEqual({
      rule: "too-short",
      minimumLength: MINIMUM_PASSWORD_LENGTH,
    });
  });

  it("accepts every password the generator produces", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(checkPasswordPolicy(generatePassword(), subject)).toEqual({ ok: true });
    }
  });
});

describe("the deny-list itself", () => {
  it("is lowercase and free of blanks, so lookups cannot silently miss", () => {
    for (const entry of COMMON_PASSWORDS) {
      expect(entry).toBe(entry.toLowerCase());
      expect(entry.trim()).toBe(entry);
      expect(entry.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(COMMON_PASSWORDS).size).toBe(COMMON_PASSWORDS.length);
  });

  it("carries entries long enough for the length rule to let through", () => {
    const longEnough = COMMON_PASSWORDS.filter((p) => p.length >= MINIMUM_PASSWORD_LENGTH);

    expect(longEnough.length).toBeGreaterThan(100);
  });
});
