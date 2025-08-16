// PDF.js variables (replacing Adobe PDF Embed API)
let pdfDoc = null;
let pdfPage = null;
let pdfCanvas = null;
let pdfContext = null;
let currentScale = 1.0;
let currentPage = 1;
let totalPages = 1;
let currentDoc = null;
let currentSections = [];
let currentSnippets = [];
let HEALTH = {};
let HAS_ANALYSIS = false;

// View mode variables
let isContinuousView = false;
let viewModeToggle = null;

// Text selection variables
let selectedText = "";
let textSelectionInsights = null;
let isProcessingTextSelection = false;
let textSelectionTimeout = null;

// Toast notification system with debouncing
let toastTimeout = null;
let lastToastMessage = '';
let lastToastType = '';

function toast(message, type = 'info', duration = 4000) {
  // Prevent duplicate toasts
  if (lastToastMessage === message && lastToastType === type) {
    return;
  }

  // Clear existing timeout
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  lastToastMessage = message;
  lastToastType = type;

  const container = document.getElementById('toast');
  if (!container) return;

  // Clear existing toasts
  container.innerHTML = '';

  const toastEl = document.createElement('div');
  toastEl.className = `toast-item ${type} transform translate-x-full opacity-0`;

  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-exclamation-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle'
  };

  const colors = {
    success: 'from-green-500 to-emerald-500',
    error: 'from-red-500 to-pink-500',
    warning: 'from-yellow-500 to-amber-500',
    info: 'from-blue-500 to-indigo-500'
  };

  toastEl.innerHTML = `
    <div class="flex items-center space-x-3 p-4 bg-gradient-to-r ${colors[type]} text-white rounded-2xl shadow-2xl border border-white/20 backdrop-blur-sm min-w-[300px] max-w-[400px]">
      <div class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
        <i class="${icons[type]} text-lg"></i>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium leading-relaxed">${message}</p>
      </div>
      <button class="toast-close w-6 h-6 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors duration-200 flex-shrink-0">
        <i class="fas fa-times text-xs"></i>
      </button>
    </div>
  `;

  container.appendChild(toastEl);

  // Animate in
  requestAnimationFrame(() => {
    toastEl.classList.remove('translate-x-full', 'opacity-0');
    toastEl.classList.add('translate-x-0', 'opacity-100');
  });

  // Auto remove
  toastTimeout = setTimeout(() => {
    removeToast(toastEl);
  }, duration);

  // Manual close
  toastEl.querySelector('.toast-close').addEventListener('click', () => {
    removeToast(toastEl);
  });
}

function removeToast(toastEl) {
  if (!toastEl) return;

  toastEl.classList.add('translate-x-full', 'opacity-0');

  setTimeout(() => {
    if (toastEl.parentNode) {
      toastEl.parentNode.removeChild(toastEl);
    }
    // Reset last toast tracking
    lastToastMessage = '';
    lastToastType = '';
  }, 300);
}

// Initialize PDF.js viewer
async function initViewer(url, containerId = 'pdf-viewer-container') {
  return new Promise(async (resolve) => {
    try {
      // Check if we have a valid URL
      if (!url || url === 'undefined' || url === 'null') {
        console.log('No valid URL provided to initViewer');
        hidePDFLoading();
        resolve(false);
        return;
      }

      // Set worker path for PDF.js
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      // Get canvas and context
      pdfCanvas = document.getElementById('pdf-canvas');
      pdfContext = pdfCanvas.getContext('2d');

      // Show loading state only when we have a valid URL
      showPDFLoading();

      // Load the PDF document
      const loadingTask = pdfjsLib.getDocument(url);
      pdfDoc = await loadingTask.promise;

      // Get total pages
      totalPages = pdfDoc.numPages;
      updatePageCount();

      // Initialize view mode (start with single page view)
      isContinuousView = false;
      const singlePageView = document.getElementById('single-page-view');
      const continuousView = document.getElementById('continuous-view');
      if (singlePageView && continuousView) {
        singlePageView.classList.remove('hidden');
        continuousView.classList.add('hidden');
      }

      // Set canvas dimensions
      resizeCanvas();

      // Load first page
      await loadPage(1);

      // Set up text selection events
      setupTextSelectionEvents();

      // Set up the toolbar
      setupToolbar();

      // Update current document name
      updateCurrentDocName();

      // Hide loading state
      hidePDFLoading();

      // Set up window resize handler
      window.addEventListener('resize', resizeCanvas);

      resolve(true);
    } catch (error) {
      console.error('Error in initViewer:', error);
      showPDFError();
      toast('Failed to load PDF. Please try again.', 'error');
      resolve(false);
    }
  });
}

// Load a specific page
async function loadPage(pageNum) {
  try {
    if (pageNum < 1 || pageNum > totalPages) {
      console.log('Invalid page number:', pageNum);
      return;
    }

    currentPage = pageNum;

    // Get the page
    pdfPage = await pdfDoc.getPage(pageNum);

    // Calculate viewport
    const viewport = pdfPage.getViewport({ scale: currentScale });

    // Set canvas dimensions
    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;

    // Render the page
    const renderContext = {
      canvasContext: pdfContext,
      viewport: viewport
    };

    await pdfPage.render(renderContext).promise;

    // Create or update text layer for text selection
    await createTextLayerForSinglePage(pdfPage, viewport);

    // Show text selection hint
    showTextSelectionHint();

    // Update page count display
    updatePageCount();

    // Update goto input field
    const gotoInput = document.getElementById('gotoPageInput');
    if (gotoInput) {
      gotoInput.value = currentPage;
    }

    console.log(`Page ${currentPage} loaded successfully`);

  } catch (error) {
    console.error('Error loading page:', error);
    toast('Failed to load page. Please try again.', 'error');
  }
}

// Create text layer for single page view
async function createTextLayerForSinglePage(page, viewport) {
  try {
    // Get or create text layer container
    let textLayerContainer = document.getElementById('single-page-text-layer');
    if (!textLayerContainer) {
      textLayerContainer = document.createElement('div');
      textLayerContainer.id = 'single-page-text-layer';
      textLayerContainer.className = 'text-layer absolute inset-0 pointer-events-auto z-10';
      textLayerContainer.style.width = `${viewport.width}px`;
      textLayerContainer.style.height = `${viewport.height}px`;
      textLayerContainer.style.fontSize = '0px';
      textLayerContainer.style.lineHeight = '1';
      textLayerContainer.style.color = 'transparent';
      textLayerContainer.style.userSelect = 'text';
      textLayerContainer.style.cursor = 'text';

      // Insert after canvas
      const canvasContainer = document.getElementById('pdf-viewer-container');
      if (canvasContainer) {
        canvasContainer.appendChild(textLayerContainer);
      }
    }

    // Update text layer dimensions
    textLayerContainer.style.width = `${viewport.width}px`;
    textLayerContainer.style.height = `${viewport.height}px`;

    // Render text content
    await renderTextLayer(page, textLayerContainer, viewport);

  } catch (error) {
    console.error('Error creating text layer for single page:', error);
  }
}

// Load all pages for continuous scrolling
async function loadAllPages() {
  try {
    if (!pdfDoc) return;

    const continuousContainer = document.getElementById('continuous-view');
    if (!continuousContainer) return;

    // Clear existing content
    continuousContainer.innerHTML = '';

    // Show loading progress
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'text-center py-8';
    loadingDiv.innerHTML = `
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <p class="text-slate-600 dark:text-slate-400">Loading pages...</p>
    `;
    continuousContainer.appendChild(loadingDiv);

    // Load all pages
    const pagePromises = [];
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      pagePromises.push(loadPageToContainer(pageNum, continuousContainer));
    }

    await Promise.all(pagePromises);

    // Remove loading indicator
    if (loadingDiv.parentNode) {
      loadingDiv.parentNode.removeChild(loadingDiv);
    }

    // Set up text selection for all pages
    setupTextSelectionEvents();

    // Show text selection hint
    showTextSelectionHint();

    console.log(`All ${totalPages} pages loaded successfully`);

  } catch (error) {
    console.error('Error loading all pages:', error);
    toast('Failed to load PDF pages. Please try again.', 'error');
  }
}

// Toggle between single page and continuous view modes
async function toggleViewMode() {
  try {
    isContinuousView = !isContinuousView;

    const singlePageView = document.getElementById('single-page-view');
    const continuousView = document.getElementById('continuous-view');

    if (isContinuousView) {
      // Switch to continuous view
      singlePageView.classList.add('hidden');
      continuousView.classList.remove('hidden');

      // Update button text
      if (viewModeToggle) {
        viewModeToggle.innerHTML = '<i class="fas fa-list mr-1"></i>Continuous';
        viewModeToggle.title = 'Switch to single page view';
      }

      // Load all pages
      await loadAllPages();

      toast('Switched to continuous view - scroll to see all pages', 'info');
    } else {
      // Switch to single page view
      continuousView.classList.add('hidden');
      singlePageView.classList.remove('hidden');

      // Update button text
      if (viewModeToggle) {
        viewModeToggle.innerHTML = '<i class="fas fa-file-alt mr-1"></i>Single';
        viewModeToggle.title = 'Switch to continuous view';
      }

      // Load current page
      await loadPage(currentPage);

      toast('Switched to single page view', 'info');
    }

    // Update toolbar state
    updateToolbarState();

  } catch (error) {
    console.error('Error toggling view mode:', error);
    toast('Failed to switch view mode', 'error');
  }
}

// Load a single page to the container
async function loadPageToContainer(pageNum, container) {
  try {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: currentScale });

    // Create page wrapper
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'page-wrapper relative bg-white dark:bg-slate-800 rounded-lg shadow-lg mx-auto';
    pageWrapper.style.width = `${viewport.width}px`;
    pageWrapper.style.maxWidth = '100%';
    pageWrapper.dataset.pageNumber = pageNum; // Add data attribute for easy selection

    // Create canvas for this page
    const canvas = document.createElement('canvas');
    canvas.className = 'page-canvas w-full h-auto';
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.dataset.pageNumber = pageNum;

    // Create text layer for text selection
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'text-layer absolute inset-0 pointer-events-auto';
    textLayerDiv.style.width = `${viewport.width}px`;
    textLayerDiv.style.height = `${viewport.height}px`;
    textLayerDiv.style.fontSize = '0px'; // Hide text but keep it selectable
    textLayerDiv.style.lineHeight = '1';
    textLayerDiv.style.color = 'transparent';
    textLayerDiv.style.userSelect = 'text';
    textLayerDiv.style.cursor = 'text';

    // Create page info overlay
    const pageInfo = document.createElement('div');
    pageInfo.className = 'absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs font-medium z-10';
    pageInfo.textContent = `Page ${pageNum}`;

    pageWrapper.appendChild(canvas);
    pageWrapper.appendChild(textLayerDiv);
    pageWrapper.appendChild(pageInfo);

    // Render the page to canvas
    const context = canvas.getContext('2d');
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };

    await page.render(renderContext).promise;

    // Render text layer for text selection
    await renderTextLayer(page, textLayerDiv, viewport);

    // Add to container
    container.appendChild(pageWrapper);

    // Add click handler for page navigation
    pageWrapper.addEventListener('click', (e) => {
      // Don't navigate if clicking on text layer
      if (e.target.closest('.text-layer')) {
        return;
      }

      currentPage = pageNum;
      updatePageCount();

      // Update goto input field
      const gotoInput = document.getElementById('gotoPageInput');
      if (gotoInput) {
        gotoInput.value = currentPage;
      }

      // Scroll to this page
      pageWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    return pageWrapper;

  } catch (error) {
    console.error(`Error loading page ${pageNum}:`, error);
    return null;
  }
}

// Render text layer for text selection
async function renderTextLayer(page, textLayerDiv, viewport) {
  try {
    const textContent = await page.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: true,
      includeMarkedContent: false
    });

    // Clear existing content and set up text layer
    textLayerDiv.innerHTML = '';
    textLayerDiv.style.position = 'absolute';
    textLayerDiv.style.left = '0';
    textLayerDiv.style.top = '0';
    textLayerDiv.style.width = '100%';
    textLayerDiv.style.height = '100%';
    textLayerDiv.style.overflow = 'visible';
    textLayerDiv.style.lineHeight = '1';
    textLayerDiv.style.fontSize = '0';
    textLayerDiv.style.userSelect = 'text';
    textLayerDiv.style.webkitUserSelect = 'text';
    textLayerDiv.style.lineHeight = '1.0';
    textLayerDiv.style.fontSize = '0';

    // Group text items by their vertical position
    const lineMap = new Map();

    // First pass: group text items by their vertical position
    textContent.items.forEach((item) => {
      if (!item.str || item.str.trim() === '') return;

      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const style = textContent.styles[item.fontName];
      const fontSize = Math.max(0.1, Math.sqrt((tx[0] * tx[0]) + (tx[1] * tx[1])));
      const lineHeight = (style?.lineHeight || 1.2) * fontSize;

      // Round the vertical position to group items on the same line
      const lineKey = Math.round(tx[5] / 2) * 2;

      if (!lineMap.has(lineKey)) {
        lineMap.set(lineKey, []);
      }

      lineMap.get(lineKey).push({
        text: item.str,
        left: tx[4],
        top: tx[5],
        fontSize: fontSize,
        scale: tx[0] / fontSize,
        style: style,
        direction: item.strDirection
      });
    });

    // Second pass: create text elements for each line
    for (const [lineKey, items] of lineMap.entries()) {
      // Sort items horizontally
      items.sort((a, b) => a.left - b.left);

      // Create a container for this line
      const lineContainer = document.createElement('div');
      lineContainer.className = 'text-line';
      lineContainer.style.position = 'absolute';
      lineContainer.style.left = '0';
      lineContainer.style.top = `${lineKey}px`;
      lineContainer.style.height = `${items[0].fontSize * 1.2}px`;
      lineContainer.style.lineHeight = `${items[0].fontSize * 1.2}px`;
      lineContainer.style.whiteSpace = 'nowrap';
      lineContainer.style.pointerEvents = 'auto';

      // Add text spans for each item in the line
      items.forEach(item => {
        const textElement = document.createElement('span');
        textElement.className = 'text-span';
        textElement.textContent = item.text;
        textElement.style.position = 'absolute';
        textElement.style.left = `${item.left}px`;
        textElement.style.top = '0';
        textElement.style.fontSize = `${item.fontSize}px`;
        textElement.style.fontFamily = item.style?.fontFamily || 'sans-serif';
        textElement.style.transform = `matrix(${item.scale}, 0, 0, 1, 0, 0)`;
        textElement.style.transformOrigin = 'left top';
        textElement.style.whiteSpace = 'pre';
        textElement.style.cursor = 'text';
        textElement.style.userSelect = 'text';
        textElement.style.webkitUserSelect = 'text';
        textElement.style.color = 'transparent';
        textElement.style.pointerEvents = 'auto';
        textElement.style.verticalAlign = 'top';
        textElement.style.direction = item.direction === 'ttb' ? 'vertical-rl' : 'ltr';

        lineContainer.appendChild(textElement);
      });

      textLayerDiv.appendChild(lineContainer);
    }

    console.log(`Text layer rendered for page with ${textContent.items.length} text items`);
  } catch (error) {
    console.error('Error rendering text layer:', error);
  }
}

// Resize canvas to fit container
function resizeCanvas() {
  if (!pdfCanvas) return;

  const container = document.getElementById('pdf-viewer-container');
  if (!container) return;

  const containerRect = container.getBoundingClientRect();
  const containerWidth = containerRect.width;
  const containerHeight = containerRect.height;

  if (pdfPage) {
    const viewport = pdfPage.getViewport({ scale: 1.0 });
    const scaleX = containerWidth / viewport.width;
    const scaleY = containerHeight / viewport.height;
    const scale = Math.min(scaleX, scaleY, 2.0); // Cap at 2x zoom

    currentScale = scale;
    loadPage(currentPage); // Reload current page with new scale
  }
}

// Show PDF loading state
function showPDFLoading() {
  const loading = document.getElementById('pdf-loading');
  const error = document.getElementById('pdf-error');
  const neutral = document.getElementById('pdf-neutral');
  if (loading) loading.classList.remove('hidden');
  if (error) error.classList.add('hidden');
  if (neutral) neutral.classList.add('hidden');
}

// Hide PDF loading state
function hidePDFLoading() {
  const loading = document.getElementById('pdf-loading');
  if (loading) loading.classList.add('hidden');
}

// Show PDF error state
function showPDFError() {
  const loading = document.getElementById('pdf-loading');
  const error = document.getElementById('pdf-error');
  const neutral = document.getElementById('pdf-neutral');
  if (loading) loading.classList.add('hidden');
  if (error) error.classList.remove('hidden');
  if (neutral) neutral.classList.add('hidden');
}

// Show PDF neutral state (no document selected)
function showPDFNeutral() {
  const loading = document.getElementById('pdf-loading');
  const error = document.getElementById('pdf-error');
  const neutral = document.getElementById('pdf-neutral');
  const canvas = document.getElementById('pdf-canvas');

  if (loading) loading.classList.add('hidden');
  if (error) error.classList.add('hidden');
  if (neutral) neutral.classList.remove('hidden');

  // Clear canvas and show placeholder
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set canvas to a reasonable size
    canvas.width = 800;
    canvas.height = 600;

    // Draw a placeholder
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw placeholder text
    ctx.fillStyle = '#64748b';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Select a document to view', canvas.width / 2, canvas.height / 2);
  }
}

// Theme handling (light/dark)
function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  const t = document.getElementById('themeToggle');
  if (t) t.textContent = saved === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const t = document.getElementById('themeToggle');
  if (t) t.textContent = next === 'dark' ? '☀️' : '🌙';
}

async function fetchConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    // Store any config data if needed
    console.log('Config loaded:', data);
  } catch (e) {
    console.error('Config fetch failed:', e);
  }
}

async function fetchHealth() {
  try {
    const res = await fetch('/api/health');
    HEALTH = await res.json();

    // Update status badges
    const llmStatus = document.getElementById('llmStatus');
    const ttsStatus = document.getElementById('ttsStatus');

    if (llmStatus) {
      llmStatus.textContent = HEALTH.llm_provider || 'Unknown';
    }

    if (ttsStatus) {
      ttsStatus.textContent = HEALTH.tts_provider || 'Unknown';
    }

    // Update current document name display
    updateCurrentDocName();
  } catch (e) {
    console.error('Health check failed:', e);
  }
}

async function loadDocuments() {
  try {
    const res = await fetch('/api/documents');
    const docs = await res.json();
    const list = document.getElementById('docList');
    if (!list) return;

    list.innerHTML = '';

    docs.forEach((d) => {
      const li = document.createElement('li');
      li.className = 'doc-item group';

      // Create a beautiful document item
      li.innerHTML = `
        <div class="flex items-center space-x-3 flex-1">
          <div class="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
            <i class="fas fa-file-pdf text-white text-sm"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-slate-700 dark:text-slate-300 truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors duration-300">
              ${d.filename}
            </div>
            <div class="text-xs text-slate-500 dark:text-slate-400">
              PDF Document
            </div>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <button class="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-all duration-300 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0" title="View document">
            <i class="fas fa-eye text-slate-600 dark:text-slate-400 text-xs"></i>
          </button>
          <button class="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all duration-300 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0" title="Delete document" onclick="deleteDocument('${d.filename}')">
            <i class="fas fa-trash text-red-600 dark:text-red-400 text-xs"></i>
          </button>
          <div class="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-blue-400 dark:group-hover:bg-blue-500 transition-all duration-300"></div>
        </div>
      `;

      li.dataset.filename = d.filename;

      // Add click handlers
      li.addEventListener('click', () => {
        // Toggle selection
        li.classList.toggle('selected');

        // Update visual state
        const indicator = li.querySelector('.w-3.h-3');
        const viewBtn = li.querySelector('button');

        if (li.classList.contains('selected')) {
          indicator.className = 'w-3 h-3 rounded-full bg-blue-500 animate-pulse';
          viewBtn.className = 'p-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/50 rounded-lg transition-all duration-300 opacity-100 transform translate-x-0';
          viewBtn.innerHTML = '<i class="fas fa-check text-blue-600 dark:text-blue-400 text-xs"></i>';
          viewBtn.title = 'Document selected';
        } else {
          indicator.className = 'w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-blue-400 dark:group-hover:bg-blue-500 transition-all duration-300';
          viewBtn.className = 'p-2 bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-all duration-300 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0';
          viewBtn.innerHTML = '<i class="fas fa-eye text-slate-600 dark:text-slate-400 text-xs"></i>';
          viewBtn.title = 'View document';
        }

        // Load document if not already loaded
        if (li.classList.contains('selected') && currentDoc !== `/files/${d.filename}`) {
          initViewer(`/files/${d.filename}`);
        }

        updateSelectedCount();
      });

      list.appendChild(li);
    });

    updateSelectedCount();
  } catch (e) {
    console.error('Failed to load documents:', e);
  }
}

function getSelectedDocs() {
  const list = document.getElementById('docList');
  if (!list) return [];

  const docs = [];
  for (const li of list.children) {
    if (li.classList.contains('selected')) {
      docs.push(li.dataset.filename || li.textContent);
    }
  }
  return docs;
}

function updateSelectedCount() {
  const el = document.getElementById('selectedCount');
  if (!el) return;
  const list = document.getElementById('docList');
  if (!list) return;

  let count = 0;
  for (const li of list.children) if (li.classList.contains('selected')) count++;
  el.textContent = `${count} selected`;
}

function updateCurrentDocName() {
  const currentDocNameEl = document.getElementById('currentDocName');
  if (currentDocNameEl && currentDoc) {
    const filename = currentDoc.split('/').pop();
    currentDocNameEl.textContent = filename || 'Unknown document';
  } else if (currentDocNameEl) {
    currentDocNameEl.textContent = 'No document selected';
  }
}

// Handle file uploads
async function uploadFiles() {
  const input = document.getElementById('fileInput');
  if (!input.files.length) {
    toast('Please select files to upload', 'warning');
    return;
  }

  // Validate file types
  const files = Array.from(input.files);
  const invalidFiles = files.filter(file => !file.type.includes('pdf'));

  if (invalidFiles.length > 0) {
    toast(`Invalid file type(s): ${invalidFiles.map(f => f.name).join(', ')}. Only PDF files are supported.`, 'error');
    return;
  }

  // Show upload progress UI
  showUploadProgress();

  const form = new FormData();
  for (const f of files) form.append('files', f);

  try {
    // Create XMLHttpRequest for progress tracking
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100;
        updateUploadProgress(percentComplete, `Uploading ${files.length} file(s)...`);
      }
    });

    // Handle upload completion
    xhr.addEventListener('load', async () => {
      if (xhr.status === 200) {
        updateUploadProgress(100, 'Upload completed!', 'success');
        toast(`Successfully uploaded ${files.length} file(s)! 🎉`, 'success');

        // Reload documents list
        await loadDocuments();

        // Hide progress after a short delay
        setTimeout(() => {
          hideUploadProgress();
        }, 1500);
      } else {
        updateUploadProgress(0, 'Upload failed', 'error');
        toast(`Upload failed: ${xhr.statusText || 'Unknown error'}`, 'error');
        hideUploadProgress();
      }
    });

    // Handle upload errors
    xhr.addEventListener('error', () => {
      updateUploadProgress(0, 'Upload failed', 'error');
      toast('Upload failed: Network error', 'error');
      hideUploadProgress();
    });

    // Handle upload timeout
    xhr.addEventListener('timeout', () => {
      updateUploadProgress(0, 'Upload failed', 'error');
      toast('Upload failed: Request timed out', 'error');
      hideUploadProgress();
    });

    // Start the upload
    xhr.open('POST', '/api/upload');
    xhr.timeout = 300000; // 5 minutes timeout for large files
    xhr.send(form);

  } catch (error) {
    console.error('Upload error:', error);
    updateUploadProgress(0, 'Upload failed', 'error');
    toast(`Upload failed: ${error.message}`, 'error');
    hideUploadProgress();
  }
}

// Show upload progress UI
function showUploadProgress() {
  // Create or show upload progress modal
  let progressModal = document.getElementById('uploadProgressModal');
  if (!progressModal) {
    progressModal = document.createElement('div');
    progressModal.id = 'uploadProgressModal';
    progressModal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    progressModal.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div class="text-center">
          <div class="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-cloud-upload-alt text-white text-lg"></i>
          </div>
          <h3 class="text-xl font-semibold text-slate-800 dark:text-white mb-4">Uploading Files...</h3>
          
          <!-- Progress Bar -->
          <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 mb-4">
            <div id="uploadProgressBar" class="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300" style="width: 0%"></div>
          </div>
          
          <div class="text-sm text-slate-600 dark:text-slate-400 mb-2">
            <div id="uploadProgressText">Preparing upload...</div>
          </div>
          
          <div class="text-xs text-slate-500 dark:text-slate-400">
            <span id="uploadProgressPercent">0%</span> complete
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(progressModal);
  }

  progressModal.classList.remove('hidden');
}

// Update upload progress
function updateUploadProgress(percent, status, state = 'uploading') {
  const progressBar = document.getElementById('uploadProgressBar');
  const progressText = document.getElementById('uploadProgressText');
  const progressPercent = document.getElementById('uploadProgressPercent');
  const progressModal = document.getElementById('uploadProgressModal');

  if (progressBar) {
    progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;

    // Update progress bar appearance based on state
    progressBar.classList.remove('success', 'error');
    if (state === 'success') {
      progressBar.classList.add('success');
    } else if (state === 'error') {
      progressBar.classList.add('error');
    }
  }

  if (progressText) {
    progressText.textContent = status;
  }

  if (progressPercent) {
    progressPercent.textContent = `${Math.round(percent)}%`;
  }

  // Update modal icon based on state
  if (progressModal) {
    const icon = progressModal.querySelector('.fas');
    if (icon) {
      if (state === 'success') {
        icon.className = 'fas fa-check-circle text-white text-lg';
      } else if (state === 'error') {
        icon.className = 'fas fa-exclamation-circle text-white text-lg';
      } else {
        icon.className = 'fas fa-cloud-upload-alt text-white text-lg';
      }
    }

    // Update modal title based on state
    const title = progressModal.querySelector('h3');
    if (title) {
      if (state === 'success') {
        title.textContent = 'Upload Complete!';
      } else if (state === 'error') {
        title.textContent = 'Upload Failed';
      } else {
        title.textContent = 'Uploading Files...';
      }
    }
  }
}

// Hide upload progress
function hideUploadProgress() {
  const progressModal = document.getElementById('uploadProgressModal');
  if (progressModal) {
    progressModal.classList.add('hidden');
  }
}

// ... existing code ...

// Load a document into the PDF viewer
async function loadDocument(doc) {
  try {
    if (!doc || !doc.filename) {
      console.error('Invalid document:', doc);
      return false;
    }

    // Update current document
    currentDoc = doc.filename;
    currentPage = 1;

    // Show loading state
    showPDFLoading();

    // Construct the URL for the document
    const docUrl = `/files/${encodeURIComponent(doc.filename)}`;

    // Initialize the PDF.js viewer
    const success = await initViewer(docUrl);

    if (success) {
      // Update UI
      updateCurrentDocName();

      // Enable insights and podcast buttons
      const insightsBtn = document.getElementById('insightsBtn');
      const podcastBtn = document.getElementById('podcastBtn');
      if (insightsBtn) insightsBtn.disabled = false;
      if (podcastBtn) podcastBtn.disabled = false;

      // Load document recommendations
      try {
        await getDocumentRecommendations();
      } catch (error) {
        console.error('Error loading document recommendations:', error);
      }

      toast(`Loaded: ${doc.filename}`, 'success');
      return true;
    } else {
      toast('Failed to load document', 'error');
      return false;
    }

  } catch (error) {
    console.error('Error loading document:', error);
    toast('Error loading document', 'error');
    return false;
  }
}

// Handle file uploads
async function uploadFiles() {
  const input = document.getElementById('fileInput');
  if (!input.files.length) return;
  const form = new FormData();
  for (const f of input.files) form.append('files', f);
  await fetch('/api/upload', { method: 'POST', body: form });
  await loadDocuments();
}

async function loadDocuments() {
  const res = await fetch('/api/documents');
  const docs = await res.json();
  const list = document.getElementById('docList');
  list.innerHTML = '';

  docs.forEach((d) => {
    const li = document.createElement('li');
    li.className = 'doc-item group';

    // Create a beautiful document item
    li.innerHTML = `
      <div class="flex items-center space-x-3 flex-1">
        <div class="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
          <i class="fas fa-file-pdf text-white text-sm"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-slate-700 dark:text-slate-300 truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors duration-300">
            ${d.filename}
          </div>
          <div class="text-xs text-slate-500 dark:text-slate-400">
            PDF Document
          </div>
        </div>
      </div>
      <div class="flex items-center space-x-2">
        <button class="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-all duration-300 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0" title="View document">
          <i class="fas fa-eye text-slate-600 dark:text-slate-400 text-xs"></i>
        </button>
        <div class="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-blue-400 dark:group-hover:bg-blue-500 transition-all duration-300"></div>
      </div>
    `;

    li.dataset.filename = d.filename;

    // Add click handlers
    li.addEventListener('click', () => {
      // Toggle selection
      li.classList.toggle('selected');

      // Update visual state
      const indicator = li.querySelector('.w-3.h-3');
      const viewBtn = li.querySelector('button');

      if (li.classList.contains('selected')) {
        indicator.className = 'w-3 h-3 rounded-full bg-blue-500 animate-pulse';
        viewBtn.className = 'p-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/50 rounded-lg transition-all duration-300 opacity-100 transform translate-x-0';
        viewBtn.innerHTML = '<i class="fas fa-check text-blue-600 dark:text-blue-400 text-xs"></i>';
        viewBtn.title = 'Document selected';
      } else {
        indicator.className = 'w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-blue-400 dark:group-hover:bg-blue-500 transition-all duration-300';
        viewBtn.className = 'p-2 bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-all duration-300 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0';
        viewBtn.innerHTML = '<i class="fas fa-eye text-slate-600 dark:text-slate-400 text-xs"></i>';
        viewBtn.title = 'View document';
      }

      // Load document if not already loaded
      if (li.classList.contains('selected') && currentDoc !== d.filename) {
        loadDocument(d);
      }

      updateSelectedCount();
    });

    list.appendChild(li);
  });

  updateSelectedCount();
}

function getSelectedDocs() {
  const list = document.getElementById('docList');
  const docs = [];
  for (const li of list.children) {
    if (li.classList.contains('selected')) {
      docs.push(li.dataset.filename || li.textContent);
    }
  }
  return docs;
}

// Update the page count display in the UI
function updatePageCount() {
  const pageCountEl = document.getElementById('pageCount');
  if (pageCountEl) {
    pageCountEl.textContent = ` / ${totalPages}`;
  }

  // Update toolbar state
  updateToolbarState();
}

// Validate and clamp a page number to the valid range
function clampPageNumber(page) {
  return Math.max(1, Math.min(Math.floor(page || 1), totalPages));
}

function updateSelectedCount() {
  const el = document.getElementById('selectedCount');
  if (!el) return;
  const list = document.getElementById('docList');
  let count = 0;
  for (const li of list.children) if (li.classList.contains('selected')) count++;
  el.textContent = `${count} selected`;
}

function renderSections(sections, relatedMap) {
  const container = document.getElementById('sections');
  container.innerHTML = '';

  if (sections.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8">
        <div class="w-16 h-16 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-chart-line text-slate-400 dark:text-slate-500 text-xl"></i>
        </div>
        <p class="text-slate-500 dark:text-slate-400 text-sm">No sections found. Run analysis to discover document sections.</p>
      </div>
    `;
    return;
  }

  // Create header
  const header = document.createElement('div');
  header.className = 'mb-4';
  header.innerHTML = `
    <h3 class="text-lg font-bold text-slate-800 dark:text-white flex items-center">
      <div class="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mr-3">
        <i class="fas fa-chart-line text-white text-xs"></i>
      </div>
      Top Sections (${sections.length})
    </h3>
  `;
  container.appendChild(header);

  currentSections = sections;

  sections.forEach((s, index) => {
    const key = `${s.document}|${s.section_title}|${s.page_number}`;
    const item = document.createElement('div');
    item.className = 'section-item group cursor-pointer';

    item.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center space-x-3 mb-2">
            <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-md">
              ${index + 1}
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="section-title text-base font-semibold text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">
                ${s.section_title}
              </h4>
              <div class="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
                <span class="flex items-center">
                  <i class="fas fa-file-pdf mr-1"></i>
                  ${s.document}
                </span>
                <span class="flex items-center">
                  <i class="fas fa-file-alt mr-1"></i>
                  Page ${s.page_number}
                </span>
              </div>
            </div>
          </div>
          
          ${s.section_summary ? `
            <p class="section-content text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              ${s.section_summary}
            </p>
          ` : ''}
        </div>
        
        <button class="ml-4 p-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-300 opacity-0 group-hover:opacity-100" 
                data-page="${s.page_number}" data-doc="${s.document}" title="Jump to this section">
          <i class="fas fa-external-link-alt text-xs"></i>
        </button>
      </div>
      
      ${relatedMap[key] && relatedMap[key].length > 0 ? `
        <div class="related-sections mt-4">
          <div class="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center">
            <i class="fas fa-link mr-2"></i>
            Related Sections (${relatedMap[key].length})
          </div>
          <div class="flex flex-wrap gap-2">
            ${relatedMap[key].map((r, idx) => `
              <button class="related-item hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-300" 
                      data-page="${r.page_number}" data-doc="${r.document}" title="Jump to ${r.section_title}">
                <div class="flex items-center space-x-2">
                  <span class="text-xs">${idx + 1}</span>
                  <span class="truncate max-w-32">${r.section_title}</span>
                  <span class="text-xs opacity-75">p.${r.page_number}</span>
                </div>
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    container.appendChild(item);

    // Add click handlers
    const jumpBtn = item.querySelector('button[data-page]');
    if (jumpBtn) {
      jumpBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const page = parseInt(jumpBtn.getAttribute('data-page'), 10);
        const doc = jumpBtn.getAttribute('data-doc');

        // Load document if not already loaded
        if (currentDoc !== `/files/${doc}`) {
          const docObj = { filename: doc };
          loadDocument(docObj);
          // Wait a bit for the viewer to initialize before jumping to page
          setTimeout(async () => {
            const ok = await jumpToPage(page);
            if (!ok) toast('Navigation failed.', 'error');
          }, 1000);
        } else {
          // Document already loaded, jump directly to page
          const ok = await jumpToPage(page);
          if (!ok) toast('Navigation failed.', 'error');
        }
      });
    }

    // Add click handlers for related sections
    item.querySelectorAll('.related-item').forEach((relBtn) => {
      relBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const page = parseInt(relBtn.getAttribute('data-page'), 10);
        const doc = relBtn.getAttribute('data-doc');

        // Load document if not already loaded
        if (currentDoc !== `/files/${doc}`) {
          const docObj = { filename: doc };
          loadDocument(docObj);
          // Wait a bit for the viewer to initialize before jumping to page
          setTimeout(async () => {
            const ok = await jumpToPage(page);
            if (!ok) toast('Navigation failed.', 'error');
          }, 1000);
        } else {
          // Document already loaded, jump directly to page
          const ok = await jumpToPage(page);
          if (!ok) toast('Navigation failed.', 'error');
        }
      });
    });
  });
}

function renderSnippets(snippets) {
  const container = document.getElementById('snippets');
  container.innerHTML = '';

  if (!snippets || snippets.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6">
        <div class="w-12 h-12 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 rounded-xl flex items-center justify-center mx-auto mb-3">
          <i class="fas fa-quote-left text-slate-400 dark:text-slate-500"></i>
        </div>
        <p class="text-slate-500 dark:text-slate-400 text-sm">No snippets found. Run analysis to extract key insights.</p>
      </div>
    `;
    return;
  }

  // Create header
  const header = document.createElement('div');
  header.className = 'mb-4';
  header.innerHTML = `
    <h3 class="text-lg font-bold text-slate-800 dark:text-white flex items-center">
      <div class="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mr-3">
        <i class="fas fa-quote-left text-white text-xs"></i>
      </div>
      Key Insights (${snippets.length})
    </h3>
  `;
  container.appendChild(header);

  currentSnippets = snippets;

  snippets.forEach((s, index) => {
    const item = document.createElement('div');
    item.className = 'snippet-item group cursor-pointer';

    item.innerHTML = `
      <div class="flex items-start space-x-3">
        <div class="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-md flex-shrink-0">
          ${index + 1}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center space-x-2 mb-2 text-xs text-slate-500 dark:text-slate-400">
            <span class="flex items-center">
              <i class="fas fa-file-pdf mr-1"></i>
              ${s.document}
            </span>
            <span class="flex items-center">
              <i class="fas fa-file-alt mr-1"></i>
              Page ${s.page_number}
            </span>
          </div>
          <p class="section-content text-sm text-slate-700 dark:text-slate-300 leading-relaxed group-hover:text-slate-900 dark:group-hover:text-white transition-colors duration-300">
            "${s.refined_text}"
          </p>
        </div>
        
        <button class="ml-3 p-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-300 opacity-0 group-hover:opacity-100 flex-shrink-0" 
                data-page="${s.page_number}" data-doc="${s.document}" title="Jump to this snippet">
          <i class="fas fa-external-link-alt text-xs"></i>
        </button>
      </div>
    `;

    container.appendChild(item);

    // Add click handler
    const jumpBtn = item.querySelector('button[data-page]');
    if (jumpBtn) {
      jumpBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const page = parseInt(jumpBtn.getAttribute('data-page'), 10);
        const doc = jumpBtn.getAttribute('data-doc');

        // Load document if not already loaded
        if (currentDoc !== `/files/${doc}`) {
          const docObj = { filename: doc };
          loadDocument(docObj);
          // Wait a bit for the viewer to initialize before jumping to page
          setTimeout(async () => {
            const ok = await jumpToPage(page);
            if (!ok) toast('Navigation failed.', 'error');
          }, 1000);
        } else {
          // Document already loaded, jump directly to page
          const ok = await jumpToPage(page);
          if (!ok) toast('Navigation failed.', 'error');
        }
      });
    }
  });
}

// Jump to a specific page in the current PDF
async function jumpToPage(pageNumber) {
  try {
    if (!pdfDoc) {
      toast('No PDF loaded', 'error');
      return false;
    }

    const clampedPage = clampPageNumber(pageNumber);

    if (clampedPage === currentPage) {
      return true; // Already on the requested page
    }

    // Load the requested page
    await loadPage(clampedPage);

    // Update the goto input field
    const gotoInput = document.getElementById('gotoPageInput');
    if (gotoInput) {
      gotoInput.value = clampedPage;
    }

    toast(`Jumped to page ${clampedPage}`, 'success');
    return true;

  } catch (error) {
    console.error('Error jumping to page:', error);
    toast('Failed to jump to page', 'error');
    return false;
  }
}

// Set up a global error handler for PDF.js viewer
window.addEventListener('error', (event) => {
  console.debug('PDF.js error:', event.error);
  if (event.error && !event.error.message?.includes('PDF')) {
    toast('An error occurred with the PDF viewer', 'error');
  }
});

// Show text selection loading state
function showTextSelectionLoading() {
  let panel = document.getElementById('textSelectionPanel');

  // Create panel if it doesn't exist
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'textSelectionPanel';
    panel.className = 'fixed top-20 right-4 w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-40 hidden';
    document.body.appendChild(panel);
  }

  panel.innerHTML = `
    <div class="p-6">
      <div class="flex items-center space-x-3 mb-4">
        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        <h3 class="text-lg font-semibold text-slate-800 dark:text-white">Analyzing Text Selection...</h3>
      </div>
      
      <!-- Progress Bar -->
      <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-4">
        <div id="textSelectionProgress" class="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
      </div>
      
      <div class="text-sm text-slate-600 dark:text-slate-400">
        <div id="textSelectionStatus">Initializing analysis...</div>
      </div>
    </div>
  `;

  panel.classList.remove('hidden');

  // Simulate progress updates
  let progress = 0;
  const progressBar = document.getElementById('textSelectionProgress');
  const status = document.getElementById('textSelectionStatus');

  const progressInterval = setInterval(() => {
    progress += Math.random() * 15;
    if (progress > 90) progress = 90;

    if (progressBar) progressBar.style.width = progress + '%';
    if (status) {
      if (progress < 30) status.textContent = 'Extracting text context...';
      else if (progress < 60) status.textContent = 'Searching across documents...';
      else if (progress < 90) status.textContent = 'Generating insights...';
      else status.textContent = 'Finalizing results...';
    }
  }, 200);

  // Store interval for cleanup
  panel.dataset.progressInterval = progressInterval;
}

// Hide text selection UI
function hideTextSelectionUI() {
  const insightsPanel = document.getElementById('textSelectionPanel');
  if (insightsPanel) {
    insightsPanel.classList.add('hidden');
  }

  // Clear global variables
  selectedText = "";
  textSelectionInsights = null;
}

// Clear text selection
function clearTextSelection() {
  hideTextSelectionUI();
  toast('Text selection cleared', 'info');
}

// Display text selection insights
function displayTextSelectionInsights(insights) {
  let panel = document.getElementById('textSelectionPanel');

  // Create panel if it doesn't exist
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'textSelectionPanel';
    panel.className = 'fixed top-20 right-4 w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-40 hidden';
    document.body.appendChild(panel);
  }

  // Clear any existing progress intervals
  const existingInterval = panel.dataset.progressInterval;
  if (existingInterval) {
    clearInterval(parseInt(existingInterval));
  }

  panel.innerHTML = `
    <div class="p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-slate-800 dark:text-white">Text Selection Insights</h3>
        <button onclick="clearTextSelection()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <div class="mb-4">
        <div class="text-sm text-slate-600 dark:text-slate-400 mb-2">Selected Text:</div>
        <div class="bg-slate-100 dark:bg-slate-700 p-3 rounded-lg text-sm text-slate-800 dark:text-slate-200">
          "${insights.selected_text.substring(0, 200)}${insights.selected_text.length > 200 ? '...' : ''}"
        </div>
      </div>
      
      ${insights.summary ? `
        <div class="mb-4">
          <div class="text-sm text-slate-600 dark:text-slate-400 mb-2">Summary:</div>
          <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm text-slate-700 dark:text-slate-300">
            ${insights.summary}
          </div>
        </div>
      ` : ''}
      
      ${insights.insights && insights.insights.length > 0 ? `
        <div class="mb-4">
          <div class="text-sm text-slate-600 dark:text-slate-400 mb-2">Related Content (${insights.insights.length}):</div>
          <div class="space-y-2 max-h-40 overflow-y-auto">
            ${insights.insights.slice(0, 5).map((insight, idx) => `
              <div class="bg-slate-50 dark:bg-slate-800 p-2 rounded border-l-4 border-blue-500">
                <div class="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  ${insight.document} (p.${insight.page_number}) - ${insight.insight_type}
                </div>
                <div class="text-sm text-slate-700 dark:text-slate-300">
                  ${insight.relevant_text.substring(0, 100)}${insight.relevant_text.length > 100 ? '...' : ''}
                </div>
                <button onclick="jumpToDocument('${insight.document}', ${insight.page_number})" 
                        class="mt-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                  Jump to this section →
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <div class="flex space-x-2">
        <button onclick="getTextSelectionInsights()" 
                class="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
          Get Recommendations
        </button>
        <button onclick="createPodcastFromTextSelection()" 
                class="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
          Create Podcast
        </button>
      </div>
    </div>
  `;

  panel.classList.remove('hidden');
}

// Jump to document function (placeholder for now)
function jumpToDocument(documentName, pageNumber) {
  if (!documentName) {
    showNotification('Document name not available', 'error');
    return;
  }

  // Load the document if not already loaded
  if (currentDoc !== `/files/${documentName}`) {
    initViewer(`/files/${documentName}`).then(() => {
      // Wait for viewer to initialize, then jump to page
      setTimeout(() => {
        jumpToPage(pageNumber || 1);
      }, 1000);
    });
  } else {
    // Document already loaded, jump directly to page
    jumpToPage(pageNumber || 1);
  }

  // Hide the text selection panel after jumping
  hideTextSelectionUI();
}

// Get text selection recommendations (placeholder for now)
function getTextSelectionRecommendations() {
  toast('Getting recommendations...', 'info');
  // TODO: Implement recommendations API call
}

// Create podcast from text selection (placeholder for now)
async function createPodcastFromTextSelection() {
  if (!textSelectionInsights) {
    toast('No text selection insights available', 'error');
    return;
  }

  // Show podcast generation progress
  showPodcastGenerationProgress();

  try {
    const response = await fetch('/api/enhanced-podcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        selected_text: textSelectionInsights.selected_text,
        related_insights: textSelectionInsights.insights || [],
        document: currentDoc || 'unknown',
        page_number: currentPage,
        conversation_style: 'academic',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // Hide progress and show success
    hidePodcastGenerationProgress();

    if (result.url) {
      toast('Podcast generated successfully!', 'success');

      // Set up the audio player with new source
      const player = document.getElementById('player');
      const audioUrl = result.url + '?t=' + Date.now(); // Add timestamp to prevent caching

      player.src = audioUrl;
      player.setAttribute('title', `Podcast: ${textSelectionInsights.selected_text.substring(0, 50)}...`);

      // Reset audio player initialization to ensure proper setup
      resetAudioPlayerInitialization();

      // Initialize audio player UI before loading
      initializeAudioPlayer();

      // Clear any existing audio info
      const audioInfo = document.getElementById('audioInfo');
      const audioTitle = document.getElementById('audioTitle');
      if (audioInfo) audioInfo.classList.add('hidden');
      if (audioTitle) audioTitle.textContent = 'Loading podcast...';

      // Wait for audio to load metadata
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Audio loading timeout'));
        }, 15000); // 15 second timeout

        player.addEventListener('loadedmetadata', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });

        player.addEventListener('error', (e) => {
          clearTimeout(timeout);
          reject(new Error(`Audio loading failed: ${e.message || 'Unknown error'}`));
        }, { once: true });

        player.load(); // Force load
      });

      // Play the podcast
      await player.play();

      // Update UI to show it's playing
      const playPauseBtn = document.getElementById('playPauseBtn');
      if (playPauseBtn) {
        const icon = playPauseBtn.querySelector('i');
        if (icon) icon.className = 'fas fa-pause text-sm';
      }

      if (audioInfo) audioInfo.classList.remove('hidden');
      if (audioTitle) audioTitle.textContent = `Podcast: ${textSelectionInsights.selected_text.substring(0, 50)}...`;

    } else {
      toast('Failed to generate podcast', 'error');
    }
  } catch (error) {
    console.error('Error creating podcast:', error);
    hidePodcastGenerationProgress();
    toast(`Error creating podcast: ${error.message}`, 'error');
  }
}

async function analyze() {
  // Get persona and job from input fields, use defaults if empty
  const persona = document.getElementById('persona').value.trim() || 'General User';
  const job = document.getElementById('job').value.trim() || 'Understanding document content and structure';

  const selectedDocs = getSelectedDocs();
  if (selectedDocs.length === 0) {
    toast('Please select at least one document to analyze', 'warning');
    return;
  }

  // Show loading state
  const analyzeBtn = document.getElementById('analyzeBtn');
  const originalText = analyzeBtn.innerHTML;
  analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
  analyzeBtn.disabled = true;

  try {
    // Call the correct /api/analyze endpoint
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona: persona,
        job: job,
        documents: selectedDocs,
        approach: 'nlp',
        method: 'auto',
        top_k: 5
      })
    });

    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('Analysis response:', data);

    // Store the analysis results
    currentSections = data.sections || [];
    currentSnippets = data.snippets || [];

    // Render the results - this is what the analyze button should do
    renderSections(currentSections, data.related_map || {});
    renderSnippets(currentSnippets);

    // Get document recommendations (this is separate from insights/podcast)
    await getDocumentRecommendations();

    HAS_ANALYSIS = true;
    toast('Analysis completed successfully! Top Sections and Key Insights are now available.', 'success');

  } catch (error) {
    console.error('Analysis failed:', error);
    toast(`Analysis failed: ${error.message}`, 'error');
  } finally {
    // Restore button state
    analyzeBtn.innerHTML = originalText;
    analyzeBtn.disabled = false;
  }
}

// Get document recommendations
async function getDocumentRecommendations() {
  try {
    if (!currentDoc) return;

    // Use the correct recommendations endpoint
    const response = await fetch(`/api/index/recommendations/${encodeURIComponent(currentDoc)}?top_k=5`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Document recommendations:', data);

      // Update the recommendations panel if data is available
      if (data.recommendations && data.recommendations.length > 0) {
        updateRecommendationsPanel(data.recommendations);
      }
    } else {
      console.warn('Failed to get recommendations:', response.status);
    }
  } catch (error) {
    console.error('Error getting document recommendations:', error);
  }
}

// Update recommendations panel
function updateRecommendationsPanel(recommendations) {
  const container = document.getElementById('recommendations');
  if (!container) return;

  if (!recommendations || recommendations.length === 0) {
    container.innerHTML = `
      <div class="text-center text-xs text-slate-500 dark:text-slate-400 py-3">
        No recommendations found
      </div>
    `;
    return;
  }

  container.innerHTML = recommendations.slice(0, 5).map((rec, index) => {
    // Handle different possible data structures
    const documentName = rec.document || rec.filename || 'Unknown';
    const pageNumber = rec.page_number || rec.page || 1;
    const relevantText = rec.relevant_text || rec.text || rec.content || 'No text available';

    return `
      <div class="p-2 bg-slate-50 dark:bg-slate-700 rounded-lg border-l-4 border-emerald-500">
        <div class="text-xs text-slate-500 dark:text-slate-400 mb-1">
          ${documentName} (p.${pageNumber})
        </div>
        <div class="text-sm text-slate-700 dark:text-slate-300">
          ${relevantText.substring(0, 80)}${relevantText.length > 80 ? '...' : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Get document insights
async function getDocumentInsights() {
  try {
    if (!currentDoc) return;

    const persona = document.getElementById('persona').value.trim();
    const job = document.getElementById('job').value.trim();
    const curr = currentSections[0];
    // Use top 3 snippet texts for richer insights
    const relatedTexts = (currentSnippets || []).slice(0, 3).map((s) => s.refined_text);

    const response = await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona,
        job,
        current_text: curr ? curr.section_title : '',
        related_texts: relatedTexts
      }),
    });

    if (response.ok) {
      const data = await response.json();
      document.getElementById('insights').textContent = data.content;
      toast('Insights ready', 'success');
    } else {
      console.warn('Failed to get insights:', response.status);
    }
  } catch (error) {
    console.error('Error getting document insights:', error);
  }
}

// Get document podcast
async function getDocumentPodcast() {
  try {
    if (!currentDoc) return;

    const persona = document.getElementById('persona').value.trim() || 'listener';
    const job = document.getElementById('job').value.trim() || 'exploring this content';

    // Create enhanced podcast data with sections and snippets
    const sections = currentSections.slice(0, 3); // Top 3 sections
    const snippets = currentSnippets.slice(0, 5); // Top 5 snippets

    // Create related insights from sections and snippets
    const relatedInsights = [];

    // Add sections as insights
    sections.forEach((section, index) => {
      relatedInsights.push({
        document: section.document,
        page_number: section.page_number,
        section_title: section.section_title,
        relevant_text: section.section_summary || section.section_title,
        relevance_score: 0.9 - (index * 0.1), // Decreasing relevance
        insight_type: "section",
        jump_url: `/files/${section.document}#page=${section.page_number}`
      });
    });

    // Add snippets as insights
    snippets.forEach((snippet, index) => {
      relatedInsights.push({
        document: snippet.document,
        page_number: snippet.page_number,
        section_title: `Key Insight ${index + 1}`,
        relevant_text: snippet.refined_text,
        relevance_score: 0.85 - (index * 0.05), // Decreasing relevance
        insight_type: "snippet",
        jump_url: `/files/${snippet.document}#page=${snippet.page_number}`
      });
    });

    // Use the ENHANCED podcast API for dual voices and better quality
    const enhancedPodcastData = {
      selected_text: sections.length > 0 ? sections[0].section_summary || sections[0].section_title :
        snippets.length > 0 ? snippets[0].refined_text :
          "Analysis of selected documents",
      related_insights: relatedInsights,
      document: currentDoc ? currentDoc.split('/').pop() : 'analyzed_documents',
      page_number: currentPage || 1,
      conversation_style: "academic",
      persona: persona,
      job: job
    };

    console.log('Creating enhanced podcast with data:', enhancedPodcastData);

    // Send to enhanced podcast endpoint for dual voice generation
    const response = await fetch('/api/enhanced-podcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enhancedPodcastData)
    });

    if (response.ok) {
      const data = await response.json();
      const player = document.getElementById('player');

      console.log('Enhanced podcast response:', data);
      console.log('Audio URL from API:', data.url);

      // Set up the audio player with new source
      const audioUrl = data.url + '?t=' + Date.now(); // Add timestamp to prevent caching
      console.log('Final audio URL:', audioUrl);

      player.src = audioUrl;
      player.setAttribute('title', `AI Podcast: ${job} (Dual Voice)`);

      // Reset audio player initialization to ensure proper setup
      resetAudioPlayerInitialization();

      // Initialize audio player UI before loading
      initializeAudioPlayer();

      // Clear any existing audio info
      const audioInfo = document.getElementById('audioInfo');
      const audioTitle = document.getElementById('audioTitle');
      if (audioInfo) audioInfo.classList.add('hidden');
      if (audioTitle) audioTitle.textContent = 'Loading dual voice podcast...';

      // Wait for audio to load metadata
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Audio loading timeout'));
        }, 15000); // 15 second timeout for enhanced podcast

        player.addEventListener('loadedmetadata', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });

        player.addEventListener('error', (e) => {
          clearTimeout(timeout);
          reject(new Error(`Audio loading failed: ${e.message || 'Unknown error'}`));
        }, { once: true });

        player.load(); // Force load
      });

      // Initialize audio player UI if not already done
      initializeAudioPlayer();

      // Play the podcast
      await player.play();

      // Update UI to show it's playing
      const playPauseBtn = document.getElementById('playPauseBtn');

      if (playPauseBtn) {
        const icon = playPauseBtn.querySelector('i');
        if (icon) icon.className = 'fas fa-pause text-sm';
      }

      if (audioInfo) audioInfo.classList.remove('hidden');
      if (audioTitle) audioTitle.textContent = `AI Podcast: ${job} (Dual Voice)`;

      toast('High-quality dual voice podcast is now playing! 🎧', 'success');

    } else {
      console.warn('Failed to generate podcast:', response.status);
    }
  } catch (error) {
    console.error('Error getting document podcast:', error);
  }
}

// Set up text selection events for PDF.js
function setupTextSelectionEvents() {
  try {
    if (!pdfCanvas) {
      console.log("PDF canvas not available for text selection setup");
      return;
    }

    // Clear any existing event listeners
    pdfCanvas.removeEventListener('mouseup', handleTextSelection);
    pdfCanvas.removeEventListener('keyup', handleTextSelection);

    // Add text selection event listeners
    pdfCanvas.addEventListener('mouseup', handleTextSelection);
    pdfCanvas.addEventListener('keyup', handleTextSelection);

    // Add selection change listener for better text capture
    document.addEventListener('selectionchange', handleSelectionChange);

    // Add keyboard shortcuts
    document.addEventListener('keydown', handleTextSelectionKeyboard);

    console.log("✅ PDF.js text selection events configured successfully");
  } catch (error) {
    console.error("Error setting up PDF.js text selection events:", error);
  }
}

// Handle selection change event
function handleSelectionChange() {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  // Clear any existing timeout
  if (textSelectionTimeout) {
    clearTimeout(textSelectionTimeout);
  }

  // Only process if there's meaningful text selection
  if (selectedText && selectedText.length > 10) {
    console.log('Text selection detected:', selectedText.substring(0, 100) + '...');

    // Debounce the text selection processing
    textSelectionTimeout = setTimeout(() => {
      if (!isProcessingTextSelection) {
        handleTextSelection(selectedText, currentPage);
      }
    }, 500);
  } else if (selectedText.length === 0) {
    // Clear selection when no text is selected
    hideTextSelectionUI();
  }
}

// Handle keyboard shortcuts for text selection
function handleTextSelectionKeyboard(event) {
  try {
    // Escape key to clear selection
    if (event.key === 'Escape') {
      clearTextSelection();
      event.preventDefault();
    }

    // Ctrl+A to select all text on current page
    if (event.ctrlKey && event.key === 'a') {
      selectAllTextOnCurrentPage();
      event.preventDefault();
    }
  } catch (error) {
    console.error("Error handling text selection keyboard:", error);
  }
}

// Select all text on the current page
function selectAllTextOnCurrentPage() {
  try {
    if (isContinuousView) {
      // In continuous view, select text from the current page wrapper
      const currentPageWrapper = document.querySelector(`[data-page-number="${currentPage}"]`);
      if (currentPageWrapper) {
        const textLayer = currentPageWrapper.querySelector('.text-layer');
        if (textLayer) {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(textLayer);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    } else {
      // In single page view, select text from the single page text layer
      const textLayer = document.getElementById('single-page-text-layer');
      if (textLayer) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(textLayer);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    toast('All text on current page selected', 'info');
  } catch (error) {
    console.error("Error selecting all text:", error);
  }
}

// Handle text selection from PDF.js
async function handleTextSelection(event) {
  try {
    // Get selected text from the document
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (!selectedText || selectedText.length < 10) {
      return; // Ignore short selections
    }

    // Get the range of the selection
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);

      // Check if the selection is within our PDF viewer
      const pdfContainer = document.getElementById('pdf-viewer-container');
      if (pdfContainer && pdfContainer.contains(range.commonAncestorContainer)) {

        // Process the selected text and trigger insights
        console.log('Processing text selection:', selectedText.substring(0, 100) + '...');

        // Set processing flag to prevent duplicate calls
        isProcessingTextSelection = true;

        try {
          // Call the text selection API
          const response = await fetch('/api/text-selection', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              selected_text: selectedText,
              document: currentDoc ? currentDoc.split('/').pop() : 'unknown',
              page_number: currentPage,
              persona: document.getElementById('persona')?.value || '',
              job: document.getElementById('job')?.value || ''
            }),
          });

          if (response.ok) {
            const data = await response.json();
            console.log('Text selection response:', data);

            // Store the insights globally
            textSelectionInsights = data;

            // Display the insights
            displayTextSelectionInsights(data);

            // Also refresh recommendations for current document
            try {
              getDocumentRecommendations();
            } catch (_) { }

          } else {
            console.error('Text selection API failed:', response.status);
            toast('Failed to analyze text selection', 'error');
          }
        } catch (error) {
          console.error('Error processing text selection:', error);
          toast('Error processing text selection', 'error');
        } finally {
          // Reset processing flag
          isProcessingTextSelection = false;
        }
      }
    }
  } catch (error) {
    console.error("Error in handleTextSelection:", error);
    isProcessingTextSelection = false;
  }
}

// Highlight selected text in the text layer
function highlightSelectedText(selection) {
  try {
    // Clear previous highlighting
    clearTextHighlighting();

    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);

    // Get the text layer container
    const textLayer = document.querySelector('.text-layer');
    if (!textLayer) return;

    // Get the bounding rectangle of the selection
    const rects = range.getClientRects();
    if (rects.length === 0) return;

    // Create a highlight for each rectangle in the selection
    Array.from(rects).forEach(rect => {
      if (rect.width === 0 || rect.height === 0) return;

      // Create highlight element
      const highlight = document.createElement('div');
      highlight.className = 'text-highlight';

      // Position the highlight
      const textLayerRect = textLayer.getBoundingClientRect();
      highlight.style.position = 'absolute';
      highlight.style.left = `${rect.left - textLayerRect.left + textLayer.scrollLeft}px`;
      highlight.style.top = `${rect.top - textLayerRect.top + textLayer.scrollTop}px`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;
      highlight.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
      highlight.style.pointerEvents = 'none';
      highlight.style.borderRadius = '2px';
      highlight.style.zIndex = '1';

      textLayer.appendChild(highlight);
    });

    // Also add the selected class to the text nodes for better text selection
    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentNode && !node.parentNode.classList.contains('text-layer')) {
        node.parentNode.classList.add('selected');
      }
    }

  } catch (error) {
    console.error("Error highlighting selected text:", error);
  }
}

// Clear text highlighting
function clearTextHighlighting() {
  try {
    // Remove selected class
    document.querySelectorAll('.selected').forEach(el => {
      el.classList.remove('selected');
    });

    // Remove highlight elements
    document.querySelectorAll('.text-highlight').forEach(el => {
      el.remove();
    });
  } catch (error) {
    console.error("Error clearing text highlighting:", error);
  }
}

// Process the selected text and trigger insights
function processSelectedText(text, pageNumber) {
  console.log("Processing selected text:", text.substring(0, 100) + "...", "Page:", pageNumber);

  if (!text || text.trim().length < 10) {
    console.log("Text too short, ignoring selection");
    return;
  }

  // Store the selected text globally
  selectedText = text.trim();

  // Show loading state
  showTextSelectionLoading();

  // Call the text selection API
  fetch('/api/text-selection', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      selected_text: selectedText,
      document: currentDoc || 'unknown',
      page_number: pageNumber || currentPage,
      persona: document.getElementById('persona')?.value || '',
      job: document.getElementById('job')?.value || '',
    }),
  })
    .then(response => response.json())
    .then(data => {
      console.log("Text selection response:", data);
      textSelectionInsights = data;
      displayTextSelectionInsights(data);
    })
    .catch(error => {
      console.error('Error processing text selection:', error);
      toast(`Error processing text selection: ${error.message}`, 'error');
    });
}

// Set up the toolbar for PDF.js
function setupToolbar() {
  try {
    // Navigation buttons
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const gotoPageBtn = document.getElementById('gotoPageBtn');
    const gotoPageInput = document.getElementById('gotoPageInput');

    // Zoom buttons
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');

    // Search functionality
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');

    // Text selection button (now optional since we have automatic selection)
    const textSelectionBtn = document.getElementById('textSelectionBtn');

    // Navigation event listeners
    if (prevPageBtn) {
      prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          loadPage(currentPage - 1);
        }
      });
    }

    if (nextPageBtn) {
      nextPageBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
          loadPage(currentPage + 1);
        }
      });
    }

    if (gotoPageBtn && gotoPageInput) {
      gotoPageBtn.addEventListener('click', () => {
        const pageNum = parseInt(gotoPageInput.value);
        if (pageNum >= 1 && pageNum <= totalPages) {
          loadPage(pageNum);
        } else {
          toast('Invalid page number', 'error');
        }
      });

      // Allow Enter key to trigger goto
      gotoPageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          gotoPageBtn.click();
        }
      });
    }

    // Zoom event listeners
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        currentScale = Math.min(currentScale * 1.2, 3.0);
        if (isContinuousView) {
          loadAllPages(); // Reload all pages with new scale
        } else {
          loadPage(currentPage); // Reload current page with new scale
        }
      });
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        currentScale = Math.max(currentScale / 1.2, 0.5);
        if (isContinuousView) {
          loadAllPages(); // Reload all pages with new scale
        } else {
          loadPage(currentPage); // Reload current page with new scale
        }
      });
    }

    // Search functionality
    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (query) {
          searchInDocument(query);
        }
      });

      // Allow Enter key to trigger search
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          searchBtn.click();
        }
      });
    }

    // Text selection button (now shows manual text input as fallback)
    if (textSelectionBtn) {
      textSelectionBtn.addEventListener('click', () => {
        showManualTextInput();
      });
    }

    // View mode toggle
    viewModeToggle = document.getElementById('viewModeToggle');
    if (viewModeToggle) {
      viewModeToggle.addEventListener('click', () => {
        toggleViewMode();
      });
    }

    // Update button states
    updateToolbarState();

    console.log("✅ PDF.js toolbar configured successfully");
  } catch (error) {
    console.error("Error setting up toolbar:", error);
  }
}

// Update toolbar button states
function updateToolbarState() {
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const gotoPageInput = document.getElementById('gotoPageInput');
  const gotoPageBtn = document.getElementById('gotoPageBtn');

  // Update navigation buttons based on view mode
  if (isContinuousView) {
    // In continuous view, disable navigation buttons since all pages are visible
    if (prevPageBtn) prevPageBtn.disabled = true;
    if (nextPageBtn) nextPageBtn.disabled = true;
    if (gotoPageInput) gotoPageInput.disabled = true;
    if (gotoPageBtn) gotoPageBtn.disabled = true;
  } else {
    // In single page view, enable navigation buttons
    if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;
    if (gotoPageInput) gotoPageInput.disabled = false;
    if (gotoPageBtn) gotoPageBtn.disabled = false;
  }

  // Update view mode toggle button
  if (viewModeToggle) {
    if (isContinuousView) {
      viewModeToggle.innerHTML = '<i class="fas fa-list mr-1"></i>Continuous';
      viewModeToggle.title = 'Switch to single page view';
    } else {
      viewModeToggle.innerHTML = '<i class="fas fa-file-alt mr-1"></i>Single';
      viewModeToggle.title = 'Switch to continuous view';
    }
  }
}

// Search in the current document
async function searchInDocument(query) {
  try {
    if (!pdfDoc || !query.trim()) return;

    toast('Searching in document...', 'info');

    // Simple text search implementation
    const results = [];

    // Search through all pages
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');

        if (pageText.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            page: pageNum,
            text: pageText.substring(0, 200) + '...'
          });
        }
      } catch (error) {
        console.error(`Error searching page ${pageNum}:`, error);
      }
    }

    if (results.length > 0) {
      // Show search results
      showSearchResults(query, results);
    } else {
      toast('No matches found', 'info');
    }

  } catch (error) {
    console.error('Error searching document:', error);
    toast('Search failed', 'error');
  }
}

// Show search results
function showSearchResults(query, results) {
  // Create a simple results overlay
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  overlay.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-2xl max-h-96 overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-slate-800 dark:text-white">
          Search Results for "${query}"
        </h3>
        <button class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" onclick="this.closest('.fixed').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="space-y-3">
        ${results.map(result => `
          <div class="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600" onclick="loadPage(${result.page}); this.closest('.fixed').remove();">
            <div class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Page ${result.page}
            </div>
            <div class="text-xs text-slate-600 dark:text-slate-400">
              ${result.text}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close on outside click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

// Show manual text input as fallback
function showManualTextInput() {
  const input = prompt('Enter text to analyze:');
  if (input && input.trim().length >= 10) {
    processSelectedText(input.trim(), currentPage);
  }
}

// Retry loading PDF
function retryPDF() {
  if (currentDoc) {
    const docUrl = `/files/${encodeURIComponent(currentDoc)}`;
    initViewer(docUrl);
  } else {
    // No document selected, show neutral state
    showPDFNeutral();
  }
}

// Set up retry button event listener
document.addEventListener('DOMContentLoaded', function () {
  const retryBtn = document.getElementById('retry-pdf');
  if (retryBtn) {
    retryBtn.addEventListener('click', retryPDF);
  }
});

// Main function to initialize the application
async function main() {
  await fetchConfig();
  await fetchHealth();
  await loadDocuments();

  // Set up upload functionality
  setupUploadFunctionality();

  document.getElementById('analyzeBtn').addEventListener('click', analyze);
  const ib = document.getElementById('insightsBtn');
  const pb = document.getElementById('podcastBtn');
  const cb = document.getElementById('clusterBtn');
  if (ib) { ib.disabled = true; ib.addEventListener('click', insights); }
  if (pb) { pb.disabled = true; pb.addEventListener('click', podcast); }
  if (cb) { cb.addEventListener('click', clusterDocuments); }
  setupToolbar();

  // Initialize audio player
  initializeAudioPlayer();

  // Theme
  initTheme();
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  const selectAllBtn = document.getElementById('selectAllBtn');
  const clearSelectionBtn = document.getElementById('clearSelectionBtn');
  const deleteAllBtn = document.getElementById('deleteAllBtn');

  if (selectAllBtn) selectAllBtn.addEventListener('click', () => {
    const list = document.getElementById('docList');
    for (const li of list.children) li.classList.add('selected');
    updateSelectedCount();
  });
  if (clearSelectionBtn) clearSelectionBtn.addEventListener('click', () => {
    const list = document.getElementById('docList');
    for (const li of list.children) li.classList.remove('selected');
    updateSelectedCount();
  });
  if (deleteAllBtn) deleteAllBtn.addEventListener('click', () => {
    const selectedDocs = getSelectedDocs();
    if (selectedDocs.length === 0) {
      toast('Please select documents to delete', 'warning');
      return;
    }
    showDeleteAllConfirmation(selectedDocs);
  });

  const docFilter = document.getElementById('docFilter');
  if (docFilter) docFilter.addEventListener('input', () => {
    const q = (docFilter.value || '').toLowerCase();
    const list = document.getElementById('docList');
    for (const li of list.children) {
      const name = (li.dataset.filename || li.textContent || '').toLowerCase();
      li.style.display = name.includes(q) ? '' : 'none';
    }
  });
}

// Set up upload functionality with drag and drop
function setupUploadFunctionality() {
  const uploadBtn = document.getElementById('uploadBtn');
  const fileInput = document.getElementById('fileInput');
  const uploadArea = document.querySelector('.group\\/upload');

  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
      fileInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', uploadFiles);
  }

  // Drag and drop functionality
  if (uploadArea) {
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, preventDefaults, false);
      document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
      uploadArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, unhighlight, false);
    });

    // Handle dropped files
    uploadArea.addEventListener('drop', handleDrop, false);
  }
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight(e) {
  const uploadArea = document.querySelector('.group\\/upload');
  if (uploadArea) {
    uploadArea.classList.add('dragover');
  }
}

function unhighlight(e) {
  const uploadArea = document.querySelector('.group\\/upload');
  if (uploadArea) {
    uploadArea.classList.remove('dragover');
  }
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;

  if (files.length > 0) {
    // Show immediate feedback
    toast(`Processing ${files.length} dropped file(s)...`, 'info');

    const fileInput = document.getElementById('fileInput');
    fileInput.files = files;

    // Start upload after a brief delay to show the feedback
    setTimeout(() => {
      uploadFiles();
    }, 100);
  } else {
    toast('No valid files found in the dropped items', 'warning');
  }
}

// Initialize the application when DOM is loaded
window.addEventListener('DOMContentLoaded', main);

// Show text selection hint
function showTextSelectionHint() {
  // Create or show text selection hint
  let hint = document.getElementById('textSelectionHint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'textSelectionHint';
    hint.className = 'fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transform translate-y-full opacity-0 transition-all duration-300';
    hint.innerHTML = `
      <div class="flex items-center space-x-2">
        <i class="fas fa-mouse-pointer text-sm"></i>
        <span class="text-sm">Select text to get insights and recommendations</span>
      </div>
    `;
    document.body.appendChild(hint);
  }

  // Show the hint with animation
  setTimeout(() => {
    hint.classList.remove('translate-y-full', 'opacity-0');
    hint.classList.add('translate-y-0', 'opacity-100');
  }, 100);

  // Hide the hint after 5 seconds
  setTimeout(() => {
    hint.classList.add('translate-y-full', 'opacity-0');
  }, 5000);
}

// Insights function
async function insights() {
  if (!HAS_ANALYSIS || (!currentSections.length && !currentSnippets.length)) {
    toast('Run Analyze and ensure sections/snippets are available.', 'error');
    return;
  }
  const persona = document.getElementById('persona').value.trim();
  const job = document.getElementById('job').value.trim();
  const curr = currentSections[0];
  // Use top 3 snippet texts for richer insights
  const relatedTexts = (currentSnippets || []).slice(0, 3).map((s) => s.refined_text);
  const btn = document.getElementById('insightsBtn');
  const prev = btn.textContent; btn.disabled = true; btn.textContent = 'Thinking...';
  try {
    const res = await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona, job, current_text: curr ? curr.section_title : '', related_texts: relatedTexts }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    document.getElementById('insights').textContent = data.content;
    toast('Insights ready', 'success');
  } catch (e) {
    toast(`Insights failed: ${e.message || e}`, 'error');
  } finally {
    btn.disabled = false; btn.textContent = prev;
  }
}

// Podcast function
async function podcast() {
  if (!HAS_ANALYSIS || (!currentSections.length && !currentSnippets.length)) {
    toast('Run Analyze first to generate content for podcast.', 'error');
    return;
  }

  const persona = document.getElementById('persona').value.trim() || 'listener';
  const job = document.getElementById('job').value.trim() || 'exploring this content';
  const btn = document.getElementById('podcastBtn');
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Creating Podcast...';

  try {
    // Create enhanced podcast data with sections and snippets
    const sections = currentSections.slice(0, 3); // Top 3 sections
    const snippets = currentSnippets.slice(0, 5); // Top 5 snippets

    // Create related insights from sections and snippets
    const relatedInsights = [];

    // Add sections as insights
    sections.forEach((section, index) => {
      relatedInsights.push({
        document: section.document,
        page_number: section.page_number,
        section_title: section.section_title,
        relevant_text: section.section_summary || section.section_title,
        relevance_score: 0.9 - (index * 0.1), // Decreasing relevance
        insight_type: "section",
        jump_url: `/files/${section.document}#page=${section.page_number}`
      });
    });

    // Add snippets as insights
    snippets.forEach((snippet, index) => {
      relatedInsights.push({
        document: snippet.document,
        page_number: snippet.page_number,
        section_title: `Key Insight ${index + 1}`,
        relevant_text: snippet.refined_text,
        relevance_score: 0.85 - (index * 0.05), // Decreasing relevance
        insight_type: "snippet",
        jump_url: `/files/${snippet.document}#page=${section.page_number}`
      });
    });

    // Use the ENHANCED podcast API for dual voices and better quality
    const enhancedPodcastData = {
      selected_text: sections.length > 0 ? sections[0].section_summary || sections[0].section_title :
        snippets.length > 0 ? snippets[0].refined_text :
          "Analysis of selected documents",
      related_insights: relatedInsights,
      document: currentDoc ? currentDoc.split('/').pop() : 'analyzed_documents',
      page_number: currentPage || 1,
      conversation_style: "academic",
      persona: persona,
      job: job
    };

    console.log('Creating enhanced podcast with data:', enhancedPodcastData);

    // Send to enhanced podcast endpoint for dual voice generation
    const res = await fetch('/api/enhanced-podcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enhancedPodcastData)
    });

    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    const player = document.getElementById('player');

    console.log('Enhanced podcast response:', data);
    console.log('Audio URL from API:', data.url);

    // Set up the audio player with new source
    const audioUrl = data.url + '?t=' + Date.now(); // Add timestamp to prevent caching
    console.log('Final audio URL:', audioUrl);

    player.src = audioUrl;
    player.setAttribute('title', `AI Podcast: ${job} (Dual Voice)`);

    // Reset audio player initialization to ensure proper setup
    resetAudioPlayerInitialization();

    // Initialize audio player UI before loading
    initializeAudioPlayer();

    // Clear any existing audio info
    const audioInfo = document.getElementById('audioInfo');
    const audioTitle = document.getElementById('audioTitle');
    if (audioInfo) audioInfo.classList.add('hidden');
    if (audioTitle) audioTitle.textContent = 'Loading dual voice podcast...';

    // Wait for audio to load metadata
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Audio loading timeout'));
      }, 15000); // 15 second timeout for enhanced podcast

      player.addEventListener('loadedmetadata', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });

      player.addEventListener('error', (e) => {
        clearTimeout(timeout);
        reject(new Error(`Audio loading failed: ${e.message || 'Unknown error'}`));
      }, { once: true });

      player.load(); // Force load
    });

    // Initialize audio player UI if not already done
    initializeAudioPlayer();

    // Play the podcast
    await player.play();

    // Update UI to show it's playing
    const playPauseBtn = document.getElementById('playPauseBtn');

    if (playPauseBtn) {
      const icon = playPauseBtn.querySelector('i');
      if (icon) icon.className = 'fas fa-pause text-sm';
    }

    if (audioInfo) audioInfo.classList.remove('hidden');
    if (audioTitle) audioTitle.textContent = `AI Podcast: ${job} (Dual Voice)`;

    toast('High-quality dual voice podcast is now playing! 🎧', 'success');

  } catch (e) {
    console.error('Enhanced podcast error:', e);
    toast(`Podcast failed: ${e.message || 'Unknown error'}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
  }
}

// Get insights for selected text
async function getTextSelectionInsights() {
  if (!textSelectionInsights || !textSelectionInsights.selected_text) return;

  const selectedText = textSelectionInsights.selected_text;
  // Remove the 10-character minimum requirement - allow any non-empty text
  if (!selectedText || selectedText.trim().length === 0) return;

  try {
    const response = await fetch('/api/document-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: selectedText,
        top_k: 5,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const results = await response.json();

    // Update the recommendations panel with text-selection-based results
    displayTextSelectionRecommendations(results.results, selectedText);

  } catch (error) {
    console.error("Error getting text insights:", error);
    showNotification(`Error getting recommendations: ${error.message}`, 'error');
  }
}

function displayTextSelectionRecommendations(results, selectedText) {
  const panel = document.getElementById('textSelectionPanel');
  if (!panel) return;

  const recommendationsHtml = `
    <div class="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border-l-4 border-yellow-500">
      <div class="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
        Recommendations based on your selection:
      </div>
      <p class="text-xs text-slate-700 dark:text-slate-300 font-medium">"${selectedText.substring(0, 80)}${selectedText.length > 80 ? '...' : ''}"</p>
      
      ${results && results.length > 0 ? `
        <div class="mt-2 space-y-1">
          ${results.slice(0, 3).map((result, idx) => `
            <div class="text-xs text-slate-600 dark:text-slate-400">
              ${idx + 1}. ${result.document} (p.${result.page_number}) - ${result.text.substring(0, 60)}...
            </div>
          `).join('')}
        </div>
      ` : '<div class="text-xs text-slate-500 dark:text-slate-400 mt-1">No specific recommendations found.</div>'}
    </div>
  `;

  // Add recommendations to the existing panel
  const existingContent = panel.querySelector('.flex.space-x-2');
  if (existingContent) {
    existingContent.insertAdjacentHTML('beforebegin', recommendationsHtml);
  }
}

function showNotification(message, type = 'info') {
  toast(message, type);
}

function loadAudio(url, title = 'Audio') {
  const player = document.getElementById('player');
  if (player) {
    player.src = url;
    player.setAttribute('title', title);
    player.play().catch(e => console.log('Auto-play prevented:', e));
    toast(`Loading audio: ${title}`, 'info');
  } else {
    // Fallback: create a new audio element
    const audio = new Audio(url);
    audio.title = title;
    audio.play().catch(e => console.log('Auto-play prevented:', e));
    toast(`Playing audio: ${title}`, 'info');
  }
}

// ... existing code ...

// Show podcast generation progress
function showPodcastGenerationProgress() {
  // Create or show podcast progress modal
  let progressModal = document.getElementById('podcastProgressModal');
  if (!progressModal) {
    progressModal = document.createElement('div');
    progressModal.id = 'podcastProgressModal';
    progressModal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    progressModal.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h3 class="text-xl font-semibold text-slate-800 dark:text-white mb-4">Generating Podcast...</h3>
          
          <!-- Progress Bar -->
          <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 mb-4">
            <div id="podcastProgress" class="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300" style="width: 0%"></div>
          </div>
          
          <div class="text-sm text-slate-600 dark:text-slate-400 mb-4">
            <div id="podcastStatus">Initializing podcast generation...</div>
          </div>
          
          <div class="text-xs text-slate-500 dark:text-slate-400">
            This may take a few minutes for high-quality audio
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(progressModal);
  }

  progressModal.classList.remove('hidden');

  // Simulate progress updates
  let progress = 0;
  const progressBar = document.getElementById('podcastProgress');
  const status = document.getElementById('podcastStatus');

  const progressInterval = setInterval(() => {
    progress += Math.random() * 8;
    if (progress > 85) progress = 85;

    if (progressBar) progressBar.style.width = progress + '%';
    if (status) {
      if (progress < 20) status.textContent = 'Analyzing selected text...';
      else if (progress < 40) status.textContent = 'Generating conversation script...';
      else if (progress < 60) status.textContent = 'Creating voice segments...';
      else if (progress < 80) status.textContent = 'Mixing audio...';
      else status.textContent = 'Finalizing podcast...';
    }
  }, 300);

  // Store interval for cleanup
  progressModal.dataset.progressInterval = progressInterval;
}

function hidePodcastGenerationProgress() {
  const progressModal = document.getElementById('podcastProgressModal');
  if (progressModal) {
    // Clear progress interval
    const interval = progressModal.dataset.progressInterval;
    if (interval) clearInterval(parseInt(interval));

    // Hide modal
    progressModal.classList.add('hidden');
  }
}

// Audio Player Initialization Functions
function resetAudioPlayerInitialization() {
  const player = document.getElementById('player');
  if (!player) return;

  // Remove existing event listeners to prevent duplicates
  player.removeEventListener('loadedmetadata', updateAudioDuration);
  player.removeEventListener('timeupdate', updateAudioProgress);
  player.removeEventListener('play', updatePlayPauseButton);
  player.removeEventListener('pause', updatePlayPauseButton);
  player.removeEventListener('ended', handleAudioEnded);
  player.removeEventListener('error', handleAudioError);

  // Reset UI elements
  const currentTimeEl = document.getElementById('currentTime');
  const totalTimeEl = document.getElementById('totalTime');
  const progressEl = document.getElementById('audioProgress');
  const playPauseBtn = document.getElementById('playPauseBtn');

  if (currentTimeEl) currentTimeEl.textContent = '0:00';
  if (totalTimeEl) totalTimeEl.textContent = '0:00';
  if (progressEl) progressEl.style.width = '0%';
  if (playPauseBtn) {
    const icon = playPauseBtn.querySelector('i');
    if (icon) icon.className = 'fas fa-play text-sm';
  }
}

function initializeAudioPlayer() {
  const player = document.getElementById('player');
  if (!player) {
    console.error('Audio player element not found');
    return;
  }

  // Set up event listeners for audio player
  player.addEventListener('loadedmetadata', updateAudioDuration);
  player.addEventListener('timeupdate', updateAudioProgress);
  player.addEventListener('play', updatePlayPauseButton);
  player.addEventListener('pause', updatePlayPauseButton);
  player.addEventListener('ended', handleAudioEnded);
  player.addEventListener('error', handleAudioError);

  // Set up control button event listeners
  setupAudioControls();

  console.log('Audio player initialized successfully');
}

function setupAudioControls() {
  // Play/Pause button
  const playPauseBtn = document.getElementById('playPauseBtn');
  if (playPauseBtn) {
    playPauseBtn.removeEventListener('click', togglePlayPause);
    playPauseBtn.addEventListener('click', togglePlayPause);
  }

  // Stop button
  const stopBtn = document.getElementById('stopBtn');
  if (stopBtn) {
    stopBtn.removeEventListener('click', stopAudio);
    stopBtn.addEventListener('click', stopAudio);
  }

  // Speed button
  const speedBtn = document.getElementById('speedBtn');
  if (speedBtn) {
    speedBtn.removeEventListener('click', cyclePlaybackSpeed);
    speedBtn.addEventListener('click', cyclePlaybackSpeed);
  }

  // Progress bar
  const progressContainer = document.getElementById('progressContainer');
  if (progressContainer) {
    progressContainer.removeEventListener('click', seekAudio);
    progressContainer.addEventListener('click', seekAudio);
  }
}

function updateAudioDuration() {
  const player = document.getElementById('player');
  const totalTimeEl = document.getElementById('totalTime');

  if (player && totalTimeEl && !isNaN(player.duration)) {
    totalTimeEl.textContent = formatTime(player.duration);
  }
}

function updateAudioProgress() {
  const player = document.getElementById('player');
  const currentTimeEl = document.getElementById('currentTime');
  const progressEl = document.getElementById('audioProgress');

  if (player && !isNaN(player.currentTime) && !isNaN(player.duration)) {
    if (currentTimeEl) {
      currentTimeEl.textContent = formatTime(player.currentTime);
    }

    if (progressEl) {
      const progress = (player.currentTime / player.duration) * 100;
      progressEl.style.width = `${progress}%`;
    }
  }
}

function updatePlayPauseButton() {
  const player = document.getElementById('player');
  const playPauseBtn = document.getElementById('playPauseBtn');

  if (player && playPauseBtn) {
    const icon = playPauseBtn.querySelector('i');
    if (icon) {
      icon.className = player.paused ? 'fas fa-play text-sm' : 'fas fa-pause text-sm';
    }
  }
}

function handleAudioEnded() {
  const playPauseBtn = document.getElementById('playPauseBtn');
  if (playPauseBtn) {
    const icon = playPauseBtn.querySelector('i');
    if (icon) icon.className = 'fas fa-play text-sm';
  }

  // Reset progress
  const progressEl = document.getElementById('audioProgress');
  if (progressEl) progressEl.style.width = '0%';

  const currentTimeEl = document.getElementById('currentTime');
  if (currentTimeEl) currentTimeEl.textContent = '0:00';
}

function handleAudioError(event) {
  console.error('Audio error:', event);
  toast('Error playing audio. Please try again.', 'error');
}

function togglePlayPause() {
  const player = document.getElementById('player');
  if (!player) return;

  if (player.paused) {
    player.play().catch(e => {
      console.error('Error playing audio:', e);
      toast('Error playing audio. Please try again.', 'error');
    });
  } else {
    player.pause();
  }
}

function stopAudio() {
  const player = document.getElementById('player');
  if (!player) return;

  player.pause();
  player.currentTime = 0;

  // Update UI
  const playPauseBtn = document.getElementById('playPauseBtn');
  if (playPauseBtn) {
    const icon = playPauseBtn.querySelector('i');
    if (icon) icon.className = 'fas fa-play text-sm';
  }

  const progressEl = document.getElementById('audioProgress');
  if (progressEl) progressEl.style.width = '0%';

  const currentTimeEl = document.getElementById('currentTime');
  if (currentTimeEl) currentTimeEl.textContent = '0:00';
}

function cyclePlaybackSpeed() {
  const player = document.getElementById('player');
  const speedBtn = document.getElementById('speedBtn');

  if (!player || !speedBtn) return;

  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const currentSpeed = player.playbackRate;
  const currentIndex = speeds.indexOf(currentSpeed);
  const nextIndex = (currentIndex + 1) % speeds.length;
  const newSpeed = speeds[nextIndex];

  player.playbackRate = newSpeed;
  speedBtn.textContent = `${newSpeed}x`;
}

function seekAudio(event) {
  const player = document.getElementById('player');
  const progressContainer = document.getElementById('progressContainer');

  if (!player || !progressContainer || isNaN(player.duration)) return;

  const rect = progressContainer.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const containerWidth = rect.width;
  const seekTime = (clickX / containerWidth) * player.duration;

  player.currentTime = seekTime;
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Document clustering functionality
async function clusterDocuments() {
  const selectedDocs = getSelectedDocs();
  if (selectedDocs.length === 0) {
    toast('Please select at least one document to cluster', 'warning');
    return;
  }

  // Show loading state
  const clusterBtn = document.getElementById('clusterBtn');
  if (clusterBtn) {
    const originalText = clusterBtn.innerHTML;
    clusterBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Clustering...';
    clusterBtn.disabled = true;

    try {
      // Call the clustering API endpoint
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documents: selectedDocs,
          approach: 'clustering',
          method: 'auto',
          top_k: 10
        })
      });

      if (!response.ok) {
        throw new Error(`Clustering failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('Clustering response:', data);

      // Store the clustering results
      currentSections = data.sections || [];
      currentSnippets = data.snippets || [];

      // Render the clustered results
      renderSections(currentSections, data.related_map || {});
      renderSnippets(currentSnippets);

      // Get document recommendations for clustered documents
      await getDocumentRecommendations();

      HAS_ANALYSIS = true;
      toast('Document clustering completed! Similar documents are now grouped together.', 'success');

    } catch (error) {
      console.error('Clustering failed:', error);
      toast(`Clustering failed: ${error.message}`, 'error');
    } finally {
      // Restore button state
      clusterBtn.innerHTML = originalText;
      clusterBtn.disabled = false;
    }
  }
}

// Show delete all confirmation dialog
function showDeleteAllConfirmation(selectedDocs) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  overlay.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
      <div class="text-center">
        <div class="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-exclamation-triangle text-red-600 dark:text-red-400 text-xl"></i>
        </div>
        <h3 class="text-xl font-semibold text-slate-800 dark:text-white mb-4">Delete Documents?</h3>
        <p class="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Are you sure you want to delete ${selectedDocs.length} selected document(s)? This action cannot be undone.
        </p>
        <div class="flex space-x-3">
          <button onclick="this.closest('.fixed').remove()" 
                  class="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
            Cancel
          </button>
          <button onclick="deleteSelectedDocuments()" 
                  class="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close on outside click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

// Delete selected documents
async function deleteSelectedDocuments() {
  const selectedDocs = getSelectedDocs();
  if (selectedDocs.length === 0) {
    toast('No documents selected for deletion', 'warning');
    return;
  }

  try {
    // Call delete API for each selected document
    const deletePromises = selectedDocs.map(async (docName) => {
      const response = await fetch(`/api/documents/${encodeURIComponent(docName)}`, {
        method: 'DELETE'
      });
      return response.ok;
    });

    const results = await Promise.all(deletePromises);
    const successCount = results.filter(Boolean).length;

    if (successCount > 0) {
      toast(`Successfully deleted ${successCount} document(s)`, 'success');

      // Reload documents list
      await loadDocuments();

      // Clear current document if it was deleted
      if (currentDoc && selectedDocs.includes(currentDoc.split('/').pop())) {
        currentDoc = null;
        showPDFNeutral();
      }

      // Clear analysis results
      currentSections = [];
      currentSnippets = [];
      HAS_ANALYSIS = false;

      // Re-render empty sections and snippets
      renderSections([], {});
      renderSnippets([]);
    } else {
      toast('Failed to delete any documents', 'error');
    }

  } catch (error) {
    console.error('Error deleting documents:', error);
    toast('Error deleting documents', 'error');
  }

  // Close confirmation dialog
  const overlay = document.querySelector('.fixed.bg-black\\/50');
  if (overlay) overlay.remove();
}