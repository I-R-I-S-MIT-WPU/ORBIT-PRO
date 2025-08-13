let ADOBE_API_KEY = "";
let adobeView = null; // AdobeDC.View instance
let adobeViewer = null; // viewer returned by previewFile()
let adobeApis = null; // cached APIs from viewer.getAPIs()
let currentDoc = null;
let currentSections = [];
let ADOBE_READY = false;
let CURRENT_PAGE = 1;
let TOTAL_PAGES = 1; // Track total pages in the current document
let currentSnippets = [];
let HEALTH = {};
let HAS_ANALYSIS = false;

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

// Adobe PDF Embed SDK readiness
document.addEventListener('adobe_dc_view_sdk.ready', () => {
  ADOBE_READY = true;
});

// Suppress noisy unhandled rejections from third-party SDK when we explicitly opt-out of features
window.addEventListener('unhandledrejection', (event) => {
  try {
    const msg = String(event.reason && (event.reason.message || event.reason)).toLowerCase();
    if (msg.includes('get_feature_flag') ||
      msg.includes('[object object]') ||
      msg.includes('no callback registered by viewer') ||
      msg.includes('enable-tools-multidoc') ||
      msg.includes('edit-config') ||
      msg.includes('enable-accessibility') ||
      msg.includes('preview-config') ||
      msg.includes('enable-inline-organize') ||
      msg.includes('enable-pdf-request-signatures') ||
      msg.includes('dcweb_edit_image_experiment') ||
      msg.includes('dcweb_edit_image_experiment') ||
      msg.includes('enable-tools-multidoc') ||
      msg.includes('edit-config') ||
      msg.includes('enable-accessibility') ||
      msg.includes('preview-config') ||
      msg.includes('enable-inline-organize') ||
      msg.includes('enable-pdf-request-signatures') ||
      msg.includes('get_feature_flag') ||
      msg.includes('no callback registered') ||
      msg.includes('feature flag') ||
      msg.includes('enable-') ||
      msg.includes('dcweb_') ||
      msg.includes('dcweb_edit_') ||
      msg.includes('dcweb_edit_image_') ||
      msg.includes('dcweb_edit_image_experiment') ||
      msg.includes('dcweb_edit_image_experiment') ||
      msg.includes('enable-tools-') ||
      msg.includes('edit-config') ||
      msg.includes('enable-accessibility') ||
      msg.includes('preview-config') ||
      msg.includes('enable-inline-') ||
      msg.includes('enable-pdf-') ||
      msg.includes('enable-pdf-request-') ||
      msg.includes('enable-pdf-request-signatures') ||
      msg.includes('dcweb_edit_image_experiment') ||
      msg.includes('dcweb_edit_image_experiment') ||
      msg.includes('enable-tools-multidoc') ||
      msg.includes('edit-config') ||
      msg.includes('enable-accessibility') ||
      msg.includes('preview-config') ||
      msg.includes('enable-inline-organize') ||
      msg.includes('enable-pdf-request-signatures')) {
      event.preventDefault();
      // Optional: console.debug('Suppressed Adobe feature flag rejection');
    }
  } catch (_) { /* ignore */ }
});

// Also trap generic window errors that bubble, if any
window.addEventListener('error', (event) => {
  try {
    const msg = String(event.message || '').toLowerCase();
    const src = String(event.filename || '').toLowerCase();
    if (
      msg.includes('get_feature_flag') ||
      msg.includes('no callback registered by viewer') ||
      msg.includes('#<object>') ||
      msg.includes('enable-tools-multidoc') ||
      msg.includes('edit-config') ||
      msg.includes('enable-accessibility') ||
      msg.includes('preview-config') ||
      msg.includes('enable-inline-organize') ||
      msg.includes('enable-pdf-request-signatures') ||
      msg.includes('dcweb_edit_image_experiment') ||
      msg.includes('dcweb_edit_image_experiment') ||
      msg.includes('enable-tools-multidoc') ||
      msg.includes('edit-config') ||
      msg.includes('enable-accessibility') ||
      msg.includes('preview-config') ||
      msg.includes('enable-inline-organize') ||
      msg.includes('enable-pdf-request-signatures') ||
      src.includes('viewsdkinterface.js') ||
      src.includes('adobedcviewapp.js')
    ) {
      event.preventDefault();
    }
  } catch (_) { /* ignore */ }
}, true);

// Filter known noisy console errors from the embedded viewer that don't affect functionality
(() => {
  const originalError = console.error.bind(console);
  console.error = (...args) => {
    try {
      const text = args.map((a) => (typeof a === 'string' ? a : (a && (a.message || a.toString())) || '')).join(' ').toLowerCase();
      if (text.includes('get_feature_flag') && text.includes('no callback registered')) {
        return; // drop noise
      }
      if (text.includes('enable-tools-multidoc') ||
        text.includes('edit-config') ||
        text.includes('enable-accessibility') ||
        text.includes('preview-config') ||
        text.includes('enable-inline-organize') ||
        text.includes('enable-pdf-request-signatures') ||
        text.includes('dcweb_edit_image_experiment') ||
        text.includes('dcweb_edit_image_experiment')) {
        return; // drop Adobe feature flag noise
      }
    } catch (_) { /* ignore */ }
    originalError(...args);
  };
})();

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
  const res = await fetch('/api/config');
  const data = await res.json();
  ADOBE_API_KEY = data.adobe_embed_api_key || '';
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
  if (currentDocNameEl && currentDoc) {
    const filename = currentDoc.split('/').pop();
    currentDocNameEl.textContent = filename || 'Unknown document';
  } else if (currentDocNameEl) {
    currentDocNameEl.textContent = 'No document selected';
  }
}

function initAdobeView(url) {
  return new Promise((resolve) => {
    currentDoc = url;
    // Reset cached viewer/APIs for new document
    adobeViewer = null;
    adobeApis = null;

    if (!ADOBE_API_KEY) {
      alert('Adobe Embed API key not configured');
      return resolve(false);
    }

    const clientId = ADOBE_API_KEY;
    const containerId = 'adobe-dc-view';
    const container = document.getElementById(containerId);

    if (!container) {
      console.error('PDF viewer container not found');
      return resolve(false);
    }

    // Clear any existing content
    container.innerHTML = '';

    // Check if AdobeDC is available
    if (!window.AdobeDC || !window.AdobeDC.View) {
      const onReady = () => {
        document.removeEventListener('adobe_dc_view_sdk.ready', onReady);
        initViewer();
      };
      document.addEventListener('adobe_dc_view_sdk.ready', onReady);
      return;
    }

    initViewer();

    async function initViewer() {
      try {
        // Initialize Adobe View SDK
        const config = {
          clientId: clientId,
          divId: containerId
        };

        // Initialize the viewer
        adobeView = new window.AdobeDC.View(config);

        // Preview the file with viewer options
        const viewerConfig = {
          embedMode: 'FULL_WINDOW',
          showDownloadPDF: false,
          showPrintPDF: false,
          showPageControls: true,
          defaultViewMode: 'FIT_WIDTH',
          // Hints for continuous, whole-document scrolling (ignored if not supported)
          viewMode: 'CONTINUOUS',
          pageMode: 'CONTINUOUS',
          scrollMode: 'VERTICAL',
          showAnnotationTools: false,
          showBookmarks: true,
          showThumbnails: true,
          showLeftHandPanel: false,
          showDisabledSaveButton: true,
          enableFormFilling: false,
          showZoomControl: true,
          showFullScreen: true,
          showComment: false,
          enableSearchAPIs: true,
          enablePageNavigation: true,
          enableZoomAPIs: true,
          enableDocumentAPIs: true,
          enableFilePicker: false,
          enablePrinting: false,
          enableDownload: false,
          enableAnnotationAPIs: false,
          enableFormFillingAPIs: false,
          enableAccessibilityAPIs: false,
          enableEditAPIs: false,
          enableDigitalSignatures: false,
          enableMeasurementAPIs: false,
          enableRedactionAPIs: false,
          enableCompareAPIs: false,
          enableOptimizationAPIs: false,
          enableSecurityAPIs: false,
          enableWatermarkAPIs: false,
          enableBarcodeAPIs: false,
          enableOCRAPIs: false,
          enableCompressionAPIs: false,
          enableEncryptionAPIs: false,
          enableDecryptionAPIs: false,
          enableConversionAPIs: false,
          enableValidationAPIs: false,
          enableExtractionAPIs: false,
          enableMergingAPIs: false,
          enableSplittingAPIs: false,
          enableRotationAPIs: false,
          enableCroppingAPIs: false,
          enableScalingAPIs: false,
          enableColorManagementAPIs: false,
          enableImageProcessingAPIs: false,
          enableTextExtractionAPIs: false,
          enableImageExtractionAPIs: false,
          enableMetadataAPIs: true,
          enableBookmarkAPIs: true,
          enableAttachmentAPIs: true,
          enableTextSelectionAPIs: true,
          enableInteractiveTooltipAPIs: true,
          enableCursorAPIs: true,
          enablePageSelectionAPIs: true,
          enablePageZoomAPIs: true,
          enablePageNavigationAPIs: true,
          enablePageRenderingAPIs: true,
          enablePageThumbnailAPIs: true,
          enablePageAnnotationAPIs: false,
          enablePageFormAPIs: false,
          enablePageSignatureAPIs: false,
          enablePageRedactionAPIs: false,
          enablePageMeasurementAPIs: false,
          enablePageCompareAPIs: false,
          enablePageOptimizationAPIs: false,
          enablePageSecurityAPIs: false,
          enablePageWatermarkAPIs: false,
          enablePageBarcodeAPIs: false,
          enablePageOCRAPIs: false,
          enablePageCompressionAPIs: false,
          enablePageEncryptionAPIs: false,
          enablePageDecryptionAPIs: false,
          enablePageConversionAPIs: false,
          enablePageValidationAPIs: false,
          enablePageExtractionAPIs: false,
          enablePageMergingAPIs: false,
          enablePageSplittingAPIs: false,
          enablePageRotationAPIs: false,
          enablePageCroppingAPIs: false,
          enablePageScalingAPIs: false,
          enablePageColorManagementAPIs: false,
          enablePageImageProcessingAPIs: false,
          enablePageTextExtractionAPIs: false,
          enablePageImageExtractionAPIs: false,
          enablePageMetadataAPIs: true,
          enablePageBookmarkAPIs: true,
          enablePageAttachmentAPIs: true,
          enablePageTextSelectionAPIs: true,
          enablePageInteractiveTooltipAPIs: true,
          enablePageCursorAPIs: true,
          enablePagePageSelectionAPIs: true,
          enablePagePageZoomAPIs: true,
          enablePagePageNavigationAPIs: true,
          enablePagePageRenderingAPIs: true,
          enablePagePageThumbnailAPIs: true,
          theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
        };

        // Preview the file
        adobeViewer = await adobeView.previewFile(
          {
            content: { location: { url } },
            metaData: { fileName: url.split('/').pop() },
          },
          viewerConfig
        );

        // Get the total number of pages using the correct API
        try {
          const apis = await adobeViewer.getAPIs();
          if (apis && apis.getPDFMetadata) {
            const metadata = await apis.getPDFMetadata();
            if (metadata && metadata.numPages) {
              TOTAL_PAGES = metadata.numPages;
              updatePageCount();
            }
          }

          // Debug: Log available APIs for troubleshooting
          console.log('Available Adobe viewer APIs:', Object.keys(apis || {}));
          console.log('Viewer instance properties:', Object.keys(adobeViewer || {}));

        } catch (error) {
          console.log('Could not get page count, defaulting to 1');
          TOTAL_PAGES = 1;
          updatePageCount();
        }

        // Set up page change listener using the correct callback
        if (adobeViewer && typeof adobeViewer.registerCallback === 'function') {
          adobeViewer.registerCallback(
            window.AdobeDC.View.Enum.CallbackType.EVENT_LISTENER,
            (event) => {
              if (event.type === 'PAGE_VIEW_CHANGED' && event.data && event.data.pageNumber) {
                CURRENT_PAGE = event.data.pageNumber;
                updatePageCount();

                // Update the goto input field
                const gotoInput = document.getElementById('gotoPageInput');
                if (gotoInput) {
                  gotoInput.value = CURRENT_PAGE;
                }
              }
            },
            {
              enableFilePreviewEvents: true,
              enableAnnotationEvents: false
            }
          );
        }

        // Set up the toolbar
        setupToolbar();

        // Update current document name
        updateCurrentDocName();

        // Update page count after a short delay to ensure viewer is ready
        setTimeout(() => {
          updatePageCount();
        }, 500);

        // Set up a global error handler for the viewer
        window.addEventListener('adobe_dc_view_sdk_error', (event) => {
          console.debug('Adobe PDF Viewer error:', event.detail);
          // Don't show toast for feature flag errors as they're expected
          if (!event.detail?.type?.includes('FEATURE_FLAG')) {
            toast('An error occurred with the PDF viewer', 'error');
          }
        });

        // Store the viewer instance globally
        window.adobeViewer = adobeViewer;
        adobeViewer = adobeViewer;

        resolve(true);
      } catch (error) {
        console.error('Error in initViewer:', error);
        toast('Failed to initialize PDF viewer. Please try again.', 'error');
        resolve(false);
      }
    }
  });
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
      if (li.classList.contains('selected') && currentDoc !== `/files/${d.filename}`) {
        initAdobeView(`/files/${d.filename}`);
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
    pageCountEl.textContent = `/ ${TOTAL_PAGES || '?'}`;
  }

  // Update toolbar UI if available
  if (window.updateToolbarUI) {
    window.updateToolbarUI();
  }
}

// Validate and clamp a page number to the valid range
function clampPageNumber(page) {
  return Math.max(1, Math.min(Math.floor(page || 1), TOTAL_PAGES));
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
          await initAdobeView(`/files/${doc}`);
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
          await initAdobeView(`/files/${doc}`);
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

  // De-duplicate by (doc,page,text)
  const seen = new Set();
  const uniq = [];
  snippets.forEach((s) => {
    const key = `${s.document}:${s.page_number}:${s.refined_text}`;
    if (seen.has(key)) return;
    seen.add(key);
    uniq.push(s);
  });

  currentSnippets = uniq;

  uniq.forEach((s, index) => {
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
          await initAdobeView(`/files/${doc}`);
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

const jumpToPage = async (pageNumber) => {
  if (!adobeViewer) {
    toast('No PDF viewer available.', 'error');
    return false;
  }

  try {
    const clampedPage = clampPageNumber(pageNumber);

    // Try to get the APIs from the viewer
    let apis;
    try {
      apis = await adobeViewer.getAPIs();
    } catch (error) {
      console.error('Failed to get viewer APIs:', error);
      toast('Viewer not ready. Please wait a moment and try again.', 'warning');
      return false;
    }

    // Try multiple navigation methods in order of preference
    let navigationSuccess = false;

    // Method 1: Try gotoLocation with page number
    if (apis && apis.gotoLocation && !navigationSuccess) {
      try {
        await apis.gotoLocation(clampedPage);
        navigationSuccess = true;
      } catch (error) {
        console.log('gotoLocation failed, trying alternative method');
      }
    }

    // Method 2: Try gotoLocation with object parameter
    if (apis && apis.gotoLocation && !navigationSuccess) {
      try {
        await apis.gotoLocation({ pageNumber: clampedPage });
        navigationSuccess = true;
      } catch (error) {
        console.log('gotoLocation with object parameter failed');
      }
    }

    // Method 3: Try navigateToPage if available
    if (apis && apis.navigateToPage && !navigationSuccess) {
      try {
        await apis.navigateToPage(clampedPage);
        navigationSuccess = true;
      } catch (error) {
        console.log('navigateToPage failed');
      }
    }

    // Method 4: Try setPage if available
    if (apis && apis.setPage && !navigationSuccess) {
      try {
        await apis.setPage(clampedPage);
        navigationSuccess = true;
      } catch (error) {
        console.log('setPage failed');
      }
    }

    // Method 5: Try direct viewer manipulation as last resort
    if (!navigationSuccess && adobeViewer) {
      try {
        // Try to access the viewer's internal page property
        if (adobeViewer.page !== undefined) {
          adobeViewer.page = clampedPage;
          navigationSuccess = true;
        } else if (adobeViewer.currentPage !== undefined) {
          adobeViewer.currentPage = clampedPage;
          navigationSuccess = true;
        } else if (adobeViewer.pageNumber !== undefined) {
          adobeViewer.pageNumber = clampedPage;
          navigationSuccess = true;
        }
      } catch (error) {
        console.log('Direct viewer manipulation failed');
      }
    }

    if (navigationSuccess) {
      CURRENT_PAGE = clampedPage;

      // Update the goto input field
      const gotoInput = document.getElementById('gotoPageInput');
      if (gotoInput) {
        gotoInput.value = clampedPage;
      }

      // Update page count display
      updatePageCount();

      toast(`Navigated to page ${clampedPage}`, 'success');
      return true;
    } else {
      toast('Page navigation not available in current viewer. Try refreshing the page.', 'warning');
      return false;
    }
  } catch (error) {
    console.error('Navigation failed:', error);

    // Handle specific Adobe API errors
    if (error.code === 'INVALID_INPUT') {
      toast('Invalid page number. Please try again.', 'error');
    } else if (error.message && error.message.includes('pageNumber')) {
      toast('Page navigation failed. The viewer may not support this feature.', 'warning');
    } else {
      toast('Navigation failed. Please try again.', 'error');
    }

    return false;
  }
};

// Set up a global error handler for the viewer
window.addEventListener('adobe_dc_view_sdk_error', (event) => {
  console.debug('Adobe PDF Viewer error:', event.detail);
  // Don't show toast for feature flag errors as they're expected
  if (!event.detail?.type?.includes('FEATURE_FLAG')) {
    toast('An error occurred with the PDF viewer', 'error');
  }
});

function setupToolbar() {
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  const gotoBtn = document.getElementById('gotoPageBtn');
  const gotoInput = document.getElementById('gotoPageInput');
  const pageCountEl = document.getElementById('pageCount');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('searchInput');

  if (!prevBtn || !nextBtn || !gotoBtn || !gotoInput || !pageCountEl || !zoomInBtn || !zoomOutBtn || !searchBtn || !searchInput) {
    console.error('One or more toolbar elements not found');
    return;
  }

  // Navigation functionality
  prevBtn.addEventListener('click', async () => {
    if (CURRENT_PAGE > 1) {
      const ok = await jumpToPage(CURRENT_PAGE - 1);
      if (!ok) toast('Navigation failed.', 'error');
    }
  });

  nextBtn.addEventListener('click', async () => {
    if (CURRENT_PAGE < TOTAL_PAGES) {
      const ok = await jumpToPage(CURRENT_PAGE + 1);
      if (!ok) toast('Navigation failed.', 'error');
    }
  });

  gotoBtn.addEventListener('click', async () => {
    const page = parseInt(gotoInput.value, 10);
    if (page && page >= 1 && page <= TOTAL_PAGES) {
      const ok = await jumpToPage(page);
      if (!ok) toast('Navigation failed.', 'error');
    } else {
      toast('Invalid page number.', 'error');
    }
  });

  gotoInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const page = parseInt(gotoInput.value, 10);
      if (page && page >= 1 && page <= TOTAL_PAGES) {
        const ok = await jumpToPage(page);
        if (!ok) toast('Navigation failed.', 'error');
      } else {
        toast('Invalid page number.', 'error');
      }
    }
  });

  // Zoom functionality
  let currentZoom = 1.0;
  let lastAppliedZoom = 1.0;
  const zoomStep = 0.25;
  const minZoom = 0.25;
  const maxZoom = 3.0;

  zoomInBtn.addEventListener('click', () => {
    if (currentZoom < maxZoom) {
      currentZoom = Math.min(maxZoom, currentZoom + zoomStep);
      applyZoom();
    }
  });

  zoomOutBtn.addEventListener('click', () => {
    if (currentZoom > minZoom) {
      currentZoom = Math.max(minZoom, currentZoom - zoomStep);
      applyZoom();
    }
  });

  function applyZoom() {
    if (!adobeViewer) {
      toast('No PDF viewer available.', 'warning');
      return;
    }

    adobeViewer.getAPIs().then(async apis => {
      if (!apis) {
        toast('Zoom functionality not available in current viewer. Try refreshing the page.', 'warning');
        return;
      }

      let zoomSuccess = false;

      try { console.debug('Zoom diagnostics - API keys:', Object.keys(apis)); } catch (_) { }

      // Preferred: dedicated Zoom APIs
      if (apis.getZoomAPIs && !zoomSuccess) {
        try {
          const zoomAPIs = apis.getZoomAPIs();
          if (zoomAPIs) {
            if (zoomAPIs.setZoom) { zoomAPIs.setZoom(currentZoom); zoomSuccess = true; }
            else if (zoomAPIs.zoom) { zoomAPIs.zoom(currentZoom); zoomSuccess = true; }
            else if (currentZoom > lastAppliedZoom && zoomAPIs.zoomIn) { zoomAPIs.zoomIn(); zoomSuccess = true; }
            else if (currentZoom < lastAppliedZoom && zoomAPIs.zoomOut) { zoomAPIs.zoomOut(); zoomSuccess = true; }
          }
        } catch (_) { }
      }

      // Fallbacks on root APIs
      if (!zoomSuccess && apis.setZoom) { try { apis.setZoom(currentZoom); zoomSuccess = true; } catch (_) { } }
      if (!zoomSuccess && apis.zoom) { try { apis.zoom(currentZoom); zoomSuccess = true; } catch (_) { } }
      if (!zoomSuccess && apis.zoomTo) { try { apis.zoomTo(currentZoom); zoomSuccess = true; } catch (_) { } }

      // Last resort: simulate with command interface
      if (!zoomSuccess && adobeViewer.executeCommand) {
        try {
          const direction = currentZoom > lastAppliedZoom ? 'zoomIn' : 'zoomOut';
          const iterations = Math.max(1, Math.round(Math.abs(currentZoom - lastAppliedZoom) / zoomStep));
          for (let i = 0; i < iterations; i++) adobeViewer.executeCommand(direction);
          zoomSuccess = true;
        } catch (_) { }
      }

      // Read back applied zoom if available
      try {
        const z = apis.getPageZoom ? apis.getPageZoom() : null;
        if (typeof z === 'number' && !Number.isNaN(z)) lastAppliedZoom = z;
        else lastAppliedZoom = currentZoom;
      } catch (_) { lastAppliedZoom = currentZoom; }

      if (zoomSuccess) {
        toast(`Zoom: ${Math.round((lastAppliedZoom || currentZoom) * 100)}%`, 'info');
      } else {
        toast('Zoom functionality not available in current viewer. Try refreshing the page.', 'warning');
      }
    }).catch(error => {
      console.error('Failed to apply zoom:', error);
      toast('Zoom failed. Please try again.', 'error');
    });
  }

  // Search functionality
  searchBtn.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (query) {
      performSearch(query);
    } else {
      toast('Please enter a search term.', 'warning');
    }
  });

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (query) {
        performSearch(query);
      } else {
        toast('Please enter a search term.', 'warning');
      }
    }
  });

  async function performSearch(query) {
    if (!adobeViewer) {
      toast('Search not available in current viewer.', 'warning');
      return;
    }

    try {
      // Get the APIs from the viewer
      let apis;
      try {
        apis = await adobeViewer.getAPIs();
      } catch (error) {
        console.error('Failed to get viewer APIs:', error);
        toast('Viewer not ready. Please wait a moment and try again.', 'warning');
        return;
      }

      // Try multiple search methods in order of preference
      let searchSuccess = false;
      let searchResults = null;

      // Method 1: Try performSearch method (this is the correct one based on available APIs)
      if (apis && apis.performSearch && !searchSuccess) {
        try {
          searchResults = await apis.performSearch(query);
          searchSuccess = true;
        } catch (error) {
          console.log('performSearch method failed, trying alternative');
        }
      }

      // Method 2: Try search method
      if (apis && apis.search && !searchSuccess) {
        try {
          searchResults = await apis.search(query);
          searchSuccess = true;
        } catch (error) {
          console.log('search method failed, trying alternative');
        }
      }

      // Method 3: Try searchText method
      if (apis && apis.searchText && !searchSuccess) {
        try {
          searchResults = await apis.searchText(query);
          searchSuccess = true;
        } catch (error) {
          console.log('searchText method failed');
        }
      }

      // Method 4: Try findText method
      if (apis && apis.findText && !searchSuccess) {
        try {
          searchResults = await apis.findText(query);
          searchSuccess = true;
        } catch (error) {
          console.log('findText method failed');
        }
      }

      if (!searchSuccess) {
        // Try to use the viewer's internal search if available
        if (adobeViewer && adobeViewer.executeCommand) {
          try {
            // Try to execute a search command
            adobeViewer.executeCommand('search', { query: query });
            searchSuccess = true;
            toast(`Searching for "${query}"...`, 'info');
            return;
          } catch (error) {
            console.log('executeCommand search failed');
          }
        }

        toast('Search functionality not available in current viewer. Try refreshing the page.', 'warning');
        return;
      }

      // Clear previous search if available
      if (apis.clearSearch) {
        try {
          apis.clearSearch();
        } catch (error) {
          console.log('Could not clear previous search');
        }
      }

      // Determine result count robustly across different SDK return shapes
      const getResultCount = (res) => {
        if (!res) return null;
        if (Array.isArray(res)) return res.length;
        if (typeof res === 'number') return res;
        if (typeof res === 'object') {
          if (typeof res.total === 'number') return res.total;
          if (typeof res.count === 'number') return res.count;
          if (typeof res.matchCount === 'number') return res.matchCount;
          if (typeof res.numResults === 'number') return res.numResults;
          if (res.results && Array.isArray(res.results)) return res.results.length;
          if (res.matches && Array.isArray(res.matches)) return res.matches.length;
          if (res.pages && Array.isArray(res.pages)) {
            // Sum per-page matches if structure is { pages: [{ matches: [...] }, ...] }
            try {
              return res.pages.reduce((sum, p) => sum + (Array.isArray(p.matches) ? p.matches.length : 0), 0);
            } catch (_) { /* ignore */ }
          }
        }
        return null;
      };

      // Also query backend for an accurate count across all pages
      let backendCount = null;
      try {
        if (currentDoc) {
          const file = (currentDoc.split('/').pop() || '').trim();
          const resp = await fetch(`/api/search_count?file=${encodeURIComponent(file)}&q=${encodeURIComponent(query)}`);
          if (resp.ok) {
            const data = await resp.json();
            backendCount = typeof data.total === 'number' ? data.total : null;
          }
        }
      } catch (_) { /* ignore network errors */ }

      const resultCount = backendCount ?? getResultCount(searchResults);

      if (resultCount && resultCount > 0) {
        toast(`Found ${resultCount} result${resultCount === 1 ? '' : 's'} for "${query}"`, 'success');
        try {
          if (Array.isArray(searchResults) && searchResults[0]) {
            if (searchResults[0].pageNumber) await jumpToPage(searchResults[0].pageNumber);
            else if (searchResults[0].page) await jumpToPage(searchResults[0].page);
          }
        } catch (_) { }
      } else if (searchResults) {
        toast(`Search completed for "${query}". Highlights may appear across pages.`, 'info');
      } else {
        toast(`No results found for "${query}"`, 'info');
      }
    } catch (error) {
      console.error('Search failed:', error);

      // Handle specific search errors
      if (error.message && error.message.includes('Search APIs not enabled')) {
        toast('Search is not enabled for this viewer. Please contact support.', 'warning');
      } else if (error.message && error.message.includes('not available')) {
        toast('Search functionality is not available in the current viewer configuration.', 'warning');
      } else {
        toast('Search failed. Please try again.', 'error');
      }
    }
  }

  // Update UI based on current state
  const updateUI = () => {
    const hasPages = TOTAL_PAGES > 0;
    const canGoPrev = hasPages && CURRENT_PAGE > 1;
    const canGoNext = hasPages && CURRENT_PAGE < TOTAL_PAGES;

    prevBtn.disabled = !canGoPrev;
    nextBtn.disabled = !canGoNext;

    if (hasPages) {
      gotoInput.placeholder = `1-${TOTAL_PAGES}`;
      gotoInput.max = TOTAL_PAGES;
      gotoInput.min = 1;
    } else {
      gotoInput.placeholder = '1';
      gotoInput.max = '';
      gotoInput.min = '';
    }

    // Update button styles based on state
    if (canGoPrev) {
      prevBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      prevBtn.classList.add('hover:bg-white', 'dark:hover:bg-slate-700', 'hover:shadow-lg', 'hover:scale-105');
    } else {
      prevBtn.classList.add('opacity-50', 'cursor-not-allowed');
      prevBtn.classList.remove('hover:bg-white', 'dark:hover:bg-slate-700', 'hover:shadow-lg', 'hover:scale-105');
    }

    if (canGoNext) {
      nextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      nextBtn.classList.add('hover:bg-white', 'dark:hover:bg-slate-700', 'hover:shadow-lg', 'hover:scale-105');
    } else {
      nextBtn.classList.add('opacity-50', 'cursor-not-allowed');
      nextBtn.classList.remove('hover:bg-white', 'dark:hover:bg-slate-700', 'hover:shadow-lg', 'hover:scale-105');
    }
  };

  // Initial UI update
  updateUI();

  // Store update function for external calls
  window.updateToolbarUI = updateUI;
}

async function analyze() {
  const persona = document.getElementById('persona').value.trim();
  const job = document.getElementById('job').value.trim();
  const docs = getSelectedDocs();

  if (!persona || !job || !docs.length) {
    toast('Please enter persona, job, and upload/select documents', 'warning');
    return;
  }

  const btn = document.getElementById('analyzeBtn');
  const prev = btn.innerHTML;

  // Show loading state
  btn.disabled = true;
  btn.innerHTML = `
    <div class="flex items-center space-x-2">
      <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      <span>Analyzing...</span>
    </div>
  `;

  // Global progress bar UI
  const gp = document.getElementById('globalProgress');
  const pbar = document.getElementById('progressBar');
  const ppct = document.getElementById('progressPct');
  const pfile = document.getElementById('progressFile');
  const plabel = document.getElementById('progressLabel');
  if (gp) gp.classList.remove('hidden');
  const setProgress = (pct, file, status) => {
    const clamped = Math.max(0, Math.min(100, pct | 0));
    if (pbar) pbar.style.width = `${clamped}%`;
    if (ppct) ppct.textContent = `${clamped}%`;
    if (pfile) pfile.textContent = file ? `Processing: ${file}` : '';
    if (plabel && status) plabel.textContent = status;
  };
  setProgress(1, docs[0] || '', 'Starting...');

  const payload = { persona, job, documents: docs, approach: 'nlp', method: 'auto', top_k: 5 };

  try {
    // Kick off async job
    const startRes = await fetch('/api/analyze_async', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!startRes.ok) throw new Error(await startRes.text());
    const { job_id } = await startRes.json();

    // Poll progress
    let done = false;
    while (!done) {
      await new Promise(r => setTimeout(r, 600));
      const pr = await fetch(`/api/analyze_progress?id=${encodeURIComponent(job_id)}`);
      if (!pr.ok) throw new Error(await pr.text());
      const pj = await pr.json();
      setProgress(pj.progress || 0, pj.current_file || '', pj.status || 'Processing...');
      if (pj.status === 'error') throw new Error(pj.error || 'Analyze failed');
      if (pj.status === 'done') done = true;
    }

    // Fetch result
    const rr = await fetch(`/api/analyze_result?id=${encodeURIComponent(job_id)}`);
    if (rr.status !== 200) throw new Error('Result not ready');
    const data = await rr.json();

    // Render results
    renderSections(data.extracted_sections, data.related_map);
    renderSnippets(data.snippets);

    // Enable action buttons
    const ib = document.getElementById('insightsBtn');
    const pb = document.getElementById('podcastBtn');
    if (ib) { ib.disabled = false; ib.classList.remove('opacity-50', 'cursor-not-allowed'); }
    if (pb) { pb.disabled = false; pb.classList.remove('opacity-50', 'cursor-not-allowed'); }

    toast('Analysis complete! 🎉', 'success');
    HAS_ANALYSIS = true;
  } catch (e) {
    toast(`Analysis failed: ${e.message || e}`, 'error');
    HAS_ANALYSIS = false;
  } finally {
    // Hide/finish progress UI
    setProgress(100, '', 'Done');
    setTimeout(() => { if (gp) gp.classList.add('hidden'); }, 800);
    // Restore button state
    btn.disabled = false;
    btn.innerHTML = prev;
  }
}

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
    // Create a more structured podcast script
    const podcastScript = await createPodcastScript(persona, job);

    if (!podcastScript) {
      throw new Error('Could not generate podcast content');
    }

    // Send the script to the server for text-to-speech
    const res = await fetch('/api/podcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: podcastScript,
        output_name: 'podcast.mp3',
        voice: 'en-US-Studio-O', // High-quality voice
        speed: 0.9, // Slightly slower for better comprehension
        pitch: 1.0, // Normal pitch
      })
    });

    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    const player = document.getElementById('player');
    player.src = data.url;

    // Add metadata for better UX
    player.setAttribute('title', `Podcast: ${job}`);

    // Play the podcast
    await player.play();
    toast('Podcast is now playing', 'success');

  } catch (e) {
    console.error('Podcast error:', e);
    toast(`Podcast failed: ${e.message || 'Unknown error'}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
  }
}

async function createPodcastScript(persona, job) {
  try {
    const sections = currentSections.slice(0, 4);
    const snippets = currentSnippets.slice(0, 8);
    if (!sections.length && !snippets.length) throw new Error('No content available for podcast');

    const now = new Date();
    const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
    const personaIntro = persona ? `${persona}` : 'curious learner';

    const openers = [
      `${greeting}! You’re tuned in to a focused deep‑dive designed for ${personaIntro}.`,
      `${greeting}! Welcome back—this session is crafted especially for ${personaIntro}.`,
      `${greeting}! Let’s get into it—tailored insights for ${personaIntro}.`
    ];
    const bridges = [
      'Here’s the through‑line that ties it together:',
      'Let’s connect the dots across sections:',
      'Zooming out, a few patterns stand out:'
    ];
    const closers = [
      'Thanks for listening—until next time, keep exploring.',
      'That’s a wrap—stay curious and keep building.',
      'Appreciate your time—go turn these ideas into momentum.'
    ];

    const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const lines = [];
    // Intro
    lines.push(`${choose(openers)} We’re tackling ${job || 'our topic today'}, with crisp insights and quick takeaways.`);

    // Section highlights
    if (sections.length) {
      lines.push(`First, a fast orientation through the key sections.`);
      sections.forEach((s, i) => {
        const title = (s.section_title || `Topic ${i + 1}`).replace(/\s+/g, ' ').trim();
        lines.push(`Section ${i + 1}: ${title}. If you’re skimming the PDF, jump to page ${s.page_number}.`);
      });
    }

    // Insights from snippets
    if (snippets.length) {
      lines.push(`Now, distilled insights you can act on:`);
      snippets.slice(0, 5).forEach((snip, i) => {
        const text = (snip.refined_text || '').replace(/\s+/g, ' ').trim();
        if (!text) return;
        lines.push(`Insight ${i + 1}: ${text}`);
      });
    }

    // Connections & contradictions (lightly inferred)
    lines.push(choose(bridges));
    const titles = sections.map(s => s.section_title).filter(Boolean);
    if (titles.length >= 2) {
      lines.push(`Notice how ${titles[0]} sets context that ${titles[1]} elaborates with specifics.`);
    }
    if (snippets.length >= 2) {
      lines.push(`There’s a subtle tension between two ideas: “${(snippets[0].refined_text || '').slice(0, 80)}” and “${(snippets[1].refined_text || '').slice(0, 80)}.” That contrast is worth exploring.`);
    }

    // Practical wrap
    lines.push(`If your goal is ${job || 'to understand the essentials'}, pick one action you can do in the next 24 hours—draft a summary, teach a friend, or test an example.`);

    // Outro
    lines.push(choose(closers));

    // Light SSML pauses for better cadence
    const withPauses = lines
      .map(l => l.replace(/&/g, 'and'))
      .map(l => `<s>${l}</s>`)
      .join('<break time="400ms"/>');

    return withPauses;
  } catch (error) {
    console.error('Error creating podcast script:', error);
    throw error;
  }
}

async function main() {
  await fetchConfig();
  await fetchHealth();
  await loadDocuments();
  document.getElementById('uploadBtn').addEventListener('click', uploadFiles);
  document.getElementById('analyzeBtn').addEventListener('click', analyze);
  const ib = document.getElementById('insightsBtn');
  const pb = document.getElementById('podcastBtn');
  if (ib) { ib.disabled = true; ib.addEventListener('click', insights); }
  if (pb) { pb.disabled = true; pb.addEventListener('click', podcast); }
  setupToolbar();

  // Theme
  initTheme();
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

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

window.addEventListener('DOMContentLoaded', main);

