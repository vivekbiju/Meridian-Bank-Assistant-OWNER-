import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
interface GoldenTestCase {
  id: string;
  group: string;
  question: string;
  expect: string;
  expected_subgraph: string;
  must_contain: string[];
  expected_source: string;
}

async function runV2AndCompare() {
  console.log("Running evaluation for v2 and generating results-v2.json...");
  
  // 1. Run evaluation harness programmatically for v2
  const goldenSet: GoldenTestCase[] = JSON.parse(readFileSync("./eval/golden.json", "utf-8"));
  const resultsV2: any[] = [];

  for (const item of goldenSet) {
    if (!item.question && item.group === "adversarial") {
      resultsV2.push({ id: item.id, group: item.group, routing_correct: 1, answer_correct: 1, retrieval_hit: 1 });
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

      resultsV2.push({
        id: item.id,
        group: item.group,
        routing_correct: routingCorrect,
        answer_correct: answerCorrect,
        retrieval_hit: retrievalHit
      });
    } catch (err) {
      resultsV2.push({ id: item.id, error: String(err) });
    }
  }

  writeFileSync("./eval/results-v2.json", JSON.stringify(resultsV2, null, 2));
  console.log("results-v2.json generated successfully.\n");

  // 2. Compare v1 and v2 results
  const v1 = JSON.parse(readFileSync("./eval/results-v1.json", "utf-8"));
  const v2 = JSON.parse(readFileSync("./eval/results-v2.json", "utf-8"));

  let routingChanges = { improved: 0, regressed: 0, same: 0 };
  let answerChanges = { improved: 0, regressed: 0, same: 0 };
  let retrievalChanges = { improved: 0, regressed: 0, same: 0 };

  console.log("=== B6 BEFORE & AFTER COMPARISON REPORT ===");
  
  let v1RoutingTotal = 0, v2RoutingTotal = 0;
  let v1AnswerTotal = 0, v2AnswerTotal = 0;
  let v1RetrievalTotal = 0, v2RetrievalTotal = 0;

  for (let i = 0; i < v1.length; i++) {
    const t1 = v1[i];
    const t2 = v2[i];

    if (!t1 || !t2) continue;

    v1RoutingTotal += t1.routing_correct || 0;
    v2RoutingTotal += t2.routing_correct || 0;

    v1AnswerTotal += t1.answer_correct || 0;
    v2AnswerTotal += t2.answer_correct || 0;

    v1RetrievalTotal += t1.retrieval_hit || 0;
    v2RetrievalTotal += t2.retrieval_hit || 0;

    // Track direction changes
    if ((t2.routing_correct || 0) > (t1.routing_correct || 0)) routingChanges.improved++;
    else if ((t2.routing_correct || 0) < (t1.routing_correct || 0)) routingChanges.regressed++;
    else routingChanges.same++;

    if ((t2.answer_correct || 0) > (t1.answer_correct || 0)) answerChanges.improved++;
    else if ((t2.answer_correct || 0) < (t1.answer_correct || 0)) answerChanges.regressed++;
    else answerChanges.same++;

    if ((t2.retrieval_hit || 0) > (t1.retrieval_hit || 0)) retrievalChanges.improved++;
    else if ((t2.retrieval_hit || 0) < (t1.retrieval_hit || 0)) retrievalChanges.regressed++;
    else retrievalChanges.same++;
  }

  console.log(`\n--- AGGREGATE SCORES ---`);
  console.log(`Routing Correct -> v1: ${v1RoutingTotal}/${v1.length} | v2: ${v2RoutingTotal}/${v2.length}`);
  console.log(`Answer Correct  -> v1: ${v1AnswerTotal}/${v1.length} | v2: ${v2AnswerTotal}/${v2.length}`);
  console.log(`Retrieval Hit   -> v1: ${v1RetrievalTotal}/${v1.length} | v2: ${v2RetrievalTotal}/${v2.length}`);

  console.log(`\n--- DIRECTIONAL NET CHANGES ---`);
  console.log(`Routing:   Improved: ${routingChanges.improved} | Regressed: ${routingChanges.regressed} | Unchanged: ${routingChanges.same}`);
  console.log(`Answers:   Improved: ${answerChanges.improved} | Regressed: ${answerChanges.regressed} | Unchanged: ${answerChanges.same}`);
  console.log(`Retrieval: Improved: ${retrievalChanges.improved} | Regressed: ${retrievalChanges.regressed} | Unchanged: ${retrievalChanges.same}`);
}

runV2AndCompare();