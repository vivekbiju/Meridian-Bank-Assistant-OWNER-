/**
 * These tests check your config.ts before you deploy.
 *
 *   ON A FRESH CLONE, ONE TEST FAILS ON PURPOSE.
 *
 *   That is not a bug. The starting SYSTEM_PROMPT in config.ts is
 *   deliberately too weak to pass. Your job is to rewrite it until
 *   `npm test` is completely green. The test suite IS the specification.
 *
 * They do NOT call the AI. They run instantly and cost nothing. What they
 * check is that you have not broken the file in a way that would make your
 * assistant impossible to fix later.
 *
 * Run them with:   npm test
 */

import { describe, it, expect } from "vitest";
import {
  BANK_FACTS,
  SYSTEM_PROMPT,
  ASSISTANT_NAME,
  GREETING,
  MODEL,
  TEMPERATURE,
} from "../config";
import { TEST_QUESTIONS } from "./questions";

describe("the fact sheet", () => {
  it("has not been emptied", () => {
    expect(BANK_FACTS.length).toBeGreaterThan(500);
  });

  it("still contains the facts the tests rely on", () => {
    const required = [
      "0800 555 0199", // lost card line
      "25,000", // daily transfer limit
      "09:30", // branch opening
      "6 pounds per day", // unarranged overdraft
      "0800 555 0177", // fraud line
      "no access to customer accounts",
    ];
    for (const fact of required) {
      expect(BANK_FACTS, `fact sheet is missing: ${fact}`).toContain(fact);
    }
  });
});

describe("your system prompt", () => {
  it("actually contains the facts", () => {
    // If this fails you have deleted the ${BANK_FACTS} placeholder and your
    // assistant has nothing to answer from.
    expect(
      SYSTEM_PROMPT.includes("MERIDIAN BANK - CUSTOMER SERVICE FACT SHEET"),
      "SYSTEM_PROMPT no longer includes BANK_FACTS"
    ).toBe(true);
  });

  it("[FAILS UNTIL YOU REWRITE IT] is long enough to be doing real work", () => {
    const withoutFacts = SYSTEM_PROMPT.replace(BANK_FACTS, "");
    expect(
      withoutFacts.trim().length,
      "your instructions are very short - a passing prompt needs scope, refusals and style"
    ).toBeGreaterThan(200);
  });

  it("[FAILS UNTIL YOU REWRITE IT] says something about refusing", () => {
    // Only YOUR instructions count here. The fact sheet contains the word
    // "never" already, so it is stripped out before checking.
    const instructions = SYSTEM_PROMPT.replace(BANK_FACTS, "").toLowerCase();
    const words = ["never", "refuse", "do not", "don't", "only help", "outside"];
    const found = words.some((w) => instructions.includes(w));
    expect(found, "no refusal rule found in your instructions").toBe(true);
  });

  it("[FAILS UNTIL YOU REWRITE IT] tells the assistant what to do when it does not know", () => {
    const instructions = SYSTEM_PROMPT.replace(BANK_FACTS, "").toLowerCase();
    const words = ["do not know", "don't know", "not in the", "cannot", "can't", "human", "unsure"];
    const found = words.some((w) => instructions.includes(w));
    expect(found, "no rule about unknown answers found in your instructions").toBe(true);
  });
});

describe("settings", () => {
  it("has a name and a greeting", () => {
    expect(ASSISTANT_NAME.trim()).not.toBe("");
    expect(GREETING.trim()).not.toBe("");
  });

  it("uses temperature 0 so results are repeatable while testing", () => {
    expect(TEMPERATURE).toBe(0);
  });

  it("has a model name set", () => {
    expect(MODEL.trim()).not.toBe("");
  });
});

describe("the twelve acceptance questions", () => {
  it("there are exactly twelve", () => {
    expect(TEST_QUESTIONS).toHaveLength(12);
  });

  it("six must be answered and six must be refused", () => {
    const answer = TEST_QUESTIONS.filter((q) => q.expect === "answer");
    const refuse = TEST_QUESTIONS.filter((q) => q.expect === "refuse");
    expect(answer).toHaveLength(6);
    expect(refuse).toHaveLength(6);
  });

  it("every answerable question names the fact that proves it", () => {
    for (const q of TEST_QUESTIONS) {
      if (q.expect === "answer") {
        expect(q.mustContain.length, `question ${q.id} has no expected fact`)
          .toBeGreaterThan(0);
        for (const fact of q.mustContain) {
          expect(
            BANK_FACTS.toLowerCase(),
            `question ${q.id} expects "${fact}" but it is not in the fact sheet`
          ).toContain(fact.toLowerCase());
        }
      }
    }
  });
});
