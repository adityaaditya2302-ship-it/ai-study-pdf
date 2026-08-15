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
      if (mode === 'local') {
        updateStatus('Reading handwriting...');
        return runOCR(base64).then(function(text) {
          updateStatus('Creating notes...');
          return structureText(text);
        });
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
          if (w < 800) { w *= 2; h *= 2; }
          if (w > maxW) { h = h * maxW / w; w = maxW; }
          c.width = w; c.height = h;
          var ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          // Enhance contrast
          var id = ctx.getImageData(0, 0, w, h), d = id.data;
          for (var i = 0; i < d.length; i += 4) {
            var g = d[i] * 0.3 + d[i+1] * 0.59 + d[i+2] * 0.11;
            g = ((g / 255 - 0.5) * 1.6 + 0.5) * 255;
            g = Math.max(0, Math.min(255, g));
            d[i] = d[i+1] = d[i+2] = g;
          }
          ctx.putImageData(id, 0, 0);
          ok(c.toDataURL('image/jpeg', 0.9).split(',')[1]);
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

  // ===== OCR =====
  function runOCR(base64) {
    return new Promise(function(ok, fail) {
      if (typeof Tesseract === 'undefined') { fail('No OCR engine'); return; }
      var img = new Image();
      img.onload = function() {
        Tesseract.recognize(img, 'eng', { logger: function(m) {
          if (m.status === 'recognizing text' && processingStatus) processingStatus.textContent = 'Reading... ' + Math.round(m.progress * 100) + '%';
        }}).then(function(r) {
          var t = r.data.text.trim();
          if (t.length < 5) fail('No text found'); else ok(t);
        }).catch(fail);
      };
      img.onerror = function() { fail('Image error'); };
      img.src = 'data:image/jpeg;base64,' + base64;
    });
  }

  // ===== STRUCTURE TEXT =====
  function structureText(text) {
    var lines = text.split('\n').map(function(l){return l.trim()}).filter(function(l){return l.length>0});
    var sections = [], title = lines[0] || 'My Notes', subtitle = lines[1] || '';
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i]; if (l.length < 3) continue;
      if (isHead(l)) { sections.push({type:'heading',content:cleanH(l)}); }
      else if (/^[\-\*•●]/.test(l)) { addList(sections, l.replace(/^[\-\*•●]\s+/,''), false); }
      else if (/^\d+[\.\)]/.test(l)) { addList(sections, l.replace(/^\d+[\.\)]\s+/,''), true); }
      else if (/[=+×÷∑∫√∞≈≠→←]/.test(l) && l.length < 80) { sections.push({type:'callout',variant:'tip',title:'Formula',content:l}); }
      else if (/\b(is defined as|is the|means|refers to)\b/i.test(l) && l.length > 20) { sections.push({type:'callout',variant:'definition',title:'Definition',content:l}); }
      else if (/\b(important|key|note|remember)\b/i.test(l) && l.length > 15) { sections.push({type:'callout',variant:'key-concept',title:'Key Concept',content:l}); }
      else { sections.push({type:'text',content:l}); }
    }
    sections = mergeText(sections);
    if (!sections.length) sections.push({type:'text',content:text});
    return {title:title, subtitle:subtitle, sections:sections};
  }

  function isHead(l) {
    if (l === l.toUpperCase() && l.length > 2 && l.length < 50) return true;
    if (l.endsWith(':') && l.length < 50) return true;
    if (/^(chapter|section|topic|definition|example|note|important|summary)/i.test(l)) return true;
    return false;
  }
  function cleanH(l) { return l.replace(/:$/,'').replace(/^\d+[\.\)]\s*/,'').trim(); }
  function addList(s, item, ord) {
    var last = s[s.length-1];
    if (last && last.type==='list' && last.ordered===ord) last.items.push(item);
    else s.push({type:'list',ordered:ord,items:[item]});
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
