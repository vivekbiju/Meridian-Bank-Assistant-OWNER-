import { readFileSync } from "fs";

interface ManualLabel {
  id: string;
  question: string;
  my_label: string;
  notes: string;
}

function compareLabels() {
  const manualLabels: ManualLabel[] = JSON.parse(readFileSync("./eval/manual_labels.json", "utf-8"));
  
  console.log(`=== B5 HUMAN-LABELLING SUMMARY ===`);
  console.log(`Total Hand-Labelled Cases: ${manualLabels.length}`);
  
  const groundedCount = manualLabels.filter(item => item.my_label === "grounded").length;
  const ungroundedCount = manualLabels.filter(item => item.my_label === "ungrounded").length;
  
  console.log(`- Grounded Cases: ${groundedCount}`);
  console.log(`- Ungrounded Cases: ${ungroundedCount}`);
  console.log(`\nManual labelling successfully loaded. Ready for final evaluation audit!`);
}

compareLabels();