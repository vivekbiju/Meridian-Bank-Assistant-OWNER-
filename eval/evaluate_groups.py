import json
import os

GOLDEN_PATH = "./eval/golden.json"
LABELS_PATH = "./eval/human_labels.json"


def evaluate_by_groups():
  if not os.path.exists(GOLDEN_PATH) or not os.path.exists(LABELS_PATH):
    print("Error: Missing golden dataset or labels file.")
    return

  with open(GOLDEN_PATH, "r", encoding="utf-8") as f:
    golden_set = json.load(f)

  with open(LABELS_PATH, "r", encoding="utf-8") as f:
    labels = json.load(f)

  # Dictionary to aggregate scores per group
  group_data = {}

  for idx, item in enumerate(golden_set):
    case_id = str(idx)
    if case_id not in labels:
      continue

    # Default to 'original' if group field isn't explicitly set
    group_name = item.get("group", "original")

    if group_name not in group_data:
      group_data[group_name] = {
          "grounded": [],
          "correct": [],
          "appropriate": [],
          "count": 0,
      }

    group_data[group_name]["count"] += 1
    group_data[group_name]["grounded"].append(
        labels[case_id]["grounded"]["score"]
    )
    group_data[group_name]["correct"].append(
        labels[case_id]["correct"]["score"]
    )
    group_data[group_name]["appropriate"].append(
        labels[case_id]["appropriate"]["score"]
    )

  print("=" * 60)
  print("GROUP-LEVEL EVALUATION BREAKDOWN (D1 Requirement)")
  print("=" * 60)

  for g_name, metrics in group_data.items():
    count = metrics["count"]
    g_avg = (
        sum(metrics["grounded"]) / count if count > 0 else 0
    )
    c_avg = sum(metrics["correct"]) / count if count > 0 else 0
    a_avg = (
        sum(metrics["appropriate"]) / count if count > 0 else 0
    )
    overall_group_avg = (g_avg + c_avg + a_avg) / 3

    print(f"\n📂 Group: {g_name.upper()} (Cases: {count})")
    print(f"   * Grounded Avg:    {g_avg:.2f} / 2.0")
    print(f"   * Correct Avg:     {c_avg:.2f} / 2.0")
    print(f"   * Appropriate Avg: {a_avg:.2f} / 2.0")
    print(f"   * Group Mean:      {overall_group_avg:.2f} / 2.0")

  print("\n" + "=" * 60)


if __name__ == "__main__":
  evaluate_by_groups()