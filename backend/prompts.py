"""AI prompt templates for the Study PDF pipeline."""

from __future__ import annotations

import json

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are an expert academic assistant that converts handwritten or printed \
study notes into clean, structured, visually rich digital notes. \
You understand math formulas, diagrams, tables, and outline hierarchies. \
Always return valid JSON matching the provided schema.\
"""

# ---------------------------------------------------------------------------
# Content understanding
# ---------------------------------------------------------------------------

CONTENT_UNDERSTANDING_PROMPT = """\
Analyse the following extracted text from a study-note image. \
Identify:
1. The main topic / title
2. Sub-topics and headings
3. Key facts, definitions, theorems, and formulas
4. Tables and lists
5. Any flowcharts, mind-maps, or timelines implied by the content

Return a plain-JSON object with keys: title, subtitle, items (list of dicts \
with keys: type, level?, text?, content?, headers?, rows?, expression?, \
ordered?, items?, branches?, steps?, events?).\
"""

# ---------------------------------------------------------------------------
# Notes design (final JSON generation)
# ---------------------------------------------------------------------------

NOTES_DESIGN_PROMPT = """\
You are given extracted study-note content. \
Your task is to produce a beautifully structured JSON representation of the \
notes using the schema below. Apply the requested design style.

STYLE: {style_name}

{style_instruction}

Return ONLY valid JSON — no markdown fences, no commentary.\
"""

# ---------------------------------------------------------------------------
# Style prompts  (10 themes)
# ---------------------------------------------------------------------------

STYLE_PROMPTS: dict[str, str] = {
    "modern": (
        "Use a clean, modern aesthetic with sans-serif typography, "
        "subtle gradients, rounded callouts, and ample whitespace."
    ),
    "academic": (
        "Use a formal, academic look with serif fonts, numbered sections, "
        "and classical theorem/proof style callouts."
    ),
    "minimal": (
        "Strip everything to the essentials. Monochrome palette, thin "
        "borders, no decorative elements, pure content-first layout."
    ),
    "colorful": (
        "Vibrant colour palette, playful section badges, gradient headers, "
        "and bold accent colours for highlights and callouts."
    ),
    "dark": (
        "Dark background (#1e1e2e), light text, neon accent colours, "
        "glowing borders, and a cyberpunk-inspired aesthetic."
    ),
    "pastel": (
        "Soft pastel tones (lavender, mint, peach, baby-blue) with "
        "rounded shapes and gentle shadows."
    ),
    "neon": (
        "High-contrast black background with electric neon highlights "
        "(cyan, magenta, lime). Bold borders and glowing text accents."
    ),
    "vintage": (
        "Sepia tones, paper-like textures, serif typography, "
        "ornamental dividers, and old-book styling."
    ),
    "tech": (
        "Monospace fonts, code-block styling, terminal-green accents, "
        "grid layouts, and a developer-focused aesthetic."
    ),
    "organic": (
        "Earth tones (olive, terracotta, sand), hand-drawn-style borders, "
        "rounded organic shapes, and warm, inviting colours."
    ),
}

# ---------------------------------------------------------------------------
# JSON schema string (used both as prompt hint and for validation)
# ---------------------------------------------------------------------------

JSON_SCHEMA = json.dumps(
    {
        "type": "object",
        "required": ["title", "subtitle", "sections"],
        "properties": {
            "title": {"type": "string"},
            "subtitle": {"type": "string"},
            "sections": {
                "type": "array",
                "items": {
                    "oneOf": [
                        {
                            "type": "object",
                            "properties": {
                                "type": {"const": "heading"},
                                "level": {"type": "integer", "minimum": 1, "maximum": 6},
                                "text": {"type": "string"},
                            },
                            "required": ["type", "text"],
                        },
                        {
                            "type": "object",
                            "properties": {
                                "type": {"const": "text"},
                                "content": {"type": "string"},
                            },
                            "required": ["type", "content"],
                        },
                        {
                            "type": "object",
                            "properties": {
                                "type": {"const": "callout"},
                                "title": {"type": "string"},
                                "content": {"type": "string"},
                                "variant": {"type": "string", "enum": ["info", "warning", "success", "tip"]},
                            },
                            "required": ["type", "content"],
                        },
                        {
                            "type": "object",
                            "properties": {
                                "type": {"const": "table"},
                                "headers": {"type": "array", "items": {"type": "string"}},
                                "rows": {"type": "array", "items": {"type": "array", "items": {"type": "string"}}},
                            },
                            "required": ["type"],
                        },
                        {
                            "type": "object",
                            "properties": {
                                "type": {"const": "formula"},
                                "expression": {"type": "string"},
                                "label": {"type": "string"},
                            },
                            "required": ["type", "expression"],
                        },
                        {
                            "type": "object",
                            "properties": {
                                "type": {"const": "highlight"},
                                "content": {"type": "string"},
                                "color": {"type": "string"},
                            },
                            "required": ["type", "content"],
                        },
                        {
                            "type": "object",
                            "properties": {
                                "type": {"const": "list"},
                                "ordered": {"type": "boolean"},
                                "items": {"type": "array", "items": {"type": "string"}},
                            },
                            "required": ["type", "items"],
                        },
                        {
                            "type": "object",
                            "properties": {
                                "type": {"const": "mindmap"},
                                "central_topic": {"type": "string"},
                                "branches": {"type": "array"},
                            },
                            "required": ["type"],
                        },
                        {
                            "type": "object",
                            "properties": {
                                "type": {"const": "flowchart"},
                                "steps": {"type": "array"},
                            },
                            "required": ["type"],
                        },
                        {
                            "type": "object",
                            "properties": {
                                "type": {"const": "timeline"},
                                "events": {"type": "array"},
                            },
                            "required": ["type"],
                        },
                    ]
                },
            },
        },
    },
    indent=2,
)


def build_notes_prompt(extracted_content: str, style: str = "modern") -> list[dict[str, str]]:
    """Return a messages list ready for the LLM."""
    style_instruction = STYLE_PROMPTS.get(style, STYLE_PROMPTS["modern"])
    user_msg = (
        f"{NOTES_DESIGN_PROMPT.format(style_name=style, style_instruction=style_instruction)}\n\n"
        f"Extracted content:\n{extracted_content}\n\n"
        f"JSON Schema:\n{JSON_SCHEMA}"
    )
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]
