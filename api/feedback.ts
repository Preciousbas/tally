import { createHash, randomUUID } from 'node:crypto';
import { Redis } from '@upstash/redis';

type NodeRequest = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  on?: (event: string, cb: (chunk?: Buffer) => void) => void;
};

type NodeResponse = {
  status: (code: number) => NodeResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

function header(req: NodeRequest, name: string): string {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function send(res: NodeResponse, code: number, body: unknown, extra: Record<string, string> = {}): void {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  for (const [name, value] of Object.entries(extra)) res.setHeader(name, value);
  res.status(code).json(body);
}

function sha16(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function originAllowed(req: NodeRequest): boolean {
  const origin = header(req, 'origin');
  if (!origin) return true;
  const host = (header(req, 'x-forwarded-host') || header(req, 'host')).split(',')[0].trim();
  if (host && origin === `https://${host}`) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

async function readBody(req: NodeRequest): Promise<unknown> {
  if (typeof req.body === 'string') {
    if (req.body.length > 4096) return { __tooBig: true };
    return JSON.parse(req.body);
  }
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on?.('data', (chunk) => chunks.push(chunk ?? Buffer.alloc(0)));
    req.on?.('end', () => resolve());
    req.on?.('error', reject);
  });
  if (!chunks.length) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.length > 4096) return { __tooBig: true };
  return JSON.parse(text);
}

export default async function handler(req: NodeRequest, res: NodeResponse): Promise<void> {
  if (req.method !== 'POST') {
    send(res, 405, { error: 'Method not allowed.' }, { Allow: 'POST' });
    return;
  }
  if (!originAllowed(req)) {
    send(res, 403, { error: 'Origin is not allowed.' });
    return;
  }
  const contentType = header(req, 'content-type');
  if (!contentType.includes('application/json')) {
    send(res, 415, { error: 'Content-Type must be application/json.' });
    return;
  }
  const length = Number(header(req, 'content-length'));
  if (Number.isFinite(length) && length > 4096) {
    send(res, 413, { error: 'Feedback is too large.' });
    return;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    send(res, 503, { error: 'Feedback storage is not configured.' });
    return;
  }

  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    send(res, 400, { error: 'Feedback must be JSON.' });
    return;
  }
  if (body && typeof body === 'object' && '__tooBig' in body) {
    send(res, 413, { error: 'Feedback is too large.' });
    return;
  }
  if (JSON.stringify(body).length > 4096) {
    send(res, 413, { error: 'Feedback is too large.' });
    return;
  }
  const data = (body ?? {}) as Record<string, unknown>;
  if (typeof data.website === 'string' && data.website.trim()) {
    send(res, 200, { ok: true });
    return;
  }

  let rating: number | null = null;
  if (data.rating !== undefined && data.rating !== null && data.rating !== '') {
    const n = typeof data.rating === 'number' ? data.rating : Number(data.rating);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      send(res, 400, { error: 'Rating must be a whole number from 1 to 5.' });
      return;
    }
    rating = n;
  }

  const textField = (value: unknown, label: string): string | null => {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') {
      send(res, 400, { error: `${label} must be text.` });
      return null;
    }
    const trimmed = value.trim();
    if (trimmed.length > 1000) {
      send(res, 400, { error: `${label} is too long.` });
      return null;
    }
    return trimmed;
  };
  const confused = textField(data.confused, 'What confused you');
  if (confused === null) return;
  const add = textField(data.add, 'What should we add');
  if (add === null) return;
  if (rating === null && !confused && !add) {
    send(res, 400, { error: 'Add a rating or a note.' });
    return;
  }

  let walletAddress: string | null = null;
  if (typeof data.walletAddress === 'string' && /^[A-Za-z0-9_-]{8,200}$/.test(data.walletAddress.trim())) {
    walletAddress = data.walletAddress.trim();
  }

  let xHandle: string | null = null;
  if (typeof data.xHandle === 'string' && data.xHandle.trim()) {
    const handle = data.xHandle.trim().replace(/^@/, '');
    if (/^[A-Za-z0-9_]{1,15}$/.test(handle)) xHandle = handle;
  }

  let page = '/';
  if (typeof data.page === 'string' && data.page.startsWith('/') && data.page.length <= 200) {
    page = data.page;
  }
  const desk = data.desk === 'chain' || data.desk === 'local' ? data.desk : null;
  const userAgent = header(req, 'user-agent');
  const entry = {
    id: randomUUID(),
    ts: new Date().toISOString(),
    rating,
    confused,
    add,
    walletAddress,
    xHandle,
    page,
    desk,
    uaHash: userAgent ? sha16(userAgent) : null,
  };

  const forwarded = header(req, 'x-forwarded-for').split(',')[0].trim();
  const ip = forwarded || header(req, 'x-real-ip') || 'unknown';
  const redis = new Redis({ url, token });
  try {
    const key = `feedback:rl:${sha16(ip)}`;
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 600);
    if (n > 5) {
      send(res, 429, { error: 'Too many notes. Try again in a few minutes.' }, { 'Retry-After': '600' });
      return;
    }
    await redis.lpush('feedback:v1', JSON.stringify(entry));
    await redis.ltrim('feedback:v1', 0, 4999);
    send(res, 201, { ok: true, id: entry.id });
  } catch (error) {
    console.error(error);
    send(res, 500, { error: 'Feedback could not be saved.' });
  }
}
