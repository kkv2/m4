import {
  SIGN_IN_LANGUAGE_COOKIE,
  SIGN_IN_LANGUAGE_MAX_AGE_SECONDS,
} from "~/lib/sign-in-language-cookie";

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
 * Re-exported so server code has one place to look for cookie names. The name
 * itself is declared in `~/lib/` because the sign-in form writes it from the
 * browser, and a Client Component must not import server code.
 */
export { SIGN_IN_LANGUAGE_COOKIE };

/** FR-023a: sessions expire 30 days after last use, sliding. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

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

/**
 * Path is `/` rather than `/admin`, even though the console lives there. The
 * BFF is at `/api/trpc`, so a cookie scoped to `/admin` would never reach the
 * procedures the console calls. The operator/tenant boundary is held by the
 * separate cookie names and separate session tables, not by path scoping.
 */
export function serialiseOperatorSessionCookie(token: string): string {
  return serialise(OPERATOR_SESSION_COOKIE, token, {
    path: "/",
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

/** Expire a cookie by name. Every cookie here is set at the root path. */
export function serialiseClearedCookie(name: string): string {
  return serialise(name, "", { path: "/", maxAgeSeconds: 0, httpOnly: true });
}
