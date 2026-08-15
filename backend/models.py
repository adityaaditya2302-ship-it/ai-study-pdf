"""Pydantic models for the AI Study PDF backend."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class SectionType(str, Enum):
    HEADING = "heading"
    TEXT = "text"
    CALLOUT = "callout"
    TABLE = "table"
    FORMULA = "formula"
    HIGHLIGHT = "highlight"
    LIST = "list"
    MINDMAP = "mindmap"
    FLOWCHART = "flowchart"
    TIMELINE = "timeline"


class ExportFormat(str, Enum):
    PDF = "pdf"
    HTML = "html"
    MARKDOWN = "md"


# ---------------------------------------------------------------------------
# Section variants
# ---------------------------------------------------------------------------

class HeadingSection(BaseModel):
    type: SectionType = SectionType.HEADING
    level: int = Field(1, ge=1, le=6)
    text: str


class TextSection(BaseModel):
    type: SectionType = SectionType.TEXT
    content: str


class CalloutSection(BaseModel):
    type: SectionType = SectionType.CALLOUT
    title: str = ""
    content: str
    variant: str = "info"  # info | warning | success | tip


class TableSection(BaseModel):
    type: SectionType = SectionType.TABLE
    headers: list[str] = Field(default_factory=list)
    rows: list[list[str]] = Field(default_factory=list)


class FormulaSection(BaseModel):
    type: SectionType = SectionType.FORMULA
    expression: str
    label: str = ""


class HighlightSection(BaseModel):
    type: SectionType = SectionType.HIGHLIGHT
    content: str
    color: str = "#fef9c3"


class ListSection(BaseModel):
    type: SectionType = SectionType.LIST
    ordered: bool = False
    items: list[str] = Field(default_factory=list)


class MindmapSection(BaseModel):
    type: SectionType = SectionType.MINDMAP
    central_topic: str = ""
    branches: list[dict[str, Any]] = Field(default_factory=list)


class FlowchartSection(BaseModel):
    type: SectionType = SectionType.FLOWCHART
    steps: list[dict[str, Any]] = Field(default_factory=list)


class TimelineSection(BaseModel):
    type: SectionType = SectionType.TIMELINE
    events: list[dict[str, Any]] = Field(default_factory=list)


# Union of all section types for NoteData
NoteSection = (
    HeadingSection
    | TextSection
    | CalloutSection
    | TableSection
    | FormulaSection
    | HighlightSection
    | ListSection
    | MindmapSection
    | FlowchartSection
    | TimelineSection
)


# ---------------------------------------------------------------------------
# Note data container
# ---------------------------------------------------------------------------

class NoteData(BaseModel):
    title: str
    subtitle: str = ""
    style: str = "modern"
    sections: list[NoteSection] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Processing
# ---------------------------------------------------------------------------

class ProcessingRequest(BaseModel):
    file_id: str
    style: str = "modern"
    mock: bool = False


class ProcessingResponse(BaseModel):
    success: bool
    note_data: NoteData | None = None
    error: str | None = None
    processing_time_ms: float = 0


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

class ExportRequest(BaseModel):
    html_content: str
    format: ExportFormat = ExportFormat.PDF


class ExportResponse(BaseModel):
    success: bool
    file_path: str | None = None
    filename: str | None = None
    error: str | None = None


# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------

class StyleInfo(BaseModel):
    id: str
    name: str
    description: str
    color: str


# ---------------------------------------------------------------------------
# WebSocket messages
# ---------------------------------------------------------------------------

class WSMessage(BaseModel):
    event: str  # status | progress | result | error
    data: Any = None
