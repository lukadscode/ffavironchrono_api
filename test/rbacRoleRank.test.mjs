import { describe, it, expect } from "vitest";
import roleRank from "../src/utils/rbacRoleRank.js";

const { getRank, minRequiredRank } = roleRank;

describe("rbacRoleRank", () => {
  it("getRank returns -1 for unknown roles", () => {
    expect(getRank("nope")).toBe(-1);
    expect(getRank(undefined)).toBe(-1);
  });

  it("getRank respects hierarchy", () => {
    expect(getRank("viewer")).toBe(0);
    expect(getRank("timing")).toBe(1);
    expect(getRank("referee")).toBe(1);
    expect(getRank("editor")).toBe(2);
    expect(getRank("organiser")).toBe(3);
  });

  it("minRequiredRank defaults to 0 when no roles", () => {
    expect(minRequiredRank()).toBe(0);
    expect(minRequiredRank([])).toBe(0);
  });

  it("minRequiredRank uses minimum rank among allowed roles", () => {
    expect(minRequiredRank(["organiser", "viewer"])).toBe(0);
    expect(minRequiredRank(["editor", "organiser"])).toBe(2);
    expect(minRequiredRank(["timing", "referee"])).toBe(1);
  });
});

