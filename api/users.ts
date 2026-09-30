import { parseTesterEvent, recordTester, storeConfigured, testerCount } from '../lib/tester-store';

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
  if (!storeConfigured()) {
    if (req.method === 'GET') {
      res.status(200).json({ count: 0, configured: false });
      return;
    }
    res.status(503).json({
      error: 'Add REDIS_URL in Vercel.',
    });
    return;
  }

  try {
    if (req.method === 'GET') {
      const count = await testerCount();
      res.status(200).json({ count, configured: true });
      return;
    }
    if (req.method === 'POST') {
      const event = parseTesterEvent(await readBody(req));
      if (!event) {
        res.status(400).json({
          error: 'walletAddress, action, txId, contractAddress, and timestamp are required.',
        });
        return;
      }
      await recordTester(event);
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tester log failed';
    res.status(500).json({ error: message });
  }
}
