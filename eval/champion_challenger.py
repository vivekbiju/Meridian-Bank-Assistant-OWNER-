import json
import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv(".env.local")

GOLDEN_PATH = "./eval/golden.json"
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


# 1. PRODUCTION PROMPT (Current baseline)
def get_production_prompt(question, expected):
  return f"""
    You are an objective banking evaluation assistant for Meridian Bank.
    Question: {question}
    Expected Source / Answer: {expected}
    
    Evaluate against criteria on a 0-2 scale:
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


# 2. CHALLENGER PROMPT (Enhanced with Chain-of-Thought & strict boundaries)
def get_challenger_prompt(question, expected):
  return f"""
    You are a rigorous, expert-level compliance judge for Meridian Bank. 
    Analyze this test case methodically before scoring.
    
    Question: {question}
    Expected Source / Answer: {expected}
    
    Step-by-step instructions:
    - First, analyze if the expected source explicitly contains the factual answer.
    - Second, verify banking compliance and factual soundness.
    - Third, assign a score (0, 1, or 2) for: grounded, correct, appropriate.
    
    Provide scores and rigorous reasoning in valid JSON matching this exact structure:
    {{
      "grounded": {{"score": <int>, "reasoning": "<str>"}},
      "correct": {{"score": <int>, "reasoning": "<str>"}},
      "appropriate": {{"score": <int>, "reasoning": "<str>"}}
    }}
    """


def run_champion_challenger():
  if not os.path.exists(GOLDEN_PATH):
    print(f"Error: Could not find golden dataset at {GOLDEN_PATH}")
    return

  with open(GOLDEN_PATH, "r", encoding="utf-8") as f:
    golden_set = json.load(f)

  model_to_use = get_active_model()
  criteria = ["grounded", "correct", "appropriate"]

  prod_scores = {c: [] for c in criteria}
  chal_scores = {c: [] for c in criteria}

  print(
      f"=== CHAMPION VS CHALLENGER EVALUATION ({len(golden_set)} cases) ==="
  )
  print(f"Model: {model_to_use} | Temperature: 0.0\n")

  for idx, item in enumerate(golden_set):
    question = item.get("question", "N/A")
    expected = item.get("expected_source") or item.get("answer", "N/A")

    # Run Production Prompt (Tagged version: production)
    try:
      res_prod = client.chat.completions.create(
          model=model_to_use,
          messages=[
              {"role": "user", "content": get_production_prompt(question, expected)}
          ],
          response_format={"type": "json_object"},
          temperature=0.0,
          user="tag:version=production",  # Metadata tag
      )
      parsed_prod = json.loads(res_prod.choices[0].message.content)
      for c in criteria:
        prod_scores[c].append(int(parsed_prod[c]["score"]))
    except Exception as e:
      print(f"[X] Prod error on case {idx+1}: {e}")

    # Run Challenger Prompt (Tagged version: challenger)
    try:
      res_chal = client.chat.completions.create(
          model=model_to_use,
          messages=[
              {"role": "user", "content": get_challenger_prompt(question, expected)}
          ],
          response_format={"type": "json_object"},
          temperature=0.0,
          user="tag:version=challenger",  # Metadata tag
      )
      parsed_chal = json.loads(res_chal.choices[0].message.content)
      for c in criteria:
        chal_scores[c].append(int(parsed_chal[c]["score"]))
    except Exception as e:
      print(f"[X] Challenger error on case {idx+1}: {e}")

    print(f"[✔] Completed case {idx + 1}/{len(golden_set)}")

  # Calculate & Print Comparative Summary
  print("\n" + "=" * 50)
  print("CHAMPION VS CHALLENGER RESULTS SUMMARY:")
  print("=" * 50)

  prod_avg_total = 0
  chal_avg_total = 0

  for c in criteria:
    p_avg = sum(prod_scores[c]) / len(prod_scores[c]) if prod_scores[c] else 0
    c_avg = sum(chal_scores[c]) / len(chal_scores[c]) if chal_scores[c] else 0
    prod_avg_total += p_avg
    chal_avg_total += c_avg
    print(
        f"* {c.capitalize()} --> Production: {p_avg:.2f} | Challenger:"
        f" {c_avg:.2f} (Diff: {c_avg - p_avg:+.2f})"
    )

  overall_p = prod_avg_total / len(criteria)
  overall_c = chal_avg_total / len(criteria)
  print("-" * 50)
  print(f"Overall Average --> Production: {overall_p:.2f} | Challenger: {overall_c:.2f} (Diff: {overall_c - overall_p:+.2f})")
  print("=" * 50)


if __name__ == "__main__":
  run_champion_challenger()