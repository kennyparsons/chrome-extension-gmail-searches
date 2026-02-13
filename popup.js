/**
 * Gmail Quick Search - Popup
 * Displays saved searches and handles navigation to Gmail
 */

'use strict';

const STORAGE_KEY = 'wizmail-saved-searches-v1';

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

/**
 * Loads searches from storage
 */
async function loadSearches() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const searches = result[STORAGE_KEY];

    if (!searches || !Array.isArray(searches) || searches.length === 0) {
      return DEFAULT_SEARCHES;
    }

    return searches;
  } catch (error) {
    console.error('[Gmail Quick Search] Error loading searches:', error);
    return DEFAULT_SEARCHES;
  }
}

/**
 * Navigates to a Gmail search
 */
async function navigateToSearch(query) {
  try {
    // Find Gmail tab or create new one
    const tabs = await chrome.tabs.query({});
    const gmailTab = tabs.find(tab => tab.url && tab.url.includes('mail.google.com'));

    const searchHash = '#search/' + encodeURIComponent(query);
    const gmailUrl = 'https://mail.google.com/mail/u/0/' + searchHash;

    if (gmailTab) {
      // Update existing Gmail tab
      await chrome.tabs.update(gmailTab.id, {
        active: true,
        url: gmailUrl
      });

      // Focus the window containing the tab
      await chrome.windows.update(gmailTab.windowId, { focused: true });
    } else {
      // Open new Gmail tab
      await chrome.tabs.create({ url: gmailUrl });
    }

    // Close popup
    window.close();
  } catch (error) {
    console.error('[Gmail Quick Search] Error navigating:', error);
  }
}

/**
 * Renders the search list
 */
function renderSearchList(searches) {
  const listContainer = document.getElementById('searchList');
  listContainer.innerHTML = '';

  if (!searches || searches.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-state-icon">📧</div>
      <div class="empty-state-text">No saved searches yet.<br>Click "+ Add Search" to get started.</div>
    `;
    listContainer.appendChild(empty);
    return;
  }

  searches.forEach((search) => {
    const item = document.createElement('div');
    item.className = 'search-item';

    const name = document.createElement('div');
    name.className = 'search-item-name';
    // Security: use textContent
    name.textContent = search.name;

    item.appendChild(name);

    item.addEventListener('click', () => {
      navigateToSearch(search.q);
    });

    // Add tooltip showing the query on hover
    item.title = search.q;

    listContainer.appendChild(item);
  });
}

/**
 * Opens the manage window
 */
function openManageWindow() {
  const width = 600;
  const height = 700;
  const left = Math.round((screen.width - width) / 2);
  const top = Math.round((screen.height - height) / 2);

  chrome.windows.create({
    url: 'manage.html',
    type: 'popup',
    width: width,
    height: height,
    left: left,
    top: top
  });

  window.close();
}

/**
 * Opens add search window
 */
function openAddWindow() {
  const width = 500;
  const height = 400;
  const left = Math.round((screen.width - width) / 2);
  const top = Math.round((screen.height - height) / 2);

  chrome.windows.create({
    url: 'manage.html?action=add',
    type: 'popup',
    width: width,
    height: height,
    left: left,
    top: top
  });

  window.close();
}

/**
 * Initializes the popup
 */
async function init() {
  const searches = await loadSearches();
  renderSearchList(searches);

  // Set up event listeners
  document.getElementById('manageBtn').addEventListener('click', openManageWindow);
  document.getElementById('addBtn').addEventListener('click', openAddWindow);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
