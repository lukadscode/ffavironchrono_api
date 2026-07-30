import { describe, it, expect } from "vitest";

describe("tokenService JWT secret validation", () => {
  it("throws in production when secret is missing or weak", async () => {
    const prev = {
      NODE_ENV: process.env.NODE_ENV,
      JWT_SECRET: process.env.JWT_SECRET,
    };
    try {
      process.env.NODE_ENV = "production";
      process.env.JWT_SECRET = "ultra-secret-key";
      const mod = await import("../src/services/tokenService.js");
      expect(() => mod._getJwtSecretOrThrow()).toThrow();

      process.env.JWT_SECRET = "";
      expect(() => mod._getJwtSecretOrThrow()).toThrow();
    } finally {
      process.env.NODE_ENV = prev.NODE_ENV;
      process.env.JWT_SECRET = prev.JWT_SECRET;
    }
  });

  it("accepts a strong secret", async () => {
    const prev = {
      NODE_ENV: process.env.NODE_ENV,
      JWT_SECRET: process.env.JWT_SECRET,
    };
    try {
      process.env.NODE_ENV = "production";
      process.env.JWT_SECRET = "A".repeat(64);
      const mod = await import("../src/services/tokenService.js");
      expect(mod._getJwtSecretOrThrow()).toBe("A".repeat(64));
    } finally {
      process.env.NODE_ENV = prev.NODE_ENV;
      process.env.JWT_SECRET = prev.JWT_SECRET;
    }
  });
});

