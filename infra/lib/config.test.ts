import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig safety guard", () => {
  it("local works when the endpoint is Floci", () => {
    const c = loadConfig("local", { AWS_ENDPOINT_URL: "http://localhost:4566" });
    expect(c.prefix).toBe("tai-local");
    expect(c.region).toBe("us-east-1");
  });

  it("local refuses without an emulator endpoint (would hit real AWS)", () => {
    expect(() => loadConfig("local", {})).toThrow(/Refusing/);
    expect(() => loadConfig("local", { AWS_ENDPOINT_URL: "https://dynamodb.us-east-1.amazonaws.com" })).toThrow();
  });

  it("aws refuses while an emulator endpoint is set", () => {
    expect(() => loadConfig("aws", { AWS_ENDPOINT_URL: "http://localhost:4566" })).toThrow(/unset/);
  });

  it("aws deploys to Sydney on ARM", () => {
    const c = loadConfig("aws", {});
    expect(c.region).toBe("ap-southeast-2");
    expect(c.lambdaArch.name).toBe("arm64");
  });

  it("unknown stage is an error", () => {
    expect(() => loadConfig("prod", {})).toThrow(/local or aws/);
    expect(() => loadConfig(undefined, {})).toThrow();
  });
});
