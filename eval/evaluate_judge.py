import json
import os
from dotenv import load_dotenv
from sklearn.metrics import cohen_kappa_score
from groq import Groq

load_dotenv(".env.local")

GOLDEN_PATH = "./eval/golden.json"
LABELS_PATH = "./eval/human_labels.json"

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


def get_active_model():
  try:
    models = client.models.list()
    for m in models.data:
      if "llama" in m.id or "gpt-oss" in m.id or "qwen" in m.id:
        return m.id
  except Exception:
    pass
  return "llama-3.3-70b-versatile"


def run_evaluation():
  if not os.path.exists(GOLDEN_PATH) or not os.path.exists(LABELS_PATH):
    print("Error: Missing golden dataset or human labels file.")
    return

  with open(GOLDEN_PATH, "r", encoding="utf-8") as f:
    golden_set = json.load(f)

  with open(LABELS_PATH, "r", encoding="utf-8") as f:
    human_labels = json.load(f)

  model_to_use = get_active_model()
  criteria = ["grounded", "correct", "appropriate"]
  human_scores = {c: [] for c in criteria}
  judge_scores = {c: [] for c in criteria}

  print(
      f"=== RUNNING DETERMINISTIC LLM JUDGE EVALUATION ({len(golden_set)}"
      f" cases) ==="
  )
  print(f"Using active model: {model_to_use} (temperature=0)\n")

  for idx, item in enumerate(golden_set):
    case_id = str(idx)
    if case_id not in human_labels:
      continue

    question = item.get("question", "N/A")
    expected = item.get("expected_source") or item.get("answer", "N/A")

    prompt = f"""
    You are a strict, objective banking evaluation judge for Meridian Bank. Evaluate this test case deterministically.
    
    Question: {question}
    Expected Source / Answer: {expected}
    
    Evaluate against the criteria on a 0-2 scale:
    1. grounded: Is the expected info backed by the source? (0-2)
    2. correct: Is it factually correct? (0-2)
    3. appropriate: Is it appropriate for a bank assistant? (0-2)
    
    Provide scores and short reasoning in valid JSON matching this exact structure:
    {{
      "grounded": {{"score": <int>, "reasoning": "<str>"}},
      "correct": {{"score": <int>, "reasoning": "<str>"}},
      "appropriate": {{"score": <int>, "reasoning": "<str>"}}
    }}
    """

    try:
      completion = client.chat.completions.create(
          model=model_to_use,
          messages=[{"role": "user", "content": prompt}],
          response_format={"type": "json_object"},
          temperature=0.0,  # Lock determinism to eliminate drift
      )
      result = json.loads(completion.choices[0].message.content)

      for c in criteria:
        human_score = human_labels[case_id][c]["score"]
        judge_score = int(result[c]["score"])

        human_scores[c].append(human_score)
        judge_scores[c].append(judge_score)

      print(f"[✔] Evaluated case {idx + 1}/{len(golden_set)}")
    except Exception as e:
      print(f"[X] Error on case {idx + 1}: {e}")

  print("\n" + "=" * 40)
  print("UPDATED COHEN'S KAPPA EVALUATION RESULTS:")
  print("=" * 40)

  for c in criteria:
    if len(human_scores[c]) > 0:
      kappa = cohen_kappa_score(
          human_scores[c], judge_scores[c], weights="quadratic"
      )
      print(f"* {c.capitalize()} Kappa: {kappa:.4f}")
    else:
      print(f"* {c.capitalize()} Kappa: N/A (no data)")

  print("=" * 40)


if __name__ == "__main__":
  run_evaluation()