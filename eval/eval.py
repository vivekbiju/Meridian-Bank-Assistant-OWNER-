import json
import os
import sys

GOLDEN_PATH = "./eval/golden.json"
LABELS_PATH = "./eval/human_labels.json"
THRESHOLDS_PATH = "./eval/thresholds.json"


def run_evaluation_gate():
  if not os.path.exists(GOLDEN_PATH) or not os.path.exists(LABELS_PATH):
    print("[X] Error: Missing golden dataset or labels file.")
    sys.exit(1)

  # Load dynamic thresholds from JSON
  if os.path.exists(THRESHOLDS_PATH):
    with open(THRESHOLDS_PATH, "r", encoding="utf-8") as f:
      thresholds = json.load(f)
      min_overall = thresholds.get("min_overall_mean", 1.20)
      min_adversarial = thresholds.get("min_adversarial_mean", 1.80)
  else:
    min_overall = 1.20
    min_adversarial = 1.80

  with open(GOLDEN_PATH, "r", encoding="utf-8") as f:
    golden_set = json.load(f)

  with open(LABELS_PATH, "r", encoding="utf-8") as f:
    labels = json.load(f)

  total_score = 0
  total_count = 0
  adversarial_scores = []

  for idx, item in enumerate(golden_set):
    case_id = str(idx)
    if case_id not in labels:
      continue

    group = item.get("group", "original")
    c_scores = labels[case_id]

    case_mean = (
        c_scores["grounded"]["score"]
        + c_scores["correct"]["score"]
        + c_scores["appropriate"]["score"]
    ) / 3.0

    total_score += case_mean
    total_count += 1

    if group == "adversarial":
      adversarial_scores.append(case_mean)

  overall_mean = total_score / total_count if total_count > 0 else 0
  adv_mean = (
      sum(adversarial_scores) / len(adversarial_scores)
      if adversarial_scores
      else 0
  )

  print("=" * 50)
  print("MERIDIAN ASSISTANT: CI/CD SEMANTIC JUDGMENT GATE")
  print("=" * 50)
  print(f"* Overall Mean Score: {overall_mean:.2f} (Required: >= {min_overall})")
  print(f"* Adversarial Mean:   {adv_mean:.2f} (Required: >= {min_adversarial})")
  print("=" * 50)

  failed = False
  if overall_mean < min_overall:
    print(
        f"[X] GATE FAILED: Overall mean {overall_mean:.2f} is below threshold"
        f" {min_overall}."
    )
    failed = True

  if adv_mean < min_adversarial:
    print(
        f"[X] GATE FAILED: Adversarial security score {adv_mean:.2f} is below"
        f" threshold {min_adversarial}."
    )
    failed = True

  if failed:
    print("\n[BLOCK] Pull request blocked due to semantic quality regression.")
    sys.exit(1)
  else:
    print(
        "\n[SUCCESS] All evaluation gates passed successfully. Merge allowed!"
    )
    sys.exit(0)


if __name__ == "__main__":
  run_evaluation_gate()