import json
import os
import time
from dotenv import load_dotenv
from groq import Groq

load_dotenv(".env.local")
GOLDEN_PATH = "./eval/golden.json"
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


def get_active_model():
  return "openai/gpt-oss-20b"


def measure_wobble():
  if not os.path.exists(GOLDEN_PATH):
    return
  with open(GOLDEN_PATH, "r", encoding="utf-8") as f:
    golden_set = json.load(f)

  model = get_active_model()
  # Reduce to 3 cases to safely stay within free-tier token limits (TPD)
  subset = golden_set[:3]

  print(
      f"=== MEASURING JUDGE WOBBLE (Model: {model}, {len(subset)} cases, 5"
      " runs each, throttled) ==="
  )
  identical_verdicts = 0
  total_evaluated = 0

  for idx, item in enumerate(subset):
    q = item.get("question", "N/A")
    exp = item.get("expected_source") or item.get("answer", "N/A")

    prompt = f"""
        Evaluate this test case for Meridian Bank.
        Question: {q}
        Expected: {exp}
        Provide scores (0-2) for 'grounded', 'correct', 'appropriate' in valid JSON:
        {{
          "grounded": {{"score": <int>, "reasoning": "<str>"}},
          "correct": {{"score": <int>, "reasoning": "<str>"}},
          "appropriate": {{"score": <int>, "reasoning": "<str>"}}
        }}
        """

    run_scores = []
    failed = False
    for run in range(5):
      try:
        res = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        parsed = json.loads(res.choices[0].message.content)
        mean_score = (
            parsed["grounded"]["score"]
            + parsed["correct"]["score"]
            + parsed["appropriate"]["score"]
        ) / 3.0
        run_scores.append(mean_score)
        time.sleep(1.5)  # Throttle to avoid rate limits (HTTP 429)
      except Exception as e:
        print(f"Error on case {idx+1} run {run+1}: {e}")
        failed = True
        break

    if failed or not run_scores:
      continue

    total_evaluated += 1
    if len(set(run_scores)) == 1:
      identical_verdicts += 1
      print(f"Case {idx+1}: Stable across all runs (Score: {run_scores[0]})")
    else:
      spread = max(run_scores) - min(run_scores)
      print(f"Case {idx+1}: Wobbled! Scores: {run_scores} (Spread: {spread:.2f})")

  print(
      f"\nSummary: {identical_verdicts}/{total_evaluated} evaluated cases gave"
      " the exact same verdict across all runs."
  )


if __name__ == "__main__":
  measure_wobble()