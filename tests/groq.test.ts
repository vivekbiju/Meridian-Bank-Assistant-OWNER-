/**
 * Checks that the Groq call is built correctly and that failures are handled.
 *
 * These tests do NOT use your real API key and do NOT cost anything. They
 * replace the network with a fake so the request can be inspected.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { askGroq, GroqError } from "../lib/groq";
import { MODEL, TEMPERATURE } from "../config";

const original = globalThis.fetch;

function fakeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

beforeEach(() => {
  process.env.GROQ_API_KEY = "gsk_test_key";
});

afterEach(() => {
  globalThis.fetch = original;
  vi.restoreAllMocks();
});

describe("askGroq", () => {
  it("sends the right url, model, temperature and auth header", async () => {
    // The two arguments are named here so TypeScript knows the shape of what
    // fetch was called with when it is inspected further down.
    const spy = vi.fn(async (_url: string, _init: RequestInit) =>
      fakeResponse({ choices: [{ message: { content: "  hello there  " } }] })
    );
    globalThis.fetch = spy as unknown as typeof fetch;

    const reply = await askGroq([
      { role: "system", content: "be useful" },
      { role: "user", content: "hi" },
    ]);

    expect(reply).toBe("hello there"); // trimmed

    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer gsk_test_key");
    expect(headers["Content-Type"]).toBe("application/json");

    const sent = JSON.parse(init.body as string);
    expect(sent.model).toBe(MODEL);
    expect(sent.temperature).toBe(TEMPERATURE);
    expect(sent.messages[0].role).toBe("system");
    expect(sent.messages[1].content).toBe("hi");
  });

  it("gives a clear error when the key is missing", async () => {
    delete process.env.GROQ_API_KEY;
    await expect(askGroq([{ role: "user", content: "hi" }])).rejects.toThrow(
      /GROQ_API_KEY is not set/
    );
  });

  it("surfaces an invalid key as a 401", async () => {
    globalThis.fetch = (async () =>
      fakeResponse({ error: "invalid api key" }, 401)) as unknown as typeof fetch;

    try {
      await askGroq([{ role: "user", content: "hi" }]);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(GroqError);
      expect((e as GroqError).status).toBe(401);
    }
  });

  it("rejects an empty answer rather than showing a blank bubble", async () => {
    globalThis.fetch = (async () =>
      fakeResponse({ choices: [{ message: { content: "   " } }] })) as unknown as typeof fetch;

    await expect(askGroq([{ role: "user", content: "hi" }])).rejects.toThrow(
      /empty answer/
    );
  });
});
