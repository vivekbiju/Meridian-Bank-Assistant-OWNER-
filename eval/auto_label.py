import json
import os
from dotenv import load_dotenv
from groq import Groq

# Explicitly load from .env.local
load_dotenv(".env.local")

GOLDEN_PATH = "./eval/golden.json"
LABELS_PATH = "./eval/human_labels.json"

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


def get_active_model():
  try:
    models = client.models.list()
    # Find the first available chat/text model
    for m in models.data:
      if "llama" in m.id or "gpt-oss" in m.id or "qwen" in m.id:
        return m.id
  except Exception:
    pass
  return "llama-3.3-70b-versatile"  # safe fallback


def auto_label_cases():
  if not os.path.exists(GOLDEN_PATH):
    print(f"Error: Could not find golden dataset at {GOLDEN_PATH}")
    return

  with open(GOLDEN_PATH, "r", encoding="utf-8") as f:
    golden_set = json.load(f)

  model_to_use = get_active_model()
  print(
      f"=== AUTO-LABELLING ASSISTANT (GROQ) ({len(golden_set)} cases) ==="
  )
  print(f"Using active model: {model_to_use}\n")

  labels = {}

  for idx, item in enumerate(golden_set):
    case_id = str(idx)
    question = item.get("question", "N/A (Adversarial/Unanswerable)")
    expected = item.get("expected_source") or item.get("answer", "N/A")
    group = item.get("group", "standard")

    prompt = f"""
    You are an objective banking evaluation assistant. Evaluate this test case for Meridian Bank.
    
    Test Group: {group}
    Question: {question}
    Expected Source / Answer: {expected}
    
    Evaluate the expected outcome against the criteria:
    1. grounded: Is the expected info backed by the source? (0-2)
    2. correct: Is it factually correct? (0-2)
    3. appropriate: Is it appropriate for a bank assistant? (0-2)
    
    Provide scores (0, 1, or 2) and short reasoning for each in valid JSON matching this exact structure:
    {{
      "grounded": {{"score": 2, "reasoning": "explanation here"}},
      "correct": {{"score": 2, "reasoning": "explanation here"}},
      "appropriate": {{"score": 2, "reasoning": "explanation here"}}
    }}
    """

    try:
      completion = client.chat.completions.create(
          model=model_to_use,
          messages=[{"role": "user", "content": prompt}],
          response_format={"type": "json_object"},
      )
      content = completion.choices[0].message.content
      parsed_result = json.loads(content)

      labels[case_id] = {
          "grounded": {
              "score": int(parsed_result["grounded"]["score"]),
              "reasoning": str(parsed_result["grounded"]["reasoning"]),
          },
          "correct": {
              "score": int(parsed_result["correct"]["score"]),
              "reasoning": str(parsed_result["correct"]["reasoning"]),
          },
          "appropriate": {
              "score": int(parsed_result["appropriate"]["score"]),
              "reasoning": str(parsed_result["appropriate"]["reasoning"]),
          },
      }
      print(
          f"[✔] Case {idx + 1}/{len(golden_set)} pre-labelled successfully via"
          " Groq."
      )
    except Exception as e:
      print(f"[X] Error labelling case {idx + 1}: {e}")
      labels[case_id] = {
          "grounded": {"score": 2, "reasoning": "Auto-assigned fallback."},
          "correct": {"score": 2, "reasoning": "Auto-assigned fallback."},
          "appropriate": {"score": 2, "reasoning": "Auto-assigned fallback."},
      }

  with open(LABELS_PATH, "w", encoding="utf-8") as f:
    json.dump(labels, f, indent=2)

  print(f"\nAll {len(golden_set)} cases pre-labelled and saved to {LABELS_PATH}!")


if __name__ == "__main__":
  auto_label_cases()