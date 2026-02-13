# WizMail Security Documentation

**Version:** 1.0.0
**Last Updated:** 2026-02-13
**Classification:** Internal Enterprise Extension
**Security Review Status:** Ready for Audit

---

## Executive Summary

WizMail is a security-first Chrome extension designed to replace Tampermonkey userscripts with a minimal, auditable solution for Gmail productivity. It implements defense-in-depth security with multiple layers of protection against common web extension vulnerabilities.

**Key Security Principles:**
- Minimal permissions (storage only)
- Domain isolation (Gmail only)
- No network access
- No remote code execution
- XSS prevention via textContent
- Comprehensive input validation
- No email data access

---

## Threat Model

### What WizMail Protects Against

1. **Cross-Site Scripting (XSS)**
   - **Threat**: Malicious search names/queries executing scripts
   - **Protection**: All user data rendered via textContent/createTextNode
   - **Verification**: Zero uses of innerHTML, outerHTML, or insertAdjacentHTML

2. **Code Injection**
   - **Threat**: Imported JSON containing executable code
   - **Protection**: Pattern detection, JSON-only parsing, no eval()
   - **Verification**: Dangerous patterns rejected (scripts, event handlers, URIs)

3. **Hash Injection**
   - **Threat**: Crafted queries redirecting to javascript: URIs
   - **Protection**: encodeURIComponent on all queries before hash navigation
   - **Verification**: Manual testing with malicious query strings

4. **Denial of Service**
   - **Threat**: Large imports causing browser freeze
   - **Protection**: Maximum 50 searches, string length limits
   - **Verification**: Import validation enforces hard limits

5. **Infinite Render Loops**
   - **Threat**: Mutation observer triggering re-renders infinitely
   - **Protection**: Debouncing (100ms), existence checks before render
   - **Verification**: Observer never mutates during observation

6. **Prototype Pollution**
   - **Threat**: Malicious JSON modifying Object.prototype
   - **Protection**: Sanitization creates new objects from scratch
   - **Verification**: No object spreading or merging from user data

7. **Data Exfiltration**
   - **Threat**: Extension sending email data to external servers
   - **Protection**: No network permissions, no fetch/XHR usage
   - **Verification**: Network tab monitoring during testing

---

## Permission Model

### Granted Permissions

```json
{
  "permissions": ["storage"],
  "host_permissions": ["https://mail.google.com/*"]
}
```

**storage**: Required for saving search configurations locally

### Explicitly Denied Permissions

The following permissions are NOT requested (preventing common attack vectors):

- ❌ `tabs` - Cannot access tab information
- ❌ `activeTab` - Cannot access active tab content
- ❌ `scripting` - Cannot inject arbitrary scripts
- ❌ `webRequest` - Cannot intercept network traffic
- ❌ `identity` - Cannot access Google account info
- ❌ `clipboardRead` - Cannot read clipboard
- ❌ `clipboardWrite` - Cannot write clipboard
- ❌ `downloads` - Cannot download files
- ❌ `cookies` - Cannot access cookies
- ❌ `history` - Cannot access browsing history
- ❌ `<all_urls>` - Cannot run on all websites

---

## Content Security Policy

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'none'"
}
```

**Enforcement:**
- Scripts must be bundled locally (no CDN)
- No inline scripts allowed
- No eval() or Function() constructor
- No object/embed tags

---

## Data Access & Privacy

### What WizMail DOES Access

1. **Chrome Storage (Local)**
   - Purpose: Store search configurations
   - Data: Search names and Gmail query strings
   - Scope: Local device only
   - Retention: Until user clears extension data

2. **Gmail Navigation DOM**
   - Purpose: Insert saved searches panel
   - Data: Navigation container structure only
   - Scope: Read-only queries, insertion of new elements
   - Retention: None (DOM queries are transient)

3. **URL Hash**
   - Purpose: Navigate to Gmail searches
   - Data: Current and target hash values
   - Scope: Read current hash, write new hash
   - Retention: None (navigation state)

### What WizMail DOES NOT Access

- ❌ Email message bodies
- ❌ Email subjects (except via user-defined searches)
- ❌ Email addresses (sender/recipient)
- ❌ Email attachments
- ❌ Contact lists
- ❌ User credentials
- ❌ Gmail API data
- ❌ Gmail cookies
- ❌ Network traffic
- ❌ Keyboard input (except in extension modals)
- ❌ Mouse tracking
- ❌ Clipboard contents
- ❌ Other browser tabs

---

## Input Validation

### Validation Layers

All user input passes through multiple validation layers before use:

#### Layer 1: Format Validation
```
Input → JSON.parse (try/catch) → Structure Check → Type Check
```

#### Layer 2: Dangerous Pattern Detection
```
Sanitized JSON → Pattern Scan → Reject if matches:
  - <script
  - javascript:
  - data:
  - on[a-z]+=  (event handlers)
```

#### Layer 3: Schema Validation
```
Parsed Data → Array Check → Length Check (≤50) → Object Validation
```

#### Layer 4: Field Validation
```
Each Object → Property Check (name, q) → Type Check (string) → Length Check
  - name: ≤ 100 characters
  - q: ≤ 500 characters
```

#### Layer 5: Sanitization
```
Valid Data → Trim Whitespace → Create New Objects → Freeze
```

### Validation Enforcement Points

1. **Import**: Validates before saving to storage
2. **Storage Load**: Validates on retrieval (defense against storage corruption)
3. **Render**: Validates objects before creating DOM elements
4. **Click**: Validates search object before navigation

---

## XSS Prevention

### Rendering Security

**Rule**: ALL user-controlled data MUST use textContent or createTextNode

**Enforcement**:
```javascript
// CORRECT (everywhere in code):
element.textContent = userInput;
const textNode = document.createTextNode(userInput);

// FORBIDDEN (zero occurrences):
element.innerHTML = userInput;  ❌
element.outerHTML = userInput;  ❌
element.insertAdjacentHTML('beforeend', userInput);  ❌
```

**Verification**: Code audit confirms zero uses of innerHTML family

### URL Encoding

**Rule**: ALL queries MUST be encoded before hash navigation

**Enforcement**:
```javascript
// CORRECT (in handleSearchClick):
const encodedQuery = encodeURIComponent(search.q);
window.location.hash = '#search/' + encodedQuery;

// FORBIDDEN:
window.location.hash = '#search/' + search.q;  ❌
```

---

## Error Handling & Logging

### Logging Policy

**Allowed**:
```javascript
console.log('[WizMail] Panel mounted successfully');
console.error('[WizMail] Storage load error, using defaults');
```

**Forbidden**:
```javascript
console.log('Search name:', searchName);  ❌ (exposes user data)
console.error('Import failed:', importedJSON);  ❌ (exposes user data)
console.log('Error:', error);  ❌ (may contain sensitive info)
```

### Error Messages to Users

All user-facing error messages are generic:
- "Invalid JSON format"
- "Invalid search configuration"
- "Could not save settings"
- "Import rejected: invalid format"

**Never exposed**:
- Actual validation failures
- Stack traces
- User data that failed validation

---

## Network Security

### Network Activity

**Expected**: ZERO network requests

**Verification Method**:
1. Open Chrome DevTools → Network tab
2. Load extension on Gmail
3. Trigger all features (export, import, navigation)
4. Verify no requests in Network tab

**Prohibited**:
- fetch()
- XMLHttpRequest
- WebSocket
- navigator.sendBeacon()
- External resource loading (<script src>, <link href>)

---

## Storage Security

### Storage Method

**Used**: chrome.storage.local (encrypted by Chrome)

**Key**: `wizmail-saved-searches-v1`

**Not Used**:
- window.localStorage (less secure)
- sessionStorage (less persistent)
- IndexedDB (unnecessary complexity)
- Remote storage (security risk)

### Storage Data Format

```json
{
  "wizmail-saved-searches-v1": [
    {
      "name": "Search Name",
      "q": "Gmail query string"
    }
  ]
}
```

**Encryption**: Chrome handles encryption at rest (platform-level)

**Sync**: Never synced (local only)

---

## Code Security

### Prohibited Patterns

The following patterns are completely absent from the codebase:

1. **Dynamic Code Execution**
   - `eval()`
   - `new Function()`
   - `setTimeout(string)`
   - `setInterval(string)`

2. **HTML Injection**
   - `innerHTML`
   - `outerHTML`
   - `insertAdjacentHTML()`
   - `document.write()`

3. **Unsafe DOM Manipulation**
   - `element.setAttribute('onclick', ...)`
   - Event handlers in strings
   - `javascript:` URLs

4. **Network Access**
   - `fetch()`
   - `XMLHttpRequest`
   - `WebSocket`
   - `<script src="...">`

### Required Patterns

The following security patterns are mandatory:

1. **Try/Catch on Async**
   - All async functions wrapped
   - All JSON.parse() wrapped
   - All storage operations wrapped

2. **Validation Before Use**
   - All user input validated
   - All storage data validated
   - All function parameters validated (defensive)

3. **Sanitization**
   - Whitespace trimmed
   - New objects created (no mutation)
   - Empty strings rejected

---

## Testing & Verification

### Security Test Results

#### XSS Tests (All Blocked ✓)

1. **Search Name Injection**
   ```json
   {"name": "<script>alert('xss')</script>", "q": "test"}
   ```
   Result: ✓ Rejected by pattern detection

2. **Event Handler Injection**
   ```json
   {"name": "Test", "q": "onclick=\"alert('xss')\""}
   ```
   Result: ✓ Rejected by pattern detection

3. **JavaScript URI**
   ```json
   {"name": "Test", "q": "javascript:alert('xss')"}
   ```
   Result: ✓ Rejected by pattern detection

4. **Data URI**
   ```json
   {"name": "Test", "q": "data:text/html,<script>alert('xss')</script>"}
   ```
   Result: ✓ Rejected by pattern detection

#### Validation Tests (All Enforced ✓)

1. **Oversized Import**: 51 searches → ✓ Rejected
2. **Long Name**: 101 characters → ✓ Rejected
3. **Long Query**: 501 characters → ✓ Rejected
4. **Invalid JSON**: Malformed → ✓ Parse error shown
5. **Non-Array**: Object instead of array → ✓ Rejected
6. **Empty Array**: [] → ✓ Rejected
7. **Missing Properties**: {name: "x"} → ✓ Rejected

#### Network Tests (All Clean ✓)

1. Extension load → ✓ No requests
2. Panel render → ✓ No requests
3. Search click → ✓ No requests
4. Export → ✓ No requests
5. Import → ✓ No requests

#### Performance Tests (All Pass ✓)

1. Rapid navigation changes → ✓ No infinite loops
2. Gmail re-render → ✓ Panel recovers correctly
3. 50 searches rendered → ✓ No performance issues

---

## Compliance Checklist

### Manifest Security ✓
- [x] Only `storage` permission declared
- [x] Only `https://mail.google.com/*` in host_permissions
- [x] Content Security Policy configured
- [x] No remote code execution capabilities

### XSS Prevention ✓
- [x] All user data rendered with textContent
- [x] Zero uses of innerHTML/outerHTML/insertAdjacentHTML
- [x] URL encoding applied before setting location.hash
- [x] No template literals used to build HTML

### Input Validation ✓
- [x] Max 50 searches enforced
- [x] Max 100 chars for name, 500 for query
- [x] JSON parsing wrapped in try/catch
- [x] Type validation on all imported data
- [x] Empty strings rejected after trim
- [x] Dangerous pattern detection implemented

### Performance & Safety ✓
- [x] MutationObserver debounced (100ms)
- [x] No document-wide event listeners
- [x] Event listeners attached to Shadow DOM only
- [x] Existence checks prevent infinite loops

### Error Handling ✓
- [x] All async operations in try/catch
- [x] Generic error messages only
- [x] No user data logged to console
- [x] Graceful degradation on storage errors

### Code Quality ✓
- [x] No eval, Function(), or dynamic code execution
- [x] No external network requests
- [x] No email content access
- [x] Security decisions documented in comments
- [x] Code is readable and auditable

---

## Security Audit Guidance

### Recommended Audit Steps

1. **Manifest Review**
   - Verify permissions minimal
   - Confirm host_permissions scoped
   - Check CSP configuration

2. **Code Audit**
   - Search for prohibited patterns (eval, innerHTML, etc.)
   - Verify textContent usage for user data
   - Check validation functions comprehensive
   - Confirm no network code paths

3. **Runtime Testing**
   - Load extension in isolated Chrome profile
   - Monitor Network tab (should be empty)
   - Attempt XSS injections via import
   - Test validation limits
   - Verify no console data leakage

4. **Storage Inspection**
   - Load extension
   - Export configuration
   - Inspect chrome.storage.local contents
   - Verify encryption at rest

5. **Integration Testing**
   - Test on Gmail with real account (test account)
   - Verify no email content accessed
   - Verify navigation works correctly
   - Verify panel survives re-renders

---

## Incident Response

### If Security Issue Discovered

1. **Immediately**: Disable extension via chrome://extensions
2. **Document**: Record exact steps to reproduce
3. **Report**: Contact IT security team
4. **Isolate**: Do not use extension until patched
5. **Review**: Audit CHANGELOG for version used

### Reporting Security Issues

Internal reporting only:
- Contact: IT Security Team
- Method: Internal security ticketing system
- Include: Version, reproduction steps, impact assessment

---

## Version History

- **1.0.0** (2026-02-13): Initial security documentation
  - Threat model defined
  - All security tests passing
  - Code audit complete
  - Ready for IT review

---

## Conclusion

WizMail implements enterprise-grade security appropriate for a Gmail extension in a managed environment. Multiple layers of defense protect against XSS, code injection, and data exfiltration. The minimal permission model and comprehensive validation make it suitable for internal deployment subject to IT security approval.

**Security Posture**: ✅ Ready for Production Deployment

**Recommended**: Annual security re-audit on version updates
