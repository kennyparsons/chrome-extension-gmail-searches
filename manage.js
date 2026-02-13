/**
 * WizMail Manage Page
 * Add, edit, delete saved searches
 */

'use strict';

const STORAGE_KEY = 'wizmail-saved-searches-v1';
const MAX_SEARCHES = 50;
const MAX_NAME_LENGTH = 100;
const MAX_QUERY_LENGTH = 500;

const DEFAULT_SEARCHES = [
  { name: "Unread", q: "is:unread" },
  { name: "Unread Archived", q: "is:unread -in:inbox" },
  { name: "Needs Reply", q: "from:* has:nouserlabels -category:social -category:promotions -category:updates -category:forums -category:advertisements -category:reservations -category:purchases is:unread" },
  { name: "Should Archive", q: "-has:nouserlabels in:inbox is:read -is:starred" },
  { name: "Attachments", q: "has:attachment" },
  { name: "Receipts", q: "category:purchases OR newer_than:1y subject:(receipt OR invoice)" },
  { name: "Starred", q: "is:starred" },
  { name: "Calendar", q: "-from:(me) subject:(\"invitation\" OR \"accepted\" OR \"rejected\" OR \"updated\" OR \"canceled event\" OR \"declined\" OR \"proposed\") when where calendar who organizer -Re" }
];

let currentSearches = [];
let editingIndex = null;

/**
 * Validates a string
 */
function validateString(value, maxLength) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength;
}

/**
 * Detects dangerous patterns in input
 * Security: Prevents code injection attempts
 */
function containsDangerousPatterns(value) {
  const dangerous = [
    /<script/i,
    /<iframe/i,
    /<embed/i,
    /<object/i,
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /on\w+\s*=/i, // Event handlers like onclick=
    /<img[^>]+src/i,
    /eval\(/i,
    /expression\(/i,
  ];

  for (const pattern of dangerous) {
    if (pattern.test(value)) {
      return true;
    }
  }

  return false;
}

/**
 * Validates Gmail query syntax
 * Basic validation to ensure it looks like a Gmail search
 */
function validateGmailQuery(query) {
  // Empty queries not allowed
  if (!query || query.trim().length === 0) {
    return { valid: false, error: 'Query cannot be empty' };
  }

  // Check for dangerous patterns
  if (containsDangerousPatterns(query)) {
    return { valid: false, error: 'Query contains invalid characters or patterns' };
  }

  // Common Gmail operators (not exhaustive, just common ones)
  const validOperators = [
    'from:', 'to:', 'subject:', 'label:', 'has:', 'is:', 'in:',
    'cc:', 'bcc:', 'after:', 'before:', 'older:', 'newer:',
    'category:', 'size:', 'larger:', 'smaller:', 'filename:',
    'has:attachment', 'has:drive', 'has:document', 'has:spreadsheet',
    'has:presentation', 'has:youtube', 'has:nouserlabels',
    'is:unread', 'is:read', 'is:starred', 'is:important', 'is:chat',
  ];

  // Allow basic text search and operators
  // Just warn about suspicious patterns, don't block everything
  const hasOperator = validOperators.some(op => query.toLowerCase().includes(op));
  const hasText = /[a-zA-Z0-9]/.test(query);

  if (!hasOperator && !hasText) {
    return { valid: false, error: 'Query must contain text or valid Gmail operators' };
  }

  // Check for SQL injection patterns (paranoid check)
  const sqlPatterns = [
    /union\s+select/i,
    /drop\s+table/i,
    /insert\s+into/i,
    /delete\s+from/i,
    /update\s+\w+\s+set/i,
    /--/,
    /;.*drop/i,
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(query)) {
      return { valid: false, error: 'Query contains invalid patterns' };
    }
  }

  return { valid: true };
}

/**
 * Checks for duplicate searches
 */
function checkDuplicate(name, query, excludeIndex = null) {
  for (let i = 0; i < currentSearches.length; i++) {
    if (i === excludeIndex) continue;

    const search = currentSearches[i];

    // Exact name match
    if (search.name.toLowerCase() === name.toLowerCase()) {
      return { isDuplicate: true, type: 'name', message: `A search named "${search.name}" already exists` };
    }

    // Exact query match
    if (search.q === query) {
      return { isDuplicate: true, type: 'query', message: `This query already exists as "${search.name}"` };
    }
  }

  return { isDuplicate: false };
}

/**
 * Validates search name
 */
function validateSearchName(name) {
  // Check for dangerous patterns
  if (containsDangerousPatterns(name)) {
    return { valid: false, error: 'Name contains invalid characters or patterns' };
  }

  // Check for suspicious characters
  if (/<|>|{|}|\$|`/.test(name)) {
    return { valid: false, error: 'Name contains invalid special characters' };
  }

  return { valid: true };
}

/**
 * Loads searches from storage
 */
async function loadSearches() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const searches = result[STORAGE_KEY];

    if (!searches || !Array.isArray(searches) || searches.length === 0) {
      return DEFAULT_SEARCHES.slice();
    }

    return searches;
  } catch (error) {
    console.error('[WizMail Manage] Error loading searches:', error);
    return DEFAULT_SEARCHES.slice();
  }
}

/**
 * Saves searches to storage
 */
async function saveSearches(searches) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: searches });
    return true;
  } catch (error) {
    console.error('[WizMail Manage] Error saving searches:', error);
    return false;
  }
}

/**
 * Shows the modal
 */
function showModal(title, search = null, index = null) {
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modalTitle');
  const nameInput = document.getElementById('searchName');
  const queryInput = document.getElementById('searchQuery');
  const errorDiv = document.getElementById('modalError');
  const nameValidation = document.getElementById('nameValidation');
  const queryValidation = document.getElementById('queryValidation');

  modalTitle.textContent = title;
  errorDiv.style.display = 'none';
  nameValidation.textContent = '';
  queryValidation.textContent = '';
  nameInput.className = 'form-input';
  queryInput.className = 'form-input';

  if (search) {
    nameInput.value = search.name;
    queryInput.value = search.q;
    editingIndex = index;
  } else {
    nameInput.value = '';
    queryInput.value = '';
    editingIndex = null;
  }

  modal.style.display = 'flex';
  nameInput.focus();
}

/**
 * Validates name input in real-time
 */
function validateNameInput() {
  const nameInput = document.getElementById('searchName');
  const nameValidation = document.getElementById('nameValidation');
  const name = nameInput.value.trim();

  if (name.length === 0) {
    nameInput.className = 'form-input';
    nameValidation.textContent = '';
    nameValidation.className = 'validation-indicator';
    return;
  }

  // Check length
  if (name.length > MAX_NAME_LENGTH) {
    nameInput.className = 'form-input invalid';
    nameValidation.textContent = `Too long (${name.length}/${MAX_NAME_LENGTH} chars)`;
    nameValidation.className = 'validation-indicator invalid';
    return;
  }

  // Security check
  const validation = validateSearchName(name);
  if (!validation.valid) {
    nameInput.className = 'form-input invalid';
    nameValidation.textContent = `⚠️ ${validation.error}`;
    nameValidation.className = 'validation-indicator invalid';
    return;
  }

  // Duplicate check
  const duplicateCheck = checkDuplicate(name, '', editingIndex);
  if (duplicateCheck.isDuplicate && duplicateCheck.type === 'name') {
    nameInput.className = 'form-input invalid';
    nameValidation.textContent = `⚠️ ${duplicateCheck.message}`;
    nameValidation.className = 'validation-indicator invalid';
    return;
  }

  // Valid
  nameInput.className = 'form-input valid';
  nameValidation.textContent = '✓ Valid';
  nameValidation.className = 'validation-indicator valid';
}

/**
 * Validates query input in real-time
 */
function validateQueryInput() {
  const queryInput = document.getElementById('searchQuery');
  const queryValidation = document.getElementById('queryValidation');
  const q = queryInput.value.trim();

  if (q.length === 0) {
    queryInput.className = 'form-input';
    queryValidation.textContent = '';
    queryValidation.className = 'validation-indicator';
    return;
  }

  // Check length
  if (q.length > MAX_QUERY_LENGTH) {
    queryInput.className = 'form-input invalid';
    queryValidation.textContent = `Too long (${q.length}/${MAX_QUERY_LENGTH} chars)`;
    queryValidation.className = 'validation-indicator invalid';
    return;
  }

  // Security check
  const validation = validateGmailQuery(q);
  if (!validation.valid) {
    queryInput.className = 'form-input invalid';
    queryValidation.textContent = `⚠️ ${validation.error}`;
    queryValidation.className = 'validation-indicator invalid';
    return;
  }

  // Duplicate check
  const duplicateCheck = checkDuplicate('', q, editingIndex);
  if (duplicateCheck.isDuplicate && duplicateCheck.type === 'query') {
    queryInput.className = 'form-input invalid';
    queryValidation.textContent = `⚠️ ${duplicateCheck.message}`;
    queryValidation.className = 'validation-indicator invalid';
    return;
  }

  // Valid
  queryInput.className = 'form-input valid';
  queryValidation.textContent = '✓ Valid Gmail query';
  queryValidation.className = 'validation-indicator valid';
}

/**
 * Hides the modal
 */
function hideModal() {
  const modal = document.getElementById('modal');
  modal.style.display = 'none';
  editingIndex = null;
}

/**
 * Shows error in modal
 */
function showModalError(message) {
  const errorDiv = document.getElementById('modalError');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

/**
 * Saves the current modal data
 */
async function saveModal() {
  const nameInput = document.getElementById('searchName');
  const queryInput = document.getElementById('searchQuery');

  const name = nameInput.value.trim();
  const q = queryInput.value.trim();

  // Step 1: Basic length validation
  if (!validateString(name, MAX_NAME_LENGTH)) {
    showModalError('Invalid search name (1-100 characters required)');
    return;
  }

  if (!validateString(q, MAX_QUERY_LENGTH)) {
    showModalError('Invalid query (1-500 characters required)');
    return;
  }

  // Step 2: Security validation for name
  const nameValidation = validateSearchName(name);
  if (!nameValidation.valid) {
    showModalError(`Name validation failed: ${nameValidation.error}`);
    return;
  }

  // Step 3: Security validation for query
  const queryValidation = validateGmailQuery(q);
  if (!queryValidation.valid) {
    showModalError(`Query validation failed: ${queryValidation.error}`);
    return;
  }

  // Step 4: Check for duplicates
  const duplicateCheck = checkDuplicate(name, q, editingIndex);
  if (duplicateCheck.isDuplicate) {
    const proceed = confirm(`⚠️ Warning: ${duplicateCheck.message}\n\nDo you want to continue anyway?`);
    if (!proceed) {
      return;
    }
  }

  // Step 5: Check max searches limit
  if (editingIndex === null && currentSearches.length >= MAX_SEARCHES) {
    showModalError(`Maximum ${MAX_SEARCHES} searches allowed`);
    return;
  }

  // Step 6: Save
  if (editingIndex !== null) {
    // Edit existing
    currentSearches[editingIndex] = { name, q };
  } else {
    // Add new
    currentSearches.push({ name, q });
  }

  const saved = await saveSearches(currentSearches);
  if (!saved) {
    showModalError('Failed to save. Please try again.');
    return;
  }

  hideModal();
  render();
}

/**
 * Deletes a search
 */
async function deleteSearch(index) {
  const search = currentSearches[index];
  const confirmed = confirm(`Delete "${search.name}"?`);

  if (!confirmed) return;

  currentSearches.splice(index, 1);

  // If all deleted, restore defaults
  if (currentSearches.length === 0) {
    currentSearches = DEFAULT_SEARCHES.slice();
  }

  await saveSearches(currentSearches);
  render();
}

/**
 * Resets to defaults
 */
async function resetToDefaults() {
  const confirmed = confirm('Reset all searches to defaults? This will delete your custom searches.');

  if (!confirmed) return;

  currentSearches = DEFAULT_SEARCHES.slice();
  await saveSearches(currentSearches);
  render();
}

/**
 * Renders the search list
 */
function render() {
  const listContainer = document.getElementById('searchList');
  listContainer.innerHTML = '';

  if (currentSearches.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-state-icon">📧</div>
      <div class="empty-state-text">No saved searches.<br>Click "Add New Search" to get started.</div>
    `;
    listContainer.appendChild(empty);
    return;
  }

  currentSearches.forEach((search, index) => {
    const item = document.createElement('div');
    item.className = 'manage-item';

    const content = document.createElement('div');
    content.className = 'manage-item-content';

    const name = document.createElement('div');
    name.className = 'manage-item-name';
    name.textContent = search.name;

    const query = document.createElement('div');
    query.className = 'manage-item-query';
    query.textContent = search.q;

    content.appendChild(name);
    content.appendChild(query);

    const actions = document.createElement('div');
    actions.className = 'manage-item-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'manage-item-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      showModal('Edit Search', search, index);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'manage-item-btn manage-item-btn-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      deleteSearch(index);
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(content);
    item.appendChild(actions);

    listContainer.appendChild(item);
  });
}

/**
 * Initializes the page
 */
async function init() {
  currentSearches = await loadSearches();
  render();

  // Set up event listeners
  document.getElementById('addNewBtn').addEventListener('click', () => {
    showModal('Add New Search');
  });

  document.getElementById('resetBtn').addEventListener('click', resetToDefaults);

  document.getElementById('modalClose').addEventListener('click', hideModal);
  document.getElementById('modalCancel').addEventListener('click', hideModal);
  document.getElementById('modalSave').addEventListener('click', saveModal);

  // Close modal on background click
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') {
      hideModal();
    }
  });

  // Real-time validation
  document.getElementById('searchName').addEventListener('input', validateNameInput);
  document.getElementById('searchQuery').addEventListener('input', validateQueryInput);

  // Handle Enter key in inputs
  document.getElementById('searchName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('searchQuery').focus();
    }
  });

  document.getElementById('searchQuery').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveModal();
    }
  });

  // Check if opened with action=add
  const params = new URLSearchParams(window.location.search);
  if (params.get('action') === 'add') {
    showModal('Add New Search');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
