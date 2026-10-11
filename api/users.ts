type NodeRequest = {
  method?: string;
  body?: unknown;
  on?: (event: string, cb: (chunk?: Buffer) => void) => void;
};

type NodeResponse = {
  status: (code: number) => NodeResponse;
  json: (body: unknown) => void;
};

type TesterAction = 'offer' | 'accept' | 'disburse' | 'repay' | 'settle' | 'proveStanding';

type TesterEvent = {
  walletAddress: string;
  action: TesterAction;
  txId: string;
  contractAddress: string;
  timestamp: string;
};

type WalletRecord = {
  walletAddress: string;
  firstAction: TesterAction;
  firstTxId: string;
  firstAt: string;
  events: TesterEvent[];
};

const ACTIONS = new Set<TesterAction>(['offer', 'accept', 'disburse', 'repay', 'settle', 'proveStanding']);

function restConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstash(command: string[]): Promise<unknown> {
  const rest = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!rest || !token) throw new Error('Tester store is not configured');
  const res = await fetch(rest, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  const body = (await res.json()) as { result?: unknown; error?: string };
  if (body.error) throw new Error(body.error);
  return body.result;
}

function parseTesterEvent(raw: unknown): TesterEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  const walletAddress = String(body.walletAddress ?? '').trim();
  const action = String(body.action ?? '') as TesterAction;
  const txId = String(body.txId ?? '').trim();
  const contractAddress = String(body.contractAddress ?? '').trim().toLowerCase();
  const timestamp = String(body.timestamp ?? '').trim();
  if (!walletAddress || !ACTIONS.has(action) || !txId) return null;
  if (!/^[0-9a-f]{64}$/.test(contractAddress)) return null;
  if (Number.isNaN(Date.parse(timestamp))) return null;
  return { walletAddress, action, txId, contractAddress, timestamp };
}

async function recordTester(event: TesterEvent): Promise<void> {
  const key = `tally:wallet:${event.walletAddress}`;
  const existing = await upstash(['GET', key]);
  let record: WalletRecord;
  if (typeof existing === 'string' && existing) {
    record = JSON.parse(existing) as WalletRecord;
    record.events = [...(record.events ?? []), event];
  } else {
    record = {
      walletAddress: event.walletAddress,
      firstAction: event.action,
      firstTxId: event.txId,
      firstAt: event.timestamp,
      events: [event],
    };
  }
  await upstash(['SADD', 'tally:wallets', event.walletAddress]);
  await upstash(['SET', key, JSON.stringify(record)]);
}

async function testerCount(): Promise<number> {
  const count = await upstash(['SCARD', 'tally:wallets']);
  return typeof count === 'number' ? count : Number(count ?? 0);
}

async function listTesters(): Promise<WalletRecord[]> {
  const members = await upstash(['SMEMBERS', 'tally:wallets']);
  const wallets = Array.isArray(members) ? members.map(String) : [];
  const records: WalletRecord[] = [];
  for (const wallet of wallets) {
    const raw = await upstash(['GET', `tally:wallet:${wallet}`]);
    if (typeof raw === 'string' && raw) records.push(JSON.parse(raw) as WalletRecord);
  }
  records.sort((a, b) => a.firstAt.localeCompare(b.firstAt));
  return records;
}

async function readBody(req: NodeRequest): Promise<unknown> {
  if (typeof req.body === 'string') {
    if (!req.body.trim()) return {};
    return JSON.parse(req.body);
  }
  if (req.body && typeof req.body === 'object') return req.body;
  if (!req.on) return {};
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => resolve(), 1000);
    req.on?.('data', (chunk) => chunks.push(chunk ?? Buffer.alloc(0)));
    req.on?.('end', () => {
      clearTimeout(timer);
      resolve();
    });
    req.on?.('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function emptyList(res: NodeResponse): void {
  res.status(200).json({ count: 0, testers: [], configured: false });
}

export default async function handler(req: NodeRequest, res: NodeResponse): Promise<void> {
  try {
    if (!restConfigured()) {
      if (req.method === 'GET') {
        emptyList(res);
        return;
      }
      res.status(503).json({ error: 'The tester list is not configured.' });
      return;
    }

    if (req.method === 'GET') {
      const count = await testerCount();
      const testers = count === 0 ? [] : await listTesters();
      res.status(200).json({ count, testers, configured: true });
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
  } catch {
    if (req.method !== 'POST') {
      emptyList(res);
      return;
    }
    res.status(503).json({ error: 'Could not save you on the tester list. Try again later.' });
  }
}
