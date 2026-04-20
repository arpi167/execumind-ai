"""
/analyze – Decision Engine
Prioritizes tasks and suggests execution strategy.
"""

import json
from flask import Blueprint, request, jsonify
from .ai_helper import call_ai, clean_json

analyze_bp = Blueprint("analyze", __name__)


def _fallback(tasks):
    return {
        "focus_task": tasks[0].get("title", "Start first task") if tasks else "Add a task",
        "focus_reason": "Start with your highest-priority item to build momentum.",
        "priority_order": [t.get("title", "") for t in tasks[:3]],
        "execution_strategy": "Focus on one task at a time. Complete it fully before switching.",
        "risk_flag": "Possible overplanning detected",
        "energy_tip": "Take a 5-minute break every 60–90 minutes to sustain focus.",
        "score": {
            "execution_readiness": 65,
            "overplanning_risk": 40,
            "momentum": 55
        }
    }


@analyze_bp.route("/analyze", methods=["POST"])
def analyze():
    data   = request.get_json(silent=True) or {}
    tasks  = data.get("tasks", [])
    xp     = data.get("xp", 0)
    streak = data.get("streak", 0)

    if not tasks:
        return jsonify({"error": "No tasks provided"}), 400

    task_list = "\n".join(
        f"- {t.get('title','Untitled')} | priority:{t.get('priority','med')} | "
        f"done:{t.get('done',False)} | duration:{t.get('duration',30)}min | category:{t.get('category','work')}"
        for t in tasks
    )

    prompt = f"""You are an elite execution coach AI. Analyze these tasks and return a decision report.

Tasks:
{task_list}

User stats: XP={xp}, Streak={streak} days

Return ONLY a raw JSON object with NO markdown fences, NO preamble:
{{
  "focus_task": "the single most important task to do RIGHT NOW",
  "focus_reason": "why this task first (1 sentence)",
  "priority_order": ["task1", "task2", "task3"],
  "execution_strategy": "2-sentence strategy for today",
  "risk_flag": "one behavioral risk detected (or null)",
  "energy_tip": "one tip to maintain energy/focus today",
  "score": {{
    "execution_readiness": 75,
    "overplanning_risk": 35,
    "momentum": 60
  }}
}}"""

    try:
        raw = call_ai(prompt)
        if not raw:
            raise ValueError("empty response")

        cleaned = clean_json(raw)
        parsed  = json.loads(cleaned)
        return jsonify({"success": True, "data": parsed})

    except Exception:
        return jsonify({"success": True, "data": _fallback(tasks), "note": "fallback_used"})
