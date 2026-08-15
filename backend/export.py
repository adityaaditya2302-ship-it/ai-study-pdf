"""Export helpers: PDF, HTML, and Markdown generation."""

from __future__ import annotations

import logging
import re
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

OUTPUT_DIR = Path(tempfile.gettempdir()) / "ai_study_pdf_exports"
OUTPUT_DIR.mkdir(exist_ok=True)


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------

def export_to_pdf(html_content: str, filename: str = "notes.pdf") -> Path:
    """Convert *html_content* to a PDF file.

    Tries WeasyPrint first; falls back to a headless browser hint.
    """
    out = OUTPUT_DIR / filename

    try:
        from weasyprint import HTML  # type: ignore[import-untyped]

        HTML(string=html_content).write_pdf(out)
        logger.info("PDF exported via WeasyPrint → %s", out)
        return out
    except ImportError:
        logger.info("WeasyPrint unavailable – writing raw HTML for browser print")

    # Fallback: save as .html with print-ready styling so the user can
    # Ctrl-P in their browser.
    fallback = out.with_suffix(".html")
    wrapped = _wrap_print_html(html_content)
    fallback.write_text(wrapped, encoding="utf-8")
    logger.info("PDF fallback HTML saved → %s", fallback)
    return fallback


# ---------------------------------------------------------------------------
# HTML
# ---------------------------------------------------------------------------

def export_to_html(html_content: str, filename: str = "notes.html") -> Path:
    """Wrap *html_content* in a standalone HTML document with inline styles."""
    out = OUTPUT_DIR / filename
    full = _wrap_standalone_html(html_content)
    out.write_text(full, encoding="utf-8")
    logger.info("HTML exported → %s", out)
    return out


# ---------------------------------------------------------------------------
# Markdown
# ---------------------------------------------------------------------------

def export_to_markdown(html_content: str, filename: str = "notes.md") -> Path:
    """Best-effort HTML → Markdown conversion."""
    out = OUTPUT_DIR / filename
    md = _html_to_markdown(html_content)
    out.write_text(md, encoding="utf-8")
    logger.info("Markdown exported → %s", out)
    return out


# ---------------------------------------------------------------------------
# HTML wrapping helpers
# ---------------------------------------------------------------------------

_STANDALONE_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>AI Study Notes</title>
<style>
  :root {{
    --bg: #f8fafc; --fg: #1e293b; --accent: #6366f1;
    --card-bg: #fff; --border: #e2e8f0;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'Inter', system-ui, sans-serif; background: var(--bg); color: var(--fg); line-height: 1.6; padding: 2rem; max-width: 900px; margin: 0 auto; }}
  h1 {{ font-size: 2rem; margin-bottom: 0.25rem; }}
  h2 {{ font-size: 1.5rem; margin-top: 2rem; border-bottom: 2px solid var(--accent); padding-bottom: 0.3rem; }}
  h3 {{ font-size: 1.2rem; margin-top: 1.5rem; color: var(--accent); }}
  p {{ margin: 0.75rem 0; }}
  table {{ width: 100%; border-collapse: collapse; margin: 1rem 0; }}
  th, td {{ border: 1px solid var(--border); padding: 0.5rem 0.75rem; text-align: left; }}
  th {{ background: var(--accent); color: #fff; }}
  .callout {{ border-left: 4px solid var(--accent); padding: 1rem; margin: 1rem 0; background: #eef2ff; border-radius: 0 8px 8px 0; }}
  .formula {{ background: #f1f5f9; padding: 0.75rem 1rem; border-radius: 6px; font-family: 'Fira Code', monospace; margin: 0.75rem 0; overflow-x: auto; }}
  .highlight {{ background: #fef9c3; padding: 0.5rem 0.75rem; border-radius: 4px; }}
  ul, ol {{ margin: 0.5rem 0 0.5rem 1.5rem; }}
  li {{ margin: 0.25rem 0; }}
  @media print {{
    body {{ padding: 0; max-width: none; }}
    .callout {{ break-inside: avoid; }}
  }}
</style>
</head>
<body>
{body}
</body>
</html>"""

_PRINT_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>AI Study Notes — Print</title>
<style>
  body {{ font-family: 'Inter', system-ui, sans-serif; line-height: 1.6; padding: 1cm; max-width: 210mm; margin: 0 auto; }}
  @media print {{ body {{ padding: 0; }} }}
</style>
</head>
<body>
{body}
<script>window.onload = () => window.print();</script>
</body>
</html>"""


def _wrap_standalone_html(body: str) -> str:
    return _STANDALONE_TEMPLATE.format(body=body)


def _wrap_print_html(body: str) -> str:
    return _PRINT_TEMPLATE.format(body=body)


# ---------------------------------------------------------------------------
# HTML → Markdown converter (lightweight, no external deps)
# ---------------------------------------------------------------------------

def _html_to_markdown(html: str) -> str:
    """Minimal HTML → Markdown conversion."""
    text = html

    # Headings
    for i in range(6, 0, -1):
        text = re.sub(rf"<h{i}[^>]*>(.*?)</h{i}>", lambda m, lv=i: f"\n{'#' * lv} {m.group(1).strip()}\n", text, flags=re.S)

    # Bold / italic
    text = re.sub(r"<(?:strong|b)>(.*?)</(?:strong|b)>", r"**\1**", text, flags=re.S)
    text = re.sub(r"<(?:em|i)>(.*?)</(?:em|i)>", r"*\1*", text, flags=re.S)

    # Paragraphs
    text = re.sub(r"<p[^>]*>(.*?)</p>", r"\n\1\n", text, flags=re.S)

    # Lists
    text = re.sub(r"<li[^>]*>(.*?)</li>", r"- \1", text, flags=re.S)
    text = re.sub(r"</?[uo]l[^>]*>", "", text)

    # Tables (basic)
    text = re.sub(r"<th[^>]*>(.*?)</th>", r"| \1 ", text, flags=re.S)
    text = re.sub(r"<td[^>]*>(.*?)</td>", r"| \1 ", text, flags=re.S)
    text = re.sub(r"<tr[^>]*>(.*?)</tr>", r"\1|\n", text, flags=re.S)
    text = re.sub(r"</?t(?:able|head|body)[^>]*>", "", text)

    # Remove remaining tags
    text = re.sub(r"<[^>]+>", "", text)

    # Decode common entities
    for ent, char in {"&amp;": "&", "&lt;": "<", "&gt;": ">", "&nbsp;": " ", "&quot;": '"'}.items():
        text = text.replace(ent, char)

    # Collapse whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() + "\n"
