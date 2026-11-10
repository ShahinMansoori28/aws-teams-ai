import { describe, expect, it } from "vitest";
import { checkMutation, siteOrigins } from "./csrf";

const allowed = ["http://localhost:3000"];

describe("checkMutation", () => {
  it("lets reads through", () => {
    expect(checkMutation({ method: "GET", origin: null, contentType: null, allowed })).toBeNull();
  });

  it("accepts a same-site JSON POST", () => {
    expect(checkMutation({ method: "POST", origin: "http://localhost:3000", contentType: "application/json; charset=utf-8", allowed })).toBeNull();
  });

  it("refuses another site's POST (the CSRF attack)", () => {
    expect(checkMutation({ method: "POST", origin: "https://evil.com", contentType: "application/json", allowed })?.status).toBe(403);
  });

  it("refuses a POST with no Origin", () => {
    expect(checkMutation({ method: "PUT", origin: null, contentType: "application/json", allowed })?.status).toBe(403);
  });

  it("refuses form bodies, which is what a hidden <form> sends", () => {
    expect(checkMutation({ method: "POST", origin: "http://localhost:3000", contentType: "application/x-www-form-urlencoded", allowed })?.status).toBe(415);
  });
});

describe("siteOrigins", () => {
  it("uses Host locally", () => {
    expect(siteOrigins(new Headers({ host: "localhost:3000" }))).toEqual(["http://localhost:3000"]);
  });

  it("prefers the forwarded host and proto behind a CDN", () => {
    const h = new Headers({ host: "abc.lambda-url.aws", "x-forwarded-host": "chat.example.com", "x-forwarded-proto": "https" });
    expect(siteOrigins(h, ["https://chat.example.com"])).toEqual(["https://chat.example.com"]);
  });
});
