# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Gmail Quick Search, please report it by:

1. **Email**: Send details to the repository owner
2. **GitHub Security Advisories**: Use the [Security tab](https://github.com/kennyparsons/chrome-extension-gmail-searches/security/advisories) to privately report vulnerabilities

### What to Include

Please include the following information in your report:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: Within 7 days
  - High: Within 30 days
  - Medium/Low: Next scheduled release

## Security Features

Gmail Quick Search implements multiple security measures:

- **XSS Prevention**: All user input rendered via textContent only
- **Input Validation**: Comprehensive validation on all user inputs
- **Pattern Detection**: Blocks dangerous scripts and injection attempts
- **Minimal Permissions**: Only requests `storage` and `tabs` permissions
- **No External Network**: No external API calls or data exfiltration
- **Content Security Policy**: Strict CSP prevents code injection
- **Local Storage Only**: All data stored locally via chrome.storage.local

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the issue and determine affected versions
2. Audit code to find similar problems
3. Prepare fixes for supported versions
4. Release patched versions as soon as possible
5. Credit the reporter (unless they wish to remain anonymous)

Thank you for helping keep Gmail Quick Search and its users safe!
