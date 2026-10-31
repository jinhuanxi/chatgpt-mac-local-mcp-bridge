import { chromium } from 'playwright';
import { allowedUrl } from './browserPolicy.mjs';

export function makeBrowser(config) {
  let browser, context, page;
  const hosts = config.allowedWebHosts;
  const getPage = () => { if (!page || page.isClosed()) throw new Error('Open a page first with browser_open'); return page; };
  async function ensureBrowser() {
    if (browser?.isConnected()) return;
    browser = await chromium.launch({ headless: Boolean(config.browserHeadless) });
    context = await browser.newContext({ acceptDownloads: false, permissions: [], serviceWorkers: 'block' });
    // Allow only explicitly approved hosts for ALL HTTP requests, not just top-level navigation.
    await context.route('**/*', async route => {
      const url = route.request().url();
      try {
        if (url.startsWith('data:') || url.startsWith('blob:')) return await route.continue();
        allowedUrl(url, hosts);
        return await route.continue();
      } catch { await route.abort('blockedbyclient').catch(() => {}); }
    });
  }
  return {
    async open(url) {
      const safe = allowedUrl(url, hosts);
      await ensureBrowser();
      if (!page || page.isClosed()) page = await context.newPage();
      await page.goto(safe, { waitUntil: 'domcontentloaded', timeout: 18000 });
      return { title: await page.title(), url: page.url() };
    },
    async inspect() {
      const p = getPage();
      return {
        title: await p.title(), url: p.url(),
        text: (await p.locator('body').innerText({ timeout: 10000 })).slice(0, 10000),
        links: await p.locator('a').evaluateAll(els => els.slice(0, 25).map(x => ({ text: (x.innerText || '').trim().slice(0, 80), href: x.href })))
      };
    },
    async click(selector) {
      const p = getPage();
      if (selector.length > 200) throw new Error('Selector too long');
      await p.locator(selector).first().click({ timeout: 8000 });
      const url = p.url();
      if (/^https?:/.test(url)) allowedUrl(url, hosts);
      return { url, title: await p.title() };
    },
    async fill(selector, value) {
      const p = getPage();
      if (selector.length > 200 || value.length > 5000) throw new Error('Input too long');
      await p.locator(selector).first().fill(value, { timeout: 8000 });
      return { filled: selector, characters: value.length };
    },
    async screenshot() {
      const p = getPage();
      const img = await p.screenshot({ type: 'jpeg', quality: 65, timeout: 10000 });
      return { content: [{ type: 'image', data: img.toString('base64'), mimeType: 'image/jpeg' }] };
    },
    async close() {
      await browser?.close(); browser = undefined; context = undefined; page = undefined;
      return { closed: true };
    }
  };
}