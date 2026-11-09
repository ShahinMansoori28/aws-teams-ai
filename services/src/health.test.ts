import { describe, expect, it } from "vitest";
import { makeHealthHandler } from "./health.js";

// The handler takes its database call as a parameter ("dependency injection"),
// so the test passes a fake one instead of needing a real table.
describe("health", () => {
  it("200 when the table answers", async () => {
    const res = await makeHealthHandler(async () => ({}))();
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body!)).toMatchObject({ ok: true, db: "ok" });
  });

  it("503 when the table read fails", async () => {
    const res = await makeHealthHandler(async () => { throw new Error("AccessDenied"); })();
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body!)).toMatchObject({ ok: false, db: "error" });
  });
});
