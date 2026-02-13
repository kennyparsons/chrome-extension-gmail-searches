# Changelog

All notable changes to WizMail will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-13

### Added

**Core Features:**
- Saved Searches panel in Gmail left navigation
- Shadow DOM implementation for style isolation
- 8 default productivity searches:
  - Unread messages
  - Unread archived messages
  - Messages needing reply
  - Messages ready to archive
  - Messages with attachments
  - Receipts and invoices
  - Starred messages
  - Calendar invitations
- Import/Export functionality for search configurations
- Mutation observer for Gmail re-render resilience
- Navigation via Gmail hash routing (no APIs)

**Security Features:**
- Manifest v3 with minimal permissions (storage only)
- Domain restriction (https://mail.google.com/* only)
- Content Security Policy preventing code injection
- XSS prevention using textContent for all user data
- Comprehensive input validation:
  - Maximum 50 searches
  - Maximum 100 characters for search names
  - Maximum 500 characters for search queries
  - Dangerous pattern detection (scripts, event handlers, data URIs)
- No external network requests
- No remote code execution
- No email content access
- No clipboard permissions required
- Generic error messages (no data leakage in logs)

**Performance Features:**
- Debounced mutation observer (100ms) prevents excessive re-renders
- Event delegation for efficient event handling
- Shadow DOM reduces style recalculation
- Scoped observer (navigation container only)

**Developer Features:**
- Strict mode JavaScript
- IIFE wrapper prevents global namespace pollution
- Comprehensive JSDoc comments
- Security-focused code comments
- Validation-first architecture
- Pure functions where possible
- Defensive programming patterns

### Security

- No use of eval() or Function() constructor
- No use of innerHTML or similar HTML injection methods
- All user-controlled strings rendered via textContent
- URL encoding on all hash navigation
- Try/catch wrappers on all async operations
- Array and object validation before storage
- Sanitization creates new objects (prevents prototype pollution)
- No logging of user data to console

### Technical Details

- **Manifest Version**: 3
- **Permissions**: storage
- **Host Permissions**: https://mail.google.com/*
- **Content Script Run Time**: document_idle
- **Shadow DOM Mode**: open (allows IT inspection)
- **Storage**: chrome.storage.local
- **Storage Key**: wizmail-saved-searches-v1

### Known Limitations

- Requires manual installation (no auto-update)
- Gmail-only (by design)
- No API access to Gmail data (by design)
- No clipboard write access (user must manually copy)
- Panel placement dependent on Gmail DOM structure

### Compliance

- ✅ No external network access
- ✅ No remote code execution
- ✅ Minimal permissions
- ✅ Open source auditable
- ✅ No third-party dependencies
- ✅ No email data collection
- ✅ XSS prevention implemented
- ✅ Input validation comprehensive
- ✅ Error handling complete

---

## Release Process

1. Update version in manifest.json
2. Update this CHANGELOG.md
3. Run security validation checklist
4. Test on Gmail (functional tests)
5. Test security (injection attempts)
6. Create git tag
7. Export for review
8. IT security approval
9. Package and deploy

---

## Version History

- **1.0.0** (2026-02-13): Initial release
