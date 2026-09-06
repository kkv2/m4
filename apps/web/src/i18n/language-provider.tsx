"use client";

import { createContext, useContext, type ReactNode } from "react";

import { getMessages } from "./index";
import type { Language, Messages } from "./index";

interface LanguageContextValue {
  language: Language;
  messages: Messages;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Supplies messages to client components. The server decides the language —
 * from the account for a signed-in user, from the device cookie on the sign-in
 * screen — and passes it in, so there is no client-side language detection.
 */
export function LanguageProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  return (
    <LanguageContext.Provider value={{ language, messages: getMessages(language) }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error("useLanguage must be used inside a LanguageProvider.");
  }
  return value;
}

/** Shorthand for the common case of only needing the messages. */
export function useMessages(): Messages {
  return useLanguage().messages;
}
