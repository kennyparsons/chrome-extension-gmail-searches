/**
 * WizMail - Gmail Saved Searches Extension
 * Security-first Chrome extension for Gmail productivity
 * All user data rendered via textContent to prevent XSS
 */

(function() {
  'use strict';

  // ============================================================================
  // CONSTANTS & CONFIGURATION
  // ============================================================================

  /** Storage key for saved searches */
  const STORAGE_KEY = 'wizmail-saved-searches-v1';

  /** Maximum number of saved searches allowed */
  const MAX_SEARCHES = 50;

  /** Maximum length for search name */
  const MAX_NAME_LENGTH = 100;

  /** Maximum length for search query */
  const MAX_QUERY_LENGTH = 500;

  /** Debounce delay for mutation observer (ms) */
  const DEBOUNCE_DELAY = 100;

  /** Default saved searches */
  const DEFAULT_SEARCHES = Object.freeze([
    { name: "Unread", q: "is:unread" },
    { name: "Unread Archived", q: "is:unread -in:inbox" },
    { name: "Needs Reply", q: "from:* has:nouserlabels -category:social -category:promotions -category:updates -category:forums -category:advertisements -category:reservations -category:purchases is:unread" },
    { name: "Should Archive", q: "-has:nouserlabels in:inbox is:read -is:starred" },
    { name: "Attachments", q: "has:attachment" },
    { name: "Receipts", q: "category:purchases OR newer_than:1y subject:(receipt OR invoice)" },
    { name: "Starred", q: "is:starred" },
    { name: "Calendar", q: "-from:(me) subject:(\"invitation\" OR \"accepted\" OR \"rejected\" OR \"updated\" OR \"canceled event\" OR \"declined\" OR \"proposed\") when where calendar who organizer -Re" }
  ]);

  // ============================================================================
  // VALIDATION FUNCTIONS
  // ============================================================================

  /**
   * Validates a string value against max length
   * @param {*} value - Value to validate
   * @param {number} maxLength - Maximum allowed length
   * @param {string} fieldName - Field name for logging
   * @returns {boolean} True if valid
   */
  function validateString(value, maxLength, fieldName) {
    if (value === undefined || value === null) {
      return false;
    }
    if (typeof value !== 'string') {
      return false;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return false;
    }
    if (trimmed.length > maxLength) {
      return false;
    }
    return true;
  }

  /**
   * Validates a single search object structure
   * @param {*} obj - Object to validate
   * @returns {boolean} True if valid search object
   */
  function validateSearchObject(obj) {
    if (obj === undefined || obj === null) {
      return false;
    }
    if (typeof obj !== 'object') {
      return false;
    }
    if (Array.isArray(obj)) {
      return false;
    }
    if (!('name' in obj) || !('q' in obj)) {
      return false;
    }
    if (!validateString(obj.name, MAX_NAME_LENGTH, 'name')) {
      return false;
    }
    if (!validateString(obj.q, MAX_QUERY_LENGTH, 'query')) {
      return false;
    }
    return true;
  }

  /**
   * Validates an array of search objects
   * Prevents injection attacks and storage abuse
   * @param {*} data - Data to validate
   * @returns {boolean} True if valid searches array
   */
  function validateSearchesArray(data) {
    if (data === undefined || data === null) {
      return false;
    }
    if (!Array.isArray(data)) {
      return false;
    }
    if (data.length === 0) {
      return false;
    }
    if (data.length > MAX_SEARCHES) {
      return false;
    }
    for (let i = 0; i < data.length; i++) {
      if (!validateSearchObject(data[i])) {
        return false;
      }
    }
    return true;
  }

  /**
   * Sanitizes searches array by trimming strings and creating new objects
   * Creates new objects to prevent prototype pollution
   * @param {Array} data - Array to sanitize
   * @returns {Array} Sanitized array
   */
  function sanitizeSearchesArray(data) {
    if (!Array.isArray(data)) {
      return DEFAULT_SEARCHES.slice();
    }
    const sanitized = [];
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      sanitized.push({
        name: item.name.trim(),
        q: item.q.trim()
      });
    }
    return sanitized;
  }

  /**
   * Detects dangerous patterns in import data
   * Defense-in-depth against code injection attempts
   * @param {string} jsonString - JSON string to check
   * @returns {boolean} True if dangerous patterns found
   */
  function containsDangerousPatterns(jsonString) {
    const lowerCase = jsonString.toLowerCase();
    const patterns = [
      '<script',
      'javascript:',
      'data:',
      /on[a-z]+=/ // Event handlers like onclick=
    ];
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      if (typeof pattern === 'string') {
        if (lowerCase.includes(pattern)) {
          return true;
        }
      } else {
        // Regex pattern
        if (pattern.test(lowerCase)) {
          return true;
        }
      }
    }
    return false;
  }

  // ============================================================================
  // STORAGE FUNCTIONS
  // ============================================================================

  /**
   * Loads saved searches from chrome.storage.local
   * Never trusts stored data without validation
   * @returns {Promise<Array>} Array of search objects
   */
  async function loadSearchesFromStorage() {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEY]);
      const data = result[STORAGE_KEY];

      if (data === undefined) {
        return DEFAULT_SEARCHES.slice();
      }

      if (!validateSearchesArray(data)) {
        console.log('[WizMail] Stored data invalid, using defaults');
        return DEFAULT_SEARCHES.slice();
      }

      return sanitizeSearchesArray(data);
    } catch (error) {
      // Never log user data
      console.error('[WizMail] Storage load error, using defaults');
      return DEFAULT_SEARCHES.slice();
    }
  }

  /**
   * Saves searches to chrome.storage.local with validation
   * @param {Array} searches - Array of search objects to save
   * @returns {Promise<boolean>} True if saved successfully
   */
  async function saveSearchesToStorage(searches) {
    try {
      if (!validateSearchesArray(searches)) {
        console.error('[WizMail] Cannot save invalid data');
        return false;
      }

      const sanitized = sanitizeSearchesArray(searches);
      const storageObject = {
        [STORAGE_KEY]: sanitized
      };

      await chrome.storage.local.set(storageObject);
      console.log('[WizMail] Searches saved successfully');
      return true;
    } catch (error) {
      // Never log error details (may contain user data)
      console.error('[WizMail] Storage save error');
      return false;
    }
  }

  // ============================================================================
  // UI UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Debounce utility function
   * Prevents excessive re-renders on rapid DOM changes
   * @param {Function} func - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  function debounce(func, delay) {
    let timeoutId = null;
    return function(...args) {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  }

  // ============================================================================
  // SHADOW DOM CREATION
  // ============================================================================

  /**
   * Creates the host element for Shadow DOM
   * @returns {HTMLElement} Host div element
   */
  function createShadowHost() {
    const hostElement = document.createElement('div');
    hostElement.id = 'wizmail-saved-searches-host';
    hostElement.style.display = 'block';
    hostElement.dataset.wizmail = 'true';
    return hostElement;
  }

  /**
   * Attaches shadow root to host element
   * Open mode allows inspection by IT security
   * @param {HTMLElement} hostElement - Host element
   * @returns {ShadowRoot} Shadow root
   */
  function attachShadowRoot(hostElement) {
    const shadowRoot = hostElement.attachShadow({ mode: 'open' });
    return shadowRoot;
  }

  /**
   * Creates CSS styles for shadow DOM
   * @returns {HTMLStyleElement} Style element
   */
  function createShadowStyles() {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        font-family: 'Google Sans', Roboto, RobotoDraft, Helvetica, Arial, sans-serif;
      }

      .wizmail-container {
        margin: 8px 0;
        padding: 0;
      }

      .wizmail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 16px;
        border-bottom: 1px solid #e0e0e0;
      }

      .wizmail-title {
        font-size: 14px;
        font-weight: 500;
        color: #202124;
        margin: 0;
      }

      .wizmail-buttons {
        display: flex;
        gap: 8px;
      }

      .wizmail-btn {
        font-size: 11px;
        padding: 4px 8px;
        cursor: pointer;
        border: 1px solid #dadce0;
        background: #fff;
        border-radius: 4px;
        color: #5f6368;
      }

      .wizmail-btn:hover {
        background: #f8f9fa;
        border-color: #dadce0;
      }

      .wizmail-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .wizmail-item {
        padding: 8px 16px;
        cursor: pointer;
        font-size: 14px;
        color: #202124;
        transition: background-color 0.15s;
      }

      .wizmail-item:hover {
        background-color: #f5f5f5;
      }

      .wizmail-item-name {
        display: block;
      }

      .wizmail-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000000;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .wizmail-modal-dialog {
        background: #fff;
        padding: 24px;
        border-radius: 8px;
        max-width: 600px;
        max-height: 80vh;
        overflow: auto;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      }

      .wizmail-modal-title {
        margin: 0 0 16px 0;
        font-size: 18px;
        font-weight: 500;
        color: #202124;
      }

      .wizmail-modal-text {
        margin: 0 0 16px 0;
        font-size: 14px;
        color: #5f6368;
      }

      .wizmail-modal-textarea {
        width: 100%;
        min-height: 300px;
        font-family: monospace;
        font-size: 12px;
        padding: 8px;
        border: 1px solid #dadce0;
        border-radius: 4px;
        margin-bottom: 16px;
        box-sizing: border-box;
      }

      .wizmail-modal-error {
        color: #d93025;
        font-size: 13px;
        margin-bottom: 16px;
        display: none;
      }

      .wizmail-modal-buttons {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      .wizmail-modal-btn {
        padding: 8px 16px;
        font-size: 14px;
        border: 1px solid #dadce0;
        background: #fff;
        border-radius: 4px;
        cursor: pointer;
        color: #202124;
      }

      .wizmail-modal-btn-primary {
        background: #1a73e8;
        color: #fff;
        border-color: #1a73e8;
      }

      .wizmail-modal-btn:hover {
        background: #f8f9fa;
      }

      .wizmail-modal-btn-primary:hover {
        background: #1765cc;
      }
    `;
    return style;
  }

  // ============================================================================
  // PANEL UI COMPONENTS
  // ============================================================================

  /**
   * Creates a single search list item
   * Query and name set via textContent to prevent XSS
   * @param {Object} search - Search object with name and q
   * @param {Function} onClick - Click handler
   * @returns {HTMLElement|null} List item element or null if invalid
   */
  function createSearchItem(search, onClick) {
    // Defensive validation
    if (!validateSearchObject(search)) {
      console.warn('[WizMail] Invalid search object, skipping');
      return null;
    }

    const li = document.createElement('li');
    li.className = 'wizmail-item';

    const span = document.createElement('span');
    span.className = 'wizmail-item-name';
    // SECURITY: Use textContent to prevent XSS
    span.textContent = search.name;
    span.title = search.q; // Tooltip showing query

    li.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick(search);
    });

    li.appendChild(span);
    return li;
  }

  /**
   * Creates the search list container
   * @param {Array} searches - Array of search objects
   * @param {Function} onSearchClick - Click handler for searches
   * @returns {HTMLElement} Unordered list element
   */
  function createSearchList(searches, onSearchClick) {
    const ul = document.createElement('ul');
    ul.className = 'wizmail-list';

    if (!Array.isArray(searches) || searches.length === 0) {
      return ul;
    }

    for (let i = 0; i < searches.length; i++) {
      const item = createSearchItem(searches[i], onSearchClick);
      if (item !== null) {
        ul.appendChild(item);
      }
    }

    return ul;
  }

  /**
   * Creates the panel header with title and buttons
   * All text set via textContent to prevent XSS
   * @param {Function} onExport - Export button click handler
   * @param {Function} onImport - Import button click handler
   * @returns {HTMLElement} Header container
   */
  function createPanelHeader(onExport, onImport) {
    const header = document.createElement('div');
    header.className = 'wizmail-header';

    const title = document.createElement('h3');
    title.className = 'wizmail-title';
    // SECURITY: Use textContent to prevent XSS
    title.textContent = 'Saved Searches';

    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'wizmail-buttons';

    const exportBtn = document.createElement('button');
    exportBtn.className = 'wizmail-btn';
    // SECURITY: Use textContent to prevent XSS
    exportBtn.textContent = 'Export';
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onExport();
    });

    const importBtn = document.createElement('button');
    importBtn.className = 'wizmail-btn';
    // SECURITY: Use textContent to prevent XSS
    importBtn.textContent = 'Import';
    importBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onImport();
    });

    buttonsContainer.appendChild(exportBtn);
    buttonsContainer.appendChild(importBtn);

    header.appendChild(title);
    header.appendChild(buttonsContainer);

    return header;
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  /**
   * Handles search item click and navigates to Gmail search
   * Always encodes query to prevent hash injection
   * @param {Object} search - Search object
   */
  function handleSearchClick(search) {
    const query = search.q;
    // SECURITY: Always encode query to prevent hash injection
    const encodedQuery = encodeURIComponent(query);
    const targetHash = '#search/' + encodedQuery;
    const currentHash = window.location.hash;

    if (currentHash === targetHash) {
      // Already on this search, force refresh
      window.location.hash = '#inbox';
      setTimeout(() => {
        window.location.hash = targetHash;
      }, 100);
    } else {
      window.location.hash = targetHash;
    }
  }

  // ============================================================================
  // MODAL FUNCTIONS
  // ============================================================================

  /**
   * Closes and removes a modal from shadow DOM
   * @param {HTMLElement} modalElement - Modal to close
   * @param {ShadowRoot} shadowRoot - Shadow root containing modal
   */
  function closeModal(modalElement, shadowRoot) {
    if (modalElement && shadowRoot.contains(modalElement)) {
      shadowRoot.removeChild(modalElement);
    }
  }

  /**
   * Shows export modal with current searches as JSON
   * Readonly textarea prevents accidental edits
   * @param {ShadowRoot} shadowRoot - Shadow root to append modal to
   */
  async function showExportModal(shadowRoot) {
    const searches = await loadSearchesFromStorage();
    const jsonString = JSON.stringify(searches, null, 2);

    const overlay = document.createElement('div');
    overlay.className = 'wizmail-modal-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'wizmail-modal-dialog';

    const title = document.createElement('h3');
    title.className = 'wizmail-modal-title';
    title.textContent = 'Export Saved Searches';

    const text = document.createElement('p');
    text.className = 'wizmail-modal-text';
    text.textContent = 'Copy the JSON below to back up your saved searches:';

    const textarea = document.createElement('textarea');
    textarea.className = 'wizmail-modal-textarea';
    textarea.value = jsonString;
    textarea.readOnly = true;
    textarea.rows = 15;

    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'wizmail-modal-buttons';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'wizmail-modal-btn wizmail-modal-btn-primary';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => {
      closeModal(overlay, shadowRoot);
    });

    buttonsContainer.appendChild(closeBtn);

    dialog.appendChild(title);
    dialog.appendChild(text);
    dialog.appendChild(textarea);
    dialog.appendChild(buttonsContainer);

    overlay.appendChild(dialog);

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay, shadowRoot);
      }
    });

    // ESC key to close
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal(overlay, shadowRoot);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    shadowRoot.appendChild(overlay);
  }

  /**
   * Shows validation error in modal
   * @param {HTMLElement} errorElement - Error display element
   * @param {string} message - Error message to display
   */
  function showValidationError(errorElement, message) {
    errorElement.textContent = message;
    errorElement.style.color = '#d93025';
    errorElement.style.display = 'block';
  }

  /**
   * Shows import modal for pasting JSON configuration
   * Multiple validation layers prevent injection
   * @param {ShadowRoot} shadowRoot - Shadow root to append modal to
   * @param {Function} onImportSuccess - Callback on successful import
   */
  async function showImportModal(shadowRoot, onImportSuccess) {
    const overlay = document.createElement('div');
    overlay.className = 'wizmail-modal-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'wizmail-modal-dialog';

    const title = document.createElement('h3');
    title.className = 'wizmail-modal-title';
    title.textContent = 'Import Saved Searches';

    const text = document.createElement('p');
    text.className = 'wizmail-modal-text';
    text.textContent = 'Paste your exported JSON below to restore saved searches:';

    const textarea = document.createElement('textarea');
    textarea.className = 'wizmail-modal-textarea';
    textarea.placeholder = 'Paste JSON here...';
    textarea.rows = 15;

    const errorDiv = document.createElement('div');
    errorDiv.className = 'wizmail-modal-error';

    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'wizmail-modal-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'wizmail-modal-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      closeModal(overlay, shadowRoot);
    });

    const importBtn = document.createElement('button');
    importBtn.className = 'wizmail-modal-btn wizmail-modal-btn-primary';
    importBtn.textContent = 'Import';
    importBtn.addEventListener('click', async () => {
      const value = textarea.value;

      if (!value || value.trim().length === 0) {
        showValidationError(errorDiv, 'Please paste JSON to import');
        return;
      }

      // SECURITY: Check for dangerous patterns
      if (containsDangerousPatterns(value)) {
        showValidationError(errorDiv, 'Import rejected: invalid format');
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(value);
      } catch (e) {
        showValidationError(errorDiv, 'Invalid JSON format');
        return;
      }

      // SECURITY: Validate structure
      if (!validateSearchesArray(parsed)) {
        showValidationError(errorDiv, 'Invalid search configuration');
        return;
      }

      const saved = await saveSearchesToStorage(parsed);
      if (!saved) {
        showValidationError(errorDiv, 'Could not save settings');
        return;
      }

      closeModal(overlay, shadowRoot);
      if (onImportSuccess) {
        onImportSuccess();
      }
    });

    buttonsContainer.appendChild(cancelBtn);
    buttonsContainer.appendChild(importBtn);

    dialog.appendChild(title);
    dialog.appendChild(text);
    dialog.appendChild(textarea);
    dialog.appendChild(errorDiv);
    dialog.appendChild(buttonsContainer);

    overlay.appendChild(dialog);

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay, shadowRoot);
      }
    });

    // ESC key to close
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal(overlay, shadowRoot);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    shadowRoot.appendChild(overlay);
  }

  // ============================================================================
  // DOM INSERTION
  // ============================================================================

  /**
   * Finds Gmail's navigation container
   * Multiple selectors for Gmail UI resilience
   * @returns {HTMLElement|null} Navigation container or null
   */
  function findGmailNavigationContainer() {
    // Gmail SPA has dynamic structure, try multiple selectors
    let navContainer = document.querySelector('[role="navigation"]');
    if (navContainer) {
      return navContainer;
    }

    // Fallback: look for common Gmail nav structure
    navContainer = document.querySelector('.aeN');
    if (navContainer) {
      return navContainer;
    }

    return null;
  }

  /**
   * Finds the Labels section in Gmail navigation
   * Attempts to place panel below Labels for better UX
   * @returns {HTMLElement|null} Labels section element or null
   */
  function findLabelsSection() {
    const allElements = document.querySelectorAll('*');
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      if (el.textContent && el.textContent.trim() === 'Labels') {
        return el;
      }
    }
    return null;
  }

  /**
   * Inserts panel host element into Gmail DOM
   * @param {HTMLElement} hostElement - Host element to insert
   * @returns {boolean} True if inserted successfully
   */
  function insertPanelIntoDOM(hostElement) {
    const labelsSection = findLabelsSection();

    if (labelsSection) {
      const parent = labelsSection.parentElement;
      const nextSibling = labelsSection.nextSibling;

      if (nextSibling) {
        parent.insertBefore(hostElement, nextSibling);
      } else {
        parent.appendChild(hostElement);
      }
      return true;
    }

    const navContainer = findGmailNavigationContainer();
    if (navContainer) {
      navContainer.appendChild(hostElement);
      return true;
    }

    console.error('[WizMail] Gmail navigation not found, cannot insert panel');
    return false;
  }

  /**
   * Checks if panel is already mounted in DOM
   * @returns {boolean} True if panel exists and is connected
   */
  function isPanelMounted() {
    const element = document.getElementById('wizmail-saved-searches-host');
    if (element && document.contains(element)) {
      return true;
    }
    return false;
  }

  // ============================================================================
  // PANEL RENDERING
  // ============================================================================

  /**
   * Handles successful import by re-rendering panel
   */
  function handleImportSuccess() {
    console.log('[WizMail] Import successful, re-rendering panel');
    const existingHost = document.getElementById('wizmail-saved-searches-host');
    if (existingHost) {
      existingHost.remove();
    }
    renderPanel();
  }

  /**
   * Renders the complete saved searches panel
   * Complete render pipeline from storage to DOM
   */
  async function renderPanel() {
    if (isPanelMounted()) {
      console.log('[WizMail] Panel already mounted');
      return;
    }

    const searches = await loadSearchesFromStorage();

    const hostElement = createShadowHost();
    const shadowRoot = attachShadowRoot(hostElement);

    const styles = createShadowStyles();
    shadowRoot.appendChild(styles);

    const container = document.createElement('div');
    container.className = 'wizmail-container';

    const header = createPanelHeader(
      () => showExportModal(shadowRoot),
      () => showImportModal(shadowRoot, handleImportSuccess)
    );
    container.appendChild(header);

    const searchList = createSearchList(searches, handleSearchClick);
    container.appendChild(searchList);

    shadowRoot.appendChild(container);

    const inserted = insertPanelIntoDOM(hostElement);
    if (inserted) {
      console.log('[WizMail] Panel mounted successfully');
    } else {
      console.error('[WizMail] Failed to insert panel');
    }
  }

  // ============================================================================
  // MUTATION OBSERVER
  // ============================================================================

  let observerInstance = null;

  /**
   * Sets up mutation observer to watch for Gmail re-renders
   * Debouncing prevents infinite loop and performance issues
   */
  function setupMutationObserver() {
    const navContainer = findGmailNavigationContainer();
    if (!navContainer) {
      console.warn('[WizMail] Cannot setup observer: navigation not found');
      return;
    }

    const debouncedRender = debounce(renderPanel, DEBOUNCE_DELAY);

    const callback = (mutations) => {
      if (!isPanelMounted()) {
        debouncedRender();
      }
    };

    const options = {
      childList: true,
      subtree: true
    };

    // Cleanup existing observer
    if (observerInstance) {
      observerInstance.disconnect();
    }

    observerInstance = new MutationObserver(callback);
    observerInstance.observe(navContainer, options);
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initializes the extension
   */
  async function initializeExtension() {
    try {
      const hostname = window.location.hostname;
      if (hostname !== 'mail.google.com') {
        console.log('[WizMail] Not on Gmail, exiting');
        return;
      }

      console.log('[WizMail] Initializing...');

      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }

      await renderPanel();
      setupMutationObserver();

      console.log('[WizMail] Initialization complete');
    } catch (error) {
      console.error('[WizMail] Initialization error:', error);
    }
  }

  // ============================================================================
  // ENTRY POINT
  // ============================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
  } else {
    initializeExtension();
  }

})();
