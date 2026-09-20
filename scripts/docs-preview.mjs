// This file is part of tally-midnight.
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//	https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Render docs/*.mdx to a Tally-themed static preview and optionally serve it.
 * Usage: node scripts/docs-preview.mjs [--no-serve] [--port 3333]
 */

import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, cpSync, existsSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs/.preview');
const PORT = Number(process.env.DOCS_PREVIEW_PORT ?? 3333);
const noServe = process.argv.includes('--no-serve');

const PAGES = [
  { file: 'index.mdx', slug: 'index', nav: 'Introduction', tab: 'Use' },
  { file: 'how-it-works.mdx', slug: 'how-it-works', nav: 'How it works', tab: 'Use' },
  { file: 'privacy.mdx', slug: 'privacy', nav: 'Privacy', tab: 'Use' },
  { file: 'desk-tour.mdx', slug: 'desk-tour', nav: 'Desk tour', tab: 'Use' },
  { file: 'quickstart.mdx', slug: 'quickstart', nav: 'Local quickstart', tab: 'Use' },
  { file: 'preprod.mdx', slug: 'preprod', nav: 'Preprod guide', tab: 'Use' },
  { file: 'architecture.mdx', slug: 'architecture', nav: 'Architecture', tab: 'Build' },
  { file: 'contract.mdx', slug: 'contract', nav: 'Contract reference', tab: 'Build' },
  { file: 'identity.mdx', slug: 'identity', nav: 'Identity', tab: 'Build' },
  { file: 'design-system.mdx', slug: 'design-system', nav: 'Design system', tab: 'Build' },
  { file: 'contributing.mdx', slug: 'contributing', nav: 'Contributing', tab: 'Build' },
  { file: 'demo.mdx', slug: 'demo', nav: 'Demo video', tab: 'Build' },
];

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { title: '', description: '', body: raw };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
  return { title: meta.title ?? '', description: meta.description ?? '', body: m[2] };
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s) {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, h) => {
      const href = h.startsWith('/docs/') ? `${h.replace(/^\/docs\//, '/').replace(/\/$/, '') || '/index'}.html` : h;
      const mapped = h === '/docs/index' ? '/index.html' : href;
      return `<a href="${mapped}">${t}</a>`;
    });
}

function rewriteDocHref(href) {
  if (!href.startsWith('/docs/')) return href;
  const rest = href.slice('/docs/'.length);
  if (!rest || rest === 'index') return '/index.html';
  if (rest.includes('.')) return href;
  return `/${rest}.html`;
}

function renderMarkdown(md) {
  let src = md;
  src = src.replace(/<CardGroup[^>]*>/g, '<div class="cards">');
  src = src.replace(/<\/CardGroup>/g, '</div>');
  src = src.replace(
    /<Card title="([^"]+)" href="([^"]+)"(?: icon="[^"]*")?>([\s\S]*?)<\/Card>/g,
    (_, title, href, inner) =>
      `<a class="card" href="${rewriteDocHref(href)}"><strong>${escapeHtml(title)}</strong><span>${inline(inner.trim())}</span></a>`,
  );
  src = src.replace(/<Steps>/g, '<ol class="steps">');
  src = src.replace(/<\/Steps>/g, '</ol>');
  src = src.replace(
    /<Step title="([^"]+)">([\s\S]*?)<\/Step>/g,
    (_, title, inner) => `<li><strong>${escapeHtml(title)}</strong> ${inline(inner.trim())}</li>`,
  );
  src = src.replace(
    /<Note>([\s\S]*?)<\/Note>/g,
    (_, inner) => `<aside class="note">${inline(inner.trim())}</aside>`,
  );

  const lines = src.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const buf = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i]);
        i += 1;
      }
      out.push(`<pre class="code ${escapeHtml(lang)}"><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      i += 1;
      continue;
    }
    if (line.startsWith('| ') && i + 1 < lines.length && /^\|[\s:-|]+$/.test(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        rows.push(lines[i]);
        i += 1;
      }
      const cells = (row) =>
        row
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      out.push(
        `<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`,
      );
      continue;
    }
    const img = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (img) {
      const srcPath = img[2].startsWith('/docs/') ? img[2].replace('/docs/', '/') : img[2];
      out.push(`<figure><img src="${srcPath}" alt="${escapeHtml(img[1])}" /><figcaption>${escapeHtml(img[1])}</figcaption></figure>`);
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
      i += 1;
      continue;
    }
    if (line.startsWith('### ')) {
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
      i += 1;
      continue;
    }
    if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(`<li>${inline(lines[i].slice(2))}</li>`);
        i += 1;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\d+\. /, ''))}</li>`);
        i += 1;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    if (line.startsWith('<') && !line.startsWith('<a ') && !line.startsWith('<div') && !line.startsWith('<ol') && !line.startsWith('<aside') && !line.startsWith('<li')) {
      out.push(line);
      i += 1;
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !lines[i].startsWith('|') && !lines[i].startsWith('```') && !lines[i].startsWith('!') && !lines[i].startsWith('- ') && !/^\d+\. /.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,560&display=swap');
:root {
  --bg: #1C1914; --surface: #2A241C; --bone: #E8DCC8; --ink: #C4B49A;
  --muted: #8A7A64; --oxblood: #8C2F2B; --moss: #4F6F54; --rule: #3D3428;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--ink); font-family: Figtree, sans-serif; }
a { color: var(--bone); }
a:hover { color: var(--oxblood); }
.shell { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
nav { border-right: 1px solid var(--rule); padding: 1.5rem 1.25rem; position: sticky; top: 0; height: 100vh; overflow: auto; }
nav .brand { display: flex; align-items: center; gap: 0.6rem; color: var(--bone); text-decoration: none; font-family: Fraunces, serif; font-size: 1.35rem; }
nav .brand img { height: 42px; width: auto; }
nav .eyebrow { font-size: 0.68rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); margin: 1.4rem 0 0.4rem; font-weight: 600; }
nav a.item { display: block; padding: 0.28rem 0; color: var(--ink); text-decoration: none; }
nav a.item.active { color: var(--bone); }
nav .cta { display: inline-block; margin-top: 1.5rem; background: var(--oxblood); color: var(--bone); text-decoration: none; padding: 0.4rem 0.75rem; font-size: 0.85rem; }
main { max-width: 820px; padding: 2.5rem 2rem 4rem; }
.blurb { color: var(--muted); margin-top: -0.4rem; }
h1, h2, h3 { font-family: Fraunces, serif; color: var(--bone); font-weight: 400; }
h1 { font-size: 2.2rem; }
h2 { font-size: 1.45rem; margin-top: 2rem; }
table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
th, td { border-bottom: 1px solid var(--rule); padding: 0.45rem 0.4rem; text-align: left; vertical-align: top; }
th { color: var(--muted); font-weight: 600; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; }
code { font-size: 0.86em; color: var(--bone); }
pre.code { background: var(--surface); border: 1px solid var(--rule); padding: 0.9rem 1rem; overflow: auto; }
figure { margin: 1.25rem 0; }
figure img { width: 100%; border: 1px solid var(--rule); }
figcaption { color: var(--muted); font-size: 0.85rem; margin-top: 0.4rem; }
.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin: 1rem 0; }
.card { display: flex; flex-direction: column; gap: 0.35rem; background: var(--surface); border: 1px solid var(--rule); padding: 0.9rem 1rem; text-decoration: none; color: var(--ink); }
.card strong { color: var(--bone); font-family: Fraunces, serif; }
.steps { padding-left: 1.2rem; }
.note { border-left: 3px solid var(--oxblood); padding: 0.6rem 0.9rem; background: var(--surface); }
.seal { color: var(--moss); }
@media (max-width: 800px) {
  .shell { grid-template-columns: 1fr; }
  nav { position: relative; height: auto; border-right: 0; border-bottom: 1px solid var(--rule); }
  .cards { grid-template-columns: 1fr; }
}
`;

function pageHtml(page, html) {
  const use = PAGES.filter((p) => p.tab === 'Use');
  const build = PAGES.filter((p) => p.tab === 'Build');
  const items = (list) =>
    list
      .map((p) => `<a class="item${p.slug === page.slug ? ' active' : ''}" href="/${p.slug === 'index' ? 'index' : p.slug}.html">${p.nav}</a>`)
      .join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(page.title)} · Tally</title>
  <meta name="description" content="${escapeHtml(page.description)}" />
  <link rel="icon" href="/images/tally-stick.svg" />
  <link rel="stylesheet" href="/preview.css" />
</head>
<body>
  <div class="shell">
    <nav>
      <a class="brand" href="/index.html"><img src="/images/tally-stick.svg" alt="" />Tally</a>
      <p class="eyebrow">Use</p>
      ${items(use)}
      <p class="eyebrow">Build</p>
      ${items(build)}
      <a class="cta" href="https://tally-jet-mu.vercel.app">Open desk</a>
    </nav>
    <main>
      <p class="eyebrow">Tally docs</p>
      <h1>${escapeHtml(page.title)}</h1>
      <p class="blurb">${escapeHtml(page.description)}</p>
      ${html}
    </main>
  </div>
</body>
</html>`;
}

function mime(file) {
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.txt': 'text/plain; charset=utf-8',
    }[extname(file)] ?? 'application/octet-stream'
  );
}

mkdirSync(OUT, { recursive: true });
mkdirSync(join(OUT, 'images'), { recursive: true });
writeFileSync(join(OUT, 'preview.css'), CSS);
copyFileSync(join(ROOT, 'docs/images/tally-stick.svg'), join(OUT, 'images/tally-stick.svg'));
if (existsSync(join(ROOT, 'docs/screenshots'))) {
  cpSync(join(ROOT, 'docs/screenshots'), join(OUT, 'screenshots'), { recursive: true });
}
if (existsSync(join(ROOT, 'docs/llms.txt'))) {
  copyFileSync(join(ROOT, 'docs/llms.txt'), join(OUT, 'llms.txt'));
}

const missing = [];
for (const page of PAGES) {
  const abs = join(ROOT, 'docs', page.file);
  if (!existsSync(abs)) {
    missing.push(page.file);
    continue;
  }
  const parsed = parseFrontmatter(readFileSync(abs, 'utf8'));
  page.title = parsed.title;
  page.description = parsed.description;
  const html = renderMarkdown(parsed.body);
  writeFileSync(join(OUT, `${page.slug}.html`), pageHtml(page, html));
}

if (missing.length) {
  console.error('Missing MDX pages:', missing.join(', '));
  process.exit(1);
}

writeFileSync(
  join(OUT, 'index.json'),
  JSON.stringify(
    PAGES.map((p) => ({ slug: p.slug, title: p.title, description: p.description, tab: p.tab })),
    null,
    2,
  ),
);

console.log(`Wrote ${PAGES.length} pages to docs/.preview`);

if (noServe) process.exit(0);

const server = createServer((req, res) => {
  let url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (url === '/') url = '/index.html';
  if (!extname(url)) url = `${url}.html`;
  const file = join(OUT, url);
  if (!file.startsWith(OUT) || !existsSync(file)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': mime(file) });
  res.end(readFileSync(file));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Docs preview http://127.0.0.1:${PORT}`);
});
