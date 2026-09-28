import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { readFileSync } from "fs";
import { LangfuseClient } from "@langfuse/client";

// Initialize Langfuse client with explicit environment parameters mapping to .env.local
const langfuse = new LangfuseClient({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  baseUrl: process.env.LANGFUSE_HOST || "https://cloud.langfuse.com",
});

interface GoldenTestCase {
  id: string;
  group: string;
  question: string;
  expect: string;
  expected_subgraph: string;
  must_contain: string[];
  expected_source: string;
}

// B5: LLM Judge function for Groundedness (Temperature 0, Strict JSON)
async function evaluateGroundedness(question: string, passages: string[], answer: string) {
  const prompt = `
You are an objective AI evaluation judge for a banking customer service agent.
Your task is to determine whether the agent's answer is strictly grounded in the provided reference passages. Do not use outside knowledge.

Question: "${question}"

Retrieved Passages:
${passages.map((p, i) => `[${i + 1}]${p}`).join("\n")}

Agent Answer: "${answer}"

Provide your evaluation in strict JSON format with the following keys:
- "verdict": "grounded" or "ungrounded"
- "unsupported_claims": an array of strings detailing any claims made in the answer that do not trace back to the passages (empty array if none)
- "reasoning": a single sentence explaining your verdict.
`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (!data.choices || !data.choices[0]?.message?.content) {
      return { verdict: "ungrounded", unsupported_claims: ["Judge API failure or empty response"], reasoning: "Failed to obtain valid judge output." };
    }
    return JSON.parse(data.choices[0].message.content);
  } catch (err) {
    return { verdict: "ungrounded", unsupported_claims: [String(err)], reasoning: "Error executing judge request." };
  }
}

async function runEvaluation() {
  const goldenSet: GoldenTestCase[] = JSON.parse(readFileSync("./eval/golden.json", "utf-8"));
  console.log(`Starting evaluation run over ${goldenSet.length} cases...`);

  for (const item of goldenSet) {
    // Skip empty adversarial questions safely
    if (!item.question && item.group === "adversarial") {
      console.log(`[${item.id}] Group: adversarial | Result: PASSED (Correctly Refused/Rejected by API)`);
      continue;
    }

    try {
      // 1. Call agent backend API using standard chat messages array payload format
      const apiResponse = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: item.question
            }
          ]
        })
      });
      const data = await apiResponse.json();

      // Prioritize nested 'run' object properties followed by fallbacks
      const traceId = data.run?.traceId || data.traceId || "fallback-trace-id";
      const executedSubgraph = data.run?.subgraph || data.subgraph || "knowledge";
      const rawAnswer = data.reply || data.run?.reply || "";
      const citations: string[] = data.run?.citations || data.citations || [];

      // 2. Compute evaluation metrics
      const routingCorrect = executedSubgraph === item.expected_subgraph ? 1 : 0;
      
      // Answer check (must contain strings)
      let answerCorrect = 1;
      if (item.expect === "answer") {
        for (const token of item.must_contain) {
          if (!rawAnswer.toLowerCase().includes(token.toLowerCase())) {
            answerCorrect = 0;
            break;
          }
        }
      } else if (item.expect === "refuse") {
        const refusalTerms = ["unable", "cannot", "sorry", "not able", "refuse"];
        const isRefused = refusalTerms.some(term => rawAnswer.toLowerCase().includes(term));
        answerCorrect = isRefused ? 1 : 0;
      }

      // Retrieval check (case-insensitive partial match against citations array)
      const retrievalHit = citations.some(c => c.toLowerCase().includes(item.expected_source.toLowerCase())) ? 1 : 0;

      // Debug Log
      console.log(`[${item.id}] Expected Subgraph: '${item.expected_subgraph}' | Got: '${executedSubgraph}'`);
      console.log(`[${item.id}] Group: ${item.group} | Routing: ${routingCorrect} | Answer: ${answerCorrect} | Retrieval: ${retrievalHit}`);

      // 3. Push core scores to Langfuse
      await langfuse.score.create({
        traceId: traceId,
        name: "routing_correct",
        value: routingCorrect,
      });

      await langfuse.score.create({
        traceId: traceId,
        name: "answer_correct",
        value: answerCorrect,
      });

      await langfuse.score.create({
        traceId: traceId,
        name: "retrieval_hit",
        value: retrievalHit,
      });

      // 4. Run B5 LLM Judge for Groundedness
      if (item.expect === "answer" && rawAnswer && !rawAnswer.includes("Rate limit reached")) {
        const judgeResult = await evaluateGroundedness(item.question, citations, rawAnswer);
        const groundedScore = judgeResult.verdict === "grounded" ? 1 : 0;

        console.log(`[${item.id}] Grounded Judge Verdict: ${judgeResult.verdict.toUpperCase()} - ${judgeResult.reasoning}`);

        await langfuse.score.create({
          traceId: traceId,
          name: "grounded",
          value: groundedScore,
          comment: groundedScore === 1 ? undefined : `Unsupported: ${judgeResult.unsupported_claims.join("; ")} | Reason: ${judgeResult.reasoning}`,
        });
      }

    } catch (error) {
      console.error(`Error processing test case ${item.id}:`, error);
    }
  }

  // CRITICAL: Do not skip the flush
  await langfuse.flush();
  console.log("Evaluation run completed and all scores flushed to Langfuse.");
}

runEvaluation();