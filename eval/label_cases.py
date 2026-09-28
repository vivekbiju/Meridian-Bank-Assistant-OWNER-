import json
import os

GOLDEN_PATH = "./eval/golden.json"
LABELS_PATH = "./eval/human_labels.json"


def label_cases():
  if not os.path.exists(GOLDEN_PATH):
    print(f"Error: Could not find golden dataset at {GOLDEN_PATH}")
    return

  with open(GOLDEN_PATH, "r", encoding="utf-8") as f:
    golden_set = json.load(f)

  # Load existing labels if resuming
  labels = {}
  if os.path.exists(LABELS_PATH):
    with open(LABELS_PATH, "r", encoding="utf-8") as f:
      try:
        labels = json.load(f)
      except json.JSONDecodeError:
        labels = {}

  print(
      f"=== HUMAN LABELLING ASSISTANT ({len(golden_set)} total cases) ==="
  )
  print("For each criterion, assign a score (0, 1, or 2) and short reasoning.")
  print("Type 'exit' or 'quit' at any prompt to save progress and exit.\n")

  for idx, item in enumerate(golden_set):
    case_id = str(idx)
    question = item.get("question", "N/A (Adversarial/Unanswerable)")
    expected = item.get("expected_source") or item.get("answer", "N/A")

    if case_id in labels:
      print(f"\n--- Case {idx + 1}/{len(golden_set)} [Already Labelled] ---")
      continue

    print(f"\n--- Case {idx + 1}/{len(golden_set)} ---")
    print(f"Question: {question}")
    print(f"Expected Context/Answer Info: {expected}")
    print("-" * 50)

    case_labels = {}
    criteria = ["grounded", "correct", "appropriate"]

    should_exit = False
    for criterion in criteria:
      print(f"\n[Criterion: {criterion.upper()}]")
      while True:
        score_input = input("  Score (0, 1, 2): ").strip()
        if score_input.lower() in ["exit", "quit"]:
          should_exit = True
          break
        if score_input in ["0", "1", "2"]:
          score = int(score_input)
          break
        print("  Invalid input. Please enter 0, 1, or 2.")

      if should_exit:
        break

      reasoning = input("  Reasoning: ").strip()
      case_labels[criterion] = {"score": score, "reasoning": reasoning}

    if should_exit:
      print("\nSaving progress and exiting...")
      break

    labels[case_id] = case_labels

    # Save incrementally after each case
    with open(LABELS_PATH, "w", encoding="utf-8") as f:
      json.dump(labels, f, indent=2)
    print(f"Saved progress for Case {idx + 1}.")

  print(f"\nLabelling session complete! Labels saved to {LABELS_PATH}.")


if __name__ == "__main__":
  label_cases()