import { describe, expect, it } from "vitest";
import { localApiUrl, localFunctionUrl, localWsUrls } from "./urls.js";

describe("local URLs", () => {
  it("HTTP API", () => {
    expect(localApiUrl("https://abc123.execute-api.us-east-1.amazonaws.com/"))
      .toBe("http://abc123.execute-api.localhost.floci.io:4566");
  });

  it("WebSocket API keeps the stage", () => {
    expect(localWsUrls("wss://ws9.execute-api.us-east-1.amazonaws.com/live")[0])
      .toBe("ws://ws9.execute-api.localhost.floci.io:4566/live");
  });

  it("Function URL", () => {
    expect(localFunctionUrl("http://fn1.lambda-url.us-east-1.127.0.0.1:4566/"))
      .toBe("http://fn1.lambda-url.us-east-1.localhost.floci.io:4566/");
  });

  it("rejects junk", () => {
    expect(() => localApiUrl("https://example.com")).toThrow();
  });
});
