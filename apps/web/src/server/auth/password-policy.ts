import { COMMON_PASSWORDS } from "./common-passwords";

/**
 * FR-032a. Length and a deny-list carry the weight; composition rules are
 * deliberately absent, following current NIST SP 800-63B guidance — requiring a
 * mix of character classes pushes people towards predictable patterns like
 * "Password1!" without making the result harder to guess.
 */
export const MINIMUM_PASSWORD_LENGTH = 12;

/** Which rule a password broke. FR-032b requires the message to name it. */
export type PasswordPolicyFailure =
  | { rule: "too-short"; minimumLength: number }
  | { rule: "too-common" }
  | { rule: "matches-email" }
  | { rule: "matches-display-name" };

export type PasswordPolicyResult = { ok: true } | { ok: false; failure: PasswordPolicyFailure };

export interface PasswordPolicySubject {
  email: string;
  displayName: string;
}

let denyList: Set<string> | undefined;

/**
 * The deny-list is built once and kept for the life of the process. It ships
 * with the product — this feature makes no outbound requests, so there is no
 * breach-checking service to call.
 */
function getDenyList(): Set<string> {
  denyList ??= new Set(COMMON_PASSWORDS.map((entry) => entry.normalize("NFKC").toLowerCase()));
  return denyList;
}

function canonicalise(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

/**
 * Check a user-chosen password. Returns which rule failed rather than a
 * boolean, so the caller can say what to fix.
 *
 * Not checked here: that the password differs from the one the operator issued.
 * That needs a hash comparison against stored state, so it belongs to the
 * procedure doing the replacing, not to a pure policy function.
 */
export function checkPasswordPolicy(
  password: string,
  subject: PasswordPolicySubject,
): PasswordPolicyResult {
  const normalised = password.normalize("NFKC");

  if (normalised.length < MINIMUM_PASSWORD_LENGTH) {
    return { ok: false, failure: { rule: "too-short", minimumLength: MINIMUM_PASSWORD_LENGTH } };
  }

  const candidate = canonicalise(password);

  if (getDenyList().has(candidate)) {
    return { ok: false, failure: { rule: "too-common" } };
  }

  const email = canonicalise(subject.email);
  const localPart = email.split("@")[0] ?? "";
  if (candidate === email || (localPart.length > 0 && candidate === localPart)) {
    return { ok: false, failure: { rule: "matches-email" } };
  }

  const displayName = canonicalise(subject.displayName);
  if (displayName.length > 0 && candidate === displayName) {
    return { ok: false, failure: { rule: "matches-display-name" } };
  }

  return { ok: true };
}
