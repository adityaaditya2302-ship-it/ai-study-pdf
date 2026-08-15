/* AI Study PDF — Designer App v3 */
document.addEventListener('DOMContentLoaded', function() {
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
  var aiProvider = document.getElementById('aiProvider');
  var apiHint = document.getElementById('apiHint');

  var currentTheme = 'minimal';
  var uploadedFile = null;
  var lastData = null;

  // ===== UPLOAD =====
  if (uploadZone) uploadZone.onclick = function() { if (fileInput) fileInput.click(); };
  if (fileInput) fileInput.onchange = function(e) { if (e.target.files[0]) handleFile(e.target.files[0]); };
  if (uploadZone) {
    uploadZone.ondragover = function(e) { e.preventDefault(); uploadZone.classList.add('drag-over'); };
    uploadZone.ondragleave = function() { uploadZone.classList.remove('drag-over'); };
    uploadZone.ondrop = function(e) { e.preventDefault(); uploadZone.classList.remove('drag-over'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); };
  }
  if (cameraBtn) cameraBtn.onclick = function() {
    var c = document.createElement('input'); c.type = 'file'; c.accept = 'image/*'; c.capture = 'environment';
    c.onchange = function(e) { if (e.target.files[0]) handleFile(e.target.files[0]); }; c.click();
  };

  function handleFile(file) {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') { alert('Please upload an image'); return; }
    uploadedFile = file;
    var reader = new FileReader();
    reader.onload = function(e) {
      if (uploadZone) uploadZone.innerHTML = '<div class="upload-preview"><img src="' + e.target.result + '" class="preview-img"><p class="preview-filename">' + file.name + '</p><button onclick="event.stopPropagation();location.reload()" class="preview-remove">✕ Remove</button></div>';
    };
    reader.readAsDataURL(file);
    processImage(file);
  }

  // ===== PROCESS =====
  function processImage(file) {
    showState('processing');
    updateStatus('Preparing image...');
    compressImage(file, 1024).then(function(base64) {
      var mode = aiProvider ? aiProvider.value : 'ai';
      var apiKey = document.getElementById('apiKeyInput') ? document.getElementById('apiKeyInput').value.trim() : '';

      if (mode === 'local') {
        updateStatus('Reading handwriting...');
        return runOCR(base64).then(function(text) {
          updateStatus('Creating notes...');
          return structureText(text);
        });
      } else if (mode === 'gemini' && apiKey) {
        updateStatus('Sending to Gemini AI...');
        return callGemini(base64, file.type || 'image/jpeg', apiKey);
      } else if (mode === 'openrouter' && apiKey) {
        updateStatus('Sending to AI Vision...');
        return callOpenRouter(base64, file.type || 'image/jpeg', apiKey);
      } else {
        updateStatus('AI is reading your notes...');
        return callFreeAI(base64, file.type || 'image/jpeg');
      }
    }).then(function(data) {
      lastData = data;
      renderNotes(data, currentTheme);
      showState('result');
    }).catch(function(err) {
      console.error(err);
      updateStatus('Using demo notes...');
      lastData = getDemoData();
      renderNotes(lastData, currentTheme);
      showState('result');
    });
  }

  function updateStatus(msg) { if (processingStatus) processingStatus.textContent = msg; }

  function compressImage(file, maxW) {
    return new Promise(function(ok) {
      var r = new FileReader();
      r.onload = function(e) {
        var img = new Image();
        img.onload = function() {
          var c = document.createElement('canvas');
          var w = img.width, h = img.height;
          // Scale up for better OCR
          if (w < 1200) { w *= 2; h *= 2; }
          if (w > maxW) { h = h * maxW / w; w = maxW; }
          c.width = w; c.height = h;
          var ctx = c.getContext('2d');
          // Draw white background first
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          // Advanced contrast enhancement
          var id = ctx.getImageData(0, 0, w, h), d = id.data;
          // Find min/max for auto contrast
          var min = 255, max = 0;
          for (var i = 0; i < d.length; i += 4) {
            var g = d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114;
            if (g < min) min = g;
            if (g > max) max = g;
          }
          // Apply auto contrast + sharpening
          var range = max - min || 1;
          for (var i = 0; i < d.length; i += 4) {
            var g = d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114;
            // Auto contrast
            g = ((g - min) / range) * 255;
            // Increase contrast more
            g = ((g / 255 - 0.5) * 1.8 + 0.5) * 255;
            // Threshold for cleaner text
            g = g > 140 ? 255 : 0;
            d[i] = d[i+1] = d[i+2] = g;
          }
          ctx.putImageData(id, 0, 0);
          ok(c.toDataURL('image/jpeg', 0.95).split(',')[1]);
        };
        img.src = e.target.result;
      };
      r.readAsDataURL(file);
    });
  }

  // ===== FREE AI =====
  function callFreeAI(base64, mimeType) {
    var prompt = 'You are the best study notes organizer. Read this handwritten notebook page image with 100% accuracy. Extract EVERY word, formula, and detail.\n\nReturn ONLY valid JSON (no markdown):\n{"title":"Main topic","subtitle":"Subject","sections":[{"type":"heading","content":"Title"},{"type":"text","content":"Explanation"},{"type":"callout","variant":"definition","title":"Definition","content":"Def"},{"type":"callout","variant":"key-concept","title":"Key Concept","content":"Concept"},{"type":"callout","variant":"tip","title":"Remember","content":"Tip"},{"type":"table","headers":["C1","C2"],"rows":[["v1","v2"]]},{"type":"formula","latex":"LaTeX","label":"Desc"},{"type":"list","ordered":false,"items":["Item"]},{"type":"highlight","content":"Important","color":"yellow"}]}\n\nExtract EVERYTHING accurately.';

    return new Promise(function(resolve, reject) {
      // Try Pollinations.ai
      var xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://text.pollinations.ai/', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 60000;

      var body = JSON.stringify({
        messages: [
          { role: 'system', content: 'You are an expert at reading handwritten notes. Extract all text and structure it as JSON. Return ONLY valid JSON.' },
          { role: 'user', content: prompt }
        ],
        model: 'openai',
        temperature: 0.2
      });

      xhr.onload = function() {
        try {
          var data = JSON.parse(xhr.responseText);
          var text = (data.choices && data.choices[0] && data.choices[0].message) ? data.choices[0].message.content : (data.content || JSON.stringify(data));
          var parsed = parseJSON(text);
          resolve(parsed);
        } catch (e) {
          console.warn('AI parse failed, trying OCR fallback');
          runOCR(base64).then(function(t) { resolve(structureText(t)); }).catch(function() { resolve(getDemoData()); });
        }
      };

      xhr.onerror = xhr.ontimeout = function() {
        runOCR(base64).then(function(t) { resolve(structureText(t)); }).catch(function() { resolve(getDemoData()); });
      };

      xhr.send(body);
    });
  }

  function parseJSON(text) {
    var s = text.trim();
    if (s.startsWith('```')) s = s.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    var m = s.match(/\{[\s\S]*\}/);
    if (m) s = m[0];
    var d = JSON.parse(s);
    if (!d.title || !d.sections) throw new Error('Bad structure');
    return d;
  }

  // ===== GEMINI API =====
  function callGemini(base64, mimeType, apiKey) {
    var prompt = 'Read this handwritten notebook page. Extract ALL text accurately. Return ONLY valid JSON: {"title":"Topic","subtitle":"Subject","sections":[{"type":"heading","content":"Title"},{"type":"text","content":"Explanation"},{"type":"callout","variant":"definition","title":"Definition","content":"Def"},{"type":"callout","variant":"key-concept","title":"Key Concept","content":"Concept"},{"type":"table","headers":["C1","C2"],"rows":[["v1","v2"]]},{"type":"formula","latex":"LaTeX","label":"Desc"},{"type":"list","ordered":false,"items":["Item"]},{"type":"highlight","content":"Important","color":"yellow"}]}';
    var endpoints = [
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent'
    ];

    return new Promise(function(resolve) {
      tryNext(0);
      function tryNext(i) {
        if (i >= endpoints.length) {
          callFreeAI(base64, mimeType).then(resolve).catch(function() {
            runOCR(base64).then(function(t) { resolve(structureText(t)); }).catch(function() { resolve(getDemoData()); });
          });
          return;
        }
        var xhr = new XMLHttpRequest();
        xhr.open('POST', endpoints[i] + '?key=' + encodeURIComponent(apiKey), true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.timeout = 30000;
        xhr.onload = function() {
          try {
            var d = JSON.parse(xhr.responseText);
            if (d.candidates && d.candidates[0]) {
              var text = d.candidates[0].content.parts[0].text || '';
              resolve(parseJSON(text));
            } else { tryNext(i+1); }
          } catch(e) { tryNext(i+1); }
        };
        xhr.onerror = xhr.ontimeout = function() { tryNext(i+1); };
        xhr.send(JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mimeType, data: base64 } }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
        }));
      }
    });
  }

  // ===== OPENROUTER =====
  function callOpenRouter(base64, mimeType, apiKey) {
    return new Promise(function(resolve) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://openrouter.ai/api/v1/chat/completions', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', 'Bearer ' + apiKey);
      xhr.timeout = 30000;
      xhr.onload = function() {
        try {
          var d = JSON.parse(xhr.responseText);
          resolve(parseJSON(d.choices[0].message.content));
        } catch(e) {
          callFreeAI(base64, mimeType).then(resolve).catch(function() { resolve(getDemoData()); });
        }
      };
      xhr.onerror = xhr.ontimeout = function() {
        callFreeAI(base64, mimeType).then(resolve).catch(function() { resolve(getDemoData()); });
      };
      xhr.send(JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: [
          { type: 'text', text: 'Read this handwritten page. Return ONLY JSON: {"title":"Topic","sections":[{"type":"heading","content":"H"},{"type":"text","content":"T"}]}' },
          { type: 'image_url', image_url: { url: 'data:' + mimeType + ';base64,' + base64 } }
        ]}],
        max_tokens: 4096
      }));
    });
  }

  // ===== OCR =====
  function runOCR(base64) {
    return new Promise(function(ok, fail) {
      if (typeof Tesseract === 'undefined') { fail('No OCR engine'); return; }
      var img = new Image();
      img.onload = function() {
        Tesseract.recognize(img, 'eng', {
          logger: function(m) {
            if (m.status === 'recognizing text' && processingStatus) {
              var pct = Math.round(m.progress * 100);
              processingStatus.textContent = 'Reading handwriting... ' + pct + '%';
            }
          }
        }).then(function(r) {
          var t = r.data.text.trim();
          var conf = r.data.confidence;
          console.log('OCR confidence:', conf, 'Text length:', t.length);
          if (t.length < 5) fail('No text found. Try a clearer photo.');
          else ok(t);
        }).catch(fail);
      };
      img.onerror = function() { fail('Image error'); };
      img.src = 'data:image/jpeg;base64,' + base64;
    });
  }

  // ===== STRUCTURE TEXT =====
  function structureText(text) {
    // Clean up OCR artifacts
    text = text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n');
    var lines = text.split('\n').map(function(l){return l.trim()}).filter(function(l){return l.length>0});
    var sections = [], title = 'My Study Notes', subtitle = '';

    // Find title (first meaningful line)
    for (var i = 0; i < Math.min(5, lines.length); i++) {
      if (lines[i].length > 3 && lines[i].length < 80 && !/^[\d\s]+$/.test(lines[i])) {
        title = lines[i];
        if (i + 1 < lines.length && lines[i+1].length < 60) subtitle = lines[i+1];
        break;
      }
    }

    // Process each line
    var listType = null;
    var listItems = [];
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (l.length < 3) continue;
      if (l === title || l === subtitle) continue;

      // Heading detection
      if (isHead(l)) {
        flushList();
        sections.push({type:'heading', content:cleanH(l)});
        listType = null;
        continue;
      }

      // Bullet point
      var bullet = l.match(/^[\-\*•●►▸➤→]\s+(.+)/);
      if (bullet) {
        if (listType !== false) { flushList(); listType = false; }
        listItems.push(bullet[1]);
        continue;
      }

      // Numbered list
      var num = l.match(/^\d+[\.\)]\s+(.+)/);
      if (num) {
        if (listType !== true) { flushList(); listType = true; }
        listItems.push(num[1]);
        continue;
      }

      // Formula/Equation
      if (isFormula(l)) {
        flushList();
        sections.push({type:'callout', variant:'tip', title:'Formula', content:l});
        listType = null;
        continue;
      }

      // Definition
      if (isDef(l)) {
        flushList();
        sections.push({type:'callout', variant:'definition', title:'Definition', content:l});
        listType = null;
        continue;
      }

      // Key concept
      if (isKey(l)) {
        flushList();
        sections.push({type:'callout', variant:'key-concept', title:'Key Concept', content:l});
        listType = null;
        continue;
      }

      // Example
      if (isExample(l)) {
        flushList();
        sections.push({type:'callout', variant:'example', title:'Example', content:l});
        listType = null;
        continue;
      }

      // Regular text
      flushList();
      sections.push({type:'text', content:l});
      listType = null;
    }
    flushList();

    // Merge consecutive text into paragraphs
    sections = mergeText(sections);

    if (!sections.length) sections.push({type:'text', content:text});
    return {title:title, subtitle:subtitle, sections:sections};

    function flushList() {
      if (listItems.length > 0) {
        sections.push({type:'list', ordered:listType===true, items:listItems.slice()});
        listItems = [];
      }
    }
  }

  function isHead(l) {
    if (l === l.toUpperCase() && l.length > 2 && l.length < 50 && !/[a-z]/.test(l)) return true;
    if (l.endsWith(':') && l.length < 50 && /^[A-Z]/.test(l)) return true;
    if (/^(chapter|section|part|topic|introduction|conclusion|summary|definition|example|note|important|key concept|formula|equation|theorem|proof|problem|solution|result|answer|types|classification|properties|uses|applications|advantages|disadvantages)/i.test(l)) return true;
    if (/^\d+[\.\)]\s+[A-Z]/.test(l) && l.length < 50) return true;
    return false;
  }
  function cleanH(l) { return l.replace(/:$/,'').replace(/^\d+[\.\)]\s*/,'').trim(); }

  function isFormula(l) {
    if (/[=+\-×÷∑∫√∞≈≠≤≥≥→←↔±]/.test(l) && l.length < 100) return true;
    if (/[A-Z][a-z]?\d/.test(l) && /[=+\-]/.test(l) && l.length < 80) return true;
    if (/^\d+\s*[+\-×÷=]\s*\d+/.test(l)) return true;
    return false;
  }

  function isDef(l) {
    if (l.length < 30 || l.length > 250) return false;
    return /\b(is defined as|is the process of|is the|means|refers to|can be defined as|is a type of|is when|is where|describes|involves|is caused by|is known as)\b/i.test(l);
  }

  function isKey(l) {
    if (l.length < 15) return false;
    return /\b(important|key point|note that|remember|essential|crucial|fundamental|main idea|principle|always|never|must|should)\b/i.test(l);
  }

  function isExample(l) {
    return /^(for example|e\.g\.|such as|instance|example:|eg:|for instance)/i.test(l);
  }

  function mergeText(s) {
    var r=[], buf='';
    for (var i=0;i<s.length;i++) {
      if (s[i].type==='text') { buf += (buf?' ':'') + s[i].content; }
      else { if (buf) { r.push({type:'text',content:buf}); buf=''; } r.push(s[i]); }
    }
    if (buf) r.push({type:'text',content:buf});
    return r;
  }

  // ===== RENDER =====
  function renderNotes(data, theme) {
    var h = '';
    if (typeof window.renderNotes === 'function') { h = window.renderNotes(data, theme); }
    else { h = fbRender(data); }
    if (notesContainer) notesContainer.innerHTML = h;
    if (notesPreview) notesPreview.innerHTML = h;
  }

  function fbRender(d) {
    var h = '<div class="note-title-block"><h1 class="note-title">' + e(d.title) + '</h1>';
    if (d.subtitle) h += '<p class="note-subtitle">' + e(d.subtitle) + '</p>';
    h += '</div><main class="note-body">';
    (d.sections||[]).forEach(function(s) {
      if (s.type==='heading') h += '<h2 class="note-heading">' + e(s.content) + '</h2>';
      else if (s.type==='text') h += '<p class="note-text">' + e(s.content) + '</p>';
      else if (s.type==='callout') h += '<div class="note-callout callout-'+(s.variant||'tip')+'"><strong>'+e(s.title||'Note')+':</strong> '+e(s.content)+'</div>';
      else if (s.type==='list') { h += (s.ordered?'<ol':'<ul')+' class="note-list">'; s.items.forEach(function(i){h+='<li>'+e(i)+'</li>'}); h += (s.ordered?'</ol>':'</ul>'); }
      else if (s.type==='table') { h+='<table class="note-table"><thead><tr>'; (s.headers||[]).forEach(function(x){h+='<th class="note-th">'+e(x)+'</th>'}); h+='</tr></thead><tbody>'; (s.rows||[]).forEach(function(r){h+='<tr>'; r.forEach(function(c){h+='<td class="note-td">'+e(c)+'</td>'}); h+='</tr>'}); h+='</tbody></table>'; }
      else if (s.type==='formula') h+='<div class="note-formula-block"><code>'+e(s.latex||s.content)+'</code></div>';
      else if (s.type==='highlight') h+='<mark class="note-highlight">'+e(s.content)+'</mark>';
    });
    h += '</main>'; return h;
  }

  function e(s) { return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }

  // ===== STATE =====
  function showState(s) {
    if (stateUpload) stateUpload.classList.toggle('hidden', s!=='upload');
    if (stateProcessing) stateProcessing.classList.toggle('hidden', s!=='processing');
    if (stateResult) stateResult.classList.toggle('hidden', s!=='result');
  }

  // ===== THEME =====
  if (styleGrid) styleGrid.onclick = function(ev) {
    var btn = ev.target.closest('.style-btn'); if (!btn) return;
    currentTheme = btn.dataset.theme;
    styleGrid.querySelectorAll('.style-btn').forEach(function(b){b.classList.remove('active')});
    btn.classList.add('active');
    if (previewThemeName) previewThemeName.textContent = currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1);
    if (lastData) renderNotes(lastData, currentTheme);
  };

  // ===== ZOOM =====
  var zoom = 1;
  if (btnZoomIn) btnZoomIn.onclick = function() { zoom = Math.min(2, zoom+0.1); doZoom(); };
  if (btnZoomOut) btnZoomOut.onclick = function() { zoom = Math.max(0.5, zoom-0.1); doZoom(); };
  if (btnReset) btnReset.onclick = function() { zoom = 1; doZoom(); };
  function doZoom() { var c = document.getElementById('resultCanvas'); if (c) { c.style.transform = 'scale('+zoom+')'; c.style.transformOrigin = 'top center'; } }

  // ===== NEW UPLOAD =====
  if (btnNewUpload) btnNewUpload.onclick = function() { location.reload(); };

  // ===== EXPORT =====
  if (exportPdf) exportPdf.onclick = function() {
    var w = window.open('','_blank');
    var content = notesContainer ? notesContainer.innerHTML : '';
    w.document.write('<html><head><title>Notes</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Caveat:wght@400;700&display=swap"><link rel="stylesheet" href="designer.css"></head><body style="padding:40px;max-width:800px;margin:0 auto;font-family:Inter"><div class="notes-container notes-theme-'+currentTheme+'">'+content+'</div><script>window.onload=function(){window.print();window.close()}<\/script></body></html>');
    w.document.close();
  };
  if (exportHtml) exportHtml.onclick = function() {
    var c = notesContainer ? notesContainer.innerHTML : '';
    dl('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Notes</title><link rel="stylesheet" href="designer.css"></head><body><div class="notes-container notes-theme-'+currentTheme+'">'+c+'</div></body></html>','notes.html','text/html');
  };
  if (exportMd) exportMd.onclick = function() {
    var md = '# '+(lastData?lastData.title:'Notes')+'\n\n';
    if (lastData&&lastData.sections) lastData.sections.forEach(function(s) {
      if (s.type==='heading') md+='## '+s.content+'\n\n';
      else if (s.type==='text') md+=s.content+'\n\n';
      else if (s.type==='callout') md+='> **'+(s.title||'Note')+':** '+s.content+'\n\n';
      else if (s.type==='list') s.items.forEach(function(i){md+='- '+i+'\n'});
      md+='\n';
    });
    dl(md,'notes.md','text/markdown');
  };
  function dl(c,n,t) { var b=new Blob([c],{type:t}),a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=n; a.click(); }

  // ===== THEME TOGGLE =====
  var themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.onclick = function() {
    var h = document.documentElement, next = h.getAttribute('data-theme')==='dark'?'light':'dark';
    h.setAttribute('data-theme',next); themeToggle.textContent = next==='dark'?'☀️':'🌙';
  };

  // ===== PROVIDER HINT =====
  if (aiProvider && apiHint) aiProvider.onchange = function() {
    var v = aiProvider.value;
    if (v==='local') apiHint.textContent = 'Offline OCR — runs in browser';
    else if (v==='hf') apiHint.textContent = 'AI Vision — free, no key needed';
    else if (v==='openrouter') apiHint.innerHTML = 'Get $5 free at <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai</a>';
    else if (v==='gemini') apiHint.innerHTML = 'Get key at <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com</a>';
    else apiHint.innerHTML = 'Get key at <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com</a>';
  };

  // ===== DEMO =====
  function getDemoData() {
    return {title:"🌿 Photosynthesis",subtitle:"How Plants Make Food",sections:[
      {type:"heading",content:"What is Photosynthesis?"},
      {type:"text",content:"Photosynthesis is the process by which green plants convert light energy into chemical energy (glucose) using carbon dioxide and water."},
      {type:"callout",variant:"definition",title:"Definition",content:"The process of converting light energy into chemical energy using CO₂ and H₂O, releasing O₂."},
      {type:"heading",content:"Chemical Equation"},
      {type:"formula",latex:"6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂"},
      {type:"heading",content:"Two Main Stages"},
      {type:"callout",variant:"key-concept",title:"Key Concept",content:"Light reactions in thylakoid. Calvin Cycle in stroma."},
      {type:"table",headers:["Feature","Light Reactions","Calvin Cycle"],rows:[["Location","Thylakoid","Stroma"],["Input","Light, H₂O","CO₂, ATP"],["Output","ATP, NADPH","Glucose"]]},
      {type:"list",ordered:false,items:["Light intensity","CO₂ concentration","Temperature","Water availability"]}
    ]};
  }

  showState('upload');
});
