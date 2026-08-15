"""AI processing pipeline: enhance → OCR → layout → generate."""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any

from PIL import Image, ImageEnhance, ImageFilter

from models import NoteData, NoteSection, SectionType

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Image enhancer
# ---------------------------------------------------------------------------

class ImageEnhancer:
    """Improve image quality before OCR."""

    @staticmethod
    def enhance(
        image_path: str | Path,
        contrast: float = 1.4,
        brightness: float = 1.2,
        sharpness: float = 2.0,
        output_path: str | Path | None = None,
    ) -> Path:
        """Apply contrast, brightness, and sharpening enhancements.

        Returns the path to the enhanced image.
        """
        img = Image.open(image_path)

        img = ImageEnhance.Contrast(img).enhance(contrast)
        img = ImageEnhance.Brightness(img).enhance(brightness)
        img = img.filter(ImageFilter.SHARPEN)
        img = ImageEnhance.Sharpness(img).enhance(sharpness)

        if output_path is None:
            output_path = Path(image_path).with_stem(
                Path(image_path).stem + "_enhanced"
            )
        output_path = Path(output_path)
        img.save(output_path, quality=95)
        logger.info("Enhanced image saved to %s", output_path)
        return output_path


# ---------------------------------------------------------------------------
# OCR processor
# ---------------------------------------------------------------------------

class OCRProcessor:
    """Extract text from an image.

    In production, swap in Google Document AI, Tesseract, or another
    OCR backend. The ``mock`` flag returns sample data instead.
    """

    @staticmethod
    def extract_text(image_path: str | Path, *, mock: bool = False) -> str:
        """Return the full text extracted from *image_path*."""
        if mock:
            return _sample_ocr_text()

        try:
            import pytesseract  # type: ignore[import-untyped]

            img = Image.open(image_path)
            text: str = pytesseract.image_to_string(img)
            logger.info("OCR extracted %d characters", len(text))
            return text
        except ImportError:
            logger.warning(
                "pytesseract not installed – falling back to mock OCR"
            )
            return _sample_ocr_text()


# ---------------------------------------------------------------------------
# Layout analyzer
# ---------------------------------------------------------------------------

class LayoutAnalyzer:
    """Detect note structure (headings, paragraphs, formulas, tables)."""

    @staticmethod
    def analyze(text: str) -> list[dict[str, Any]]:
        """Heuristic layout analysis returning a list of section dicts."""
        sections: list[dict[str, Any]] = []
        lines = text.splitlines()

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            if _looks_like_heading(stripped):
                sections.append({"type": "heading", "level": 2, "text": stripped})
            elif _looks_like_formula(stripped):
                sections.append({"type": "formula", "expression": stripped})
            elif stripped.startswith(("-", "*", "•")):
                items = [l.strip(" -•*") for l in lines if l.strip().startswith(("-", "*", "•"))]
                sections.append({"type": "list", "ordered": False, "items": items})
                break  # consume all list items at once
            else:
                sections.append({"type": "text", "content": stripped})

        return sections


# ---------------------------------------------------------------------------
# AI note generator
# ---------------------------------------------------------------------------

class AINoteGenerator:
    """Turn extracted content into a structured NoteData via an LLM."""

    def __init__(self, api_key: str | None = None, *, mock: bool = False) -> None:
        self.api_key = api_key
        self.mock = mock

    def generate(
        self, raw_content: str, style: str = "modern"
    ) -> NoteData:
        """Generate structured notes from raw OCR content."""
        if self.mock:
            return _sample_note_data(style)

        try:
            return self._call_llm(raw_content, style)
        except Exception:
            logger.exception("LLM call failed – returning mock data")
            return _sample_note_data(style)

    # -- private ----------------------------------------------------------

    def _call_llm(self, raw_content: str, style: str) -> NoteData:
        """Call the Gemini / OpenAI compatible API."""
        from prompts import build_notes_prompt  # local import to avoid circular deps

        try:
            import httpx  # noqa: F811 – re-import for clarity
        except ImportError:
            logger.warning("httpx not installed – using mock data")
            return _sample_note_data(style)

        messages = build_notes_prompt(raw_content, style)

        # Try OpenAI-compatible endpoint (Gemini, OpenAI, local, etc.)
        base_url = "https://generativelanguage.googleapis.com/v1beta"
        url = f"{base_url}/models/gemini-2.0-flash:generateContent"
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": self.api_key or "",
        }
        payload = {
            "contents": [{"parts": [{"text": m["content"]} for m in messages]}]
        }

        resp = httpx.post(url, json=payload, headers=headers, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        raw_text = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "{}")
        )
        # Strip markdown fences if present
        cleaned = raw_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed = json.loads(cleaned)
        return _dict_to_note_data(parsed)


# ---------------------------------------------------------------------------
# Full pipeline helper
# ---------------------------------------------------------------------------

def run_pipeline(
    image_path: str | Path,
    *,
    style: str = "modern",
    mock: bool = False,
    api_key: str | None = None,
) -> tuple[NoteData, float]:
    """Execute the full pipeline and return (NoteData, elapsed_ms)."""
    t0 = time.perf_counter()

    # Step 1 – enhance
    enhanced = ImageEnhancer.enhance(image_path)

    # Step 2 – OCR
    ocr_text = OCRProcessor.extract_text(enhanced, mock=mock)

    # Step 3 – layout
    layout = LayoutAnalyzer.analyze(ocr_text)

    # Step 4 – AI generation
    generator = AINoteGenerator(api_key=api_key, mock=mock)
    raw_for_ai = json.dumps({"ocr_text": ocr_text, "layout": layout}, indent=2)
    note_data = generator.generate(raw_for_ai, style=style)

    elapsed = (time.perf_counter() - t0) * 1000
    logger.info("Pipeline completed in %.1f ms", elapsed)
    return note_data, elapsed


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _looks_like_heading(line: str) -> bool:
    import re
    return bool(re.match(r"^(#{1,6}\s|.{3,60}$)", line) and len(line) < 80 and line.isupper())


def _looks_like_formula(line: str) -> bool:
    import re
    return bool(re.search(r"[=∑∫∂√π∞≈≠≤≥±×÷]", line)) or bool(re.match(r"^[a-zA-Z]\s*[=+\-*/]", line))


def _sample_ocr_text() -> str:
    return """\
# Linear Algebra — Lecture 5

## Eigenvalues & Eigenvectors

Definition: Let A be an n×n matrix. A scalar λ is called an eigenvalue of A
if there exists a non-zero vector v such that Av = λv.

The vector v is called an eigenvector corresponding to λ.

### Finding Eigenvalues

1. Solve det(A - λI) = 0
2. This gives the characteristic polynomial
3. Roots are the eigenvalues

### Properties

- Trace(A) = sum of eigenvalues
- det(A) = product of eigenvalues
- Eigenvalues of A⁻¹ are 1/λ

### Example

A = [[2, 1], [1, 2]]

det(A - λI) = (2-λ)² - 1 = λ² - 4λ + 3 = (λ-1)(λ-3)

Eigenvalues: λ₁ = 1, λ₂ = 3

For λ₁ = 1: v₁ = [1, -1]ᵀ
For λ₂ = 3: v₂ = [1, 1]ᵀ
"""


def _sample_note_data(style: str = "modern") -> NoteData:
    from models import (
        HeadingSection,
        TextSection,
        CalloutSection,
        TableSection,
        FormulaSection,
        ListSection,
        HighlightSection,
    )

    sections: list[NoteSection] = [
        HeadingSection(level=1, text="Linear Algebra — Lecture 5"),
        HeadingSection(level=2, text="Eigenvalues & Eigenvectors"),
        CalloutSection(
            title="Definition",
            content=(
                "Let A be an n×n matrix. A scalar λ is an eigenvalue of A if "
                "there exists a non-zero vector v such that Av = λv."
            ),
            variant="info",
        ),
        TextSection(content="The vector v is called an eigenvector corresponding to λ."),
        HeadingSection(level=3, text="Finding Eigenvalues"),
        ListSection(
            ordered=True,
            items=[
                "Solve det(A - λI) = 0",
                "This gives the characteristic polynomial",
                "Roots are the eigenvalues",
            ],
        ),
        HeadingSection(level=3, text="Properties"),
        TableSection(
            headers=["Property", "Formula"],
            rows=[
                ["Trace", "Trace(A) = Σλᵢ"],
                ["Determinant", "det(A) = Πλᵢ"],
                ["Inverse", "Eigenvalues of A⁻¹ are 1/λ"],
            ],
        ),
        HeadingSection(level=3, text="Example"),
        FormulaSection(expression="A = [[2, 1], [1, 2]]", label="Matrix A"),
        FormulaSection(
            expression="det(A - λI) = (2-λ)² - 1 = λ² - 4λ + 3 = (λ-1)(λ-3)",
            label="Characteristic polynomial",
        ),
        HighlightSection(
            content="Eigenvalues: λ₁ = 1, λ₂ = 3",
            color="#fef9c3",
        ),
        TextSection(content="For λ₁ = 1: v₁ = [1, -1]ᵀ"),
        TextSection(content="For λ₂ = 3: v₂ = [1, 1]ᵀ"),
    ]
    return NoteData(
        title="Linear Algebra — Lecture 5",
        subtitle="Eigenvalues & Eigenvectors",
        style=style,
        sections=sections,
    )


def _dict_to_note_data(data: dict[str, Any]) -> NoteData:
    """Convert a raw dict (from LLM JSON) into a NoteData instance."""
    from models import (
        HeadingSection,
        TextSection,
        CalloutSection,
        TableSection,
        FormulaSection,
        ListSection,
        HighlightSection,
        MindmapSection,
        FlowchartSection,
        TimelineSection,
    )

    type_map: dict[str, Any] = {
        "heading": HeadingSection,
        "text": TextSection,
        "callout": CalloutSection,
        "table": TableSection,
        "formula": FormulaSection,
        "list": ListSection,
        "highlight": HighlightSection,
        "mindmap": MindmapSection,
        "flowchart": FlowchartSection,
        "timeline": TimelineSection,
    }

    raw_sections = data.get("sections", [])
    parsed: list[NoteSection] = []
    for s in raw_sections:
        cls = type_map.get(s.get("type"))
        if cls is None:
            continue
        try:
            parsed.append(cls(**{k: v for k, v in s.items() if k != "type"}))
        except Exception:
            logger.warning("Skipping malformed section: %s", s)

    return NoteData(
        title=data.get("title", "Untitled"),
        subtitle=data.get("subtitle", ""),
        sections=parsed,
    )
