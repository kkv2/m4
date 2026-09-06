import { describe, expect, it } from "vitest";

import {
  OPERATOR_SESSION_COOKIE,
  SIGN_IN_LANGUAGE_COOKIE,
  TENANT_SESSION_COOKIE,
  readCookie,
  serialiseClearedCookie,
  serialiseOperatorSessionCookie,
  serialiseSignInLanguageCookie,
  serialiseTenantSessionCookie,
} from "./cookies";

describe("readCookie", () => {
  it("finds a cookie among others", () => {
    const headers = new Headers({ cookie: "a=1; m4_session=token-value; b=2" });

    expect(readCookie(headers, TENANT_SESSION_COOKIE)).toBe("token-value");
  });

  it("returns null when the cookie or the header is absent", () => {
    expect(readCookie(new Headers({ cookie: "a=1" }), TENANT_SESSION_COOKIE)).toBeNull();
    expect(readCookie(new Headers(), TENANT_SESSION_COOKIE)).toBeNull();
  });

  it("does not match a cookie whose name merely ends with the one asked for", () => {
    const headers = new Headers({ cookie: "not_m4_session=wrong" });

    expect(readCookie(headers, TENANT_SESSION_COOKIE)).toBeNull();
  });

  it("decodes percent-encoded values", () => {
    const headers = new Headers({ cookie: "m4_signin_language=en" });

    expect(readCookie(headers, SIGN_IN_LANGUAGE_COOKIE)).toBe("en");
  });
});

describe("session cookies", () => {
  it("are httpOnly, SameSite=Lax and scoped to their surface", () => {
    const tenant = serialiseTenantSessionCookie("t");
    const operator = serialiseOperatorSessionCookie("o");

    expect(tenant).toContain("HttpOnly");
    expect(tenant).toContain("SameSite=Lax");
    expect(tenant).toContain("Path=/");
    expect(operator).toContain("HttpOnly");
    expect(operator).toContain("Path=/admin");
  });

  it("expire in 30 days", () => {
    expect(serialiseTenantSessionCookie("t")).toContain(`Max-Age=${60 * 60 * 24 * 30}`);
  });

  it("are not Secure outside production, so local http works", () => {
    expect(serialiseTenantSessionCookie("t")).not.toContain("Secure");
  });

  it("round-trip through readCookie", () => {
    const [pair] = serialiseTenantSessionCookie("token/with+chars").split(";");
    const headers = new Headers({ cookie: pair ?? "" });

    expect(readCookie(headers, TENANT_SESSION_COOKIE)).toBe("token/with+chars");
  });
});

describe("the sign-in language cookie", () => {
  it("is readable by the client, because the client toggles it", () => {
    expect(serialiseSignInLanguageCookie("en")).not.toContain("HttpOnly");
  });

  it("outlives a session, so a returning user does not switch every time", () => {
    expect(serialiseSignInLanguageCookie("ja")).toContain(`Max-Age=${60 * 60 * 24 * 365}`);
  });
});

describe("serialiseClearedCookie", () => {
  it("expires the cookie immediately on the path it was set with", () => {
    expect(serialiseClearedCookie(TENANT_SESSION_COOKIE)).toContain("Max-Age=0");
    expect(serialiseClearedCookie(OPERATOR_SESSION_COOKIE)).toContain("Path=/admin");
  });
});
