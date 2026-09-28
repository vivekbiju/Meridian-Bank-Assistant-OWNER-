import { readFileSync, writeFileSync } from "fs";

interface GoldenTestCase {
  id: string;
  question: string;
  expect: string;
  expected_source: string;
}

function generateTemplate() {
  const goldenSet: GoldenTestCase[] = JSON.parse(readFileSync("./eval/golden.json", "utf-8"));
  
  const template = goldenSet.map(item => ({
    id: item.id,
    question: item.question,
    expected_source: item.expected_source,
    my_label: "grounded | ungrounded", // Fill this in: "grounded" or "ungrounded"
    notes: ""                        // Optional notes on why
  }));

  writeFileSync("./eval/manual_labels.json", JSON.stringify(template, null, 2));
  console.log("Hand-labelling template generated at eval/manual_labels.json!");
}

generateTemplate();