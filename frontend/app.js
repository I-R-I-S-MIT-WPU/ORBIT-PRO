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
  // No longer needed with PDF.js
  console.log('PDF.js configuration loaded');
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

function updateCurrentDocName() {
  const currentDocNameEl = document.getElementById('currentDocName');
  if (currentDocNameEl) {
    if (currentDoc) {
      const filename = currentDoc.split('/').pop() || currentDoc;
      currentDocNameEl.textContent = filename;
      currentDocNameEl.title = filename;
    } else {
      currentDocNameEl.textContent = 'No document selected';
      currentDocNameEl.title = 'No document selected';
    }
  }
}

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
    panel.className = 'fixed top-20 right-4 w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-40';
    document.body.appendChild(panel);
  }

  panel.innerHTML = `
    <div class="p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-slate-800 dark:text-white">Analyzing Text...</h3>
        <button onclick="hideTextSelectionUI()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <div class="text-center py-8">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p class="text-slate-600 dark:text-slate-400">Processing selected text...</p>
        <p class="text-xs text-slate-500 dark:text-slate-500 mt-2">Finding relevant content across all documents</p>
      </div>
    </div>
  `;

  panel.classList.remove('hidden');
}

// Hide text selection UI
function hideTextSelectionUI() {
  const panel = document.getElementById('textSelectionPanel');
  if (panel) {
    panel.classList.add('hidden');
  }
}

// Clear text selection
function clearTextSelection() {
  try {
    // Clear the window selection
    if (window.getSelection) {
      window.getSelection().removeAllRanges();
    } else if (document.selection) {
      document.selection.empty();
    }

    // Clear highlighting
    clearTextHighlighting();

    // Hide toolbar
    hideTextSelectionToolbar();

    // Clear stored data
    selectedText = "";
    textSelectionInsights = null;
    hideTextSelectionUI();

    toast('Text selection cleared', 'info');
  } catch (error) {
    console.error('Error clearing text selection:', error);
  }
}

// Display text selection insights
function displayTextSelectionInsights(insights) {
  let panel = document.getElementById('textSelectionPanel');

  // Create panel if it doesn't exist
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'textSelectionPanel';
    panel.className = 'fixed top-20 right-4 w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-40';
    document.body.appendChild(panel);
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
        <button onclick="getTextSelectionRecommendations()" 
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
    toast('Document name not available', 'error');
    return;
  }

  // For now, just show a toast message
  toast(`Would jump to ${documentName} page ${pageNumber}`, 'info');

  // TODO: Implement actual document jumping when PDF.js navigation is complete
}

// Get text selection recommendations (placeholder for now)
function getTextSelectionRecommendations() {
  toast('Getting recommendations...', 'info');
  // TODO: Implement recommendations API call
}

// Create podcast from text selection (placeholder for now)
function createPodcastFromTextSelection() {
  toast('Creating podcast...', 'info');
  // TODO: Implement podcast creation API call
}

async function analyze() {
  const persona = document.getElementById('persona').value.trim();
  const job = document.getElementById('job').value.trim();

  if (!persona && !job) {
    toast('Please provide either a persona or job description', 'warning');
    return;
  }

  if (!currentDoc) {
    toast('Please select a document first', 'warning');
    return;
  }

  // Show loading state
  const analyzeBtn = document.getElementById('analyzeBtn');
  const originalText = analyzeBtn.innerHTML;
  analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
  analyzeBtn.disabled = true;

  try {
    // Get document recommendations
    await getDocumentRecommendations();

    // Get document insights
    await getDocumentInsights();

    // Get document podcast
    await getDocumentPodcast();

    HAS_ANALYSIS = true;
    toast('Analysis completed successfully!', 'success');

  } catch (error) {
    console.error('Analysis failed:', error);
    toast('Analysis failed. Please try again.', 'error');
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

    // Use the text-selection API with empty selected text to get document overview
    const response = await fetch('/api/text-selection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selected_text: '', // Empty text to get document overview
        document: currentDoc,
        page_number: 1,
        persona: document.getElementById('persona')?.value || '',
        job: document.getElementById('job')?.value || ''
      })
    });

    if (response.ok) {
      const data = await response.json();
      // Handle recommendations data
      console.log('Document recommendations:', data);

      // Update the recommendations panel if data is available
      if (data.insights && data.insights.length > 0) {
        updateRecommendationsPanel(data.insights);
      }
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

  container.innerHTML = recommendations.slice(0, 5).map((rec, index) => `
    <div class="p-2 bg-slate-50 dark:bg-slate-700 rounded-lg border-l-4 border-emerald-500">
      <div class="text-xs text-slate-500 dark:text-slate-400 mb-1">
        ${rec.document} (p.${rec.page_number})
      </div>
      <div class="text-sm text-slate-700 dark:text-slate-300">
        ${rec.relevant_text.substring(0, 80)}${rec.relevant_text.length > 80 ? '...' : ''}
      </div>
    </div>
  `).join('');
}

// Get document insights
async function getDocumentInsights() {
  try {
    if (!currentDoc) return;

    const response = await fetch('/api/document-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document: currentDoc,
        persona: document.getElementById('persona')?.value || '',
        job: document.getElementById('job')?.value || ''
      })
    });

    if (response.ok) {
      const data = await response.json();
      // Handle insights data
      console.log('Document insights:', data);
    }
  } catch (error) {
    console.error('Error getting document insights:', error);
  }
}

// Get document podcast
async function getDocumentPodcast() {
  try {
    if (!currentDoc) return;

    const response = await fetch('/api/enhanced-podcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document: currentDoc,
        selected_text: selectedText || '',
        persona: document.getElementById('persona')?.value || '',
        job: document.getElementById('job')?.value || ''
      })
    });

    if (response.ok) {
      const data = await response.json();
      // Handle podcast data
      console.log('Document podcast:', data);
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
      
      // Ensure the selection is within our text layer
      const textLayer = document.querySelector('.text-layer');
      if (textLayer && !textLayer.contains(range.commonAncestorContainer)) {
        return; // Selection is not in our text layer
      }

      // Highlight the selected text in the text layer
      highlightSelectedText(selection);

      // Show the text selection toolbar
      showTextSelectionToolbar(selectedText);

      // Clear any existing timeout
      if (textSelectionTimeout) {
        clearTimeout(textSelectionTimeout);
      }

      // Debounce text selection to avoid multiple rapid calls
      textSelectionTimeout = setTimeout(() => {
        processSelectedText(selectedText, currentPage);
      }, 300);
    }
  } catch (error) {
    console.error("Error handling text selection:", error);
  }
}

// Handle selection change events
function handleSelectionChange(event) {
  try {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText && selectedText.length >= 10) {
      // Highlight the selected text
      highlightSelectedText(selection);

      // Show the text selection toolbar
      showTextSelectionToolbar(selectedText);

      // Clear any existing timeout
      if (textSelectionTimeout) {
        clearTimeout(textSelectionTimeout);
      }

      // Debounce text selection
      textSelectionTimeout = setTimeout(() => {
        processSelectedText(selectedText, currentPage);
      }, 300);
    } else {
      // Clear highlighting if no text is selected
      clearTextHighlighting();
      hideTextSelectionToolbar();
    }
  } catch (error) {
    console.error("Error handling selection change:", error);
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
        acceptNode: function(node) {
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

// Initialize the application
async function main() {
  await loadDocuments();

  // Initialize PDF viewer in neutral state
  showPDFNeutral();

  // Set up event listeners
  document.getElementById('uploadBtn')?.addEventListener('click', uploadFiles);
  document.getElementById('analyzeBtn')?.addEventListener('click', analyze);

  // Set up theme
  initTheme();
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  // Set up document selection controls
  const selectAllBtn = document.getElementById('selectAllBtn');
  const clearSelectionBtn = document.getElementById('clearSelectionBtn');
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

  // Set up document filter
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', main);

// Show text selection toolbar
function showTextSelectionToolbar(selectedText) {
  try {
    // Remove existing toolbar
    hideTextSelectionToolbar();

    // Create toolbar
    const toolbar = document.createElement('div');
    toolbar.id = 'text-selection-toolbar';
    toolbar.className = 'fixed bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg z-50 p-2 flex items-center space-x-2';

    // Position toolbar near the selection
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      toolbar.style.left = `${rect.left + window.scrollX}px`;
      toolbar.style.top = `${rect.bottom + window.scrollY + 10}px`;
    } else {
      // Fallback position
      toolbar.style.left = '50%';
      toolbar.style.top = '20px';
      toolbar.style.transform = 'translateX(-50%)';
    }

    // Add toolbar content
    toolbar.innerHTML = `
      <div class="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
        <span class="font-medium">Selected: ${selectedText.length} chars</span>
      </div>
      <div class="flex items-center space-x-1">
        <button onclick="copySelectedText()" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors" title="Copy text">
          <i class="fas fa-copy text-blue-500"></i>
        </button>
        <button onclick="getTextSelectionInsights()" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors" title="Get insights">
          <i class="fas fa-lightbulb text-yellow-500"></i>
        </button>
        <button onclick="clearTextSelection()" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors" title="Clear selection">
          <i class="fas fa-times text-red-500"></i>
        </button>
      </div>
    `;

    document.body.appendChild(toolbar);

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (document.getElementById('text-selection-toolbar')) {
        hideTextSelectionToolbar();
      }
    }, 5000);

  } catch (error) {
    console.error("Error showing text selection toolbar:", error);
  }
}

// Hide text selection toolbar
function hideTextSelectionToolbar() {
  try {
    const toolbar = document.getElementById('text-selection-toolbar');
    if (toolbar) {
      toolbar.remove();
    }
  } catch (error) {
    console.error("Error hiding text selection toolbar:", error);
  }
}

// Copy selected text to clipboard
function copySelectedText() {
  try {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText) {
      navigator.clipboard.writeText(selectedText).then(() => {
        toast('Text copied to clipboard!', 'success');
      }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = selectedText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast('Text copied to clipboard!', 'success');
      });
    }
  } catch (error) {
    console.error("Error copying text:", error);
    toast('Failed to copy text', 'error');
  }
}

// Get insights for selected text
function getTextSelectionInsights() {
  try {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText && selectedText.length >= 10) {
      processSelectedText(selectedText, currentPage);
    } else {
      toast('Please select some text first', 'warning');
    }
  } catch (error) {
    console.error("Error getting text insights:", error);
  }
}

// Show text selection hint
function showTextSelectionHint() {
  try {
    // Remove existing hint
    hideTextSelectionHint();

    // Create hint element
    const hint = document.createElement('div');
    hint.id = 'text-selection-hint';
    hint.className = 'text-selection-hint';
    hint.innerHTML = `
      <div class="flex items-center space-x-2">
        <i class="fas fa-mouse-pointer text-white"></i>
        <span>Select text to get insights and recommendations</span>
        <button onclick="hideTextSelectionHint()" class="ml-2 text-white/80 hover:text-white">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    document.body.appendChild(hint);

    // Auto-hide after 8 seconds
    setTimeout(() => {
      if (document.getElementById('text-selection-hint')) {
        hideTextSelectionHint();
      }
    }, 8000);

  } catch (error) {
    console.error("Error showing text selection hint:", error);
  }
}

// Hide text selection hint
function hideTextSelectionHint() {
  try {
    const hint = document.getElementById('text-selection-hint');
    if (hint) {
      hint.remove();
    }
  } catch (error) {
    console.error("Error hiding text selection hint:", error);
  }
}