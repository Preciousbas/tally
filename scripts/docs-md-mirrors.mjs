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
 * Write .md agent mirrors next to each docs MDX page (Mintlify also serves .md).
 * Usage: node scripts/docs-md-mirrors.mjs
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === '.preview' || name.name === 'screenshots' || name.name === 'images') continue;
      out.push(...walk(p));
    } else if (name.name.endsWith('.mdx')) out.push(p);
  }
  return out;
}

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

function toMarkdown(src) {
  let t = src;
  t = t.replace(/<CardGroup[^>]*>/g, '');
  t = t.replace(/<\/CardGroup>/g, '');
  t = t.replace(
    /<Card title="([^"]+)" href="([^"]+)"(?: icon="[^"]*")?>([\s\S]*?)<\/Card>/g,
    (_, title, href, inner) => `- [${title}](${href}) — ${inner.trim().replace(/\s+/g, ' ')}`,
  );
  t = t.replace(/<Steps>/g, '');
  t = t.replace(/<\/Steps>/g, '');
  let n = 0;
  t = t.replace(/<Step title="([^"]+)">([\s\S]*?)<\/Step>/g, (_, title, inner) => {
    n += 1;
    return `${n}. **${title}** — ${inner.trim().replace(/\s+/g, ' ')}`;
  });
  t = t.replace(/<Note>([\s\S]*?)<\/Note>/g, (_, inner) => `> ${inner.trim()}`);
  t = t.replace(/<Warning>([\s\S]*?)<\/Warning>/g, (_, inner) => `> **Warning:** ${inner.trim()}`);
  return t.trim() + '\n';
}

let count = 0;
for (const file of walk(DOCS)) {
  const parsed = parseFrontmatter(readFileSync(file, 'utf8'));
  const hasQuote = parsed.body.trimStart().startsWith('>');
  const quote = hasQuote ? '' : (parsed.description ? `> ${parsed.description}\n\n` : '');
  const md = `# ${parsed.title}\n\n${quote}${toMarkdown(parsed.body)}`;
  const dest = file.replace(/\.mdx$/, '.md');
  writeFileSync(dest, md);
  count += 1;
}
console.log(`Wrote ${count} .md mirrors`);
