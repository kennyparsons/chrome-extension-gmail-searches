# 📧 Gmail Quick Search

[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/kennyparsons/chrome-extension-gmail-searches/badge)](https://scorecard.dev/viewer/?uri=github.com/kennyparsons/chrome-extension-gmail-searches)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Scorecard supply-chain security](https://github.com/kennyparsons/chrome-extension-gmail-searches/actions/workflows/scorecard.yml/badge.svg)](https://github.com/kennyparsons/chrome-extension-gmail-searches/actions/workflows/scorecard.yml)

Quick access to your saved Gmail searches. Click any search to jump directly to filtered results.

## ✨ Features

- 🎯 **Quick Access** - One-click access to your most-used Gmail searches
- 🎨 **Gmail-Themed UI** - Dark theme matching Gmail's official colors
- 🔒 **Security-First** - Input validation and XSS prevention built-in
- ⚡ **Fast & Lightweight** - Minimal permissions, maximum performance
- 💾 **Local Storage** - Your searches stay private on your device
- ✏️ **Easy Management** - Add, edit, and delete searches with real-time validation

## 🚀 Installation

### Load as Unpacked Extension

1. **Download or Clone** this repository
   ```bash
   git clone https://github.com/kennyparsons/chrome-extension-gmail-searches.git
   ```

2. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Or click Menu → Extensions → Manage Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the Extension**
   - Click "Load unpacked"
   - Select the folder containing this repository

5. **Pin the Extension** (optional)
   - Click the Extensions puzzle icon in your toolbar
   - Pin "Gmail Quick Search" for easy access

## 📖 Usage

### Quick Search
1. Click the Gmail Quick Search icon in your toolbar
2. Select any saved search from the popup
3. You'll be taken directly to Gmail with that search applied

### Manage Searches
1. Click the ⚙️ gear icon in the popup
2. **Add** new searches with custom names and Gmail queries
3. **Edit** existing searches
4. **Delete** searches you no longer need
5. **Reset** to default searches anytime

### Default Searches
The extension comes with 8 useful default searches:
- 📬 Unread
- 📦 Unread Archived
- ✉️ Needs Reply
- 🗂️ Should Archive
- 📎 Attachments
- 🧾 Receipts
- ⭐ Starred
- 📅 Calendar

## 🔐 Security Features

- **XSS Prevention** - All user input is sanitized
- **Pattern Detection** - Blocks dangerous scripts and code injection
- **Gmail Query Validation** - Ensures queries are valid Gmail search syntax
- **Character Limits** - Prevents abuse and oversized data
- **Duplicate Detection** - Warns before creating duplicate searches

## 🛠️ Technical Details

- **Manifest Version:** 3
- **Permissions:** `storage`, `tabs`
- **Host Permissions:** `https://mail.google.com/*`
- **Storage:** Local only (chrome.storage.local)

## 📝 License

This project is open source and available under the MIT License.

## 🌟 Coming Soon

This extension will be available on the Chrome Web Store. Stay tuned!
