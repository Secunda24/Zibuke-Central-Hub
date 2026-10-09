import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'src/modules/assistant/knowledge.json');
const origins = ['https://zibukeafrica.com', 'https://zibukeoncall.co.za'];
const hosts = new Set(origins.flatMap(o => [new URL(o).hostname, 'www.' + new URL(o).hostname]));
export function safeUrl(value, base) {
  try {
    const u = new URL(value, base);
    if (u.protocol !== 'https:' || !hosts.has(u.hostname) || u.port || u.username || u.password || u.search) return null;
    if (/\/(?:api|admin|login|logout|account|my-account|checkout|cart|book|booking|wp-admin|wp-json)(?:[/.\-]|$)/i.test(u.pathname)) return null;
    if (/\.(?:pdf|png|jpe?g|svg|webp|gif|zip|mp4|css|js|ico|woff2?)$/i.test(u.pathname)) return null;
    u.hash = ''; return u.href;
  } catch { return null; }
}
export function decodeEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', hellip: '...', bull: '*' };
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, key) => {
    if (key[0] !== '#') return named[key.toLowerCase()] ?? all;
    const n = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
  });
}
export function htmlText(html) {
  return decodeEntities(html.replace(/<(script|style|svg|noscript|nav|footer|header|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
async function download(url) {
  for (let i = 0; i < 4; i++) {
    if (!safeUrl(url)) throw new Error('URL outside public site scope');
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'ZibukeKnowledgeBot/1.0' } });
    if ([301,302,303,307,308].includes(response.status)) {
      const next = safeUrl(response.headers.get('location') || '', url);
      if (!next) throw new Error('Redirect outside public site scope');
      await response.body?.cancel(); url = next; continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
    const reader = response.body?.getReader(); if (!reader) throw new Error('Empty response');
    let size = 0; const parts = [];
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > 1000000) { await reader.cancel(); throw new Error('Page exceeds 1MB limit'); }
      parts.push(value);
    }
    return { url, text: Buffer.concat(parts).toString('utf8'), type: response.headers.get('content-type') || '' };
  }
  throw new Error('Too many redirects');
}
export function robotsRules(text) {
  const groups = []; let current = { agents: [], rules: [] }; let hasRules = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split('#')[0].trim(); const i = line.indexOf(':'); if (i < 0) continue;
    const key = line.slice(0,i).trim().toLowerCase(), value = line.slice(i+1).trim();
    if (key === 'user-agent') { if (hasRules) { groups.push(current); current = { agents: [], rules: [] }; hasRules = false; } current.agents.push(value.toLowerCase()); }
    if (['allow','disallow'].includes(key) && value) { current.rules.push({ allow: key === 'allow', value }); hasRules = true; }
  }
  groups.push(current);
  const specific = groups.filter(g => g.agents.some(a => a !== '*' && 'zibukeknowledgebot'.startsWith(a)));
  return (specific.length ? specific : groups.filter(g => g.agents.includes('*'))).flatMap(g => g.rules);
}
export function permitted(url, rules) {
  const p = new URL(url).pathname;
  const matches = rules.filter(r => {
    const escaped = r.value.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$');
    return new RegExp('^' + escaped).test(p);
  }).sort((a,b) => b.value.length - a.value.length || Number(b.allow) - Number(a.allow));
  return matches[0]?.allow ?? true;
}
async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(path.join(dir,e.name)) : path.join(dir,e.name)))).flat();
}
async function screenLabels(file, visited = new Set()) {
  if (visited.has(file) || visited.size > 35) return []; visited.add(file);
  const code = await fs.readFile(file, 'utf8');
  const tree = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const labels = []; const imports = [];
  function visit(node) {
    if (ts.isJsxText(node)) { const t = node.text.replace(/\s+/g,' ').trim(); if (t.length > 2 && t.length < 400) labels.push(t); }
    if (ts.isJsxAttribute(node) && ['title','placeholder','aria-label'].includes(node.name.getText(tree)) && node.initializer && ts.isStringLiteral(node.initializer)) labels.push(node.initializer.text);
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  for (const name of imports) {
    if (!name.startsWith('@/') && !name.startsWith('.')) continue;
    const base = name.startsWith('@/') ? path.join(root,name.slice(2)) : path.resolve(path.dirname(file),name);
    if (!base.startsWith(root + path.sep)) continue;
    for (const ext of ['.tsx', '/index.tsx']) {
      const candidate = base + ext;
      try { if ((await fs.stat(candidate)).isFile()) { labels.push(...await screenLabels(candidate,visited)); break; } } catch { /* not a UI module */ }
    }
  }
  return [...new Set(labels)];
}
export async function refresh() {
  const documents = [], scans = []; const fetchedAt = new Date().toISOString();
  for (const origin of origins) {
    const report = { origin, pages: 0, skipped: [], capped: false }; scans.push(report);
    let rules;
    try { rules = robotsRules((await download(origin + '/robots.txt')).text); }
    catch (error) { if (error.message !== 'HTTP 404') { report.skipped.push({ url: origin, reason: 'robots.txt unavailable: ' + error.message }); continue; } rules = []; }
    const queue = [origin + '/']; const seen = new Set();
    try {
      const sitemap = await download(origin + '/sitemap.xml');
      const maps = [...sitemap.text.matchAll(/<loc>\s*(.*?)\s*<\/loc>/g)].map(m => decodeEntities(m[1]));
      for (const link of maps.slice(0,150)) {
        const u = safeUrl(link, origin); if (!u || new URL(u).hostname.replace(/^www\./,'') !== new URL(origin).hostname) continue;
        if (new URL(u).pathname.endsWith('.xml')) {
          if (!permitted(u,rules)) continue;
          const nested = await download(u).catch(() => null);
          if (nested) queue.push(...[...nested.text.matchAll(/<loc>\s*(.*?)\s*<\/loc>/g)].map(m => decodeEntities(m[1])).slice(0,100));
        } else queue.push(u);
      }
    } catch { /* discover pages through navigation instead */ }
    while (queue.length && report.pages < 60 && seen.size < 150) {
      const url = safeUrl(queue.shift(), origin);
      if (!url || seen.has(url) || new URL(url).hostname.replace(/^www\./,'') !== new URL(origin).hostname) continue;
      seen.add(url); if (!permitted(url,rules)) { report.skipped.push({ url, reason: 'robots.txt' }); continue; }
      try {
        const page = await download(url);
        if (!page.type.includes('text/html')) continue;
        const text = htmlText(page.text).slice(0,24000);
        const title = htmlText(page.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || url);
        if (text.length > 100 && !documents.some(d => d.url === page.url)) { documents.push({ title, url: page.url, kind: 'website', text, fetchedAt }); report.pages++; }
        for (const match of page.text.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
          const link = safeUrl(decodeEntities(match[1]), page.url);
          if (link && !seen.has(link)) queue.push(link);
        }
      } catch (error) { report.skipped.push({ url, reason: error.message }); }
    }
    report.capped = queue.length > 0;
    console.log(`${origin}: ${report.pages} public pages indexed; ${report.skipped.length} skipped${report.capped ? '; crawl limit reached' : ''}.`);
  }
  if (scans.some(s => s.pages === 0)) throw new Error('A website could not be scanned. Existing knowledge was left unchanged.');
  const guides = JSON.parse((await fs.readFile(path.join(root,'src/modules/assistant/platform-guide.json'),'utf8')).replace(/^\uFEFF/,''));
  const pages = (await walk(path.join(root,'app/dashboard'))).filter(p => p.endsWith(path.sep + 'page.tsx'));
  for (const file of pages) {
    const route = '/' + path.relative(path.join(root,'app'),path.dirname(file)).split(path.sep).join('/');
    const url = route.replace(/\/\[[^/]+\]/g,'');
    const guide = guides.find(g => g.url === url);
    const labels = await screenLabels(file);
    documents.push({ title: guide?.title || `Platform: ${url}`, url, kind: 'platform', text: `${guide?.text || 'Use the controls available on this screen.'}\nVisible screen labels (not a sequence of steps): ${labels.join(' | ').slice(0,9000)}`, fetchedAt });
  }
  await fs.writeFile(output, JSON.stringify({ updatedAt: fetchedAt, scans, platformScreens: pages.length, documents },null,2) + '\n');
  console.log(`Saved ${documents.length} reference documents including ${pages.length} platform screens.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  refresh().catch(error => { console.error(error.message); process.exitCode = 1; });
}
