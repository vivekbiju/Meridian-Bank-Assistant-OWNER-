/**
 * Checks the database code without touching a real database.
 *
 * The Neon driver is replaced with a fake that records every query instead of
 * sending it anywhere. That means these tests are instant, free, and cannot
 * write rubbish into the shared class database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Every query the code tried to run, recorded by the fake driver below.
// vi.hoisted is needed because vi.mock runs before the rest of this file.
const recorder = vi.hoisted(() => ({
  queries: [] as { text: string; values: unknown[] }[],
  rows: [] as unknown[],
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    return (strings: TemplateStringsArray, ...values: unknown[]) => {
      recorder.queries.push({ text: strings.join("?"), values });
      return Promise.resolve(recorder.rows);
    };
  },
}));

import {
  ensureTable,
  saveMessage,
  getMessages,
  countMessages,
  databaseIsConfigured,
  studentName,
} from "../lib/db";

/** The text of every query run so far, lower-cased, for easy searching. */
function allQueryText(): string {
  return recorder.queries.map((q) => q.text).join("\n").toLowerCase();
}

beforeEach(() => {
  recorder.queries = [];
  recorder.rows = [];
  process.env.DATABASE_URL = "postgresql://fake:fake@example.test/fake";
  delete process.env.STUDENT_NAME;
});

describe("databaseIsConfigured", () => {
  it("is false when DATABASE_URL is absent", () => {
    delete process.env.DATABASE_URL;
    expect(databaseIsConfigured()).toBe(false);
  });

  it("is true once DATABASE_URL is set", () => {
    expect(databaseIsConfigured()).toBe(true);
  });
});

describe("studentName", () => {
  it("falls back to unknown when STUDENT_NAME is unset", () => {
    expect(studentName()).toBe("unknown");
  });

  it("uses STUDENT_NAME when it is set", () => {
    process.env.STUDENT_NAME = "priya";
    expect(studentName()).toBe("priya");
  });
});

describe("ensureTable", () => {
  it("is safe to call twice", async () => {
    await ensureTable();
    const firstRun = recorder.queries.length;

    await ensureTable();
    const secondRun = recorder.queries.length - firstRun;

    // The second run does exactly the same work as the first...
    expect(secondRun).toBe(firstRun);

    // ...and nothing it runs can fail on a database that already has the
    // table, the column or the index.
    const text = allQueryText();
    expect(text).toContain("create table if not exists messages");
    expect(text).toContain("add column if not exists student_name");
    expect(text).toContain("create index if not exists");
  });

  it("does nothing at all when there is no database", async () => {
    delete process.env.DATABASE_URL;
    await ensureTable();
    expect(recorder.queries).toHaveLength(0);
  });
});

describe("saveMessage", () => {
  it("falls back to \"unknown\" when STUDENT_NAME is unset", async () => {
    await saveMessage("s_1", "user", "hello");

    expect(recorder.queries).toHaveLength(1);
    const [query] = recorder.queries;
    expect(query.text.toLowerCase()).toContain("insert into messages");
    expect(query.values).toEqual(["s_1", "user", "hello", "unknown"]);
  });

  it("writes the student name it is given", async () => {
    process.env.STUDENT_NAME = "priya";
    await saveMessage("s_1", "assistant", "hi there", studentName());

    expect(recorder.queries[0].values).toEqual([
      "s_1",
      "assistant",
      "hi there",
      "priya",
    ]);
  });
});

describe("the /data queries", () => {
  it("filter by student name", async () => {
    process.env.STUDENT_NAME = "priya";

    await getMessages(studentName(), 100);

    const [query] = recorder.queries;
    expect(query.text.toLowerCase()).toContain("where student_name =");
    // The name is sent as a value, not glued into the SQL text, which is what
    // stops someone typing SQL into a name box.
    expect(query.values).toContain("priya");
    expect(query.values).toContain(100);
  });

  it("show the newest messages first", async () => {
    await getMessages();
    expect(recorder.queries[0].text.toLowerCase()).toContain("order by created_at desc");
  });

  it("count only that student's rows", async () => {
    process.env.STUDENT_NAME = "priya";
    recorder.rows = [{ total: "7" }];

    const total = await countMessages(studentName());

    expect(total).toBe(7);
    expect(recorder.queries[0].text.toLowerCase()).toContain("where student_name =");
    expect(recorder.queries[0].values).toEqual(["priya"]);
  });

  it("return nothing rather than crashing when there is no database", async () => {
    delete process.env.DATABASE_URL;
    expect(await getMessages()).toEqual([]);
    expect(await countMessages()).toBe(0);
    expect(recorder.queries).toHaveLength(0);
  });
});
