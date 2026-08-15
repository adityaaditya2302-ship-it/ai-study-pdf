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

    var provider = document.getElementById('aiProvider');
    var mode = provider ? provider.value : 'hf';

    if (mode === 'local') {
      // Local OCR mode
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
        alert('Error: ' + err.message);
        lastData = getDemoData();
        renderNotes(lastData, currentTheme);
        showState('result');
      });
    } else {
      // AI Vision mode (Hugging Face)
      compressImage(file, 1024).then(function(base64) {
        updateStatus('Sending to AI Vision...');
        return processWithHF(base64, file.type || 'image/jpeg');
      }).then(function(data) {
        lastData = data;
        renderNotes(data, currentTheme);
        showState('result');
      }).catch(function(err) {
        console.error('AI Vision error:', err);
        alert('AI Error: ' + err.message + '\nFalling back to demo notes.');
        lastData = getDemoData();
        renderNotes(lastData, currentTheme);
        showState('result');
      });
    }
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
          // Scale up small images for better OCR
          if (w < 1000) { w = w * 2; h = h * 2; }
          if (w > maxWidth) { h = h * maxWidth / w; w = maxWidth; }
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');

          // Draw image
          ctx.drawImage(img, 0, 0, w, h);

          // Enhance contrast for better OCR
          var imageData = ctx.getImageData(0, 0, w, h);
          var data = imageData.data;
          for (var i = 0; i < data.length; i += 4) {
            // Convert to grayscale
            var gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            // Increase contrast
            gray = ((gray / 255 - 0.5) * 1.5 + 0.5) * 255;
            gray = Math.max(0, Math.min(255, gray));
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
          }
          ctx.putImageData(imageData, 0, 0);

          resolve(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]);
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
          console.log('OCR confidence:', result.data.confidence);
          console.log('OCR text:', text);
          if (text.length < 5) {
            reject(new Error('Could not read text. Try a clearer photo with better lighting.'));
          } else {
            resolve(text);
          }
        }).catch(reject);
      };
      img.onerror = function() { reject(new Error('Failed to load image')); };
      img.src = 'data:image/jpeg;base64,' + base64;
    });
  }

  // ===== HUGGING FACE AI VISION (Free, No API Key) =====
  function processWithHF(base64, mimeType) {
    var prompt = `You are an expert study notes organizer. Analyze this handwritten notebook page image and extract ALL the content accurately.

Return ONLY a valid JSON object with this exact structure:
{
  "title": "Main topic title",
  "subtitle": "Subject area",
  "sections": [
    { "type": "heading", "content": "Section heading" },
    { "type": "text", "content": "Explanation paragraph" },
    { "type": "callout", "variant": "definition", "title": "Definition", "content": "Definition text" },
    { "type": "callout", "variant": "key-concept", "title": "Key Concept", "content": "Important concept" },
    { "type": "callout", "variant": "tip", "title": "Tip", "content": "Helpful tip" },
    { "type": "table", "headers": ["Col1", "Col2"], "rows": [["val1", "val2"]] },
    { "type": "formula", "latex": "LaTeX formula", "label": "Description" },
    { "type": "list", "ordered": false, "items": ["Item 1", "Item 2"] },
    { "type": "highlight", "content": "Important text", "color": "yellow" }
  ]
}

Rules:
- Extract ALL text from the handwritten notes accurately
- Use heading for section titles
- Use text for explanations
- Use callout for definitions and key concepts
- Use table for comparison data
- Use formula for math equations (convert to LaTeX)
- Use list for bullet points
- Preserve the structure and hierarchy
- Return ONLY the JSON object, nothing else`;

    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://router.huggingface.co/v1/chat/completions', true);
      xhr.setRequestHeader('Content-Type', 'application/json');

      var body = JSON.stringify({
        model: 'HuggingFaceH4/llama-3.2-11b-vision-instruct',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: 'data:' + mimeType + ';base64,' + base64 } }
          ]
        }],
        max_tokens: 4096,
        temperature: 0.2
      });

      xhr.onload = function() {
        try {
          var data = JSON.parse(xhr.responseText);
          if (xhr.status !== 200) {
            // Try alternative endpoint
            tryAlternativeHF(base64, mimeType, resolve, reject);
            return;
          }
          var text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '';
          var parsed = parseAIResponse(text);
          resolve(parsed);
        } catch (e) {
          tryAlternativeHF(base64, mimeType, resolve, reject);
        }
      };

      xhr.onerror = function() {
        tryAlternativeHF(base64, mimeType, resolve, reject);
      };

      xhr.send(body);
    });
  }

  function tryAlternativeHF(base64, mimeType, resolve, reject) {
    // Try using the free inference API
    var prompt = `Analyze this handwritten notebook page. Extract ALL content and return ONLY valid JSON:
{
  "title": "Main topic",
  "subtitle": "Subject",
  "sections": [
    { "type": "heading", "content": "Heading" },
    { "type": "text", "content": "Text" },
    { "type": "callout", "variant": "definition", "title": "Definition", "content": "Def" },
    { "type": "callout", "variant": "key-concept", "title": "Key Concept", "content": "Concept" },
    { "type": "table", "headers": ["C1", "C2"], "rows": [["v1", "v2"]] },
    { "type": "formula", "latex": "LaTeX", "label": "Desc" },
    { "type": "list", "ordered": false, "items": ["Item"] },
    { "type": "highlight", "content": "Important", "color": "yellow" }
  ]
}
Extract everything accurately. Return ONLY JSON.`;

    // Use Pollinations.ai free API (no key needed)
    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://text.pollinations.ai/', true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    var imageData = 'data:' + mimeType + ';base64,' + base64;
    var body = JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a helpful assistant that analyzes handwritten notes and returns structured JSON. Return ONLY valid JSON, no markdown.' },
        { role: 'user', content: prompt + '\n\n[Image: ' + imageData.substring(0, 50) + '...]' }
      ],
      model: 'openai',
      jsonMode: true
    });

    xhr.onload = function() {
      try {
        var data = JSON.parse(xhr.responseText);
        var text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || data.content || '';
        var parsed = parseAIResponse(text);
        resolve(parsed);
      } catch (e) {
        // Final fallback: use local OCR
        updateStatus('AI unavailable, using local OCR...');
        runOCR(base64).then(function(text) {
          resolve(structureText(text));
        }).catch(function() {
          resolve(getDemoData());
        });
      }
    };

    xhr.onerror = function() {
      runOCR(base64).then(function(text) {
        resolve(structureText(text));
      }).catch(function() {
        resolve(getDemoData());
      });
    };

    xhr.send(body);
  }

  function parseAIResponse(text) {
    var jsonStr = text.trim();
    // Remove markdown code fences
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    // Try to find JSON object
    var match = jsonStr.match(/\{[\s\S]*\}/);
    if (match) jsonStr = match[0];

    var data = JSON.parse(jsonStr);
    if (!data.title || !data.sections) {
      throw new Error('Invalid response structure');
    }
    return data;
  }

  // ===== TEXT STRUCTURING (Improved) =====
  function structureText(text) {
    var lines = text.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
    var sections = [];
    var title = 'My Study Notes';
    var subtitle = 'Extracted from handwritten notes';

    // Find title (first substantial line)
    for (var i = 0; i < Math.min(5, lines.length); i++) {
      if (lines[i].length > 3 && lines[i].length < 80) {
        title = lines[i];
        if (i + 1 < lines.length && lines[i + 1].length < 60) subtitle = lines[i + 1];
        break;
      }
    }

    // Build sections from remaining lines
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.length < 3) continue;

      // Skip first 2 lines if they're title/subtitle
      if (i < 2 && (line === title || line === subtitle)) continue;

      // 1. HEADING detection (strong signals)
      if (detectHeading(line)) {
        sections.push({ type: 'heading', content: cleanHeading(line) });
        continue;
      }

      // 2. BULLET POINTS
      var bullet = line.match(/^[\-\*•●►▸➤→]\s+(.+)/);
      if (bullet) {
        addToList(sections, bullet[1], false);
        continue;
      }

      // 3. NUMBERED LIST
      var num = line.match(/^\d+[\.\)]\s+(.+)/);
      if (num) {
        addToList(sections, num[1], true);
        continue;
      }

      // 4. FORMULA / EQUATION detection
      if (detectFormula(line)) {
        sections.push({ type: 'callout', variant: 'tip', title: 'Formula', content: line });
        continue;
      }

      // 5. DEFINITION detection
      if (detectDefinition(line)) {
        sections.push({ type: 'callout', variant: 'definition', title: 'Definition', content: line });
        continue;
      }

      // 6. KEY CONCEPT / IMPORTANT detection
      if (detectKeyConcept(line)) {
        sections.push({ type: 'callout', variant: 'key-concept', title: 'Key Concept', content: line });
        continue;
      }

      // 7. EXAMPLE detection
      if (detectExample(line)) {
        sections.push({ type: 'callout', variant: 'example', title: 'Example', content: line });
        continue;
      }

      // 8. REGULAR TEXT
      sections.push({ type: 'text', content: line });
    }

    // Merge consecutive text into paragraphs
    sections = mergeTextParagraphs(sections);

    if (sections.length === 0) {
      sections.push({ type: 'text', content: text });
    }

    return { title: title, subtitle: subtitle, sections: sections };
  }

  function detectHeading(line) {
    // ALL CAPS (but not too long)
    if (line === line.toUpperCase() && line.length > 2 && line.length < 50) return true;
    // Ends with colon and is short
    if (line.endsWith(':') && line.length < 50) return true;
    // Numbered heading like "1. Introduction"
    if (/^\d+[\.\)]\s+[A-Z]/.test(line) && line.length < 50) return true;
    // Starts with common heading words
    if (/^(chapter|section|part|topic|introduction|conclusion|summary|definition|example|note|important|key|formula|equation|theorem|proof|problem|solution|result|answer)/i.test(line)) return true;
    // Short line with first letter capitalized and no period at end
    if (line.length < 30 && /^[A-Z]/.test(line) && !line.endsWith('.') && !line.endsWith(',')) return true;
    return false;
  }

  function cleanHeading(line) {
    return line.replace(/:$/, '').replace(/^\d+[\.\)]\s*/, '').trim();
  }

  function detectFormula(line) {
    // Contains math symbols
    if (/[=+\-×÷∑∫√∞≈≠≤≥≥→←↔±×÷%‰]/.test(line) && line.length < 100) return true;
    // Contains subscripts/superscripts patterns like H2O, CO2
    if (/[A-Z][a-z]?\d/.test(line) && line.length < 60) return true;
    // Contains common formula patterns
    if (/\d+\s*[+\-×÷=]\s*\d+/.test(line)) return true;
    return false;
  }

  function detectDefinition(line) {
    var patterns = [
      /\b(is defined as|is the process|is the|means|refers to|can be defined|is a|is an|is when|is where|describes|involves)\b/i,
      /^.{20,80}\.$/  // Long sentence ending with period
    ];
    // Must be a substantial sentence
    if (line.length > 30 && line.length < 200) {
      for (var i = 0; i < patterns.length; i++) {
        if (patterns[i].test(line)) return true;
      }
    }
    return false;
  }

  function detectKeyConcept(line) {
    var keywords = /\b(important|key|note that|remember|essential|crucial|fundamental|main idea|principle|concept)\b/i;
    return keywords.test(line) && line.length > 20;
  }

  function detectExample(line) {
    return /^(for example|e\.g\.|such as|instance|e\.g|example:|eg:)/i.test(line);
  }

  function addToList(sections, item, ordered) {
    var last = sections[sections.length - 1];
    if (last && last.type === 'list' && last.ordered === ordered) {
      last.items.push(item);
    } else {
      sections.push({ type: 'list', ordered: ordered, items: [item] });
    }
  }

  function mergeTextParagraphs(sections) {
    var result = [];
    var textBuf = '';
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      if (s.type === 'text') {
        if (textBuf) textBuf += ' ';
        textBuf += s.content;
      } else {
        if (textBuf) {
          result.push({ type: 'text', content: textBuf });
          textBuf = '';
        }
        result.push(s);
      }
    }
    if (textBuf) result.push({ type: 'text', content: textBuf });
    return result;
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
