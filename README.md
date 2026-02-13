# WizMail - Gmail Saved Searches Extension

A security-first Chrome extension that adds a customizable Saved Searches panel to Gmail's left navigation.

## Overview

WizMail replaces Tampermonkey userscripts with a minimal, auditable Chrome extension designed for enterprise environments. It operates exclusively on Gmail with no external network access, no remote code execution, and no email data collection.

## Features

- **Saved Searches Panel**: Quick access to frequently used Gmail searches
- **8 Default Searches**: Pre-configured productivity searches (Unread, Needs Reply, etc.)
- **Import/Export**: Backup and restore your search configurations
- **Shadow DOM Isolation**: Styles isolated from Gmail to prevent conflicts
- **Auto-Recovery**: Survives Gmail re-renders using mutation observers

## Security

- **Minimal Permissions**: Only requires `storage` permission
- **Domain Restricted**: Runs only on `https://mail.google.com/*`
- **No Network Requests**: Entirely client-side with no external calls
- **No Remote Code**: All logic bundled locally
- **XSS Protection**: All user data rendered via textContent
- **Input Validation**: Comprehensive validation on all imported data
- **Content Security Policy**: Strict CSP prevents code injection

## Installation

### Loading Unpacked Extension (Development)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `wizmail` directory
6. Navigate to Gmail - the Saved Searches panel should appear in the left sidebar

### For IT Deployment

1. Review the security documentation in `SECURITY.md`
2. Audit the source code (manifest.json and content.js)
3. Package the extension using Chrome's packaging tools
4. Deploy via enterprise policy or Chrome Web Store

## Usage

### Using Saved Searches

- Click any search in the panel to navigate to that Gmail search
- Searches use Gmail's native hash routing (no APIs required)
- Panel survives page navigation and Gmail re-renders

### Exporting Searches

1. Click the **Export** button in the panel header
2. Copy the JSON from the modal
3. Save to a file or password manager for backup

### Importing Searches

1. Click the **Import** button in the panel header
2. Paste valid JSON configuration
3. Click **Import** to apply changes
4. Panel will re-render with new searches

### Import Format

```json
[
  {
    "name": "Search Name",
    "q": "Gmail search query"
  }
]
```

**Validation Rules:**
- Maximum 50 searches
- Search names ≤ 100 characters
- Search queries ≤ 500 characters
- No HTML, scripts, or code injection patterns

## Default Searches

1. **Unread**: All unread messages
2. **Unread Archived**: Unread messages not in inbox
3. **Needs Reply**: Unread unlabeled messages requiring action
4. **Should Archive**: Read inbox messages that aren't starred
5. **Attachments**: All messages with attachments
6. **Receipts**: Purchases and receipts from the last year
7. **Starred**: All starred messages
8. **Calendar**: Calendar invitations and updates

## Troubleshooting

### Panel doesn't appear
- Verify you're on `mail.google.com`
- Check Chrome extensions page - ensure WizMail is enabled
- Open DevTools console and look for `[WizMail]` logs
- Try reloading Gmail

### Panel disappears after navigation
- This shouldn't happen - mutation observer should restore it
- Check console for errors
- Report issue if persistent

### Import fails
- Verify JSON is valid (use a JSON validator)
- Check that array length ≤ 50 items
- Ensure no HTML or script tags in search names/queries
- Check string length limits

## Development

### Project Structure

```
wizmail/
├── manifest.json    # Extension manifest (Manifest v3)
├── content.js       # Main content script
├── README.md        # This file
├── SECURITY.md      # Security documentation
└── CHANGELOG.md     # Version history
```

### Code Architecture

- **IIFE Wrapper**: All code in strict mode IIFE
- **No Global Variables**: Prevents conflicts with Gmail
- **Validation First**: All user input validated before use
- **Shadow DOM**: Complete style isolation
- **Event Delegation**: Efficient event handling
- **Debouncing**: Prevents excessive re-renders

### Contributing

This is an internal enterprise extension. For changes:

1. Create feature branch from main
2. Make minimal, focused changes
3. Test thoroughly on Gmail
4. Run security validation checklist
5. Submit for security review
6. Update CHANGELOG.md

## License

Internal use only. Not for public distribution.

## Support

For issues or questions:
- Check SECURITY.md for security-related questions
- Review Chrome DevTools console for error messages
- Contact IT security team for deployment issues
