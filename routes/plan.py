"""
/plan – Adaptive Planner
Generates time-blocked schedule with deep work focus.
"""

import json
from flask import Blueprint, request, jsonify
from .ai_helper import call_ai, clean_json

plan_bp = Blueprint("plan", __name__)


def _fallback(pending, start_time):
    return [
        {
            "time": start_time,
            "end_time": "10:30 AM",
            "type": "focus",
            "title": "Deep Work Session",
            "tasks": [t.get("title", "") for t in pending[:2]],
            "note": "Start with your highest-priority tasks.",
            "duration_min": 90
        },
        {
            "time": "10:30 AM",
            "end_time": "10:40 AM",
            "type": "break",
            "title": "Short Break",
            "tasks": [],
            "note": "Step away, hydrate, breathe.",
            "duration_min": 10
        },
        {
            "time": "10:40 AM",
            "end_time": "12:10 PM",
            "type": "focus",
            "title": "Second Focus Block",
            "tasks": [t.get("title", "") for t in pending[2:4]],
            "note": "Continue execution without switching tasks.",
            "duration_min": 90
        },
        {
            "time": "12:10 PM",
            "end_time": "12:20 PM",
            "type": "break",
            "title": "Midday Break",
            "tasks": [],
            "note": "Walk, stretch, reset.",
            "duration_min": 10
        },
        {
            "time": "5:00 PM",
            "end_time": "5:30 PM",
            "type": "review",
            "title": "Daily Review",
            "tasks": [],
            "note": "Reflect on wins and plan tomorrow.",
            "duration_min": 30
        }
    ]


@plan_bp.route("/plan", methods=["POST"])
def plan():
    data       = request.get_json(silent=True) or {}
    tasks      = data.get("tasks", [])
    start_time = data.get("start_time", "9:00 AM")
    work_hours = data.get("work_hours", 8)

    if not tasks:
        return jsonify({"error": "No tasks provided"}), 400

    pending = [t for t in tasks if not t.get("done", False)]
    task_summary = ", ".join(
        f"{t.get('title','?')} ({t.get('priority','med')} priority, {t.get('duration',30)}min)"
        for t in pending
    ) or "General work"

    prompt = f"""Create a time-blocked daily schedule starting at {start_time} for {work_hours} hours.

Tasks to schedule: {task_summary}

Rules:
- Group tasks into deep work blocks (max 90 min each)
- Add 5-10 min breaks between blocks
- Add a review block at end of day
- Prioritize high-priority tasks first
- Return ONLY a raw JSON array with NO markdown fences, NO preamble

[
  {{
    "time": "9:00 AM",
    "end_time": "10:30 AM",
    "type": "focus",
    "title": "Block title",
    "tasks": ["task1", "task2"],
    "note": "one line tip",
    "duration_min": 90
  }}
]

Types allowed: "focus", "break", "review". Max 8 blocks."""

    try:
        raw = call_ai(prompt)
        if not raw:
            raise ValueError("empty response")

        cleaned = clean_json(raw)
        blocks  = json.loads(cleaned)

        if not isinstance(blocks, list) or len(blocks) == 0:
            raise ValueError("invalid schedule")

        return jsonify({"success": True, "schedule": blocks})

    except Exception:
        return jsonify({"success": True, "schedule": _fallback(pending, start_time), "note": "fallback_used"})
