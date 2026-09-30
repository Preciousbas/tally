import { readFileSync, writeFileSync } from 'node:fs';
import { Redis } from '@upstash/redis';

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
if (!url || !token) {
  console.error('Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or KV_REST_API_URL and KV_REST_API_TOKEN.');
  process.exit(1);
}

type Entry = {
  ts?: string;
  rating?: number | null;
  confused?: string;
  add?: string;
  walletAddress?: string | null;
  xHandle?: string | null;
  page?: string;
};

const redis = new Redis({ url, token });
const rows = await redis.lrange<Entry | string>('feedback:v1', 0, -1);
const notes: Entry[] = [];
for (const row of rows) {
  try {
    const note = typeof row === 'string' ? JSON.parse(row) as Entry : row;
    if (note && typeof note === 'object') notes.push(note);
  } catch {
    /* skip a bad row */
  }
}

const rated = notes.filter((note) => typeof note.rating === 'number');
const average = rated.length
  ? (rated.reduce((sum, note) => sum + Number(note.rating), 0) / rated.length).toFixed(1)
  : '—';
const counts = [5, 4, 3, 2, 1].map((score) => `${score}: ${rated.filter((note) => note.rating === score).length}`).join(', ');

function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim().slice(0, 200);
}

function wallet(value: string | null | undefined): string {
  if (!value) return '—';
  if (value.length <= 16) return value;
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

function when(ts: string | undefined): string {
  if (!ts) return '—';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

const lines = [
  `Exported ${new Date().toISOString()}. ${notes.length} responses. Average rating ${average} from ${rated.length} rated.`,
  '',
  counts,
  '',
  '| Date | Rating | What confused them | What to add | Wallet | X | Page |',
  '| --- | --- | --- | --- | --- | --- | --- |',
];
for (const note of notes) {
  lines.push(`| ${when(note.ts)} | ${note.rating ?? '—'} | ${cell(note.confused || '—')} | ${cell(note.add || '—')} | ${wallet(note.walletAddress)} | ${cell(note.xHandle || '—')} | ${cell(note.page || '—')} |`);
}

const start = '<!-- feedback:export:start -->';
const end = '<!-- feedback:export:end -->';
const block = `${start}\n${lines.join('\n')}\n${end}`;
const path = new URL('../docs/FEEDBACK.md', import.meta.url);
let md = readFileSync(path, 'utf8');
if (md.includes(start) && md.includes(end)) {
  md = md.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block);
} else {
  md = `${md.trimEnd()}\n\n## Raw responses\n\n${block}\n`;
}
writeFileSync(path, md.endsWith('\n') ? md : `${md}\n`);
console.log(`Wrote docs/FEEDBACK.md (${notes.length} responses)`);
