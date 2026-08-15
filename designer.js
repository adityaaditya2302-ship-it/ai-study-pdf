/* AI Study PDF — Designer App (Complete Rewrite) */
document.addEventListener('DOMContentLoaded', function() {

  // DOM Elements
  var uploadZone = document.getElementById('uploadZone');
  var fileInput = document.getElementById('fileInput');
  var cameraBtn = document.getElementById('cameraBtn');
  var stateUpload = document.getElementById('stateUpload');
  var stateProcessing = document.getElementById('stateProcessing');
  var stateResult = document.getElementById('stateResult');
  var processingStatus = document.getElementById('processingStatus');
  var notesContainer = document.getElementById('notesContainer');
  var notesPreview = document.getElementById('notesPreview');
  var styleGrid = document.getElementById('styleGrid');
  var previewThemeName = document.getElementById('previewThemeName');
  var exportPdf = document.getElementById('exportPdf');
  var exportHtml = document.getElementById('exportHtml');
  var exportMd = document.getElementById('exportMd');
  var btnNewUpload = document.getElementById('btnNewUpload');
  var btnZoomIn = document.getElementById('btnZoomIn');
  var btnZoomOut = document.getElementById('btnZoomOut');
  var btnReset = document.getElementById('btnReset');

  var currentTheme = 'minimal';
  var uploadedFile = null;
  var lastData = null;

  // ===== FILE UPLOAD =====
  if (uploadZone) {
    uploadZone.onclick = function() {
      if (fileInput) fileInput.click();
    };
  }

  if (fileInput) {
    fileInput.onchange = function(e) {
      if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
      }
    };
  }

  // Drag and drop
  if (uploadZone) {
    uploadZone.ondragover = function(e) { e.preventDefault(); uploadZone.classList.add('drag-over'); };
    uploadZone.ondragleave = function() { uploadZone.classList.remove('drag-over'); };
    uploadZone.ondrop = function(e) {
      e.preventDefault();
      uploadZone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    };
  }

  // Camera
  if (cameraBtn) {
    cameraBtn.onclick = function() {
      var cam = document.createElement('input');
      cam.type = 'file';
      cam.accept = 'image/*';
      cam.capture = 'environment';
      cam.onchange = function(e) {
        if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
      };
      cam.click();
    };
  }

  function handleFile(file) {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      alert('Please upload an image file (JPG, PNG)');
      return;
    }
    uploadedFile = file;

    // Show preview
    var reader = new FileReader();
    reader.onload = function(e) {
      if (uploadZone) {
        uploadZone.innerHTML = '<div class="upload-preview">' +
          '<img src="' + e.target.result + '" class="preview-img">' +
          '<p class="preview-filename">' + file.name + '</p>' +
          '<button onclick="event.stopPropagation();location.reload()" class="preview-remove">✕ Remove</button>' +
          '</div>';
      }
    };
    reader.readAsDataURL(file);

    // Start processing
    processImage(file);
  }

  // ===== PROCESSING =====
  function processImage(file) {
    showState('processing');
    updateStatus('Preparing image...');

    // Compress and send to OCR
    compressImage(file, 1024).then(function(base64) {
      updateStatus('Reading handwriting...');
      return runOCR(base64);
    }).then(function(text) {
      updateStatus('Creating beautiful notes...');
      var data = structureText(text);
      lastData = data;
      renderNotes(data, currentTheme);
      showState('result');
    }).catch(function(err) {
      console.error(err);
      alert('Error: ' + err.message + '\nUsing demo notes instead.');
      lastData = getDemoData();
      renderNotes(lastData, currentTheme);
      showState('result');
    });
  }

  function updateStatus(msg) {
    if (processingStatus) processingStatus.textContent = msg;
  }

  function compressImage(file, maxWidth) {
    return new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
          var canvas = document.createElement('canvas');
          var w = img.width, h = img.height;
          if (w > maxWidth) { h = h * maxWidth / w; w = maxWidth; }
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function runOCR(base64) {
    return new Promise(function(resolve, reject) {
      if (typeof Tesseract === 'undefined') {
        reject(new Error('OCR engine not loaded. Check your internet connection.'));
        return;
      }

      // Create a temporary image for Tesseract
      var img = new Image();
      img.onload = function() {
        Tesseract.recognize(img, 'eng', {
          logger: function(m) {
            if (m.status === 'recognizing text' && processingStatus) {
              processingStatus.textContent = 'Reading... ' + Math.round(m.progress * 100) + '%';
            }
          }
        }).then(function(result) {
          var text = result.data.text.trim();
          if (text.length < 5) {
            reject(new Error('Could not read text. Try a clearer photo.'));
          } else {
            resolve(text);
          }
        }).catch(reject);
      };
      img.onerror = function() { reject(new Error('Failed to load image')); };
      img.src = 'data:image/jpeg;base64,' + base64;
    });
  }

  // ===== TEXT STRUCTURING =====
  function structureText(text) {
    var lines = text.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
    var sections = [];
    var title = lines.length > 0 ? lines[0].substring(0, 60) : 'My Study Notes';
    var subtitle = lines.length > 1 ? lines[1].substring(0, 60) : 'OCR Extracted';

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.length < 3) continue;

      // Heading detection
      if (isHeading(line)) {
        sections.push({ type: 'heading', content: cleanLine(line) });
        continue;
      }

      // Bullet point
      var bullet = line.match(/^[\-\*•●►▸]\s+(.+)/);
      if (bullet) {
        addToList(sections, bullet[1], false);
        continue;
      }

      // Numbered list
      var num = line.match(/^\d+[\.\)]\s+(.+)/);
      if (num) {
        addToList(sections, num[1], true);
        continue;
      }

      // Formula
      if (/[=+\-×÷∑∫√∞≈≠≤≥αβγδε]/.test(line) && line.length < 80) {
        sections.push({ type: 'callout', variant: 'tip', title: 'Formula', content: line });
        continue;
      }

      // Regular text
      sections.push({ type: 'text', content: line });
    }

    if (sections.length === 0) {
      sections.push({ type: 'text', content: text });
    }

    return { title: title, subtitle: subtitle, sections: sections };
  }

  function isHeading(line) {
    if (line === line.toUpperCase() && line.length > 3 && line.length < 60) return true;
    if (line.endsWith(':') && line.length < 60) return true;
    if (/^\d+\.\s+[A-Z]/.test(line) && line.length < 60) return true;
    if (/^(chapter|section|part|topic|introduction|conclusion|summary|definition|example|note|important)/i.test(line)) return true;
    return false;
  }

  function cleanLine(line) {
    return line.replace(/:$/, '').replace(/^[\d]+\.\s*/, '').trim();
  }

  function addToList(sections, item, ordered) {
    var last = sections[sections.length - 1];
    if (last && last.type === 'list' && last.ordered === ordered) {
      last.items.push(item);
    } else {
      sections.push({ type: 'list', ordered: ordered, items: [item] });
    }
  }

  // ===== RENDERING =====
  function renderNotes(data, theme) {
    if (typeof window.renderNotes === 'function') {
      var html = window.renderNotes(data, theme);
      if (notesContainer) notesContainer.innerHTML = html;
      if (notesPreview) notesPreview.innerHTML = html;
    } else {
      var html = fallbackRender(data);
      if (notesContainer) notesContainer.innerHTML = html;
      if (notesPreview) notesPreview.innerHTML = html;
    }
  }

  function fallbackRender(data) {
    var h = '<div class="note-title-block"><h1 class="note-title">' + esc(data.title) + '</h1>';
    if (data.subtitle) h += '<p class="note-subtitle">' + esc(data.subtitle) + '</p>';
    h += '</div><main class="note-body">';

    if (data.sections) {
      data.sections.forEach(function(s) {
        if (s.type === 'heading') h += '<h2 class="note-heading">' + esc(s.content) + '</h2>';
        else if (s.type === 'text') h += '<p class="note-text">' + esc(s.content) + '</p>';
        else if (s.type === 'callout') h += '<div class="note-callout callout-' + (s.variant || 'tip') + '"><strong>' + esc(s.title || 'Note') + ':</strong> ' + esc(s.content) + '</div>';
        else if (s.type === 'list') {
          var tag = s.ordered ? 'ol' : 'ul';
          h += '<' + tag + ' class="note-list">';
          s.items.forEach(function(item) { h += '<li>' + esc(item) + '</li>'; });
          h += '</' + tag + '>';
        }
        else if (s.type === 'table') {
          h += '<table class="note-table"><thead><tr>';
          s.headers.forEach(function(hdr) { h += '<th class="note-th">' + esc(hdr) + '</th>'; });
          h += '</tr></thead><tbody>';
          s.rows.forEach(function(row) {
            h += '<tr>';
            row.forEach(function(cell) { h += '<td class="note-td">' + esc(cell) + '</td>'; });
            h += '</tr>';
          });
          h += '</tbody></table>';
        }
        else if (s.type === 'formula') h += '<div class="note-formula-block"><code>' + esc(s.latex || s.content) + '</code></div>';
        else if (s.type === 'highlight') h += '<mark class="note-highlight">' + esc(s.content) + '</mark>';
      });
    }
    h += '</main>';
    return h;
  }

  function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ===== STATE MANAGEMENT =====
  function showState(state) {
    if (stateUpload) stateUpload.classList.toggle('hidden', state !== 'upload');
    if (stateProcessing) stateProcessing.classList.toggle('hidden', state !== 'processing');
    if (stateResult) stateResult.classList.toggle('hidden', state !== 'result');
  }

  // ===== THEME SELECTION =====
  if (styleGrid) {
    styleGrid.onclick = function(e) {
      var btn = e.target.closest('.style-btn');
      if (!btn) return;
      currentTheme = btn.dataset.theme;
      styleGrid.querySelectorAll('.style-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      if (previewThemeName) previewThemeName.textContent = currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1);
      if (lastData) renderNotes(lastData, currentTheme);
    };
  }

  // ===== ZOOM =====
  var zoom = 1;
  if (btnZoomIn) btnZoomIn.onclick = function() { zoom = Math.min(2, zoom + 0.1); applyZoom(); };
  if (btnZoomOut) btnZoomOut.onclick = function() { zoom = Math.max(0.5, zoom - 0.1); applyZoom(); };
  if (btnReset) btnReset.onclick = function() { zoom = 1; applyZoom(); };

  function applyZoom() {
    var canvas = document.getElementById('resultCanvas');
    if (canvas) { canvas.style.transform = 'scale(' + zoom + ')'; canvas.style.transformOrigin = 'top center'; }
  }

  // ===== NEW UPLOAD =====
  if (btnNewUpload) {
    btnNewUpload.onclick = function() {
      uploadedFile = null;
      lastData = null;
      location.reload();
    };
  }

  // ===== EXPORT =====
  if (exportPdf) exportPdf.onclick = function() {
    var win = window.open('', '_blank');
    var content = notesContainer ? notesContainer.innerHTML : '';
    win.document.write('<html><head><title>Notes</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Caveat:wght@400;700&display=swap"><link rel="stylesheet" href="designer.css"><link rel="stylesheet" href="styles/' + currentTheme + '-notes.css"></head><body style="padding:40px;max-width:800px;margin:0 auto;font-family:Inter,sans-serif"><div class="notes-container notes-theme-' + currentTheme + '">' + content + '</div><script>window.onload=function(){window.print();window.close()}<\/script></body></html>');
    win.document.close();
  };

  if (exportHtml) exportHtml.onclick = function() {
    var content = notesContainer ? notesContainer.innerHTML : '';
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AI Study Notes</title><link rel="stylesheet" href="designer.css"><link rel="stylesheet" href="styles/' + currentTheme + '-notes.css"></head><body><div class="notes-container notes-theme-' + currentTheme + '">' + content + '</div></body></html>';
    downloadFile(html, 'notes.html', 'text/html');
  };

  if (exportMd) exportMd.onclick = function() {
    var md = '# ' + (lastData ? lastData.title : 'Notes') + '\n\n';
    if (lastData && lastData.sections) {
      lastData.sections.forEach(function(s) {
        if (s.type === 'heading') md += '## ' + s.content + '\n\n';
        else if (s.type === 'text') md += s.content + '\n\n';
        else if (s.type === 'callout') md += '> **' + (s.title || 'Note') + ':** ' + s.content + '\n\n';
        else if (s.type === 'list') s.items.forEach(function(i) { md += '- ' + i + '\n'; });
        md += '\n';
      });
    }
    downloadFile(md, 'notes.md', 'text/markdown');
  };

  function downloadFile(content, filename, type) {
    var blob = new Blob([content], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ===== THEME TOGGLE =====
  var themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.onclick = function() {
      var html = document.documentElement;
      var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
    };
  }

  // ===== DEMO DATA =====
  function getDemoData() {
    return {
      title: "🌿 Photosynthesis",
      subtitle: "How Plants Make Food",
      sections: [
        { type: "heading", content: "What is Photosynthesis?" },
        { type: "text", content: "Photosynthesis is the process by which green plants convert light energy into chemical energy (glucose) using carbon dioxide and water." },
        { type: "callout", variant: "definition", title: "Definition", content: "The process of converting light energy into chemical energy using CO₂ and H₂O, releasing O₂ as a byproduct." },
        { type: "heading", content: "Chemical Equation" },
        { type: "formula", latex: "6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂" },
        { type: "heading", content: "Two Main Stages" },
        { type: "callout", variant: "key-concept", title: "Key Concept", content: "Light reactions occur in thylakoid membranes. Calvin Cycle occurs in the stroma." },
        { type: "table", headers: ["Feature", "Light Reactions", "Calvin Cycle"], rows: [["Location", "Thylakoid", "Stroma"], ["Input", "Light, H₂O", "CO₂, ATP"], ["Output", "ATP, NADPH", "Glucose"]] },
        { type: "heading", content: "Factors" },
        { type: "list", ordered: false, items: ["Light intensity", "CO₂ concentration", "Temperature", "Water availability"] }
      ]
    };
  }

  // Init
  showState('upload');
});
