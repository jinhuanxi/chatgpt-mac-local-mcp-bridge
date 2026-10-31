import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedUrl } from '../src/browserPolicy.mjs';
const hosts = ['example.com', 'localhost'];
test('browser host allowlist validates exact hosts and schemes', () => {
  assert.equal(allowedUrl('https://example.com/path', hosts), 'https://example.com/path');
  assert.equal(allowedUrl('http://localhost:3000/', hosts), 'http://localhost:3000/');
  assert.throws(() => allowedUrl('https://notexample.com', hosts), /allowlist/);
  assert.throws(() => allowedUrl('https://example.com.bad.com', hosts), /allowlist/);
  assert.throws(() => allowedUrl('file:///etc/passwd', hosts), /http\/https/);
  assert.throws(() => allowedUrl('https://user:pass@example.com', hosts), /Credentials/);
  assert.throws(() => allowedUrl('javascript:alert(1)', hosts), /http\/https/);
});