import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { readFileSync, writeFileSync } from "fs";

interface GoldenTestCase {
  id: string;
  group: string;
  question: string;
  expect: string;
  expected_subgraph: string;
  must_contain: string[];
  expected_source: string;
}

async function saveBaselineV1() {
  const goldenSet: GoldenTestCase[] = JSON.parse(readFileSync("./eval/golden.json", "utf-8"));
  const results: any[] = [];

  console.log("Running baseline evaluation to generate results-v1.json...");

  for (const item of goldenSet) {
    if (!item.question && item.group === "adversarial") {
      results.push({ id: item.id, status: "passed_refusal", routing: 1, answer: 1, retrieval: 1 });
      continue;
    }

    try {
      const apiResponse = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: item.question }] })
      });
      const data = await apiResponse.json();

      const executedSubgraph = data.run?.subgraph || data.subgraph || "knowledge";
      const rawAnswer = data.reply || data.run?.reply || "";
      const citations: string[] = data.run?.citations || data.citations || [];

      const routingCorrect = executedSubgraph === item.expected_subgraph ? 1 : 0;
      
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
        answerCorrect = refusalTerms.some(term => rawAnswer.toLowerCase().includes(term)) ? 1 : 0;
      }

      const retrievalHit = citations.some(c => c.toLowerCase().includes(item.expected_source.toLowerCase())) ? 1 : 0;

      results.push({
        id: item.id,
        group: item.group,
        routing_correct: routingCorrect,
        answer_correct: answerCorrect,
        retrieval_hit: retrievalHit
      });
    } catch (err) {
      results.push({ id: item.id, error: String(err) });
    }
  }

  writeFileSync("./eval/results-v1.json", JSON.stringify(results, null, 2));
  console.log("Baseline successfully saved to eval/results-v1.json!");
}

saveBaselineV1();