/**
 * AI Study PDF Note Rendering Engine
 * Converts structured JSON data into beautiful HTML notes.
 */

const CALLOUT_ICONS = {
  definition: '📖',
  'key-concept': '💡',
  warning: '⚠️',
  tip: '✨',
  example: '📝',
};

const CALLOUT_CLASSES = {
  definition: 'callout-definition',
  'key-concept': 'callout-key-concept',
  warning: 'callout-warning',
  tip: 'callout-tip',
  example: 'callout-example',
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderTitle(data) {
  const title = escapeHtml(data.title || '');
  const subtitle = escapeHtml(data.subtitle || '');

  let html = '<header class="note-title-block">';
  html += '<div class="note-title-deco-top"></div>';
  html += `<h1 class="note-title">${title}</h1>`;
  if (subtitle) {
    html += `<p class="note-subtitle">${subtitle}</p>`;
  }
  html += '<div class="note-title-deco-bottom"></div>';
  html += '</header>';
  return html;
}

function renderHeading(section) {
  const content = escapeHtml(section.content || '');
  return `<h2 class="note-heading">${content}</h2>`;
}

function renderText(section) {
  const content = escapeHtml(section.content || '');
  return `<p class="note-text">${content}</p>`;
}

function renderCallout(section) {
  const variant = section.variant || 'tip';
  const icon = CALLOUT_ICONS[variant] || '💡';
  const variantClass = CALLOUT_CLASSES[variant] || 'callout-tip';
  const title = escapeHtml(section.title || '');
  const content = escapeHtml(section.content || '');

  let html = `<div class="note-callout ${variantClass}" data-variant="${escapeHtml(variant)}">`;
  html += '<div class="callout-header">';
  html += `<span class="callout-icon">${icon}</span>`;
  if (title) {
    html += `<span class="callout-title">${title}</span>`;
  }
  html += '</div>';
  html += `<div class="callout-content">${content}</div>`;
  html += '</div>';
  return html;
}

function renderTable(section) {
  const headers = section.headers || [];
  const rows = section.rows || [];

  let html = '<div class="note-table-wrapper">';
  html += '<table class="note-table">';

  if (headers.length > 0) {
    html += '<thead><tr>';
    headers.forEach(function (h) {
      html += `<th class="note-th">${escapeHtml(h)}</th>`;
    });
    html += '</tr></thead>';
  }

  if (rows.length > 0) {
    html += '<tbody>';
    rows.forEach(function (row) {
      html += '<tr>';
      row.forEach(function (cell) {
        html += `<td class="note-td">${escapeHtml(cell)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody>';
  }

  html += '</table>';
  html += '</div>';
  return html;
}

function renderFormula(section) {
  const latex = section.latex || '';
  const label = escapeHtml(section.label || '');

  let html = '<div class="note-formula-block" data-latex="' + escapeHtml(latex) + '">';
  html += '<div class="formula-content" id="formula-' + Math.random().toString(36).slice(2, 9) + '">';

  if (typeof window !== 'undefined' && window.katex && window.katex.renderToString) {
    try {
      html += window.katex.renderToString(latex, {
        throwOnError: false,
        displayMode: true,
      });
    } catch (e) {
      html += '<code class="formula-raw">' + escapeHtml(latex) + '</code>';
    }
  } else {
    html += '<code class="formula-raw">' + escapeHtml(latex) + '</code>';
  }

  html += '</div>';
  if (label) {
    html += `<span class="formula-label">${label}</span>`;
  }
  html += '</div>';
  return html;
}

function renderHighlight(section) {
  const content = escapeHtml(section.content || '');
  const color = section.color || 'yellow';
  return `<mark class="note-highlight highlight-${escapeHtml(color)}" data-color="${escapeHtml(color)}">${content}</mark>`;
}

function renderList(section) {
  const items = section.items || [];
  const ordered = section.ordered;
  const tag = ordered ? 'ol' : 'ul';
  const listClass = ordered ? 'note-list note-list-ordered' : 'note-list note-list-unordered';

  let html = `<${tag} class="${listClass}">`;
  items.forEach(function (item) {
    html += `<li class="note-list-item">${escapeHtml(item)}</li>`;
  });
  html += `</${tag}>`;
  return html;
}

function renderMindmap(section) {
  const root = escapeHtml(section.root || 'Root');
  const children = section.children || [];

  let mermaid = 'mindmap\n';
  mermaid += `  root((${root}))\n`;

  children.forEach(function (child) {
    const label = escapeHtml(child.label || '');
    mermaid += `    ${label}\n`;
    if (child.sub && Array.isArray(child.sub)) {
      child.sub.forEach(function (s) {
        mermaid += `      ${escapeHtml(s)}\n`;
      });
    }
  });

  let html = '<div class="note-mindmap">';
  html += `<div class="mermaid">${mermaid}</div>`;
  html += '</div>';
  return html;
}

function renderFlowchart(section) {
  const steps = section.steps || [];

  let mermaid = 'flowchart TD\n';
  steps.forEach(function (step, i) {
    const id = 'A' + (i + 1);
    const nextId = i < steps.length - 1 ? 'A' + (i + 2) : null;
    mermaid += `  ${id}["${escapeHtml(step)}"]\n`;
    if (nextId) {
      mermaid += `  ${id} --> ${nextId}\n`;
    }
  });

  let html = '<div class="note-flowchart">';
  html += `<div class="mermaid">${mermaid}</div>`;
  html += '</div>';
  return html;
}

function renderTimeline(section) {
  const events = section.events || [];

  let html = '<div class="note-timeline">';
  events.forEach(function (evt, i) {
    const time = escapeHtml(evt.time || '');
    const event = escapeHtml(evt.event || '');
    html += '<div class="timeline-item">';
    html += '<div class="timeline-marker">';
    html += '<div class="timeline-dot"></div>';
    if (i < events.length - 1) {
      html += '<div class="timeline-line"></div>';
    }
    html += '</div>';
    html += '<div class="timeline-content">';
    if (time) {
      html += `<span class="timeline-time">${time}</span>`;
    }
    html += `<span class="timeline-event">${event}</span>`;
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function renderSection(section) {
  if (!section || !section.type) return '';

  switch (section.type) {
    case 'heading':
    case 'h2':
      return renderHeading(section);
    case 'text':
      return renderText(section);
    case 'callout':
      return renderCallout(section);
    case 'table':
      return renderTable(section);
    case 'formula':
      return renderFormula(section);
    case 'highlight':
      return renderHighlight(section);
    case 'list':
      return renderList(section);
    case 'mindmap':
      return renderMindmap(section);
    case 'flowchart':
      return renderFlowchart(section);
    case 'timeline':
      return renderTimeline(section);
    default:
      return '';
  }
}

function renderNotes(data, theme) {
  if (!data) return '<div class="notes-container notes-empty"></div>';

  theme = theme || 'minimal';
  const sections = data.sections || [];

  let html = `<div class="notes-container notes-theme-${escapeHtml(theme)}" data-theme="${escapeHtml(theme)}">`;
  html += renderTitle(data);

  html += '<main class="note-body">';
  sections.forEach(function (section) {
    html += renderSection(section);
  });
  html += '</main>';

  html += '<footer class="note-footer"></footer>';
  html += '</div>';

  return html;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderNotes: renderNotes,
    renderTitle: renderTitle,
    renderSection: renderSection,
    renderCallout: renderCallout,
    renderTable: renderTable,
    renderFormula: renderFormula,
    renderHighlight: renderHighlight,
    renderList: renderList,
    renderMindmap: renderMindmap,
    renderFlowchart: renderFlowchart,
    renderTimeline: renderTimeline,
  };
}
