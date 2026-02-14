/**
 * Unit tests for validation functions
 * Tests security-critical validation logic
 */

// Import validation functions (in real setup, these would be exported from manage.js)
// For now, we'll define them inline for testing

const MAX_NAME_LENGTH = 100;
const MAX_QUERY_LENGTH = 500;

function validateString(value, maxLength) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength;
}

function containsDangerousPatterns(value) {
  const dangerous = [
    /<script/i,
    /<iframe/i,
    /<embed/i,
    /<object/i,
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /on\w+\s*=/i,
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

function validateGmailQuery(query) {
  if (!query || query.trim().length === 0) {
    return { valid: false, error: 'Query cannot be empty' };
  }

  if (containsDangerousPatterns(query)) {
    return { valid: false, error: 'Query contains invalid characters or patterns' };
  }

  const validOperators = [
    'from:', 'to:', 'subject:', 'label:', 'has:', 'is:', 'in:',
    'cc:', 'bcc:', 'after:', 'before:', 'older:', 'newer:',
    'category:', 'size:', 'larger:', 'smaller:', 'filename:',
    'has:attachment', 'has:drive', 'has:document', 'has:spreadsheet',
    'has:presentation', 'has:youtube', 'has:nouserlabels',
    'is:unread', 'is:read', 'is:starred', 'is:important', 'is:chat',
  ];

  const hasOperator = validOperators.some(op => query.toLowerCase().includes(op));
  const hasText = /[a-zA-Z0-9]/.test(query);

  if (!hasOperator && !hasText) {
    return { valid: false, error: 'Query must contain text or valid Gmail operators' };
  }

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

// Test Suite: validateString
describe('validateString', () => {
  test('accepts valid strings within length', () => {
    expect(validateString('Valid Name', 100)).toBe(true);
    expect(validateString('Test', 10)).toBe(true);
  });

  test('rejects empty or whitespace-only strings', () => {
    expect(validateString('', 100)).toBe(false);
    expect(validateString('   ', 100)).toBe(false);
  });

  test('rejects strings exceeding max length', () => {
    expect(validateString('a'.repeat(101), 100)).toBe(false);
    expect(validateString('a'.repeat(100), 100)).toBe(true);
  });

  test('rejects non-string values', () => {
    expect(validateString(null, 100)).toBe(false);
    expect(validateString(undefined, 100)).toBe(false);
    expect(validateString(123, 100)).toBe(false);
    expect(validateString({}, 100)).toBe(false);
  });

  test('trims whitespace before validation', () => {
    expect(validateString('  Valid  ', 100)).toBe(true);
  });
});

// Test Suite: containsDangerousPatterns
describe('containsDangerousPatterns', () => {
  test('detects script tags', () => {
    expect(containsDangerousPatterns('<script>alert(1)</script>')).toBe(true);
    expect(containsDangerousPatterns('<SCRIPT>alert(1)</SCRIPT>')).toBe(true);
  });

  test('detects iframe tags', () => {
    expect(containsDangerousPatterns('<iframe src="evil.com"></iframe>')).toBe(true);
  });

  test('detects javascript: protocol', () => {
    expect(containsDangerousPatterns('javascript:alert(1)')).toBe(true);
    expect(containsDangerousPatterns('JAVASCRIPT:alert(1)')).toBe(true);
  });

  test('detects data: protocol', () => {
    expect(containsDangerousPatterns('data:text/html,<script>alert(1)</script>')).toBe(true);
  });

  test('detects event handlers', () => {
    expect(containsDangerousPatterns('onclick=alert(1)')).toBe(true);
    expect(containsDangerousPatterns('onload=evil()')).toBe(true);
    expect(containsDangerousPatterns('onerror=hack()')).toBe(true);
  });

  test('detects eval calls', () => {
    expect(containsDangerousPatterns('eval(malicious)')).toBe(true);
  });

  test('allows safe text', () => {
    expect(containsDangerousPatterns('is:unread from:user@example.com')).toBe(false);
    expect(containsDangerousPatterns('subject:meeting')).toBe(false);
    expect(containsDangerousPatterns('Safe Search Name')).toBe(false);
  });
});

// Test Suite: validateGmailQuery
describe('validateGmailQuery', () => {
  test('accepts valid Gmail operators', () => {
    expect(validateGmailQuery('is:unread').valid).toBe(true);
    expect(validateGmailQuery('from:user@example.com').valid).toBe(true);
    expect(validateGmailQuery('subject:meeting').valid).toBe(true);
    expect(validateGmailQuery('has:attachment').valid).toBe(true);
  });

  test('accepts plain text searches', () => {
    expect(validateGmailQuery('meeting notes').valid).toBe(true);
    expect(validateGmailQuery('project update').valid).toBe(true);
  });

  test('accepts complex queries', () => {
    expect(validateGmailQuery('is:unread from:boss@company.com subject:urgent').valid).toBe(true);
    expect(validateGmailQuery('has:attachment -is:starred').valid).toBe(true);
  });

  test('rejects empty queries', () => {
    expect(validateGmailQuery('').valid).toBe(false);
    expect(validateGmailQuery('   ').valid).toBe(false);
  });

  test('rejects dangerous patterns', () => {
    expect(validateGmailQuery('<script>alert(1)</script>').valid).toBe(false);
    expect(validateGmailQuery('javascript:alert(1)').valid).toBe(false);
    expect(validateGmailQuery('onclick=evil()').valid).toBe(false);
  });

  test('rejects SQL injection attempts', () => {
    expect(validateGmailQuery('UNION SELECT * FROM users').valid).toBe(false);
    expect(validateGmailQuery('DROP TABLE emails').valid).toBe(false);
    expect(validateGmailQuery('test; DROP TABLE users').valid).toBe(false);
  });

  test('rejects queries without text or operators', () => {
    expect(validateGmailQuery('!!!###').valid).toBe(false);
    expect(validateGmailQuery('---').valid).toBe(false);
  });

  test('provides error messages', () => {
    const result = validateGmailQuery('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// Test Suite: Integration tests
describe('validation integration', () => {
  test('validates default searches', () => {
    const defaults = [
      { name: "Unread", q: "is:unread" },
      { name: "Unread Archived", q: "is:unread -in:inbox" },
      { name: "Needs Reply", q: "from:* has:nouserlabels -category:social is:unread" },
    ];

    defaults.forEach(search => {
      expect(validateString(search.name, MAX_NAME_LENGTH)).toBe(true);
      expect(validateGmailQuery(search.q).valid).toBe(true);
    });
  });

  test('enforces length limits', () => {
    const longName = 'a'.repeat(MAX_NAME_LENGTH + 1);
    const longQuery = 'is:unread ' + 'a'.repeat(MAX_QUERY_LENGTH);

    expect(validateString(longName, MAX_NAME_LENGTH)).toBe(false);
    expect(validateString(longQuery, MAX_QUERY_LENGTH)).toBe(false);
  });
});
