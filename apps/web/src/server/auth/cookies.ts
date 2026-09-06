/**
 * Cookie names and attributes, in one place so no route invents its own.
 *
 * The two session cookies are separate on purpose. FR-008 makes the
 * operator/tenant-user split a security boundary, and separate cookies mean an
 * operator's browser simply does not carry a credential the tenant application
 * would look at — the boundary holds without anything having to check it.
 */

/** Opaque session token for a tenant user. */
export const TENANT_SESSION_COOKIE = "m4_session";

/** Opaque session token for an operator. */
export const OPERATOR_SESSION_COOKIE = "m4_operator_session";

/**
 * The device-level language preference on the tenant sign-in screen (FR-043b).
 * Not httpOnly: the client toggles it. It is a display preference, never a
 * credential, and the account language supersedes it once signed in (FR-043d).
 */
export const SIGN_IN_LANGUAGE_COOKIE = "m4_signin_language";

/** FR-023a: sessions expire 30 days after last use, sliding. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const SIGN_IN_LANGUAGE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function isSecureContext(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Read one cookie out of a request's headers. Returns null when absent. */
export function readCookie(headers: Headers, name: string): string | null {
  const header = headers.get("cookie");
  if (!header) return null;

  for (const pair of header.split(";")) {
    const index = pair.indexOf("=");
    if (index === -1) continue;
    if (pair.slice(0, index).trim() !== name) continue;
    return decodeURIComponent(pair.slice(index + 1).trim());
  }

  return null;
}

interface SerialiseOptions {
  path: string;
  maxAgeSeconds: number;
  httpOnly: boolean;
}

function serialise(name: string, value: string, options: SerialiseOptions): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAgeSeconds}`,
    "SameSite=Lax",
  ];

  if (options.httpOnly) parts.push("HttpOnly");
  if (isSecureContext()) parts.push("Secure");

  return parts.join("; ");
}

export function serialiseTenantSessionCookie(token: string): string {
  return serialise(TENANT_SESSION_COOKIE, token, {
    path: "/",
    maxAgeSeconds: SESSION_MAX_AGE_SECONDS,
    httpOnly: true,
  });
}

export function serialiseOperatorSessionCookie(token: string): string {
  return serialise(OPERATOR_SESSION_COOKIE, token, {
    path: "/admin",
    maxAgeSeconds: SESSION_MAX_AGE_SECONDS,
    httpOnly: true,
  });
}

export function serialiseSignInLanguageCookie(language: "ja" | "en"): string {
  return serialise(SIGN_IN_LANGUAGE_COOKIE, language, {
    path: "/",
    maxAgeSeconds: SIGN_IN_LANGUAGE_MAX_AGE_SECONDS,
    httpOnly: false,
  });
}

/** Expire a cookie by name, using the same Path it was set with. */
export function serialiseClearedCookie(name: string): string {
  const path = name === OPERATOR_SESSION_COOKIE ? "/admin" : "/";
  return serialise(name, "", { path, maxAgeSeconds: 0, httpOnly: true });
}
