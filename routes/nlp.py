"""
/nlp  – NLP Engine: converts free-form text into structured tasks
/behavior – Behavior pattern analyzer
"""

import json
from flask import Blueprint, request, jsonify
from .ai_helper import call_ai, clean_json

nlp_bp = Blueprint("nlp", __name__)


# ── /nlp ──────────────────────────────────────────────────────────────────────

def _nlp_fallback(text):
    # Extract a rough title from the first sentence
    first = text.split(".")[0].strip()[:60] or "Break down your main goal"
    return {
        "tasks": [
            {
                "title": first,
                "priority": "high",
                "duration": 60,
                "category": "work",
                "reasoning": "Start with clarity"
            }
        ],
        "strategy": "Start small and focus on one task at a time.",
        "warnings": ["Could not parse input fully — showing simplified task"],
        "estimated_total_hours": 1.0
    }


@nlp_bp.route("/nlp", methods=["POST"])
def nlp():
    data = request.get_json(silent=True) or {}
    text = data.get("text", "").strip()

    if not text:
        return jsonify({"error": "No text provided"}), 400

    prompt = f"""You are an expert task extraction AI. Convert this unstructured brain dump into a structured task list.

User input: "{text}"

Extract every actionable item. Return ONLY raw JSON (no markdown fences, no preamble):

{{
  "tasks": [
    {{
      "title": "Clear action title (verb + noun)",
      "priority": "high",
      "duration": 30,
      "category": "work",
      "reasoning": "Why this priority (1 short phrase)"
    }}
  ],
  "strategy": "2-sentence execution strategy for these tasks",
  "warnings": ["any overload or conflict warnings"],
  "estimated_total_hours": 2.5
}}

Priority must be exactly: "high", "med", or "low".
Category must be exactly one of: "work", "learning", "health", "personal", "creative"."""

    try:
        raw = call_ai(prompt)
        if not raw:
            raise ValueError("empty response")

        cleaned = clean_json(raw)
        parsed  = json.loads(cleaned)
        tasks   = parsed.get("tasks", [])

        if not isinstance(tasks, list) or len(tasks) == 0:
            raise ValueError("no tasks")

        return jsonify({
            "success": True,
            "tasks": tasks,
            "strategy": parsed.get("strategy", ""),
            "warnings": parsed.get("warnings", []),
            "estimated_total_hours": parsed.get("estimated_total_hours", 0),
            "count": len(tasks)
        })

    except Exception:
        fb = _nlp_fallback(text)
        return jsonify({
            "success": True,
            "tasks": fb["tasks"],
            "strategy": fb["strategy"],
            "warnings": fb["warnings"],
            "estimated_total_hours": fb["estimated_total_hours"],
            "count": len(fb["tasks"]),
            "note": "fallback_used"
        })


# ── /behavior ──────────────────────────────────────────────────────────────────

def _behavior_fallback(tasks, xp, streak):
    done = [t for t in tasks if t.get("done")]
    pct  = round(len(done) / len(tasks) * 100) if tasks else 0
    grade = "A" if pct >= 80 else ("B" if pct >= 60 else ("C" if pct >= 40 else "D"))
    return {
        "overall_grade": grade,
        "strength": "You are showing consistent progress",
        "fix": "Reduce task switching — finish one item fully before starting another",
        "action": "Complete your single highest-priority task first thing tomorrow",
        "scores": {
            "execution": max(30, pct),
            "consistency": min(100, streak * 15),
            "planning_accuracy": 65,
            "focus_depth": 60
        },
        "flag": "on_track" if pct >= 50 else "low_execution"
    }


@nlp_bp.route("/behavior", methods=["POST"])
def behavior():
    data   = request.get_json(silent=True) or {}
    tasks  = data.get("tasks", [])
    xp     = data.get("xp", 0)
    streak = data.get("streak", 0)

    done       = [t for t in tasks if t.get("done")]
    pending    = [t for t in tasks if not t.get("done")]
    high_done  = sum(1 for t in done    if t.get("priority") == "high")
    high_total = sum(1 for t in tasks   if t.get("priority") == "high")
    pct        = round(len(done) / len(tasks) * 100) if tasks else 0

    prompt = f"""You are an execution behavior analyst. Give a short, sharp performance assessment.

Data:
- Total tasks: {len(tasks)}, Completed: {len(done)} ({pct}%)
- High priority completed: {high_done}/{high_total}
- Streak: {streak} days, XP: {xp}
- Pending tasks: {len(pending)}

Return ONLY raw JSON (no markdown fences, no preamble):
{{
  "overall_grade": "B",
  "strength": "one specific strength",
  "fix": "one behavioral pattern to fix",
  "action": "one specific action for tomorrow",
  "scores": {{
    "execution": 70,
    "consistency": 65,
    "planning_accuracy": 60,
    "focus_depth": 55
  }},
  "flag": "on_track"
}}

flag must be exactly one of: "overplanning", "low_execution", "inconsistency", "on_track"."""

    try:
        raw = call_ai(prompt)
        if not raw:
            raise ValueError("empty")

        cleaned = clean_json(raw)
        parsed  = json.loads(cleaned)
        return jsonify({"success": True, "data": parsed})

    except Exception:
        return jsonify({"success": True, "data": _behavior_fallback(tasks, xp, streak), "note": "fallback_used"})
