import { en } from "./messages/en";
import { ja, type Messages } from "./messages/ja";

export type { Messages };

/**
 * The languages M4 speaks.
 *
 * Declared here rather than imported from `@m4/db`, because this module is
 * reached from Client Components and importing the database package would drag
 * Prisma and node-postgres into the browser bundle. Prisma generates its
 * `Language` enum as the same `"JA" | "EN"` union, so the two are structurally
 * identical and server code can pass one straight in.
 */
export const LANGUAGES = ["JA", "EN"] as const;

export type Language = (typeof LANGUAGES)[number];

const MESSAGES: Record<Language, Messages> = {
  JA: ja,
  EN: en,
};

/**
 * Messages for a language. The language comes from the signed-in user's
 * account, not from the URL — which is why this feature carries no i18n
 * routing and no locale path segment.
 */
export function getMessages(language: Language): Messages {
  return MESSAGES[language];
}

/** The two-letter tag for `<html lang>` and the sign-in language cookie. */
export function languageTag(language: Language): "ja" | "en" {
  return language === "EN" ? "en" : "ja";
}

/** Parse a two-letter tag back, falling back to Japanese (FR-043a). */
export function languageFromTag(tag: string | null | undefined): Language {
  return tag === "en" ? "EN" : "JA";
}

/**
 * Fill `{placeholder}` slots in a message. Deliberately minimal: this feature's
 * copy needs interpolation in one place, and ICU syntax would be a library.
 */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
