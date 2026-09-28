import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv(".env.local")
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

try:
  models = client.models.list()
  print("Available models on your Groq key:")
  for m in models.data:
    print(f" - {m.id}")
except Exception as e:
  print(f"Error fetching models: {e}")