import { describe, it, expect } from "vitest";
import refreshTokenFormat from "../src/utils/refreshTokenFormat.js";

const { makeSessionBoundRefreshToken, parseSessionBoundRefreshToken } =
  refreshTokenFormat;

describe("refreshTokenFormat", () => {
  it("parse returns null for invalid formats", () => {
    expect(parseSessionBoundRefreshToken(null)).toBe(null);
    expect(parseSessionBoundRefreshToken("")).toBe(null);
    expect(parseSessionBoundRefreshToken("abc")).toBe(null);
    expect(parseSessionBoundRefreshToken("a.b.c")).toBe(null);
    expect(parseSessionBoundRefreshToken(".secret")).toBe(null);
    expect(parseSessionBoundRefreshToken("session.")).toBe(null);
  });

  it("make/parse roundtrip", () => {
    const { token, secret } = makeSessionBoundRefreshToken("session-uuid");
    expect(token).toContain(".");
    expect(secret).toBeTruthy();
    const parsed = parseSessionBoundRefreshToken(token);
    expect(parsed).not.toBe(null);
    expect(parsed.sessionId).toBe("session-uuid");
    expect(parsed.secret).toBe(secret);
  });
});

