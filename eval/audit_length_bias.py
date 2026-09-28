import json
import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv(".env.local")
GOLDEN_PATH = "./eval/golden.json"
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


def get_active_model():
  return "openai/gpt-oss-20b"


def score_text(model, question, answer_text, expected):
  prompt = f"""
    Evaluate this test case for Meridian Bank.
    Question: {question}
    Answer/Source to evaluate: {answer_text}
    Expected Baseline: {expected}
    
    Provide scores (0-2) for 'grounded', 'correct', 'appropriate' in valid JSON:
    {{
      "grounded": {{"score": <int>, "reasoning": "<str>"}},
      "correct": {{"score": <int>, "reasoning": "<str>"}},
      "appropriate": {{"score": <int>, "reasoning": "<str>"}}
    }}
    """
  res = client.chat.completions.create(
      model=model,
      messages=[{"role": "user", "content": prompt}],
      response_format={"type": "json_object"},
      temperature=0.0,
  )
  return json.loads(res.choices[0].message.content)


def audit_length_bias():
  if not os.path.exists(GOLDEN_PATH):
    print("Golden dataset not found.")
    return

  with open(GOLDEN_PATH, "r", encoding="utf-8") as f:
    golden_set = json.load(f)

  model = get_active_model()
  print(f"=== LENGTH BIAS AUDIT (Model: {model}) ===")

  test_cases = [
      item
      for item in golden_set
      if item.get("group") in ["original_twelve", "answerable"]
  ][:5]

  inflated_count = 0
  for idx, item in enumerate(test_cases):
    q = item.get("question", "N/A")
    exp = item.get("expected_source") or item.get("answer", "N/A")

    orig_res = score_text(model, q, exp, exp)
    orig_mean = (
        orig_res["grounded"]["score"]
        + orig_res["correct"]["score"]
        + orig_res["appropriate"]["score"]
    ) / 3.0

    padded_exp = (
        f"{exp}. Additionally, Meridian Bank was founded with a commitment to"
        " secure customer service and transparent financial operations."
    )
    padded_res = score_text(model, q, padded_exp, exp)
    padded_mean = (
        padded_res["grounded"]["score"]
        + padded_res["correct"]["score"]
        + padded_res["appropriate"]["score"]
    ) / 3.0

    print(
        f"Case {idx+1} | Original Mean: {orig_mean:.2f} | Padded Mean:"
        f" {padded_mean:.2f}"
    )
    if padded_mean > orig_mean:
      inflated_count += 1

  print(
      f"\nResult: Length inflation detected in {inflated_count}/{len(test_cases)}"
      " tested cases."
  )


if __name__ == "__main__":
  audit_length_bias()