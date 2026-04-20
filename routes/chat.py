"""
/chat – AI Mentor Chatbot
Multi-turn mentor-style conversations with guaranteed response.
"""

from flask import Blueprint, request, jsonify
from .ai_helper import call_ai_chat

chat_bp = Blueprint("chat", __name__)

SYSTEM_PROMPT = """You are ExecuMind AI — an elite execution coach and strategic performance mentor.

- Direct, confident, and motivating — no fluff
- Science-backed but immediately actionable
- Focused on execution outcomes, not just planning
- Use **bold** for key insights
- Keep responses concise (3-5 sentences) unless a detailed plan is requested
- Start with the most important point — no preamble
- When user shares context, reference it specifically
- Tone: intelligent friend + demanding coach"""

FALLBACKS = [
    "**Start with your highest-priority task right now.** Every minute of delay is a choice. Commit to 25 minutes of undistracted focus — that's all it takes to break inertia.",
    "**Clarity beats motivation every time.** Pick one task, define the very next physical action, and start immediately. Progress creates energy.",
    "**You don't need more planning — you need execution.** Close everything except what you're working on. Set a 45-minute timer and go.",
    "**Your future self is watching.** The task you're avoiding is exactly the one you should do first. Do it now, feel the momentum.",
]

_fallback_idx = [0]

def _get_fallback():
    msg = FALLBACKS[_fallback_idx[0] % len(FALLBACKS)]
    _fallback_idx[0] += 1
    return msg


@chat_bp.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    messages = data.get("messages", [])
    context  = data.get("context", {})

    if not messages:
        return jsonify({"success": True, "reply": _get_fallback()})

    # Build context block
    ctx_block = ""
    if context:
        ctx_block = f"""

User's current state:
- Tasks: {context.get('total_tasks', 0)} total, {context.get('done_tasks', 0)} completed
- Completion rate: {context.get('completion_pct', 0)}%
- XP: {context.get('xp', 0)} | Streak: {context.get('streak', 0)} days
- High-priority pending: {context.get('high_pending', 0)}
- Next task: {context.get('next_task', 'none')}"""

    system = SYSTEM_PROMPT + ctx_block

    valid_messages = [
        {"role": m["role"], "content": m["content"]}
        for m in messages
        if m.get("role") in ("user", "assistant") and m.get("content", "").strip()
    ]

    if not valid_messages:
        return jsonify({"success": True, "reply": _get_fallback()})

    reply = call_ai_chat(system, valid_messages)

    if not reply or not reply.strip():
        reply = _get_fallback()

    return jsonify({"success": True, "reply": reply.strip()})
