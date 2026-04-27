"""Scoring engine: turn raw responses into per-theme scores, normalized 0..1."""

from collections import defaultdict
from dataclasses import dataclass

from app.models import Question, Response


@dataclass
class ThemeScoreResult:
    code: str
    score: float  # normalized 0..1
    rank: int


def score_responses(responses: list[Response], questions_by_id: dict[int, Question]) -> list[ThemeScoreResult]:
    """
    Paired questions: the chosen option's theme gets +1.
    Likert questions: each mapped theme gets (value - 3) / 2 * weight, so 5 -> +weight, 1 -> -weight.
    Final scores are min-max normalized to 0..1 across themes that received any signal,
    then every known theme receives at least a 0.
    """
    raw: dict[str, float] = defaultdict(float)
    max_possible: dict[str, float] = defaultdict(float)

    for resp in responses:
        q = questions_by_id.get(resp.question_id)
        if q is None:
            continue

        if q.kind == "paired":
            # exactly two options; option positions are 0 and 1
            for opt in q.options:
                max_possible[opt.theme_code] += 1.0  # max a theme could get from this question
            chosen = next((o for o in q.options if o.position == resp.value), None)
            if chosen:
                raw[chosen.theme_code] += 1.0

        elif q.kind == "likert":
            for weight_entry in q.likert_weights or []:
                code = weight_entry["theme_code"]
                weight = float(weight_entry.get("weight", 1.0))
                # value in [1,5], center at 3 -> range [-1, +1] after /2
                contribution = ((resp.value - 3) / 2.0) * weight
                raw[code] += contribution
                max_possible[code] += abs(weight)

    # Normalize to 0..1 using a theme's own max possible magnitude.
    normalized: dict[str, float] = {}
    for code, mp in max_possible.items():
        if mp <= 0:
            normalized[code] = 0.5
            continue
        # Shift from [-mp, +mp] to [0, 1]
        val = raw[code]
        normalized[code] = max(0.0, min(1.0, (val + mp) / (2 * mp)))

    # Rank descending
    ordered = sorted(normalized.items(), key=lambda kv: kv[1], reverse=True)
    return [ThemeScoreResult(code=code, score=score, rank=i + 1) for i, (code, score) in enumerate(ordered)]
