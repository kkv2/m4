/**
 * Password rules that both sides need to know.
 *
 * `src/lib/` is the code shared with the browser. The rule itself is enforced
 * on the server in `~/server/auth/password-policy`; this is only the number the
 * message has to quote, and it lives here so a Client Component can render
 * "at least 12 characters" without importing server code — which would drag the
 * deny-list into the browser bundle.
 */
export const MINIMUM_PASSWORD_LENGTH = 12;
