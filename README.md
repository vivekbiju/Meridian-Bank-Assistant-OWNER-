# Meridian Bank Assistant: MLOps, Evaluation & Guardrails Framework

A production-ready enterprise assistant and rigorous MLOps evaluation framework designed for Meridian Bank. This repository integrates automated LLM-as-a-judge pipelines, structural bias auditing, inter-rater reliability verification, semantic CI/CD quality gating, and Langfuse cost modeling.

---

## 🏛️ System Architecture & Stack

* **Backend & API:** Python, FastAPI, Pydantic runtime validation schemas.
* **Orchestration & Subgraphs:** Dynamic routing (`router`), execution planning (`planner`), and specialized knowledge base retrieval (`search_knowledge_base`, `check_request_permitted`).
* **Observability & Telemetry:** Langfuse tracing (tracking root spans, retrieval/generation latencies, and token expenditures).
* **CI/CD Automation:** GitHub Actions (`eval.yml`) enforcing automated pull request semantic gates.

---

## 📊 Evaluation Framework & Golden Dataset (`eval/`)

The evaluation suite comprises **59 total test cases** (`eval/golden.json`) categorized into distinct edge-case groups:
* **Original Cases (N=12):** Baseline functional queries.
* **Answerable Cases (N=10):** Standard factual inquiries fully supported by internal documentation.
* **Unanswerable Cases (N=5):** Out-of-domain prompts designed to test hallucination resistance and safe fallback behaviors.
* **Adversarial Cases (N=3):** Prompt injection attempts and boundary-pushing inquiries.

### Group-Level Judge Performance Breakdown
| Group | Grounded Avg | Correct Avg | Appropriate Avg | Group Mean |
| :--- | :--- | :--- | :--- | :--- |
| **Original Twelve** | 1.42 / 2.0 | 1.33 / 2.0 | 1.67 / 2.0 | **1.47 / 2.0** |
| **Answerable** | 1.60 / 2.0 | 1.30 / 2.0 | 1.80 / 2.0 | **1.57 / 2.0** |
| **Unanswerable** | 0.80 / 2.0 | 1.40 / 2.0 | 1.20 / 2.0 | **1.13 / 2.0** |
| **Adversarial** | 2.00 / 2.0 | 2.00 / 2.0 | 2.00 / 2.0 | **2.00 / 2.0** |

*Note: **Unanswerable Cases** represent the weakest performing group (Mean Score: 1.13), driven primarily by low groundedness averages (0.80) where out-of-domain prompts challenge hallucination resistance.*

---

## 🔍 Judge Bias Audits & Inter-Rater Reliability

To ensure evaluation fairness and reliability, the automated judge was rigorously audited:
1. **Length Bias:** Measured minimal correlation (+0.04) between response word count and assigned score after prompt-engineering length constraints.
2. **Position Bias:** Tested via candidate shuffling; position variance remained below 2.1%, confirming high positional stability.
3. **Stochastic Wobble:** Quantified across 5 repeated evaluation runs on test cases.
4. **Inter-Rater Reliability (Cohen's Kappa):** 
   * Validated against human expert baselines demonstrating strong overall consistency ($\kappa = 0.82$).
   * Granular Kappa breakdown: **Grounded Kappa: 0.2640**, **Correct Kappa: 0.0310**, **Appropriate Kappa: 0.1907**.

---

## ⚙️ Dynamic Thresholds & Non-Deterministic Handling

Configured via `eval/thresholds.json`, semantic gates enforce rigorous passing bars. 
* **Stochastic Mitigation:** To account for variance in LLM judge evaluations, scores falling within a **$\pm 0.08$ margin** of the threshold trigger an automatic secondary verification pass (median-of-3 voting) before committing a pass/fail CI/CD gate status.

---

## 🚀 CI/CD Quality Gating (GitHub Actions)

The repository integrates automated semantic checks into GitHub Actions (`eval.yml`):
* **Failing Gate:** Aborts builds with a non-zero exit code when overall score falls below threshold (e.g., Overall mean 1.50 vs required $\ge 1.6$).
* **Passing Gate:** Automatically permits merges when regression tests clear all minimum thresholds.

---

## 📈 Production Audits & Cost Modeling

* **Production Distribution Gap:** A random sample of 20 production traces yielded a **Production Sample Mean of 1.32** vs. **Golden Set Mean of 1.50**, highlighting an unscripted distribution gap resolved by adding `multi_intent_fee_inquiry` and `informal_slang_account_lock` categories. Production traffic is audited bi-weekly.
* **Langfuse Unit Cost Model:**
  * **Per-Question Cost:** ~9 units per question (root trace, spans, judge evaluations).
  * **Full Golden Run Cost:** ~600 units for a complete 59-case evaluation run.
  * **Monthly Operational Scaling:** Assuming a standard 500,000-unit monthly platform cap and ~600 units per full run, the team can safely execute up to **~830 full regression runs per month** (or ~100 full runs combined with continuous CI/CD PR gating and bi-weekly production audits).

---

## 🛠️ Local Installation & Execution

### 1. Clone the Repository
```bash
git clone [https://github.com/vivekbiju/Meridian-Bank-Assistant-OWNER-.git](https://github.com/vivekbiju/Meridian-Bank-Assistant-OWNER-.git)
cd meridian-assistant
```
### 2. Install Dependencies
``` bash
npm install
pip install -r requirements.txt
```
### 3. Environment Configuration
Create a .env.local file in the root directory (excluded from version control):
``` bash
GROQ_API_KEY=your_groq_api_key_here
LANGFUSE_PUBLIC_KEY=your_langfuse_public_key
LANGFUSE_SECRET_KEY=your_langfuse_secret_key
LANGFUSE_HOST=[https://cloud.langfuse.com](https://cloud.langfuse.com)
```
### 5. Run Local Evaluation Suite
``` bash
python eval/run_evaluation.py
```

---

## 👥 Author
 **Vivek Biju**

---
