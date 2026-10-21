# OpenAI GitHub Secret: read-only recheck

The project owner has confirmed replacement of the GitHub Actions repository secret `OPENAI_API_KEY`.

This commit triggers **only** the existing read-only model metadata GET check on the isolated authentication-diagnostic branch. It sends no customer data, never calls `/v1/responses`, has no model-generation cost, and does not reserve budget or activate production. It does not verify the model's quality.
