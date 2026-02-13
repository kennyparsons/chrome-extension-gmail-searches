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
   * Supports both light and dark modes
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
        background: var(--wizmail-bg, #ffffff);
        color: var(--wizmail-text, #202124);
      }

      /* Detect dark mode from Gmail */
      @media (prefers-color-scheme: dark) {
        .wizmail-container {
          --wizmail-bg: #2d2e30;
          --wizmail-text: #e8eaed;
          --wizmail-border: #5f6368;
          --wizmail-hover: #3c4043;
          --wizmail-btn-bg: #3c4043;
          --wizmail-btn-border: #5f6368;
          --wizmail-btn-text: #e8eaed;
          --wizmail-input-bg: #3c4043;
          --wizmail-input-border: #5f6368;
          --wizmail-input-text: #e8eaed;
        }
      }

      @media (prefers-color-scheme: light) {
        .wizmail-container {
          --wizmail-bg: #ffffff;
          --wizmail-text: #202124;
          --wizmail-border: #e0e0e0;
          --wizmail-hover: #f5f5f5;
          --wizmail-btn-bg: #ffffff;
          --wizmail-btn-border: #dadce0;
          --wizmail-btn-text: #5f6368;
          --wizmail-input-bg: #ffffff;
          --wizmail-input-border: #dadce0;
          --wizmail-input-text: #202124;
        }
      }

      .wizmail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 16px;
        border-bottom: 1px solid var(--wizmail-border, #e0e0e0);
      }

      .wizmail-title {
        font-size: 14px;
        font-weight: 500;
        color: var(--wizmail-text, #202124);
        margin: 0;
      }

      .wizmail-add-btn {
        font-size: 11px;
        padding: 4px 12px;
        cursor: pointer;
        border: 1px solid var(--wizmail-btn-border, #dadce0);
        background: var(--wizmail-btn-bg, #fff);
        border-radius: 4px;
        color: var(--wizmail-btn-text, #5f6368);
      }

      .wizmail-add-btn:hover {
        opacity: 0.8;
      }

      .wizmail-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .wizmail-item {
        display: flex;
        align-items: center;
        padding: 8px 16px;
        border-bottom: 1px solid var(--wizmail-border, #e0e0e0);
        transition: background-color 0.15s;
      }

      .wizmail-item:hover {
        background-color: var(--wizmail-hover, #f5f5f5);
      }

      .wizmail-item-content {
        flex: 1;
        cursor: pointer;
        min-width: 0;
      }

      .wizmail-item-name {
        display: block;
        font-size: 14px;
        color: var(--wizmail-text, #202124);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .wizmail-item-query {
        display: block;
        font-size: 11px;
        color: var(--wizmail-btn-text, #5f6368);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-top: 2px;
      }

      .wizmail-item-actions {
        display: flex;
        gap: 4px;
        margin-left: 8px;
        opacity: 0;
        transition: opacity 0.15s;
      }

      .wizmail-item:hover .wizmail-item-actions {
        opacity: 1;
      }

      .wizmail-item-btn {
        font-size: 11px;
        padding: 2px 8px;
        cursor: pointer;
        border: 1px solid var(--wizmail-btn-border, #dadce0);
        background: var(--wizmail-btn-bg, #fff);
        border-radius: 3px;
        color: var(--wizmail-btn-text, #5f6368);
      }

      .wizmail-item-btn:hover {
        opacity: 0.7;
      }

      .wizmail-item-btn-delete {
        color: #d93025;
      }

      .wizmail-add-form {
        padding: 12px 16px;
        border-bottom: 1px solid var(--wizmail-border, #e0e0e0);
        background: var(--wizmail-hover, #f5f5f5);
      }

      .wizmail-form-group {
        margin-bottom: 8px;
      }

      .wizmail-form-label {
        display: block;
        font-size: 11px;
        font-weight: 500;
        margin-bottom: 4px;
        color: var(--wizmail-text, #202124);
      }

      .wizmail-form-input {
        width: 100%;
        padding: 6px 8px;
        font-size: 13px;
        border: 1px solid var(--wizmail-input-border, #dadce0);
        border-radius: 4px;
        box-sizing: border-box;
        background: var(--wizmail-input-bg, #fff);
        color: var(--wizmail-input-text, #202124);
      }

      .wizmail-form-input:focus {
        outline: none;
        border-color: #1a73e8;
      }

      .wizmail-form-error {
        font-size: 11px;
        color: #d93025;
        margin-top: 4px;
        display: none;
      }

      .wizmail-form-buttons {
        display: flex;
        gap: 8px;
        margin-top: 8px;
      }

      .wizmail-form-btn {
        padding: 6px 12px;
        font-size: 12px;
        border: 1px solid var(--wizmail-btn-border, #dadce0);
        background: var(--wizmail-btn-bg, #fff);
        border-radius: 4px;
        cursor: pointer;
        color: var(--wizmail-btn-text, #5f6368);
      }

      .wizmail-form-btn-primary {
        background: #1a73e8;
        color: #fff;
        border-color: #1a73e8;
      }

      .wizmail-form-btn:hover {
        opacity: 0.8;
      }

      .wizmail-edit-form {
        padding: 8px 16px;
        background: var(--wizmail-hover, #f5f5f5);
        border-bottom: 1px solid var(--wizmail-border, #e0e0e0);
      }
    `;
    return style;
  }

  // ============================================================================
  // PANEL UI COMPONENTS
  // ============================================================================

  /**
   * Creates a single search list item with edit/delete buttons
   * Query and name set via textContent to prevent XSS
   * @param {Object} search - Search object with name and q
   * @param {Function} onClick - Click handler for search
   * @param {Function} onEdit - Edit handler
   * @param {Function} onDelete - Delete handler
   * @param {number} index - Index in searches array
   * @returns {HTMLElement|null} List item element or null if invalid
   */
  function createSearchItem(search, onClick, onEdit, onDelete, index) {
    // Defensive validation
    if (!validateSearchObject(search)) {
      console.warn('[WizMail] Invalid search object, skipping');
      return null;
    }

    const li = document.createElement('li');
    li.className = 'wizmail-item';

    const content = document.createElement('div');
    content.className = 'wizmail-item-content';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'wizmail-item-name';
    // SECURITY: Use textContent to prevent XSS
    nameSpan.textContent = search.name;

    const querySpan = document.createElement('span');
    querySpan.className = 'wizmail-item-query';
    // SECURITY: Use textContent to prevent XSS
    querySpan.textContent = search.q;

    content.appendChild(nameSpan);
    content.appendChild(querySpan);

    content.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick(search);
    });

    const actions = document.createElement('div');
    actions.className = 'wizmail-item-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'wizmail-item-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onEdit(index);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'wizmail-item-btn wizmail-item-btn-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onDelete(index);
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(content);
    li.appendChild(actions);

    return li;
  }

  /**
   * Creates the add search form
   * @param {Function} onAdd - Callback when search is added
   * @param {Function} onCancel - Callback when cancelled
   * @returns {HTMLElement} Form element
   */
  function createAddForm(onAdd, onCancel) {
    const form = document.createElement('div');
    form.className = 'wizmail-add-form';

    const nameGroup = document.createElement('div');
    nameGroup.className = 'wizmail-form-group';

    const nameLabel = document.createElement('label');
    nameLabel.className = 'wizmail-form-label';
    nameLabel.textContent = 'Search Name';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'wizmail-form-input';
    nameInput.placeholder = 'e.g., Unread';
    nameInput.maxLength = MAX_NAME_LENGTH;

    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);

    const queryGroup = document.createElement('div');
    queryGroup.className = 'wizmail-form-group';

    const queryLabel = document.createElement('label');
    queryLabel.className = 'wizmail-form-label';
    queryLabel.textContent = 'Gmail Query';

    const queryInput = document.createElement('input');
    queryInput.type = 'text';
    queryInput.className = 'wizmail-form-input';
    queryInput.placeholder = 'e.g., is:unread';
    queryInput.maxLength = MAX_QUERY_LENGTH;

    queryGroup.appendChild(queryLabel);
    queryGroup.appendChild(queryInput);

    const errorDiv = document.createElement('div');
    errorDiv.className = 'wizmail-form-error';

    const buttons = document.createElement('div');
    buttons.className = 'wizmail-form-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'wizmail-form-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      onCancel();
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'wizmail-form-btn wizmail-form-btn-primary';
    addBtn.textContent = 'Add';
    addBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      const q = queryInput.value.trim();

      if (!validateString(name, MAX_NAME_LENGTH, 'name')) {
        errorDiv.textContent = 'Invalid search name (1-100 characters)';
        errorDiv.style.display = 'block';
        return;
      }

      if (!validateString(q, MAX_QUERY_LENGTH, 'query')) {
        errorDiv.textContent = 'Invalid query (1-500 characters)';
        errorDiv.style.display = 'block';
        return;
      }

      errorDiv.style.display = 'none';
      onAdd({ name, q });
    });

    buttons.appendChild(cancelBtn);
    buttons.appendChild(addBtn);

    form.appendChild(nameGroup);
    form.appendChild(queryGroup);
    form.appendChild(errorDiv);
    form.appendChild(buttons);

    return form;
  }

  /**
   * Creates the edit search form
   * @param {Object} search - Search to edit
   * @param {Function} onSave - Callback when saved
   * @param {Function} onCancel - Callback when cancelled
   * @returns {HTMLElement} Form element
   */
  function createEditForm(search, onSave, onCancel) {
    const form = document.createElement('div');
    form.className = 'wizmail-edit-form';

    const nameGroup = document.createElement('div');
    nameGroup.className = 'wizmail-form-group';

    const nameLabel = document.createElement('label');
    nameLabel.className = 'wizmail-form-label';
    nameLabel.textContent = 'Search Name';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'wizmail-form-input';
    nameInput.value = search.name;
    nameInput.maxLength = MAX_NAME_LENGTH;

    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);

    const queryGroup = document.createElement('div');
    queryGroup.className = 'wizmail-form-group';

    const queryLabel = document.createElement('label');
    queryLabel.className = 'wizmail-form-label';
    queryLabel.textContent = 'Gmail Query';

    const queryInput = document.createElement('input');
    queryInput.type = 'text';
    queryInput.className = 'wizmail-form-input';
    queryInput.value = search.q;
    queryInput.maxLength = MAX_QUERY_LENGTH;

    queryGroup.appendChild(queryLabel);
    queryGroup.appendChild(queryInput);

    const errorDiv = document.createElement('div');
    errorDiv.className = 'wizmail-form-error';

    const buttons = document.createElement('div');
    buttons.className = 'wizmail-form-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'wizmail-form-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      onCancel();
    });

    const saveBtn = document.createElement('button');
    saveBtn.className = 'wizmail-form-btn wizmail-form-btn-primary';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      const q = queryInput.value.trim();

      if (!validateString(name, MAX_NAME_LENGTH, 'name')) {
        errorDiv.textContent = 'Invalid search name (1-100 characters)';
        errorDiv.style.display = 'block';
        return;
      }

      if (!validateString(q, MAX_QUERY_LENGTH, 'query')) {
        errorDiv.textContent = 'Invalid query (1-500 characters)';
        errorDiv.style.display = 'block';
        return;
      }

      errorDiv.style.display = 'none';
      onSave({ name, q });
    });

    buttons.appendChild(cancelBtn);
    buttons.appendChild(saveBtn);

    form.appendChild(nameGroup);
    form.appendChild(queryGroup);
    form.appendChild(errorDiv);
    form.appendChild(buttons);

    return form;
  }

  /**
   * Creates the panel header with title and add button
   * All text set via textContent to prevent XSS
   * @param {Function} onAdd - Add button click handler
   * @returns {HTMLElement} Header container
   */
  function createPanelHeader(onAdd) {
    const header = document.createElement('div');
    header.className = 'wizmail-header';

    const title = document.createElement('h3');
    title.className = 'wizmail-title';
    // SECURITY: Use textContent to prevent XSS
    title.textContent = 'Saved Searches';

    const addBtn = document.createElement('button');
    addBtn.className = 'wizmail-add-btn';
    // SECURITY: Use textContent to prevent XSS
    addBtn.textContent = '+ Add';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onAdd();
    });

    header.appendChild(title);
    header.appendChild(addBtn);

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
  // DOM INSERTION
  // ============================================================================

  /**
   * Finds Gmail's left navigation panel
   * Uses same approach as working Tampermonkey script
   * @returns {HTMLElement|null} Navigation element or null
   */
  function findGmailNavigationContainer() {
    // Try exact selectors from working script
    let nav = document.querySelector('div[role="navigation"]');
    if (nav) {
      console.log('[WizMail] Found nav via div[role="navigation"]');
      return nav;
    }

    nav = document.querySelector('nav[role="navigation"]');
    if (nav) {
      console.log('[WizMail] Found nav via nav[role="navigation"]');
      return nav;
    }

    nav = document.querySelector('div[aria-label="Main menu"]');
    if (nav) {
      console.log('[WizMail] Found nav via aria-label="Main menu"');
      return nav;
    }

    console.error('[WizMail] Could not find navigation container');
    return null;
  }

  /**
   * Finds the Labels header element
   * Uses same approach as working Tampermonkey script
   * @param {HTMLElement} nav - Navigation container
   * @returns {HTMLElement|null} Labels element or null
   */
  function findLabelsHeader(nav) {
    if (!nav) return null;

    // Find an element whose text is exactly "Labels"
    const textNodes = Array.from(nav.querySelectorAll('span, div, button'));
    const labelsHeader = textNodes.find(
      (n) => n.textContent && n.textContent.trim() === 'Labels'
    );

    if (labelsHeader) {
      console.log('[WizMail] Found Labels header');
      return labelsHeader;
    }

    return null;
  }

  /**
   * Inserts panel host element into Gmail DOM
   * Uses same approach as working Tampermonkey script
   * @param {HTMLElement} hostElement - Host element to insert
   * @returns {boolean} True if inserted successfully
   */
  function insertPanelIntoDOM(hostElement) {
    const nav = findGmailNavigationContainer();
    if (!nav) {
      console.error('[WizMail] Gmail navigation not found, cannot insert panel');
      return false;
    }

    // Try to anchor the panel below the "Labels" header
    const labelsHeader = findLabelsHeader(nav);
    if (labelsHeader && labelsHeader.parentElement) {
      labelsHeader.parentElement.insertAdjacentElement('afterend', hostElement);
      console.log('[WizMail] Panel inserted after Labels');
      return true;
    }

    // Fallback: append at end
    nav.appendChild(hostElement);
    console.log('[WizMail] Panel appended to nav (fallback)');
    return true;
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

  let currentShadowRoot = null;
  let currentSearches = [];

  /**
   * Re-renders the search list in the existing panel
   */
  async function rerenderSearchList() {
    if (!currentShadowRoot) {
      return;
    }

    currentSearches = await loadSearchesFromStorage();

    const existingList = currentShadowRoot.querySelector('.wizmail-list');
    const existingForm = currentShadowRoot.querySelector('.wizmail-add-form, .wizmail-edit-form');

    if (existingList) {
      existingList.remove();
    }
    if (existingForm) {
      existingForm.remove();
    }

    const container = currentShadowRoot.querySelector('.wizmail-container');
    if (!container) {
      return;
    }

    const searchList = createSearchList(
      currentSearches,
      handleSearchClick,
      handleEdit,
      handleDelete
    );

    container.appendChild(searchList);
  }

  /**
   * Shows the add search form
   */
  function showAddForm() {
    if (!currentShadowRoot) {
      return;
    }

    const existingForm = currentShadowRoot.querySelector('.wizmail-add-form, .wizmail-edit-form');
    if (existingForm) {
      return; // Already showing a form
    }

    if (currentSearches.length >= MAX_SEARCHES) {
      alert(`Maximum ${MAX_SEARCHES} searches allowed`);
      return;
    }

    const container = currentShadowRoot.querySelector('.wizmail-container');
    const header = currentShadowRoot.querySelector('.wizmail-header');

    const form = createAddForm(
      async (search) => {
        currentSearches.push(search);
        const saved = await saveSearchesToStorage(currentSearches);
        if (saved) {
          await rerenderSearchList();
        }
      },
      () => {
        const form = currentShadowRoot.querySelector('.wizmail-add-form');
        if (form) {
          form.remove();
        }
      }
    );

    // Insert after header
    if (header.nextSibling) {
      container.insertBefore(form, header.nextSibling);
    } else {
      container.appendChild(form);
    }
  }

  /**
   * Handles editing a search
   * @param {number} index - Index of search to edit
   */
  function handleEdit(index) {
    if (!currentShadowRoot || index < 0 || index >= currentSearches.length) {
      return;
    }

    const existingForm = currentShadowRoot.querySelector('.wizmail-add-form, .wizmail-edit-form');
    if (existingForm) {
      existingForm.remove();
    }

    const search = currentSearches[index];
    const list = currentShadowRoot.querySelector('.wizmail-list');
    const listItems = list.querySelectorAll('.wizmail-item');
    const targetItem = listItems[index];

    if (!targetItem) {
      return;
    }

    const form = createEditForm(
      search,
      async (updatedSearch) => {
        currentSearches[index] = updatedSearch;
        const saved = await saveSearchesToStorage(currentSearches);
        if (saved) {
          await rerenderSearchList();
        }
      },
      () => {
        const form = currentShadowRoot.querySelector('.wizmail-edit-form');
        if (form) {
          form.remove();
        }
      }
    );

    // Insert after the item being edited
    if (targetItem.nextSibling) {
      list.insertBefore(form, targetItem.nextSibling);
    } else {
      list.appendChild(form);
    }
  }

  /**
   * Handles deleting a search
   * @param {number} index - Index of search to delete
   */
  async function handleDelete(index) {
    if (index < 0 || index >= currentSearches.length) {
      return;
    }

    const search = currentSearches[index];
    const confirmed = confirm(`Delete "${search.name}"?`);

    if (!confirmed) {
      return;
    }

    currentSearches.splice(index, 1);

    // If all searches deleted, restore defaults
    if (currentSearches.length === 0) {
      currentSearches = DEFAULT_SEARCHES.slice();
    }

    const saved = await saveSearchesToStorage(currentSearches);
    if (saved) {
      await rerenderSearchList();
    }
  }

  /**
   * Creates the search list container
   * @param {Array} searches - Array of search objects
   * @param {Function} onSearchClick - Click handler for searches
   * @param {Function} onEdit - Edit handler
   * @param {Function} onDelete - Delete handler
   * @returns {HTMLElement} Unordered list element
   */
  function createSearchList(searches, onSearchClick, onEdit, onDelete) {
    const ul = document.createElement('ul');
    ul.className = 'wizmail-list';

    if (!Array.isArray(searches) || searches.length === 0) {
      return ul;
    }

    for (let i = 0; i < searches.length; i++) {
      const item = createSearchItem(searches[i], onSearchClick, onEdit, onDelete, i);
      if (item !== null) {
        ul.appendChild(item);
      }
    }

    return ul;
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

    currentSearches = await loadSearchesFromStorage();

    const hostElement = createShadowHost();
    const shadowRoot = attachShadowRoot(hostElement);
    currentShadowRoot = shadowRoot;

    const styles = createShadowStyles();
    shadowRoot.appendChild(styles);

    const container = document.createElement('div');
    container.className = 'wizmail-container';

    const header = createPanelHeader(showAddForm);
    container.appendChild(header);

    const searchList = createSearchList(
      currentSearches,
      handleSearchClick,
      handleEdit,
      handleDelete
    );
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
   * Uses same approach as working Tampermonkey script
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

      // Gmail SPA needs extra time to render navigation
      // Try multiple times with delays
      let attempts = 0;
      const maxAttempts = 20;
      const delay = 500; // ms

      while (attempts < maxAttempts) {
        const nav = findGmailNavigationContainer();
        if (nav) {
          console.log(`[WizMail] Navigation found on attempt ${attempts + 1}`);
          await renderPanel();
          setupMutationObserver();
          console.log('[WizMail] Initialization complete');
          return;
        }

        if (attempts === 0 || attempts % 5 === 0) {
          console.log(`[WizMail] Waiting for Gmail to load... (attempt ${attempts + 1}/${maxAttempts})`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        attempts++;
      }

      console.error('[WizMail] Failed to find Gmail navigation after', maxAttempts, 'attempts');
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
