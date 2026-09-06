import { Language } from "@m4/db";

import { en } from "./messages/en";
import { ja, type Messages } from "./messages/ja";

export type { Messages };
export { Language };

const MESSAGES: Record<Language, Messages> = {
  [Language.JA]: ja,
  [Language.EN]: en,
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
  return language === Language.EN ? "en" : "ja";
}

/** Parse a two-letter tag back, falling back to Japanese (FR-043a). */
export function languageFromTag(tag: string | null | undefined): Language {
  return tag === "en" ? Language.EN : Language.JA;
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
