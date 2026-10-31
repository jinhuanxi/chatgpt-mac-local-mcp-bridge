export function allowedUrl(input, allowedHosts) {
  let url;
  try { url = new URL(input); } catch { throw new Error('Invalid URL'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http/https URLs are allowed');
  if (url.username || url.password) throw new Error('Credentials in URL are prohibited');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const allowed = allowedHosts.some(raw => {
    const rule = String(raw).trim().toLowerCase();
    // Explicit hostname matches only; no wildcard or suffix matching.
    return rule.length > 0 && host === rule;
  });
  if (!allowed) throw new Error(`Host not on allowlist: ${host}; edit config.json to approve it`);
  return url.toString();
}