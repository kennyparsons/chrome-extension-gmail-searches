# Chrome Web Store Publishing Requirements

## Single Purpose Description

> Gmail Quick Search is a productivity extension that provides quick access to saved Gmail search queries. It allows users to create, manage, and navigate to filtered Gmail results with a single click.

---

## Permission Justifications

### Host Permission: `https://mail.google.com/*`

**Justification:**

The extension requires access to Gmail's domain to display its popup interface when users visit mail.google.com. The host permission is necessary to:

1. Display the extension popup on Gmail pages
2. Inject the extension's user interface (popup and management windows)
3. Capture user clicks to navigate to Gmail search results using Gmail's native hash routing

**Data Access:** The extension does NOT read, access, or extract any email content, user data, or Gmail information. It only displays its own UI elements.

---

### Permission: `storage`

**Justification:**

The extension uses Chrome's `chrome.storage.local` API to persistently store user-created saved searches locally on their device. This permission is necessary to:

1. Save user-created search configurations
2. Load previously saved searches when the extension is opened
3. Provide offline functionality

**Data Access:** All data is stored exclusively on the user's local device and never transmitted externally.

---

### Permission: `tabs`

**Justification:**

The extension uses the `tabs` permission to navigate users to Gmail with their selected search query applied. This permission is necessary to:

1. Detect when the user is on a Gmail page
2. Create or navigate to Gmail tab windows with the search query in the URL hash
3. Provide the core functionality of navigating to filtered search results

**Data Access:** The extension only reads the current tab's URL to determine if it's a Gmail tab. It does NOT access page content or user data.

---

### Remote Code: Not Used

**Justification:**

The extension does NOT use remote code execution of any kind. All code is:

- Bundled locally in the extension package
- Executed only from local JavaScript files
- Never dynamically loaded or evaluated
- Never fetched from external sources

The manifest includes a strict Content Security Policy (`script-src 'self'`) that prevents any remote code execution.

---

## Data Usage Compliance

### No Data Collection

✅ The extension **does NOT:**
- Collect user data
- Transmit data to external servers
- Use analytics or tracking
- Access email content
- Build user profiles
- Use cookies or tracking pixels

### Data Storage

✅ All data is stored **exclusively locally** on the user's device using `chrome.storage.local`

### Third-Party Services

✅ The extension **does NOT use:**
- Third-party services
- CDNs
- Analytics platforms
- External APIs
- Tracking code

### User Control

✅ Users have **complete control:**
- All data stored locally on their device
- Data can be deleted by uninstalling the extension
- No data synced to any external service
- Transparent, open-source implementation

---

## Contact Email

**Required:** Add your email address on the Account tab of the Chrome Web Store developer console.

**Example:** your-email@example.com

---

## Email Verification

**Required:** After adding your email, complete the verification process by clicking the verification link sent to your email address.

**Steps:**
1. Go to Account tab in developer console
2. Enter your email address
3. Check your email inbox for verification link from Google
4. Click the verification link
5. Return to developer console

---

## Certification

Before publishing, you must certify that:

✅ Your extension's data practices comply with the [Chrome Web Store Developer Program Policies](https://developer.chrome.com/docs/webstore/program_policies/)

**Checkbox:** Check the certification box on the Privacy practices tab before clicking Publish.

---

## Summary Checklist

- [ ] Fill in Single Purpose Description (provided above)
- [ ] Fill in Host Permission justification (provided above)
- [ ] Fill in Storage permission justification (provided above)
- [ ] Fill in Tabs permission justification (provided above)
- [ ] Fill in Remote Code justification (provided above)
- [ ] Add contact email on Account tab
- [ ] Verify contact email (check inbox for verification link)
- [ ] Check data compliance certification box
- [ ] Click Save Draft
- [ ] Click Publish
