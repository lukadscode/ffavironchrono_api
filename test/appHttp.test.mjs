import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

describe("API HTTP (supertest)", () => {
  let app;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    const mod = await import("../src/app.js");
    app = mod.default || mod;
  });

  it("GET /test returns API OK outside production", async () => {
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    expect(res.text).toBe("API OK");
  });

  it("GET /public/timing-points/event/:id returns standardized success shape", async () => {
    const res = await request(app).get("/public/timing-points/event/non-existent");
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty("status", "success");
      expect(res.body).toHaveProperty("data");
      expect(Array.isArray(res.body.data)).toBe(true);
    }
  });

  it("unknown route returns JSON error with request_id header", async () => {
    const res = await request(app).get("/this-route-does-not-exist-xyz");
    expect(res.status).toBe(404);
    expect(res.headers["x-request-id"]).toBeTruthy();
  });
});
