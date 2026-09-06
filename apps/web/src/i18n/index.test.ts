import { Language } from "@m4/db";
import { describe, expect, it } from "vitest";

import { format, getMessages, languageFromTag, languageTag } from "./index";
import { en } from "./messages/en";
import { ja } from "./messages/ja";

/** Every leaf key path in a nested message object. */
function keyPaths(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]: [string, unknown]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "object" && child !== null ? keyPaths(child, path) : [path];
  });
}

describe("getMessages", () => {
  it("returns the dictionary for each language", () => {
    expect(getMessages(Language.JA)).toBe(ja);
    expect(getMessages(Language.EN)).toBe(en);
  });
});

describe("the two dictionaries", () => {
  it("carry exactly the same keys", () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(ja).sort());
  });

  it("have no empty strings", () => {
    for (const dictionary of [ja, en]) {
      for (const path of keyPaths(dictionary)) {
        const value = path
          .split(".")
          .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], dictionary);
        expect(value).not.toBe("");
      }
    }
  });

  it("use the same placeholders in both languages", () => {
    const placeholders = (text: string) => (text.match(/\{(\w+)\}/g) ?? []).sort();

    expect(placeholders(en.password.tooShort)).toEqual(placeholders(ja.password.tooShort));
  });
});

describe("language tags", () => {
  it("round-trip", () => {
    expect(languageFromTag(languageTag(Language.JA))).toBe(Language.JA);
    expect(languageFromTag(languageTag(Language.EN))).toBe(Language.EN);
  });

  it("fall back to Japanese for anything unrecognised, per FR-043a", () => {
    expect(languageFromTag(null)).toBe(Language.JA);
    expect(languageFromTag(undefined)).toBe(Language.JA);
    expect(languageFromTag("fr")).toBe(Language.JA);
  });
});

describe("format", () => {
  it("fills placeholders", () => {
    expect(format(en.password.tooShort, { minimumLength: 12 })).toBe("Use at least 12 characters.");
  });

  it("leaves an unknown placeholder alone rather than printing undefined", () => {
    expect(format("{a} and {b}", { a: "x" })).toBe("x and {b}");
  });
});
