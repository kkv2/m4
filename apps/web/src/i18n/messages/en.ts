import type { Messages } from "./ja";

/**
 * English messages. Typed as `Messages`, so removing a key or misspelling one
 * fails `pnpm typecheck` rather than showing a blank to an English user.
 */
export const en: Messages = {
  common: {
    productName: "M4",
    signOut: "Sign out",
    save: "Save",
    cancel: "Cancel",
    submit: "Submit",
    close: "Close",
    loading: "Loading…",
    requiredLegend: "* marks a required field.",
    unexpectedError: "Something went wrong. Please try again in a moment.",
  },
  signIn: {
    title: "Sign in",
    emailLabel: "Email address",
    passwordLabel: "Password",
    submit: "Sign in",
    failed: "That email address and password do not match.",
    throttled: "Too many sign-in attempts. Please wait a few minutes and try again.",
    switchLanguage: "日本語",
  },
  firstLogin: {
    languageTitle: "Choose your language",
    languageDescription: "You can change this later in settings.",
    languageSubmit: "Continue",
    passwordTitle: "Set your own password",
    passwordDescription: "Replace the password your operator gave you with one only you know.",
    newPasswordLabel: "New password",
    passwordSubmit: "Set password and continue",
  },
  password: {
    tooShort: "Use at least {minimumLength} characters.",
    tooCommon: "That password is too common. Choose something harder to guess.",
    matchesEmail: "Your password cannot be your email address.",
    matchesDisplayName: "Your password cannot be your display name.",
    sameAsIssued: "Choose a password different from the one you were given.",
    currentIncorrect: "That is not your current password.",
    sameAsCurrent: "Choose a password different from your current one.",
    confirmLabel: "New password (confirm)",
    mismatch: "The two new passwords do not match.",
  },
  settings: {
    title: "Settings",
    userIdLabel: "User ID",
    emailLabel: "Email address",
    readOnlyNote: "This cannot be changed.",
    displayNameLabel: "Display name",
    languageLabel: "Language",
    currentPasswordLabel: "Current password",
    newPasswordLabel: "New password",
    changePassword: "Change password",
    saved: "Your changes have been saved.",
    shortcutHint: "You can also press ⌘ + ,",
  },
  app: {
    consoleName: "User Console",
    home: "Go to home",
    welcome: "Welcome",
    nothingHereYet: "Chat is coming soon. Your sign-in is complete.",
    settings: "Settings",
  },
  language: {
    ja: "日本語",
    en: "English",
  },
};
