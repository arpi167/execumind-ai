"""
ExecuMind AI – Flask Backend Entry Point
"""

import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

# Load env FIRST, before any routes import ai_helper
load_dotenv()

from routes.analyze import analyze_bp
from routes.plan    import plan_bp
from routes.chat    import chat_bp
from routes.nlp     import nlp_bp
from routes.main    import main_bp

app = Flask(__name__)
CORS(app)

app.register_blueprint(main_bp)
app.register_blueprint(analyze_bp)
app.register_blueprint(plan_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(nlp_bp)

if __name__ == "__main__":
    key = os.getenv("GEMINI_API_KEY", "")

    print("\n🚀 ExecuMind AI Server Starting...")
    print("━" * 40)
    print("  Frontend : Render URL will be assigned")
    print("  API Base : /")
    print(f"  Gemini   : {'✅ key loaded' if key and key != 'your_api_key_here' else '⚠️ key missing – fallbacks active'}")
    print("━" * 40)

    port = int(os.environ.get("PORT", 5000))  # ✅ IMPORTANT
    app.run(host="0.0.0.0", port=port)        # ❌ remove debug=True
