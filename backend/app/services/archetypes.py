"""Archetype scoring + role recommendations.

Loaded from `app/seed/archetypes.json`. The file is parsed once at import time
and held in memory — this is config, not user data.

Scoring model
-------------
Each archetype declares a `weights` dict mapping trait_code -> weight. We score
each archetype as the weighted sum of trait scores (each trait score is in
[0, 1] from the scoring engine; we expose 0..10 to the UI but keep raw 0..1
internally for the math).

    archetype_score = sum(trait_score * weight  for trait_code, weight in weights)

The top two archetypes by score are returned as `primary` and `secondary`.

Recommended roles
-----------------
Plain threshold rules over trait scores expressed on the 0..10 scale (we
multiply the raw 0..1 score by 10 once for readability). The first set is
generous on purpose — better to surface a role and let the farm owner ignore
it than to under-suggest.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ARCHETYPES_PATH = Path(__file__).resolve().parent.parent / "seed" / "archetypes.json"


def _load() -> list[dict[str, Any]]:
    with ARCHETYPES_PATH.open(encoding="utf-8") as f:
        return json.load(f)


_ARCHETYPES: list[dict[str, Any]] = _load()


@dataclass
class ArchetypeResult:
    code: str
    rank: int
    score: float  # raw weighted sum (not normalized)
    emoji: str
    color: str
    name: str
    tagline: str
    description: str
    hidden_truth: str
    vs_others: str
    strengths: list[str]
    best_role: str
    frustrated_by: str
    struggles_with: str
    wrong_role: str
    management: str


@dataclass
class RecommendedRole:
    code: str
    emoji: str
    name: str
    reason: str  # short text explaining why this trait combo unlocks the role


def _localized(entry: dict[str, Any], locale: str) -> dict[str, Any]:
    return entry.get(locale) or entry.get("en") or {}


def score_archetypes(trait_scores_0_1: dict[str, float], locale: str) -> list[ArchetypeResult]:
    """Return all archetypes ranked by weighted-sum score, primary first."""
    scored: list[tuple[float, dict[str, Any]]] = []
    for arc in _ARCHETYPES:
        weights: dict[str, float] = arc.get("weights") or {}
        s = sum(float(trait_scores_0_1.get(code, 0.0)) * float(w) for code, w in weights.items())
        scored.append((s, arc))

    scored.sort(key=lambda kv: kv[0], reverse=True)

    out: list[ArchetypeResult] = []
    for rank, (score, arc) in enumerate(scored, start=1):
        loc = _localized(arc, locale)
        out.append(
            ArchetypeResult(
                code=arc["code"],
                rank=rank,
                score=score,
                emoji=arc.get("emoji", ""),
                color=arc.get("color", "#444"),
                name=loc.get("name", arc["code"]),
                tagline=loc.get("tagline", ""),
                description=loc.get("description", ""),
                hidden_truth=loc.get("hidden_truth", ""),
                vs_others=loc.get("vs_others", ""),
                strengths=list(loc.get("strengths") or []),
                best_role=loc.get("best_role", ""),
                frustrated_by=loc.get("frustrated_by", ""),
                struggles_with=loc.get("struggles_with", ""),
                wrong_role=loc.get("wrong_role", ""),
                management=loc.get("management", ""),
            )
        )
    return out


# ----- Recommended-role rules ----------------------------------------------

# Each rule: (role_code, emoji, en_name, es_name, en_reason, es_reason, predicate)
# Predicate operates on trait scores 0..10.
_ROLE_RULES = [
    (
        "equipment_operator",
        "🚜",
        "Equipment Operator",
        "Operador de Maquinaria",
        "Strong feel for machinery — can run iron all day.",
        "Buen manejo de maquinaria — puede operar todo el día.",
        lambda t: t.get("equipment", 0) >= 7,
    ),
    (
        "mechanic",
        "🔧",
        "Mechanic / Maintenance",
        "Mecánico / Mantenimiento",
        "Diagnoses and fixes when something breaks mid-job.",
        "Diagnostica y arregla cuando algo se rompe a medio trabajo.",
        lambda t: t.get("equipment", 0) >= 7 and t.get("problem_solving", 0) >= 6,
    ),
    (
        "animal_care",
        "🐔",
        "Animal Care Specialist",
        "Especialista en Cuidado Animal",
        "Reads livestock the way other people read weather.",
        "Lee al ganado como otros leen el clima.",
        lambda t: t.get("animal_care", 0) >= 7,
    ),
    (
        "tree_field",
        "🌳",
        "Tree & Field Specialist",
        "Especialista en Árboles y Campo",
        "Notices subtle plant and field changes early — and shows up to act on them.",
        "Detecta cambios sutiles en plantas y campo a tiempo — y se presenta a actuar.",
        lambda t: t.get("observation", 0) >= 6 and t.get("reliability", 0) >= 6,
    ),
    (
        "garden_harvest",
        "🥬",
        "Garden & Harvest Specialist",
        "Especialista en Huerto y Cosecha",
        "Steady, fast, finishes the rows — exactly what harvest windows demand.",
        "Constante, rápido, termina los surcos — justo lo que pide la cosecha.",
        lambda t: t.get("drive_output", 0) >= 6 and t.get("reliability", 0) >= 6,
    ),
    (
        "fence_property",
        "🏗️",
        "Fence & Property Specialist",
        "Especialista en Cercas y Propiedad",
        "Improvises around terrain and shows up day after day to close the line.",
        "Improvisa con el terreno y vuelve día tras día para cerrar la línea.",
        lambda t: t.get("problem_solving", 0) >= 6 and t.get("reliability", 0) >= 6,
    ),
    (
        "construction",
        "🔨",
        "Construction Specialist",
        "Especialista en Construcción",
        "Pushes hard and figures out the angle when the plan doesn't fit reality.",
        "Empuja fuerte y resuelve el ángulo cuando el plan no encaja.",
        lambda t: t.get("problem_solving", 0) >= 6 and t.get("drive_output", 0) >= 6,
    ),
    (
        "crew_lead",
        "👷",
        "Crew Lead Potential",
        "Potencial de Jefe de Cuadrilla",
        "Sets direction and keeps the order of operations clean.",
        "Marca el rumbo y mantiene limpio el orden de las tareas.",
        lambda t: t.get("leadership", 0) >= 6 and t.get("planning", 0) >= 5,
    ),
]


def recommended_roles(trait_scores_0_1: dict[str, float], locale: str) -> list[RecommendedRole]:
    """Return the role pills that this trait profile unlocks."""
    t10 = {k: v * 10.0 for k, v in trait_scores_0_1.items()}
    is_es = locale == "es"
    out: list[RecommendedRole] = []
    for code, emoji, en_name, es_name, en_reason, es_reason, predicate in _ROLE_RULES:
        if predicate(t10):
            out.append(
                RecommendedRole(
                    code=code,
                    emoji=emoji,
                    name=es_name if is_es else en_name,
                    reason=es_reason if is_es else en_reason,
                )
            )
    return out
