import { describe, it, expect } from "vitest";
import apiResponse from "../src/utils/apiResponse.js";

function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    req: { id: "req-123" },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("apiResponse", () => {
  it("success includes request_id", () => {
    const res = makeRes();
    apiResponse.success(res, { ok: true }, 201);
    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe("success");
    expect(res.body.data.ok).toBe(true);
    expect(res.body.request_id).toBe("req-123");
  });

  it("error includes status and message", () => {
    const res = makeRes();
    apiResponse.error(res, "Bad", 400);
    expect(res.statusCode).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Bad");
  });

  it("locked returns 423", () => {
    const res = makeRes();
    apiResponse.locked(res);
    expect(res.statusCode).toBe(423);
  });
});
