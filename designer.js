/* ============================================================
   AI Study PDF — Designer App Logic
   Handles upload, processing, theme selection, AI simulation,
   rendering integration, and export.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // ── DOM References ─────────────────────────────────────────
  const html = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const uploadZone = document.getElementById('uploadZone');
  const cameraBtn = document.getElementById('cameraBtn');
  const styleGrid = document.getElementById('styleGrid');
  const styleButtons = styleGrid ? styleGrid.querySelectorAll('.style-btn') : [];
  const exportPdf = document.getElementById('exportPdf');
  const exportHtml = document.getElementById('exportHtml');
  const exportMd = document.getElementById('exportMd');
  const stateUpload = document.getElementById('stateUpload');
  const stateProcessing = document.getElementById('stateProcessing');
  const stateResult = document.getElementById('stateResult');
  const processingStatus = document.getElementById('processingStatus');
  const notesPreview = document.getElementById('notesPreview');
  const notesContainer = document.getElementById('notesContainer');
  const previewThemeName = document.getElementById('previewThemeName');
  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomOut = document.getElementById('btnZoomOut');
  const btnReset = document.getElementById('btnReset');
  const btnNewUpload = document.getElementById('btnNewUpload');

  // ── App State ──────────────────────────────────────────────
  let currentTheme = 'minimal';
  let currentZoom = 1;
  let uploadedFile = null;
  let currentNotesHTML = '';
  let lastStructuredData = null;

  const PIPELINE_STEPS = [
    { key: 'enhance', label: 'Enhancing image quality...', time: 1200 },
    { key: 'read', label: 'Reading handwriting...', time: 1800 },
    { key: 'understand', label: 'Understanding content...', time: 1500 },
    { key: 'design', label: 'Designing beautiful notes...', time: 1600 }
  ];

  // ============================================================
  // 1. THEME TOGGLE (Dark / Light mode for the page itself)
  // ============================================================
  function setPageTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    if (themeToggle) {
      themeToggle.innerHTML = theme === 'dark'
        ? '<span class="icon-sun">☀️</span>'
        : '<span class="icon-moon">🌙</span>';
    }
  }

  // Restore saved page theme
  const savedPageTheme = localStorage.getItem('theme');
  if (savedPageTheme) {
    setPageTheme(savedPageTheme);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setPageTheme(prefersDark ? 'dark' : 'light');
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = html.getAttribute('data-theme');
      setPageTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  // ============================================================
  // 2. FILE UPLOAD HANDLING
  // ============================================================
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif', 'application/pdf'];
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB

  function validateFile(file) {
    if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
      alert('Invalid file type. Please upload JPG, PNG, or HEIC.');
      return false;
    }
    if (file.size > MAX_SIZE) {
      alert('File is too large. Maximum size is 10MB.');
      return false;
    }
    return true;
  }

  function showPreview(file) {
    if (!uploadZone) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadZone.innerHTML = `
        <div class="upload-preview">
          <img src="${e.target.result}" alt="Uploaded preview" class="preview-img">
          <p class="preview-filename">${file.name}</p>
          <button class="preview-remove" id="removePreview">✕ Remove</button>
        </div>
      `;
      document.getElementById('removePreview').addEventListener('click', (ev) => {
        ev.stopPropagation();
        resetUploadZone();
        uploadedFile = null;
      });
    };
    reader.readAsDataURL(file);
  }

  function resetUploadZone() {
    if (!uploadZone) return;
    uploadZone.innerHTML = `
      <div class="upload-zone-inner">
        <div class="upload-icon">📷</div>
        <p class="upload-text">Click to select a photo</p>
        <p class="upload-subtext">or drag & drop</p>
      </div>
    `;
  }

  // -- File input --
  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        processFiles(files[0]);
      }
      fileInput.value = '';
    });
  }

  function processFiles(file) {
    if (!validateFile(file)) return;
    uploadedFile = file;
    showPreview(file);
    startAIProcessing();
  }

  // -- Click to upload --
  if (uploadZone) {
    uploadZone.addEventListener('click', (e) => {
      if (e.target.closest('.preview-remove') || e.target.closest('.preview-img')) return;
      if (fileInput) fileInput.click();
    });
  }

  // -- Provider hint update --
  const aiProvider = document.getElementById('aiProvider');
  const apiHint = document.getElementById('apiHint');
  if (aiProvider && apiHint) {
    aiProvider.addEventListener('change', () => {
      if (aiProvider.value === 'local') {
        apiHint.innerHTML = 'No API key needed — runs entirely in your browser';
      } else if (aiProvider.value === 'gemini') {
        apiHint.innerHTML = 'Get key at <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com</a>';
      } else if (aiProvider.value === 'groq') {
        apiHint.innerHTML = 'Get free key at <a href="https://console.groq.com/keys" target="_blank">console.groq.com</a>';
      } else {
        apiHint.innerHTML = 'Get key at <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com</a>';
      }
    });
  }
  // -- Drag and drop --
  if (uploadZone) {
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadZone.classList.add('drag-over');
    });

    uploadZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadZone.classList.remove('drag-over');
    });

    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadZone.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        processFiles(files[0]);
      }
    });
  }

  // -- Camera capture --
  if (cameraBtn) {
    cameraBtn.addEventListener('click', () => {
      const tempInput = document.createElement('input');
      tempInput.type = 'file';
      tempInput.accept = 'image/*';
      tempInput.capture = 'environment';
      tempInput.style.display = 'none';
      document.body.appendChild(tempInput);
      tempInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
          processFiles(files[0]);
        }
        document.body.removeChild(tempInput);
      });
      tempInput.click();
    });
  }

  // ============================================================
  // 3. STYLE SELECTOR — 10 Themes
  // ============================================================

  /** Apply the selected notes theme to the container */
  function applyNotesTheme(theme) {
    currentTheme = theme;
    const themeClasses = [
      'minimal', 'medical', 'engineering', 'cute', 'dark',
      'notebook', 'apple', 'goodnotes', 'pinterest', 'exam'
    ];
    // Update right panel
    if (notesContainer) {
      themeClasses.forEach(cls => notesContainer.classList.remove(`theme-${cls}`));
      notesContainer.classList.add(`theme-${theme}`);
    }
    // Update result canvas
    const resultCanvas = document.getElementById('resultCanvas');
    if (resultCanvas) {
      themeClasses.forEach(cls => resultCanvas.classList.remove(`theme-${cls}`));
      resultCanvas.classList.add(`theme-${theme}`);
    }
    if (previewThemeName) {
      previewThemeName.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
    }
    styleButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
    localStorage.setItem('notesTheme', theme);
    // Re-render notes with new theme if content exists
    if (lastStructuredData && typeof renderNotes === 'function') {
      const renderedHTML = renderNotes(lastStructuredData, theme);
      if (notesContainer) notesContainer.innerHTML = renderedHTML;
      if (notesPreview) notesPreview.innerHTML = renderedHTML;
      currentNotesHTML = notesContainer ? notesContainer.innerHTML : '';
    }
  }

  // Bind click events to theme buttons
  styleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      applyNotesTheme(btn.dataset.theme);
    });
  });

  // Restore saved notes theme
  const savedNotesTheme = localStorage.getItem('notesTheme');
  if (savedNotesTheme) {
    applyNotesTheme(savedNotesTheme);
  }

  // ============================================================
  // 4. AI PROCESSING SIMULATION
  // ============================================================

  /** Switch between view states */
  function showState(state) {
    [stateUpload, stateProcessing, stateResult].forEach(el => {
      if (!el) return;
      el.classList.add('hidden');
    });
    if (state === 'upload' && stateUpload) stateUpload.classList.remove('hidden');
    if (state === 'processing' && stateProcessing) stateProcessing.classList.remove('hidden');
    if (state === 'result' && stateResult) stateResult.classList.remove('hidden');
  }

  /** Animate pipeline steps one by one */
  function animatePipeline() {
    const steps = document.querySelectorAll('.pipeline-step');
    steps.forEach(s => {
      s.classList.remove('active', 'completed');
    });

    let delay = 0;
    PIPELINE_STEPS.forEach((step, index) => {
      const el = document.querySelector(`.pipeline-step[data-step="${step.key}"]`);
      if (!el) return;

      // Start this step
      setTimeout(() => {
        el.classList.add('active');
        if (processingStatus) processingStatus.textContent = step.label;
      }, delay);

      // Mark completed
      setTimeout(() => {
        el.classList.remove('active');
        el.classList.add('completed');
      }, delay + step.time);

      delay += step.time;
    });

    return delay; // total time for all steps
  }

  /** Start the AI processing simulation */
  function startAIProcessing() {
    showState('processing');

    const totalDuration = animatePipeline();
    const apiKey = document.getElementById('apiKeyInput')?.value?.trim();
    const provider = document.getElementById('aiProvider')?.value || 'gemini';

    setTimeout(() => {
      if (provider === 'local' || !apiKey) {
        processLocally();
      } else if (provider === 'openai') {
        processWithOpenAI(apiKey);
      } else if (provider === 'groq') {
        processWithGroq(apiKey);
      } else {
        processWithGemini(apiKey);
      }
        // Fallback to mock data if no API key
        const mockData = generateMockNotes();
        lastStructuredData = mockData;
        renderAndShow(mockData);
      }
    }, totalDuration + 400);
  }

  /** Process image with Gemini Vision API */
  async function processWithGemini(apiKey) {
    try {
      if (processingStatus) processingStatus.textContent = 'Sending to Gemini AI...';

      // Convert uploaded file to base64
      const base64 = await fileToBase64(uploadedFile);
      const mimeType = uploadedFile.type || 'image/jpeg';

      const prompt = `You are an expert study notes organizer. Analyze this handwritten notebook page image and extract ALL the content.

Return ONLY a valid JSON object (no markdown, no code fences) with this exact structure:
{
  "title": "Main topic title from the notes",
  "subtitle": "Brief subtitle or subject area",
  "sections": [
    {
      "type": "heading",
      "content": "Section heading text"
    },
    {
      "type": "text",
      "content": "Paragraph text explaining the concept"
    },
    {
      "type": "callout",
      "variant": "definition",
      "title": "Label like 'Definition'",
      "content": "Important definition or concept"
    },
    {
      "type": "callout",
      "variant": "key-concept",
      "title": "Label",
      "content": "Key concept explanation"
    },
    {
      "type": "table",
      "headers": ["Column1", "Column2"],
      "rows": [["val1", "val2"]]
    },
    {
      "type": "formula",
      "latex": "LaTeX formula here",
      "label": "What this formula represents"
    },
    {
      "type": "list",
      "ordered": false,
      "items": ["Item 1", "Item 2"]
    },
    {
      "type": "highlight",
      "content": "Important highlighted text",
      "color": "yellow"
    }
  ]
}

Rules:
- Extract ALL text from the handwritten notes accurately
- Use "heading" type for section titles
- Use "text" type for explanations
- Use "callout" with variant "definition" for definitions, "key-concept" for key ideas, "tip" for tips
- Use "table" for any tabular/comparison data
- Use "formula" for any mathematical formulas (convert to LaTeX)
- Use "list" for bullet points
- Preserve the logical structure and hierarchy
- Return ONLY the JSON object, nothing else`;

      // Try multiple API versions and models
      const endpoints = [
        { base: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash' },
        { base: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-pro' },
        { base: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash-lite' }
      ];

      let data = null;
      let lastError = null;

      for (const ep of endpoints) {
        try {
          const url = `${ep.base}/models/${ep.model}:generateContent?key=${encodeURIComponent(apiKey)}`;
          console.log('Trying:', ep.base, ep.model);
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: mimeType, data: base64 } }
                ]
              }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 8192
              }
            })
          });

          if (response.ok) {
            data = await response.json();
            console.log('Success with:', ep.base, ep.model);
            break;
          } else {
            const err = await response.json();
            lastError = err.error?.message || `HTTP ${response.status}`;
            console.warn(`Failed ${ep.model}:`, lastError);
          }
        } catch (e) {
          lastError = e.message;
          console.warn(`Error ${ep.model}:`, e);
        }
      }

      if (!data) {
        throw new Error('All models failed. Last error: ' + lastError);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Parse JSON from response (handle possible markdown code fences)
      let jsonStr = text.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const structuredData = JSON.parse(jsonStr);

      // Validate basic structure
      if (!structuredData.title || !structuredData.sections) {
        throw new Error('Invalid response structure from AI');
      }

      lastStructuredData = structuredData;
      renderAndShow(structuredData);

    } catch (error) {
      console.error('Gemini API error:', error);
      alert('AI processing failed: ' + error.message + '\n\nFalling back to demo notes.');
      // Fallback to mock data
      const mockData = generateMockNotes();
      lastStructuredData = mockData;
      renderAndShow(mockData);
    }
  }

  /** Convert file to base64 string */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /** Compress image to reduce API payload size */
  function compressImage(file, maxWidth = 1024) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width;
          let h = img.height;
          if (w > maxWidth) {
            h = (h * maxWidth) / w;
            w = maxWidth;
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataUrl.split(',')[1]);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /** Process image with OpenAI GPT-4o API */
  async function processWithOpenAI(apiKey) {
    try {
      if (processingStatus) processingStatus.textContent = 'Sending to GPT-4o...';

      const base64 = await fileToBase64(uploadedFile);
      const mimeType = uploadedFile.type || 'image/jpeg';

      const prompt = `You are an expert study notes organizer. Analyze this handwritten notebook page image and extract ALL the content.

Return ONLY a valid JSON object (no markdown, no code fences) with this exact structure:
{
  "title": "Main topic title from the notes",
  "subtitle": "Brief subtitle or subject area",
  "sections": [
    { "type": "heading", "content": "Section heading text" },
    { "type": "text", "content": "Paragraph text explaining the concept" },
    { "type": "callout", "variant": "definition", "title": "Definition", "content": "Important definition" },
    { "type": "callout", "variant": "key-concept", "title": "Key Concept", "content": "Key concept" },
    { "type": "table", "headers": ["Col1", "Col2"], "rows": [["val1", "val2"]] },
    { "type": "formula", "latex": "LaTeX formula", "label": "Description" },
    { "type": "list", "ordered": false, "items": ["Item 1", "Item 2"] },
    { "type": "highlight", "content": "Important text", "color": "yellow" }
  ]
}

Rules: Extract ALL text accurately. Use heading for titles, text for explanations, callout for definitions/key concepts, table for comparisons, formula for math, list for bullet points. Return ONLY the JSON.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
            ]
          }],
          max_tokens: 4096,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || `API error ${response.status}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';

      let jsonStr = text.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const structuredData = JSON.parse(jsonStr);
      if (!structuredData.title || !structuredData.sections) {
        throw new Error('Invalid response structure from AI');
      }

      lastStructuredData = structuredData;
      renderAndShow(structuredData);

    } catch (error) {
      console.error('OpenAI API error:', error);
      alert('AI processing failed: ' + error.message + '\n\nFalling back to demo notes.');
      const mockData = generateMockNotes();
      lastStructuredData = mockData;
      renderAndShow(mockData);
    }
  }

  /** Process image with Groq API (Llama 3.2 Vision - Free) */
  async function processWithGroq(apiKey) {
    try {
      if (processingStatus) processingStatus.textContent = 'Compressing image...';

      // Compress image for API
      const base64 = await compressImage(uploadedFile, 1024);
      const mimeType = 'image/jpeg';

      if (processingStatus) processingStatus.textContent = 'Sending to Llama Vision...';

      const prompt = `Analyze this handwritten notebook page. Extract ALL content and return ONLY valid JSON:
{
  "title": "Main topic",
  "subtitle": "Subject area",
  "sections": [
    { "type": "heading", "content": "Heading text" },
    { "type": "text", "content": "Explanation text" },
    { "type": "callout", "variant": "definition", "title": "Definition", "content": "Definition text" },
    { "type": "callout", "variant": "key-concept", "title": "Key Concept", "content": "Concept text" },
    { "type": "table", "headers": ["Col1", "Col2"], "rows": [["val1", "val2"]] },
    { "type": "formula", "latex": "LaTeX", "label": "Description" },
    { "type": "list", "ordered": false, "items": ["Item 1"] },
    { "type": "highlight", "content": "Important text", "color": "yellow" }
  ]
}
Extract everything accurately. Return ONLY JSON.`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.2-90b-vision-preview',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
            ]
          }],
          max_tokens: 4096,
          temperature: 0.3
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('Groq API response:', responseData);
        throw new Error(responseData.error?.message || `HTTP ${response.status}: ${JSON.stringify(responseData)}`);
      }

      const text = responseData.choices?.[0]?.message?.content || '';

      let jsonStr = text.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const structuredData = JSON.parse(jsonStr);
      if (!structuredData.title || !structuredData.sections) {
        throw new Error('Invalid response structure');
      }

      lastStructuredData = structuredData;
      renderAndShow(structuredData);

    } catch (error) {
      console.error('Groq API error:', error);
      alert('AI processing failed: ' + error.message + '\n\nFalling back to demo notes.');
      const mockData = generateMockNotes();
      lastStructuredData = mockData;
      renderAndShow(mockData);
    }
  }

  /** Process image locally using Tesseract.js OCR (no API needed) */
  async function processLocally() {
    try {
      if (processingStatus) processingStatus.textContent = 'Loading OCR engine...';

      // Check if Tesseract is loaded
      if (typeof Tesseract === 'undefined') {
        throw new Error('OCR engine not loaded. Please check your internet connection and refresh.');
      }

      // Run OCR on the uploaded image
      if (processingStatus) processingStatus.textContent = 'Reading handwriting... (this may take a moment)';

      const result = await Tesseract.recognize(uploadedFile, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text' && processingStatus) {
            const pct = Math.round(m.progress * 100);
            processingStatus.textContent = `Reading handwriting... ${pct}%`;
          }
        }
      });

      const extractedText = result.data.text.trim();
      console.log('OCR extracted:', extractedText);

      if (!extractedText || extractedText.length < 10) {
        throw new Error('Could not read enough text from the image. Try a clearer photo.');
      }

      // Structure the extracted text into notes format
      const structuredData = structureOCRText(extractedText);
      lastStructuredData = structuredData;
      renderAndShow(structuredData);

    } catch (error) {
      console.error('Local OCR error:', error);
      alert('OCR failed: ' + error.message + '\n\nFalling back to demo notes.');
      const mockData = generateMockNotes();
      lastStructuredData = mockData;
      renderAndShow(mockData);
    }
  }

  /** Convert raw OCR text into structured note format */
  function structureOCRText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const sections = [];
    let title = 'My Study Notes';
    let subtitle = 'Extracted from handwritten notes';

    // Try to detect title (first non-empty line that's short)
    if (lines.length > 0) {
      title = lines[0].substring(0, 80);
      if (lines.length > 1 && lines[1].length < 60) {
        subtitle = lines[1];
      }
    }

    // Detect headings (lines that are ALL CAPS, or end with ':', or are very short bold text)
    // Detect bullet points (lines starting with -, *, •, or numbers)
    // Everything else becomes text paragraphs
    let currentSection = null;
    let paragraphBuffer = [];

    function flushParagraph() {
      if (paragraphBuffer.length > 0) {
        const content = paragraphBuffer.join(' ');
        if (content.length > 20) {
          // Check if it looks like a definition (contains "is", "means", "defined as")
          if (/\b(is defined as|means|is the|is a|refers to)\b/i.test(content)) {
            sections.push({
              type: 'callout',
              variant: 'definition',
              title: 'Definition',
              content: content
            });
          } else {
            sections.push({ type: 'text', content: content });
          }
        }
        paragraphBuffer = [];
      }
    }

    for (let i = 2; i < lines.length; i++) {
      const line = lines[i];

      // Skip very short noise lines
      if (line.length < 2) continue;

      // Detect heading: ALL CAPS, or ends with ':', or numbered like "1.", "2."
      const isHeading = (
        (line === line.toUpperCase() && line.length > 3 && line.length < 60) ||
        (line.endsWith(':') && line.length < 80) ||
        (/^\d+\.\s+[A-Z]/.test(line) && line.length < 80) ||
        (/^(Chapter|Section|Part|Topic|Introduction|Conclusion|Summary|Definition|Example|Note)\b/i.test(line) && line.length < 80)
      );

      if (isHeading) {
        flushParagraph();
        sections.push({
          type: 'heading',
          content: line.replace(/:$/, '').trim()
        });
        continue;
      }

      // Detect bullet point
      const bulletMatch = line.match(/^[\-\*•●►▸]\s+(.+)/);
      if (bulletMatch) {
        flushParagraph();
        if (!currentSection || currentSection.type !== 'list') {
          currentSection = { type: 'list', ordered: false, items: [] };
          sections.push(currentSection);
        }
        currentSection.items.push(bulletMatch[1]);
        continue;
      }

      // Detect numbered list
      const numMatch = line.match(/^\d+[\.\)]\s+(.+)/);
      if (numMatch) {
        flushParagraph();
        if (!currentSection || currentSection.type !== 'list') {
          currentSection = { type: 'list', ordered: true, items: [] };
          sections.push(currentSection);
        }
        currentSection.items.push(numMatch[1]);
        continue;
      }

      // Detect formula (contains math symbols)
      if (/[=+\-×÷∑∫√∞≈≠≤≥αβγδεθλμπσφω]/.test(line) && line.length < 100) {
        flushParagraph();
        sections.push({
          type: 'callout',
          variant: 'tip',
          title: 'Formula',
          content: line
        });
        continue;
      }

      // Regular text - add to paragraph buffer
      currentSection = null;
      paragraphBuffer.push(line);
    }

    flushParagraph();

    // If we got very few sections, just make text paragraphs
    if (sections.length < 3) {
      sections.length = 0;
      for (let i = 2; i < lines.length; i++) {
        if (lines[i].length > 5) {
          sections.push({ type: 'text', content: lines[i] });
        }
      }
    }

    // Ensure at least something
    if (sections.length === 0) {
      sections.push({ type: 'text', content: text });
    }

    return {
      title: title,
      subtitle: subtitle + ' (OCR extracted)',
      sections: sections
    };
  }

  /** Render notes and switch to result view */
  function renderAndShow(data) {
    if (typeof renderNotes === 'function') {
      const renderedHTML = renderNotes(data, currentTheme);
      if (notesContainer) notesContainer.innerHTML = renderedHTML;
      if (notesPreview) notesPreview.innerHTML = renderedHTML;
      if (typeof mermaid !== 'undefined' && mermaid.init) {
        try { mermaid.init(undefined, '.mermaid'); } catch(e) {}
      }
    } else {
      const html = fallbackRender(data);
      if (notesContainer) notesContainer.innerHTML = html;
      if (notesPreview) notesPreview.innerHTML = html;
    }
    currentNotesHTML = notesContainer ? notesContainer.innerHTML : '';
    showState('result');
  }

  /** Basic fallback renderer when renderer.js is unavailable */
  function fallbackRender(data) {
    let html = `<div class="notes-title">${data.title}</div>`;
    if (data.sections) {
      data.sections.forEach(section => {
        html += `<h2>${section.heading}</h2>`;
        if (section.content) html += `<p>${section.content}</p>`;
        if (section.callout) {
          html += `<div class="callout callout-${section.callout.type || 'default'}">
            <strong>${section.callout.label || 'Note'}:</strong> ${section.callout.text}
          </div>`;
        }
        if (section.table) {
          html += '<table class="notes-table"><thead><tr>';
          section.table.headers.forEach(h => { html += `<th>${h}</th>`; });
          html += '</tr></thead><tbody>';
          section.table.rows.forEach(row => {
            html += '<tr>';
            row.forEach(cell => { html += `<td>${cell}</td>`; });
            html += '</tr>';
          });
          html += '</tbody></table>';
        }
        if (section.formula) {
          html += `<div class="formula-box">${section.formula}</div>`;
        }
        if (section.highlights) {
          html += '<div class="highlights">';
          section.highlights.forEach(h => {
            html += `<div class="highlight-item">${h}</div>`;
          });
          html += '</div>';
        }
      });
    }
    if (data.mindmap) {
      html += '<div class="mindmap"><h3>Mind Map</h3><ul>';
      data.mindmap.forEach(node => {
        html += `<li><strong>${node.topic}</strong>: ${node.detail}</li>`;
      });
      html += '</ul></div>';
    }
    return html;
  }

  // ============================================================
  // 5. MOCK AI RESPONSE GENERATOR
  // ============================================================

  /** Generate realistic structured JSON for a Photosynthesis topic */
  function generateMockNotes() {
    return {
      title: "🌿 Photosynthesis",
      subtitle: "A Complete Guide to How Plants Make Food",
      sections: [
        {
          type: "heading",
          content: "What is Photosynthesis?"
        },
        {
          type: "text",
          content: "Photosynthesis is the biological process by which green plants, algae, and certain bacteria convert light energy (usually from the sun) into chemical energy stored in glucose. This process takes place primarily in the chloroplasts of plant cells, using the green pigment chlorophyll."
        },
        {
          type: "callout",
          variant: "definition",
          title: "Definition",
          content: "Photosynthesis: The process of converting light energy into chemical energy (glucose) using carbon dioxide and water, with oxygen released as a byproduct."
        },
        {
          type: "heading",
          content: "The Chemical Equation"
        },
        {
          type: "formula",
          latex: "6CO_2 + 6H_2O \\xrightarrow{\\text{light}} C_6H_{12}O_6 + 6O_2",
          label: "Balanced chemical equation for photosynthesis"
        },
        {
          type: "text",
          content: "This balanced equation shows that six molecules of carbon dioxide react with six molecules of water, powered by light energy, to produce one molecule of glucose and six molecules of oxygen."
        },
        {
          type: "heading",
          content: "Two Main Stages"
        },
        {
          type: "text",
          content: "Photosynthesis occurs in two major stages: the Light-Dependent Reactions and the Calvin Cycle (Light-Independent Reactions). Each stage takes place in a specific part of the chloroplast."
        },
        {
          type: "callout",
          variant: "key-concept",
          title: "Key Concept",
          content: "The Light-Dependent Reactions occur in the thylakoid membranes, while the Calvin Cycle takes place in the stroma of the chloroplast."
        },
        {
          type: "table",
          headers: ["Feature", "Light-Dependent Reactions", "Calvin Cycle"],
          rows: [
            ["Location", "Thylakoid membranes", "Stroma"],
            ["Inputs", "Light, H₂O, NADP⁺, ADP", "CO₂, ATP, NADPH"],
            ["Outputs", "ATP, NADPH, O₂", "G3P → Glucose"],
            ["Energy", "Requires light", "Does not require light directly"],
            ["Duration", "Fast (milliseconds)", "Slower (seconds)"]
          ]
        },
        {
          type: "heading",
          content: "Light-Dependent Reactions — Detailed"
        },
        {
          type: "text",
          content: "In this stage, light energy is absorbed by chlorophyll and other pigments in Photosystem II (PSII) and Photosystem I (PSI). The energy drives the photolysis of water, generates ATP through chemiosmosis, and produces NADPH as an energy carrier."
        },
        {
          type: "list",
          ordered: false,
          items: [
            "⚡ Photolysis of water: 2H₂O → 4H⁺ + O₂ + 4e⁻",
            "🔋 ATP synthase generates ATP via proton gradient",
            "🔄 Electron transport chain connects PSII to PSI",
            "📦 NADP⁺ + 2e⁻ + H⁺ → NADPH (at PSI)"
          ]
        },
        {
          type: "heading",
          content: "The Calvin Cycle"
        },
        {
          type: "text",
          content: "The Calvin Cycle uses ATP and NADPH from the light reactions to fix CO₂ into organic molecules. It consists of three phases: carbon fixation, reduction, and regeneration of the CO₂ acceptor (RuBP)."
        },
        {
          type: "callout",
          variant: "tip",
          title: "Important",
          content: "RuBisCO is the most abundant protein on Earth. It catalyzes the first step of carbon fixation in the Calvin Cycle."
        },
        {
          type: "heading",
          content: "Factors Affecting Photosynthesis"
        },
        {
          type: "text",
          content: "The rate of photosynthesis is influenced by several environmental factors. Understanding these factors is crucial for agriculture and ecosystem management."
        },
        {
          type: "table",
          headers: ["Factor", "Effect", "Optimal Range"],
          rows: [
            ["Light Intensity", "Increases rate up to saturation point", "1000–2000 μmol/m²/s"],
            ["CO₂ Concentration", "Higher CO₂ = faster fixation", "400–800 ppm"],
            ["Temperature", "Enzyme-dependent; too hot denatures", "25–35°C"],
            ["Water Availability", "Required for photolysis", "Adequate soil moisture"],
            ["Chlorophyll Content", "More chlorophyll = more light absorbed", "Species-dependent"]
          ]
        },
        {
          type: "heading",
          content: "C3, C4, and CAM Plants"
        },
        {
          type: "text",
          content: "Different plant species have evolved distinct carbon fixation strategies to adapt to various environments."
        },
        {
          type: "list",
          ordered: false,
          items: [
            "🌱 C3 plants (e.g., rice, wheat): Calvin Cycle only; common in temperate climates",
            "🌿 C4 plants (e.g., corn, sugarcane): Use PEP carboxylase to concentrate CO₂; hot environments",
            "🌵 CAM plants (e.g., cacti, pineapple): Open stomata at night to conserve water; arid environments"
          ]
        },
        {
          type: "mindmap",
          root: "Photosynthesis",
          children: [
            { label: "Light Reactions", sub: ["Thylakoid", "ATP + NADPH + O₂"] },
            { label: "Calvin Cycle", sub: ["Stroma", "CO₂ fixation → G3P"] },
            { label: "Key Enzyme", sub: ["RuBisCO fixes CO₂ to RuBP"] },
            { label: "Environmental Factors", sub: ["Light, CO₂, temperature, water"] },
            { label: "Plant Adaptations", sub: ["C3, C4, CAM pathways"] }
          ]
        }
      ]
    };
  }

  // ============================================================
  // 6. EXPORT FUNCTIONALITY
  // ============================================================

  /** Export as PDF using the browser print dialog */
  function exportPDF() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups for this site.');
      return;
    }

    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(el => el.outerHTML)
      .join('\n');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>AI Study PDF — Notes</title>
        ${styles}
        <style>
          body { padding: 40px; max-width: 800px; margin: 0 auto; font-family: 'Inter', sans-serif; }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="notes-container theme-${currentTheme}">
          ${notesContainer ? notesContainer.innerHTML : ''}
        </div>
        <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  /** Export as a standalone HTML file with inline styles */
  function exportHTML() {
    const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(el => `<link rel="stylesheet" href="${el.href}">`)
      .join('\n    ');

    const content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Study PDF — Notes</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Inter:wght@300;400;500;600;700&family=Kalam:wght@300;400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>
    body { margin: 0; padding: 40px; background: #f5f5f5; font-family: 'Inter', sans-serif; }
    .notes-container { max-width: 800px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .notes-title { font-size: 28px; font-weight: 700; margin-bottom: 24px; color: #1a1a2e; }
    h2 { font-size: 20px; font-weight: 600; margin-top: 28px; margin-bottom: 12px; color: #2d3436; }
    p { line-height: 1.7; color: #444; margin-bottom: 12px; }
    .callout { padding: 16px 20px; border-radius: 8px; margin: 16px 0; border-left: 4px solid; }
    .callout-definition { background: #e3f2fd; border-color: #1976d2; }
    .callout-key-concept { background: #e8f5e9; border-color: #388e3c; }
    .callout-important { background: #fff3e0; border-color: #f57c00; }
    .callout strong { display: block; margin-bottom: 4px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    .formula-box { background: #f8f9fa; padding: 16px; border-radius: 8px; text-align: center; font-size: 18px; font-family: 'Kalam', cursive; margin: 16px 0; border: 1px dashed #ccc; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
    th { background: #f0f0f0; padding: 10px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; }
    tr:hover td { background: #fafafa; }
    .highlights { margin: 16px 0; }
    .highlight-item { padding: 10px 14px; background: #fffde7; border-left: 3px solid #fbc02d; margin-bottom: 8px; border-radius: 4px; font-size: 14px; }
    .mindmap { margin-top: 24px; }
    .mindmap h3 { font-size: 18px; margin-bottom: 12px; }
    .mindmap ul { list-style: none; padding: 0; }
    .mindmap li { padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px; }
    .mindmap li strong { color: #2d3436; }
  </style>
</head>
<body>
  <div class="notes-container theme-${currentTheme}">
    ${notesContainer ? notesContainer.innerHTML : ''}
  </div>
</body>
</html>`;

    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-study-notes.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** Export as Markdown */
  function exportMarkdown() {
    let md = '';

    if (lastStructuredData) {
      const d = lastStructuredData;
      md += `# ${d.title}\n\n`;
      if (d.subtitle) md += `_${d.subtitle}_\n\n`;

      if (d.sections) {
        d.sections.forEach(section => {
          md += `## ${section.heading}\n\n`;

          if (section.content) {
            md += `${section.content}\n\n`;
          }

          if (section.callout) {
            md += `> **${section.callout.label}:** ${section.callout.text}\n\n`;
          }

          if (section.formula) {
            md += `**Formula:** \`${section.formula}\`\n\n`;
          }

          if (section.table) {
            md += '| ' + section.table.headers.join(' | ') + ' |\n';
            md += '| ' + section.table.headers.map(() => '---').join(' | ') + ' |\n';
            section.table.rows.forEach(row => {
              md += '| ' + row.join(' | ') + ' |\n';
            });
            md += '\n';
          }

          if (section.highlights) {
            section.highlights.forEach(h => {
              md += `- ${h}\n`;
            });
            md += '\n';
          }
        });
      }

      if (d.mindmap) {
        md += `## Mind Map\n\n`;
        d.mindmap.forEach(node => {
          md += `- **${node.topic}:** ${node.detail}\n`;
        });
        md += '\n';
      }
    } else {
      // Fallback: extract text from the rendered HTML
      md += '# AI Study Notes\n\n';
      const container = notesContainer || notesPreview;
      if (container) {
        const text = container.innerText || container.textContent;
        md += text;
      }
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-study-notes.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Bind export buttons
  if (exportPdf) exportPdf.addEventListener('click', exportPDF);
  if (exportHtml) exportHtml.addEventListener('click', exportHTML);
  if (exportMd) exportMd.addEventListener('click', exportMarkdown);

  // ============================================================
  // 7. ZOOM & RESULT VIEW CONTROLS
  // ============================================================
  function setZoom(level) {
    currentZoom = Math.max(0.5, Math.min(2, level));
    const canvas = document.getElementById('resultCanvas');
    if (canvas) {
      canvas.style.transform = `scale(${currentZoom})`;
      canvas.style.transformOrigin = 'top center';
    }
  }

  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => setZoom(currentZoom + 0.1));
  }
  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => setZoom(currentZoom - 0.1));
  }
  if (btnReset) {
    btnReset.addEventListener('click', () => setZoom(1));
  }
  if (btnNewUpload) {
    btnNewUpload.addEventListener('click', () => {
      uploadedFile = null;
      currentNotesHTML = '';
      lastStructuredData = null;
      resetUploadZone();
      showState('upload');
    });
  }

  // ============================================================
  // INIT: Apply saved theme and show upload state
  // ============================================================
  showState('upload');
});
