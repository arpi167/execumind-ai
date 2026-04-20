"""
ExecuMind AI – Centralized AI Helper
Stable Gemini integration with full fallback protection.
"""

import os
import re
import threading
from dotenv import load_dotenv

load_dotenv()

# ── Gemini setup (safe – never crashes on import) ──────────────────────────────
_model = None

def _get_model():
    """Lazy-init Gemini model. Returns None if unavailable."""
    global _model
    if _model is not None:
        return _model
    try:
        import google.generativeai as genai
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if not api_key or api_key in ("your_api_key_here", ""):
            return None
        genai.configure(api_key=api_key)
        _model = genai.GenerativeModel("gemini-1.5-flash")
        return _model
    except Exception:
        return None


def _call_with_timeout(fn, timeout=10):
    """Run fn() in a thread; return result or None on timeout/error."""
    result = [None]
    error  = [None]

    def _run():
        try:
            result[0] = fn()
        except Exception as e:
            error[0] = e

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    t.join(timeout)
    if t.is_alive():
        return None   # timed-out
    if error[0]:
        return None
    return result[0]


def clean_json(text: str) -> str:
    """Strip markdown fences."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


# ── Public API ─────────────────────────────────────────────────────────────────

def call_ai(prompt: str, system: str = None) -> str:
    """Single-turn prompt → text reply. Never raises."""
    model = _get_model()
    if model is None:
        return ""

    full_prompt = f"{system}\n\n{prompt}" if system else prompt

    def _fn():
        resp = model.generate_content(full_prompt)
        return resp.text if resp and resp.text else ""

    return _call_with_timeout(_fn, timeout=10) or ""


def call_ai_chat(system: str, messages: list) -> str:
    """Multi-turn chat → assistant reply. Never raises."""
    model = _get_model()
    if model is None:
        return ""

    parts = [system, ""]
    for m in messages:
        role = "User" if m.get("role") == "user" else "Assistant"
        content = (m.get("content") or "").strip()
        if content:
            parts.append(f"{role}: {content}")
    parts.append("Assistant:")
    full_prompt = "\n".join(parts)

    def _fn():
        resp = model.generate_content(full_prompt)
        return resp.text if resp and resp.text else ""

    return _call_with_timeout(_fn, timeout=10) or ""
