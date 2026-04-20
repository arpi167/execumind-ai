# 🚀 ExecuMind AI – Intelligent Task Execution & Decision System

An AI-powered execution system that transforms thoughts into structured action and ensures consistent task completion through intelligent decision-making and behavioral feedback.

---

## 🏗️ Project Structure

```
execumind/
├── app.py                    ← Flask entry point
├── requirements.txt          ← Python dependencies
├── .env                      ← API key (you must edit this)
├── routes/
│   ├── __init__.py
│   ├── main.py               ← Serves frontend (GET /)
│   ├── ai_helper.py          ← Shared Gemini API utility
│   ├── analyze.py            ← POST /analyze  (Decision Engine)
│   ├── plan.py               ← POST /plan     (Schedule Generator)
│   ├── chat.py               ← POST /chat     (AI Mentor Chatbot)
│   └── nlp.py                ← POST /nlp + POST /behavior
├── templates/
│   └── index.html            ← Full frontend HTML
└── static/
    ├── css/style.css         ← Dark UI stylesheet
    └── js/app.js             ← Frontend logic (talks to Flask)
```

---

## ⚡ Quick Setup (3 Steps)

### Step 1 — Install dependencies

Open a terminal in the `execumind/` folder and run:

```bash
# Create a virtual environment (recommended)
python -m venv venv

# Activate it:
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install all packages
pip install -r requirements.txt
```

### Step 2 — Add your API key

Open the `.env` file and replace the placeholder:

```
GEMINI_API_KEY=your_api_key_here
```

Get your free API key at: https://aistudio.google.com/

### Step 3 — Run the app

```bash
python app.py
```

Then open your browser at: **http://localhost:5000**

---

## 🔌 API Routes

| Method | Endpoint    | Description                            |
| ------ | ----------- | -------------------------------------- |
| GET    | `/`         | Serves the frontend dashboard          |
| POST   | `/analyze`  | Decision engine — ranks & strategizes  |
| POST   | `/plan`     | Generates AI time-block schedule       |
| POST   | `/chat`     | Multi-turn AI mentor chatbot           |
| POST   | `/nlp`      | Converts brain dump → structured tasks |
| POST   | `/behavior` | Analyzes behavioral execution patterns |

---

## 🧠 Features

| Feature                | Description                                        |
| ---------------------- | -------------------------------------------------- |
| **NLP Brain Dump**     | Type anything → AI extracts structured tasks       |
| **Decision Engine**    | AI ranks tasks by impact and generates strategy    |
| **Time-Block Planner** | Auto-generated deep work schedule with breaks      |
| **Behavior Analyzer**  | Detects overplanning, low execution, inconsistency |
| **XP + Levels**        | 7 levels with XP earned per completed task         |
| **Badges**             | 9 achievement badges unlocked by milestones        |
| **Streak Tracker**     | Daily streak with persistent localStorage          |
| **AI Mentor Chat**     | Full multi-turn chat with context awareness        |

---

## 🛠️ VS Code Tips

1. Install the **Python** extension by Microsoft
2. Select your virtual environment interpreter:
   - Press `Ctrl+Shift+P` → "Python: Select Interpreter" → choose `venv`
3. Install **Flask Snippets** extension for route autocompletion
4. Use the integrated terminal: `Ctrl+\`` to run the app

---

## 🔧 Troubleshooting

**"ModuleNotFoundError"** → Make sure your venv is activated before running pip install

**"API key not set"** → Check your `.env` file has the correct key (no quotes needed)

**"Port 5000 in use"** → Change the port in `app.py`: `app.run(port=5001)`

**macOS AirPlay conflict on port 5000** → Use `app.run(port=5001)` and open http://localhost:5001

---

## 📦 Dependencies

- **Flask 3.0** — Web framework
- **flask-cors** — Cross-origin requests
- **anthropic 0.28** — Claude AI SDK
- **python-dotenv** — Environment variable loading
