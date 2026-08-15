# AI Study PDF

> **Scan → Understand → Beautify → Learn**

Transform handwritten notebook pages into beautifully designed, interactive study material using AI.

## Features

- **Smart Scanning** — Upload photos of handwritten notes with auto edge detection
- **AI Understanding** — Reads handwriting, identifies key concepts, formulas, and relationships
- **10 Design Themes** — Minimal, Medical, Engineering, Cute, Dark, Notebook, Apple, GoodNotes, Pinterest, Exam
- **Smart Layouts** — Auto-generated callout boxes, tables, mind maps, flowcharts, formula boxes
- **Export Anywhere** — PDF, HTML, Markdown export with print-ready quality
- **Lightning Fast** — Full page processed in under 30 seconds

## Quick Start

### Frontend (No build step needed)

Simply open `index.html` in your browser to see the landing page, or `designer.html` for the app.

### Backend (Optional — for AI processing)

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run the server
python main.py
# or
uvicorn main:app --reload --port 8000
```

The backend runs at `http://localhost:8000`

### Run in VS Code

1. Open the project folder in VS Code
2. Install the **Live Server** extension
3. Right-click `index.html` → "Open with Live Server"
4. For backend: Open integrated terminal → `cd backend` → `python main.py`

## Project Structure

```
ai-study-pdf/
├── index.html              # Landing page
├── index.css               # Landing page styles
├── app.js                  # Landing page interactivity
├── designer.html           # Main app interface
├── designer.css            # App styles
├── designer.js             # App logic
├── renderer.js             # Note rendering engine (JSON → HTML)
├── styles/                 # 10 design theme CSS files
│   ├── minimal-student.css
│   ├── medical-notes.css
│   ├── engineering.css
│   ├── cute-notes.css
│   ├── dark-theme.css
│   ├── notebook-style.css
│   ├── apple-notes.css
│   ├── goodnotes-style.css
│   ├── pinterest-aesthetic.css
│   └── exam-revision.css
├── backend/                # FastAPI backend
│   ├── main.py             # API endpoints
│   ├── pipeline.py         # AI processing pipeline
│   ├── prompts.py          # AI prompt templates
│   ├── models.py           # Pydantic data models
│   ├── export.py           # Export functionality
│   └── requirements.txt    # Python dependencies
└── assets/                 # Static assets
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML/CSS/JS (Vanilla) |
| Fonts | Google Fonts (Caveat, Kalam, Inter) |
| Math Rendering | KaTeX |
| Diagrams | Mermaid.js |
| Backend | FastAPI (Python) |
| AI Models | Gemini 2.5 Flash / GPT-4.1 Vision |
| OCR | Google Document AI / Tesseract |

## License

MIT
