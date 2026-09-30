import { recordFeedback, storeConfigured } from '../lib/tester-store';

type NodeRequest = {
  method?: string;
  body?: unknown;
  on?: (event: string, cb: (chunk?: Buffer) => void) => void;
};

type NodeResponse = {
  status: (code: number) => NodeResponse;
  json: (body: unknown) => void;
};

async function readBody(req: NodeRequest): Promise<unknown> {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on?.('data', (chunk) => chunks.push(chunk ?? Buffer.alloc(0)));
    req.on?.('end', () => resolve());
    req.on?.('error', reject);
  });
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export default async function handler(req: NodeRequest, res: NodeResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }
  if (!storeConfigured()) {
    res.status(503).json({
      error: 'Add REDIS_URL in Vercel.',
    });
    return;
  }
  const body = (await readBody(req)) as Record<string, unknown>;
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: 'Rating must be 1 to 5.' });
    return;
  }
  await recordFeedback({
    walletAddress: String(body.walletAddress ?? ''),
    rating,
    confused: String(body.confused ?? '').slice(0, 2000),
    add: String(body.add ?? '').slice(0, 2000),
    xHandle: String(body.xHandle ?? '').slice(0, 80),
    timestamp: String(body.timestamp ?? new Date().toISOString()),
  });
  res.status(200).json({ ok: true });
}
