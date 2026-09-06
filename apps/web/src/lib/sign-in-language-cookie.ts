/**
 * The device-level language preference on the tenant sign-in screen (FR-043b).
 *
 * The name lives in `src/lib/` because both sides need it: the server reads it
 * to render the screen in the remembered language, and the sign-in form writes
 * it from the browser. It is the one cookie here that is deliberately not
 * `httpOnly` — a display preference, never a credential.
 */
export const SIGN_IN_LANGUAGE_COOKIE = "m4_signin_language";

export const SIGN_IN_LANGUAGE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
