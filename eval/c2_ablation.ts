import { readFileSync } from "fs";
import { search } from "../lib/knowledge/retriever";

const configs = [
  { run: 1, threshold: 0.35, k: 5 },
  { run: 2, threshold: 0.20, k: 5 },
  { run: 3, threshold: 0.50, k: 5 },
  { run: 4, threshold: 0.35, k: 3 },
  { run: 5, threshold: 0.35, k: 10 },
];

async function runAblation() {
  console.log("Loading golden dataset...");
  const goldenSet = JSON.parse(readFileSync("./eval/golden.json", "utf-8"));
  console.log(`Loaded ${goldenSet.length} test items. Starting ablation...\n`);

  console.log("=== C2 RETRIEVAL ABLATION STUDY ===");
  console.log("Run | Threshold | k | Recall@k | MRR | False Empty | Answer Correct");
  console.log("------------------------------------------------------------------");

  for (const cfg of configs) {
    let recallHits = 0;
    let totalWithSource = 0;
    let reciprocalRankSum = 0;
    let falseEmpties = 0;
    let answerCorrectCount = 0;

    for (const item of goldenSet) {
      if (!item.question && item.group === "adversarial") continue;

      const results = await search(item.question, { limit: cfg.k, minScore: cfg.threshold });

      const hasSource = Boolean(item.expected_source);
      const isUnanswerable = item.group === "unanswerable" || item.group === "adversarial";

      if (hasSource) {
        totalWithSource++;
        let foundIndex = -1;
        
        results.forEach((hit: any, index: number) => {
          const sourceName = hit.document?.source || "";
          if (sourceName.toLowerCase().includes(item.expected_source.toLowerCase())) {
            if (foundIndex === -1) foundIndex = index + 1;
          }
        });

        if (foundIndex !== -1 && foundIndex <= cfg.k) {
          recallHits++;
          reciprocalRankSum += 1 / foundIndex;
        }

        if (results.length === 0 && !isUnanswerable) {
          falseEmpties++;
        }
      }

      if (results.length > 0) {
        answerCorrectCount++;
      }
    }

    const recallAtK = (recallHits / (totalWithSource || 1)).toFixed(2);
    const mrr = (reciprocalRankSum / (totalWithSource || 1)).toFixed(2);
    const falseEmptyRate = `${falseEmpties}/${totalWithSource}`;
    const answerCorrect = `${answerCorrectCount}/${goldenSet.length}`;

    console.log(`${cfg.run.toString().padEnd(3)} | ${cfg.threshold.toString().padEnd(9)} | ${cfg.k.toString().padEnd(2)} | ${recallAtK.padEnd(8)} | ${mrr.padEnd(3)} | ${falseEmptyRate.padEnd(11)} | ${answerCorrect}`);
  }
}

runAblation();