# WizMail Implementation Plan - Initial POC

**Document Version:** 1.0
**Created:** 2026-02-13
**Status:** Draft
**Branch:** feat/initial-setup

---

## Overview

This document provides a highly detailed, step-by-step implementation plan for the WizMail Chrome extension. Each phase is broken down into microsteps that can be accomplished sequentially. Security requirements are integrated at every step.

---

## Phase 1: Project Structure & Manifest

### Step 1.1: Create Basic File Structure
**Objective:** Establish the minimal file structure for a Manifest v3 extension

**Microsteps:**
1. Create `manifest.json` in project root
2. Create `content.js` in project root
3. Verify both files are in the same directory as .gitignore

**Success Criteria:**
- Two files exist: `manifest.json` and `content.js`
- Files are tracked by git (not in .gitignore)

---

### Step 1.2: Write Manifest v3 Configuration
**Objective:** Create a secure, minimal manifest file

**Microsteps:**
1. Set `manifest_version` to 3
2. Set `name` to "WizMail"
3. Set `version` to "1.0.0"
4. Set `description` to describe the extension purpose (saved searches panel)
5. Add `permissions` array with only `"storage"`
6. Add `host_permissions` array with only `"https://mail.google.com/*"`
7. Add `content_scripts` array with single entry
8. Configure content script to match `"https://mail.google.com/*"`
9. Set content script to load `content.js`
10. Set content script `run_at` to `"document_idle"` (Gmail SPA needs full DOM)
11. Add `content_security_policy` object
12. Set `extension_pages` CSP to `"script-src 'self'; object-src 'none'"`
13. Validate JSON syntax
14. Verify no extra permissions are included (no tabs, activeTab, etc.)

**Success Criteria:**
- Manifest is valid JSON
- Only required permissions declared
- CSP configured correctly
- Content script configured to run only on Gmail

**Security Checkpoints:**
- [ ] No `<all_urls>` permission
- [ ] No wildcard domains
- [ ] CSP prevents inline scripts and eval
- [ ] Only storage permission granted

---

### Step 1.3: Create Initial Content Script Structure
**Objective:** Create a basic content script with logging

**Microsteps:**
1. Add IIFE (Immediately Invoked Function Expression) wrapper to avoid global scope pollution
2. Add strict mode directive
3. Create initialization function
4. Add console log: `[WizMail] Extension loaded`
5. Add console log with current URL to verify Gmail detection
6. Call initialization function
7. Verify no syntax errors

**Success Criteria:**
- Script uses strict mode
- Script is wrapped in IIFE
- Initialization logs to console
- No global variables leaked

---

## Phase 2: Storage Layer Implementation

### Step 2.1: Define Storage Constants
**Objective:** Establish storage configuration with validation rules

**Microsteps:**
1. Define storage key constant: `STORAGE_KEY = 'wizmail-saved-searches-v1'`
2. Define validation constants:
   - `MAX_SEARCHES = 50`
   - `MAX_NAME_LENGTH = 100`
   - `MAX_QUERY_LENGTH = 500`
3. Add JSDoc comments explaining each constant
4. Group constants at top of file (before IIFE or inside at top)

**Success Criteria:**
- All constants defined with clear names
- Constants are immutable (const keyword)
- Documentation explains purpose

---

### Step 2.2: Create Default Searches Array
**Objective:** Define the 8 default saved searches

**Microsteps:**
1. Create constant array `DEFAULT_SEARCHES`
2. Add search: `{ name: "Unread", q: "is:unread" }`
3. Add search: `{ name: "Unread Archived", q: "is:unread -in:inbox" }`
4. Add search: `{ name: "Needs Reply", q: "from:* has:nouserlabels -category:social -category:promotions -category:updates -category:forums -category:advertisements -category:reservations -category:purchases is:unread" }`
5. Add search: `{ name: "Should Archive", q: "-has:nouserlabels in:inbox is:read -is:starred" }`
6. Add search: `{ name: "Attachments", q: "has:attachment" }`
7. Add search: `{ name: "Receipts", q: "category:purchases OR newer_than:1y subject:(receipt OR invoice)" }`
8. Add search: `{ name: "Starred", q: "is:starred" }`
9. Add search: `{ name: "Calendar", q: "-from:(me) subject:(\"invitation\" OR \"accepted\" OR \"rejected\" OR \"updated\" OR \"canceled event\" OR \"declined\" OR \"proposed\") when where calendar who organizer -Re" }`
10. Verify array has exactly 8 items
11. Verify each item has both `name` and `q` properties
12. Make array immutable (Object.freeze if needed)

**Success Criteria:**
- Array contains exactly 8 searches
- All searches have required properties
- Queries match specification exactly

---

### Step 2.3: Implement String Validation Function
**Objective:** Create validation for individual string fields

**Microsteps:**
1. Create function `validateString(value, maxLength, fieldName)`
2. Check if value is undefined or null → return false
3. Check if typeof value is not 'string' → return false
4. Trim the string value
5. Check if trimmed length is 0 → return false
6. Check if trimmed length exceeds maxLength → return false
7. Return true if all checks pass
8. Add JSDoc comment explaining parameters and return value
9. Test mentally with edge cases: null, undefined, number, empty string, long string

**Success Criteria:**
- Function rejects non-strings
- Function rejects empty/whitespace-only strings
- Function respects max length
- Function is pure (no side effects)

---

### Step 2.4: Implement Search Object Validation Function
**Objective:** Create validation for a single search object

**Microsteps:**
1. Create function `validateSearchObject(obj)`
2. Check if obj is undefined or null → return false
3. Check if typeof obj is not 'object' → return false
4. Check if obj is an array → return false
5. Check if obj has 'name' property using hasOwnProperty or 'name' in obj
6. Check if obj has 'q' property
7. Validate name using `validateString(obj.name, MAX_NAME_LENGTH, 'name')`
8. Validate q using `validateString(obj.q, MAX_QUERY_LENGTH, 'query')`
9. Return true only if both validations pass
10. Add JSDoc comment

**Success Criteria:**
- Rejects non-objects
- Rejects arrays
- Requires both name and q properties
- Validates both fields using string validator

---

### Step 2.5: Implement Searches Array Validation Function
**Objective:** Create validation for entire searches array

**Microsteps:**
1. Create function `validateSearchesArray(data)`
2. Check if data is undefined or null → return false
3. Check if Array.isArray(data) is false → return false
4. Check if data.length === 0 → return false
5. Check if data.length > MAX_SEARCHES → return false
6. Loop through each item in data
7. For each item, call `validateSearchObject(item)`
8. If any item fails validation → return false
9. Return true if all items pass
10. Add JSDoc comment
11. Add comment explaining security purpose: "Prevents injection attacks and storage abuse"

**Success Criteria:**
- Rejects non-arrays
- Rejects empty arrays
- Enforces maximum count
- Validates every item in array

---

### Step 2.6: Implement Storage Sanitization Function
**Objective:** Clean and normalize searches array before storage

**Microsteps:**
1. Create function `sanitizeSearchesArray(data)`
2. Return early if data is not an array → return DEFAULT_SEARCHES
3. Create new empty array `sanitized`
4. Loop through each item in data
5. For each item, create new object with trimmed strings:
   - Create `name` by trimming `item.name`
   - Create `q` by trimming `item.q`
6. Push new object to sanitized array
7. Return sanitized array
8. Add JSDoc comment
9. Add security comment: "Creates new objects to prevent prototype pollution"

**Success Criteria:**
- Returns new array (doesn't mutate input)
- Trims whitespace from all strings
- Creates new objects (not references)

---

### Step 2.7: Implement Load from Storage Function
**Objective:** Load searches from chrome.storage.local with error handling

**Microsteps:**
1. Create async function `loadSearchesFromStorage()`
2. Wrap entire function body in try/catch
3. In try block, call `chrome.storage.local.get([STORAGE_KEY])`
4. Await the result
5. Extract data from result object using STORAGE_KEY
6. If data is undefined → return DEFAULT_SEARCHES
7. Call `validateSearchesArray(data)`
8. If validation fails → log `[WizMail] Stored data invalid, using defaults`
9. If validation fails → return DEFAULT_SEARCHES
10. Call `sanitizeSearchesArray(data)`
11. Return sanitized data
12. In catch block, log `[WizMail] Storage load error, using defaults`
13. In catch block, do NOT log the error object (may contain user data)
14. In catch block, return DEFAULT_SEARCHES
15. Add JSDoc comment
16. Add security comment: "Never trusts stored data without validation"

**Success Criteria:**
- Returns default searches on any error
- Validates all loaded data
- Sanitizes before returning
- Never throws exceptions
- Logs generic errors only

---

### Step 2.8: Implement Save to Storage Function
**Objective:** Save searches to chrome.storage.local with validation

**Microsteps:**
1. Create async function `saveSearchesToStorage(searches)`
2. Wrap entire function body in try/catch
3. In try block, call `validateSearchesArray(searches)`
4. If validation fails → log `[WizMail] Cannot save invalid data`
5. If validation fails → return false
6. Call `sanitizeSearchesArray(searches)`
7. Create storage object: `{ [STORAGE_KEY]: sanitized }`
8. Call `chrome.storage.local.set(storageObject)`
9. Await the result
10. Log `[WizMail] Searches saved successfully`
11. Return true
12. In catch block, log `[WizMail] Storage save error`
13. In catch block, do NOT log error details
14. In catch block, return false
15. Add JSDoc comment

**Success Criteria:**
- Validates before saving
- Sanitizes data
- Returns success boolean
- Never throws exceptions
- Generic error logging only

---

## Phase 3: Shadow DOM & UI Structure

### Step 3.1: Implement Shadow DOM Host Creation
**Objective:** Create the container element that will host the Shadow DOM

**Microsteps:**
1. Create function `createShadowHost()`
2. Call `document.createElement('div')`
3. Store element in variable `hostElement`
4. Set `hostElement.id = 'wizmail-saved-searches-host'`
5. Set `hostElement.style.display = 'block'`
6. Add data attribute: `hostElement.dataset.wizmail = 'true'` (for detection)
7. Return hostElement
8. Add JSDoc comment

**Success Criteria:**
- Returns a div element
- Element has unique ID
- Element has data attribute for detection

---

### Step 3.2: Implement Shadow Root Attachment
**Objective:** Attach Shadow DOM to host element

**Microsteps:**
1. Create function `attachShadowRoot(hostElement)`
2. Call `hostElement.attachShadow({ mode: 'open' })`
3. Store shadow root in variable
4. Return shadow root
5. Add JSDoc comment
6. Add comment explaining security: "Open mode allows inspection by IT security"

**Success Criteria:**
- Shadow root attached with open mode
- Shadow root is returned

---

### Step 3.3: Create Shadow DOM CSS Styles
**Objective:** Define isolated styles for the saved searches panel

**Microsteps:**
1. Create function `createShadowStyles()`
2. Create style element: `document.createElement('style')`
3. Define CSS for container:
   - Set margin and padding
   - Set border styling to match Gmail
   - Set background color
4. Define CSS for header:
   - Set font weight, size, color to match Gmail labels section
   - Set padding
5. Define CSS for search list:
   - Remove list-style
   - Set padding and margin
6. Define CSS for search items:
   - Set padding, cursor pointer
   - Set hover background color
   - Set transition for smooth hover
7. Define CSS for buttons (import/export):
   - Set small font size
   - Set padding
   - Set cursor pointer
   - Set border and background
8. Define CSS for modal overlay:
   - Set position fixed, full viewport
   - Set z-index very high (1000000)
   - Set semi-transparent background
9. Define CSS for modal dialog:
   - Set centered position
   - Set background white
   - Set padding, border radius
   - Set max-width and max-height
10. Set textContent of style element to CSS string
11. Return style element
12. Add JSDoc comment

**Success Criteria:**
- All UI elements styled
- Styles match Gmail aesthetic
- Modal has high z-index
- No external style dependencies

---

### Step 3.4: Create Panel Header Structure
**Objective:** Build the "Saved Searches" header with import/export buttons

**Microsteps:**
1. Create function `createPanelHeader(onExport, onImport)`
2. Create container div for header
3. Create h3 element for title
4. Set h3 textContent to "Saved Searches" (using textContent, NOT innerHTML)
5. Create div for buttons container
6. Create button element for Export
7. Set Export button textContent to "Export" (using textContent)
8. Add click event listener to Export button calling onExport
9. Use `addEventListener` with options object: `{ once: false }`
10. Call `stopPropagation()` in event handler to prevent Gmail interference
11. Create button element for Import
12. Set Import button textContent to "Import" (using textContent)
13. Add click event listener to Import button calling onImport
14. Use stopPropagation in Import handler
15. Append Export and Import buttons to buttons container
16. Append title and buttons container to header container
17. Return header container
18. Add JSDoc comment
19. Add security comment: "All text set via textContent to prevent XSS"

**Success Criteria:**
- Header contains title and two buttons
- All text set via textContent (no innerHTML)
- Event listeners use stopPropagation
- Callbacks are parameters (dependency injection)

---

### Step 3.5: Create Search List Item Function
**Objective:** Create individual search item with click handler

**Microsteps:**
1. Create function `createSearchItem(search, onClick)`
2. Validate search object structure (defensive)
3. If invalid → log warning and return null
4. Create li element
5. Create span element for search name
6. Set span.textContent to search.name (using textContent, NOT innerHTML)
7. Add title attribute to span showing the query (for tooltip)
8. Set title using textContent approach: `span.title = search.q`
9. Add click event listener to li element
10. In click handler, call onClick with search object
11. Use stopPropagation in handler
12. Append span to li
13. Return li element
14. Add JSDoc comment
15. Add security comment: "Query and name set via textContent to prevent XSS"

**Success Criteria:**
- Returns li element with search name
- All user data set via textContent
- Click handler calls callback
- Includes tooltip with query

---

### Step 3.6: Create Search List Container Function
**Objective:** Build the ul element containing all search items

**Microsteps:**
1. Create function `createSearchList(searches, onSearchClick)`
2. Create ul element
3. If searches is empty or invalid → return ul with no items
4. Loop through searches array
5. For each search, call `createSearchItem(search, onSearchClick)`
6. If item is null (validation failed) → skip it
7. Append each valid item to ul
8. Return ul element
9. Add JSDoc comment

**Success Criteria:**
- Returns ul element
- Contains li for each search
- Handles empty arrays gracefully
- Skips invalid items without breaking

---

### Step 3.7: Implement Search Click Navigation
**Objective:** Navigate to Gmail search hash when search is clicked

**Microsteps:**
1. Create function `handleSearchClick(search)`
2. Extract query string: `const query = search.q`
3. Encode query using `encodeURIComponent(query)`
4. Build target hash: `const targetHash = '#search/' + encodedQuery`
5. Get current hash: `const currentHash = window.location.hash`
6. Check if currentHash === targetHash (already on this search)
7. If already on target:
   - Set hash to '#inbox' (temporary switch)
   - Use setTimeout with 100ms delay
   - In timeout callback, set hash to targetHash
8. If not on target:
   - Set hash directly to targetHash
9. Add JSDoc comment
10. Add security comment: "Always encodes query to prevent hash injection"

**Success Criteria:**
- Uses encodeURIComponent on query
- Handles refresh case (temp switch to inbox)
- No raw user data in hash

**Security Checkpoints:**
- [ ] encodeURIComponent used on query
- [ ] No direct concatenation of user data into hash
- [ ] No javascript: or data: URIs possible

---

## Phase 4: DOM Insertion & Mutation Observation

### Step 4.1: Implement Gmail Navigation Container Finder
**Objective:** Locate Gmail's left navigation container in the DOM

**Microsteps:**
1. Create function `findGmailNavigationContainer()`
2. Add comment explaining Gmail DOM structure (SPA, dynamic rendering)
3. Try multiple selectors (Gmail structure changes):
   - Try `document.querySelector('[role="navigation"]')`
   - If not found, try alternative selector for nav container
   - If not found, try looking for labels section parent
4. Return the found element or null
5. Add JSDoc comment
6. Add comment: "Multiple selectors for Gmail UI resilience"

**Success Criteria:**
- Attempts multiple selectors
- Returns element or null
- Doesn't throw errors

---

### Step 4.2: Implement Labels Section Finder
**Objective:** Find the Labels section to insert panel below it

**Microsteps:**
1. Create function `findLabelsSection()`
2. Query for elements containing "Labels" text
3. Use querySelectorAll and Array.from to search
4. Filter elements where textContent includes "Labels"
5. Find element with exact or closest match
6. Return found element or null
7. Add JSDoc comment
8. Add comment: "Attempts to place panel below Labels for better UX"

**Success Criteria:**
- Searches for Labels section
- Returns element or null
- Doesn't throw errors

---

### Step 4.3: Implement Panel Insertion Function
**Objective:** Insert shadow host into Gmail navigation DOM

**Microsteps:**
1. Create function `insertPanelIntoDOM(hostElement)`
2. Call `findLabelsSection()`
3. If labels section found:
   - Get parent element of labels section
   - Get next sibling of labels section
   - If next sibling exists, insert before next sibling
   - If no next sibling, append to parent
4. If labels section not found:
   - Call `findGmailNavigationContainer()`
   - If nav container found, append to nav container
5. If neither found:
   - Log `[WizMail] Gmail navigation not found, cannot insert panel`
   - Return false
6. Return true on successful insertion
7. Add JSDoc comment

**Success Criteria:**
- Tries primary insertion (below Labels)
- Falls back to append to navigation
- Returns success boolean
- Logs failure gracefully

---

### Step 4.4: Implement Panel Existence Check
**Objective:** Detect if panel is already mounted to prevent duplicates

**Microsteps:**
1. Create function `isPanelMounted()`
2. Query for element with ID 'wizmail-saved-searches-host'
3. Alternatively check for element with data-wizmail attribute
4. Return true if element exists and is in DOM
5. Use document.contains() to verify element is connected
6. Return false if not found
7. Add JSDoc comment

**Success Criteria:**
- Checks for panel by ID
- Verifies element is in DOM
- Returns boolean

---

### Step 4.5: Create Debounce Utility Function
**Objective:** Implement debouncing for mutation observer

**Microsteps:**
1. Create function `debounce(func, delay)`
2. Create closure variable `timeoutId` initialized to null
3. Return function that:
   - Clears existing timeout if timeoutId is not null
   - Sets new timeout calling func after delay
   - Stores timeout ID in timeoutId
4. Add JSDoc comment
5. Add comment: "Prevents excessive re-renders on rapid DOM changes"

**Success Criteria:**
- Returns debounced function
- Clears previous timeout
- Delays function execution

---

### Step 4.6: Implement Panel Render Function
**Objective:** Complete render pipeline from storage to DOM

**Microsteps:**
1. Create async function `renderPanel()`
2. Check if panel already exists using `isPanelMounted()`
3. If exists → log `[WizMail] Panel already mounted` and return
4. Load searches from storage using `loadSearchesFromStorage()`
5. Await the result
6. Create shadow host using `createShadowHost()`
7. Attach shadow root using `attachShadowRoot()`
8. Create styles using `createShadowStyles()`
9. Append styles to shadow root
10. Create panel header with export/import callbacks (pass function references)
11. Append header to shadow root
12. Create search list with searches and click callback
13. Append search list to shadow root
14. Insert host into DOM using `insertPanelIntoDOM()`
15. If insertion fails → log error and clean up
16. If insertion succeeds → log `[WizMail] Panel mounted successfully`
17. Add JSDoc comment

**Success Criteria:**
- Prevents duplicate mounting
- Loads data from storage
- Builds complete shadow DOM tree
- Inserts into Gmail DOM
- Logs success/failure

---

### Step 4.7: Implement Mutation Observer Setup
**Objective:** Watch for Gmail re-renders and re-mount panel if removed

**Microsteps:**
1. Create variable to hold observer instance
2. Create function `setupMutationObserver()`
3. Get Gmail navigation container using `findGmailNavigationContainer()`
4. If container not found → log warning and return
5. Create debounced version of `renderPanel()` with 100ms delay
6. Create MutationObserver with callback:
   - In callback, check if panel still exists using `isPanelMounted()`
   - If panel removed → call debounced render function
7. Define observer options:
   - Set `childList: true` (watch for added/removed children)
   - Set `subtree: true` (watch descendants)
   - Do NOT watch attributes or characterData (unnecessary)
8. Disconnect existing observer if it exists (cleanup)
9. Start observing the navigation container with options
10. Store observer reference in closure variable
11. Add JSDoc comment
12. Add security comment: "Debouncing prevents infinite loop and performance issues"

**Success Criteria:**
- Observer watches navigation container only
- Uses debouncing (minimum 100ms)
- Checks panel existence before re-rendering
- Disconnects old observer before creating new one
- Limited scope (childList and subtree only)

**Security Checkpoints:**
- [ ] Debouncing implemented (prevents DoS)
- [ ] Observer scoped to nav container (not document)
- [ ] Existence check prevents infinite loop

---

## Phase 5: Import/Export Modals

### Step 5.1: Create Modal Overlay Structure
**Objective:** Build modal overlay container

**Microsteps:**
1. Create function `createModalOverlay()`
2. Create div element for overlay
3. Set className or id for styling
4. Set styles directly if needed (position fixed, z-index 1000000)
5. Return overlay element
6. Add JSDoc comment

**Success Criteria:**
- Returns overlay div
- High z-index set
- Full viewport coverage

---

### Step 5.2: Create Modal Dialog Structure
**Objective:** Build modal dialog content container

**Microsteps:**
1. Create function `createModalDialog()`
2. Create div element for dialog
3. Set className or id for styling
4. Set styles (centered, background white, padding)
5. Return dialog element
6. Add JSDoc comment

**Success Criteria:**
- Returns dialog div
- Centered in viewport
- Styled appropriately

---

### Step 5.3: Create Modal Close Handler
**Objective:** Implement modal dismissal logic

**Microsteps:**
1. Create function `closeModal(modalElement, shadowRoot)`
2. Check if modalElement exists
3. Remove modalElement from shadowRoot
4. Add JSDoc comment

**Success Criteria:**
- Removes modal from DOM
- Handles null/undefined gracefully

---

### Step 5.4: Implement Export Modal
**Objective:** Display current searches as JSON for user to copy

**Microsteps:**
1. Create async function `showExportModal(shadowRoot)`
2. Load current searches from storage
3. Convert searches to JSON using `JSON.stringify(searches, null, 2)`
4. Create modal overlay
5. Create modal dialog
6. Create h3 for title, set textContent to "Export Saved Searches"
7. Create paragraph with instructions, set textContent
8. Create textarea element
9. Set textarea value to JSON string
10. Set textarea readonly attribute
11. Set textarea rows to 15, cols to 60
12. Create Close button
13. Set button textContent to "Close"
14. Add click listener to button calling closeModal
15. Append title, paragraph, textarea, button to dialog
16. Append dialog to overlay
17. Append overlay to shadowRoot
18. Add click listener to overlay for click-outside-to-close
19. In overlay click handler, check if event.target === overlay
20. If true, call closeModal
21. Add ESC key listener
22. Add JSDoc comment
23. Add comment: "Readonly textarea prevents accidental edits"

**Success Criteria:**
- Shows current searches as formatted JSON
- Readonly textarea
- Close button works
- Click outside closes modal
- ESC key closes modal

---

### Step 5.5: Implement Import Validation Error Display
**Objective:** Show specific validation errors to user

**Microsteps:**
1. Create function `showValidationError(errorElement, message)`
2. Set errorElement.textContent to message (not innerHTML)
3. Set errorElement style color to red
4. Set errorElement style display to block
5. Add JSDoc comment

**Success Criteria:**
- Displays error message safely
- Uses textContent
- Styled as error

---

### Step 5.6: Implement Dangerous Pattern Detection
**Objective:** Reject imports containing potentially malicious patterns

**Microsteps:**
1. Create function `containsDangerousPatterns(jsonString)`
2. Define array of forbidden patterns:
   - `<script`
   - `javascript:`
   - `data:`
   - `on[a-z]+=` (as regex for event handlers like onclick=)
3. Convert jsonString to lowercase for case-insensitive check
4. Loop through each pattern
5. For string patterns, use includes()
6. For regex patterns, use test()
7. If any pattern found → return true
8. Return false if no patterns found
9. Add JSDoc comment
10. Add security comment: "Defense-in-depth against code injection attempts"

**Success Criteria:**
- Detects script tags
- Detects javascript: URIs
- Detects data: URIs
- Detects event handler attributes
- Case-insensitive detection

---

### Step 5.7: Implement Import Modal
**Objective:** Accept and validate JSON import from user

**Microsteps:**
1. Create async function `showImportModal(shadowRoot, onImportSuccess)`
2. Create modal overlay
3. Create modal dialog
4. Create h3 for title, set textContent to "Import Saved Searches"
5. Create paragraph with instructions, set textContent
6. Create textarea for JSON input
7. Set textarea placeholder to "Paste JSON here..."
8. Set textarea rows to 15, cols to 60
9. Create div for error messages
10. Set error div style display to none initially
11. Create Import button
12. Set button textContent to "Import"
13. Create Cancel button
14. Set button textContent to "Cancel"
15. Add click listener to Cancel button calling closeModal
16. Add click listener to Import button with async handler:
    - Get textarea value
    - If value is empty → show error "Please paste JSON to import"
    - Check for dangerous patterns using `containsDangerousPatterns()`
    - If dangerous patterns found → show error "Import rejected: invalid format"
    - Wrap JSON.parse in try/catch
    - If parse fails → show error "Invalid JSON format"
    - Validate parsed data using `validateSearchesArray()`
    - If validation fails → show error "Invalid search configuration"
    - If all valid, call `saveSearchesToStorage(parsed)`
    - If save fails → show error "Could not save settings"
    - If save succeeds → call onImportSuccess callback
    - Close modal
17. Append all elements to dialog
18. Append dialog to overlay
19. Append overlay to shadowRoot
20. Add click-outside-to-close handler
21. Add ESC key handler
22. Add JSDoc comment
23. Add security comment: "Multiple validation layers prevent injection"

**Success Criteria:**
- Accepts JSON input
- Validates format
- Checks for dangerous patterns
- Shows specific errors
- Saves on success
- Calls success callback
- Closes modal

**Security Checkpoints:**
- [ ] JSON parsing in try/catch
- [ ] Dangerous pattern detection
- [ ] Array validation
- [ ] String length validation
- [ ] Sanitization before save
- [ ] Generic error messages (no data leakage)

---

## Phase 6: Integration & Initialization

### Step 6.1: Wire Import/Export Handlers to Panel
**Objective:** Connect modal functions to header buttons

**Microsteps:**
1. Modify `renderPanel()` function
2. When creating panel header, pass proper callbacks:
   - For onExport, pass function that calls `showExportModal(shadowRoot)`
   - For onImport, pass function that calls `showImportModal(shadowRoot, handleImportSuccess)`
3. Create function `handleImportSuccess()`:
   - Log `[WizMail] Import successful, re-rendering panel`
   - Remove existing panel (by ID or reference)
   - Call `renderPanel()` to re-mount with new data
4. Add JSDoc comments

**Success Criteria:**
- Export button shows export modal
- Import button shows import modal
- Import success re-renders panel with new data

---

### Step 6.2: Implement Initialization Sequence
**Objective:** Set up extension when content script loads

**Microsteps:**
1. Create async function `initializeExtension()`
2. Add check for Gmail domain:
   - Get `window.location.hostname`
   - If not 'mail.google.com' → log `[WizMail] Not on Gmail, exiting` and return
3. Log `[WizMail] Initializing...`
4. Wait for DOM to be ready (check `document.readyState`)
5. If document not ready, add DOMContentLoaded listener
6. When ready, call `renderPanel()`
7. Await panel render
8. Call `setupMutationObserver()`
9. Log `[WizMail] Initialization complete`
10. Wrap in try/catch with error logging
11. Add JSDoc comment

**Success Criteria:**
- Checks for Gmail domain
- Waits for DOM ready
- Renders panel
- Sets up observer
- Handles errors gracefully

---

### Step 6.3: Add Extension Entry Point
**Objective:** Call initialization when script loads

**Microsteps:**
1. At bottom of content.js (inside or after IIFE)
2. Check if document.readyState is 'complete' or 'interactive'
3. If ready, call `initializeExtension()` immediately
4. If not ready, add DOMContentLoaded listener calling `initializeExtension()`
5. Add comment explaining Gmail SPA loading

**Success Criteria:**
- Extension initializes when script loads
- Handles different document ready states
- Only initializes once

---

## Phase 7: Testing & Security Validation

### Step 7.1: Manual Functional Testing Checklist
**Objective:** Verify all features work correctly

**Manual Test Cases:**
1. Load extension in Chrome (Load unpacked)
2. Navigate to mail.google.com
3. Verify panel appears in left navigation
4. Verify panel shows all 8 default searches
5. Click each search, verify navigation to correct hash
6. Click same search twice, verify refresh behavior
7. Click Export, verify JSON appears in modal
8. Copy export JSON, verify it's valid JSON
9. Click Import, paste valid JSON, verify import succeeds
10. Verify panel re-renders with imported searches
11. Reload Gmail, verify panel persists
12. Test on different Gmail views (inbox, sent, etc.)
13. Verify no console errors

**Success Criteria:**
- All 13 test cases pass
- No errors in console
- Panel stable across navigation

---

### Step 7.2: Security Testing Checklist
**Objective:** Verify security requirements are met

**Security Test Cases:**
1. Attempt to import JSON with `<script>alert('xss')</script>` in name
2. Verify import is rejected
3. Attempt to import with `javascript:alert()` in query
4. Verify import is rejected
5. Attempt to import with `onclick="alert()"` pattern
6. Verify import is rejected
7. Attempt to import 51 searches (over limit)
8. Verify import is rejected
9. Attempt to import search with 101 character name
10. Verify import is rejected
11. Attempt to import search with 501 character query
12. Verify import is rejected
13. Inspect network tab, verify no external requests
14. Inspect console, verify no user data logged
15. Check manifest permissions, verify only storage
16. Check manifest host_permissions, verify only mail.google.com
17. Verify CSP in manifest

**Success Criteria:**
- All XSS attempts blocked
- All validation limits enforced
- No external network activity
- No user data in logs
- Minimal permissions

**Security Checkpoints:**
- [ ] XSS prevention verified
- [ ] Input validation verified
- [ ] No network requests verified
- [ ] No sensitive logging verified
- [ ] Permissions minimal verified

---

### Step 7.3: Pre-Implementation Security Checklist (from CLAUDE.md Section 15)
**Objective:** Final verification before considering implementation complete

**Manifest Security:**
- [ ] Only `storage` permission declared
- [ ] Only `https://mail.google.com/*` in host_permissions
- [ ] Content Security Policy configured (Section 3.5)
- [ ] No remote code execution capabilities

**XSS Prevention:**
- [ ] All user data rendered with `textContent` or `createTextNode()`
- [ ] Zero uses of `innerHTML`, `outerHTML`, `insertAdjacentHTML`
- [ ] URL encoding applied before setting `location.hash`
- [ ] No template literals used to build HTML

**Input Validation:**
- [ ] Max 50 searches enforced
- [ ] Max 100 chars for name, 500 for query
- [ ] JSON parsing wrapped in try/catch
- [ ] Type validation on all imported data
- [ ] Empty strings rejected after trim

**Performance & Safety:**
- [ ] MutationObserver debounced (min 100ms)
- [ ] Observer disconnects before mutations (N/A - we don't mutate during observation)
- [ ] No document-wide event listeners
- [ ] Event listeners attached to Shadow DOM only

**Error Handling:**
- [ ] All async operations in try/catch
- [ ] Generic error messages only (no data exposure)
- [ ] No user data logged to console
- [ ] Graceful degradation on storage errors

**Code Quality:**
- [ ] No `eval`, `Function()`, or dynamic code execution
- [ ] No external network requests
- [ ] No email content access
- [ ] Comments explain security decisions
- [ ] Code is readable and auditable

**Success Criteria:**
- All 30+ checkboxes checked
- Code ready for security review
- Implementation matches specification

---

## Phase 8: Documentation & Handoff

### Step 8.1: Create README
**Objective:** Document installation and usage

**Microsteps:**
1. Create README.md file
2. Add project title and description
3. Add installation instructions:
   - Clone/download repository
   - Open Chrome extensions page
   - Enable Developer mode
   - Click Load unpacked
   - Select wizmail directory
4. Add usage instructions:
   - Navigate to Gmail
   - Find Saved Searches panel
   - Click searches to navigate
   - Use Import/Export to manage
5. Add security notes
6. Add license information if needed
7. Add development/contribution guidelines

**Success Criteria:**
- Clear installation steps
- Usage instructions complete
- Security posture explained

---

### Step 8.2: Create Changelog
**Objective:** Document version history

**Microsteps:**
1. Create CHANGELOG.md file
2. Add entry for version 1.0.0
3. List all features:
   - Saved searches panel
   - 8 default searches
   - Import/Export functionality
   - Shadow DOM isolation
   - Mutation observer resilience
4. Note security features implemented
5. Date the release

**Success Criteria:**
- Complete feature list
- Version and date documented

---

### Step 8.3: Create Security Audit Report
**Objective:** Document security review results for IT

**Microsteps:**
1. Create SECURITY.md file
2. List all security features:
   - Minimal permissions
   - No network requests
   - XSS prevention
   - Input validation
   - CSP configuration
3. Document threat model:
   - What attacks are prevented
   - What data is accessed
   - What data is stored
4. Include test results from Phase 7.2
5. List compliance with enterprise requirements

**Success Criteria:**
- Complete security documentation
- Test results included
- Ready for IT review

---

## Implementation Order

**Execute phases in strict order:**

1. Phase 1: Manifest & structure (foundation)
2. Phase 2: Storage layer (data handling)
3. Phase 3: UI components (rendering)
4. Phase 4: DOM integration (mounting)
5. Phase 5: Modals (import/export)
6. Phase 6: Initialization (wiring)
7. Phase 7: Testing (validation)
8. Phase 8: Documentation (handoff)

**Each phase must be complete before starting the next.**

**Each microstep should be verified before proceeding.**

---

## Success Metrics

Extension is complete when:
- All phases complete
- All security checkpoints passed
- All test cases pass
- Documentation complete
- Ready for IT security review
- Can replace Tampermonkey userscript

---

## End of Implementation Plan

This plan provides a complete roadmap from empty repository to production-ready Chrome extension. Each microstep is designed to be accomplishable sequentially with clear success criteria.
