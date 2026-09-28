from pydantic import BaseModel, Field


class CriterionScore(BaseModel):
  score: int = Field(
      ...,
      ge=0,
      le=2,
      description=(
          "Score must be strictly 0, 1, or 2 based on the evaluation rubric."
      ),
  )
  reasoning: str = Field(
      ..., description="Detailed step-by-step reasoning supporting the score."
  )


class JudgeResponse(BaseModel):
  grounded: CriterionScore = Field(
      ...,
      description=(
          "Is the response strictly backed by the retrieved context (preventing"
          " hallucinations)?"
      ),
  )
  correct: CriterionScore = Field(
      ...,
      description=(
          "Is the factual answer correct relative to the golden standard?"
      ),
  )
  appropriate: CriterionScore = Field(
      ...,
      description=(
          "Is the tone, helpfulness, and safety appropriate for a bank"
          " assistant?"
      ),
  )