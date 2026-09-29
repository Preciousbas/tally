/**
 * Tester log and feedback live in Upstash Redis.
 * Vercel env vars:
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 */

export type TesterAction = 'offer' | 'accept' | 'disburse' | 'repay' | 'settle' | 'proveStanding';

export type TesterEvent = {
  walletAddress: string;
  action: TesterAction;
  txId: string;
  contractAddress: string;
  timestamp: string;
};

export type WalletRecord = {
  walletAddress: string;
  firstAction: TesterAction;
  firstTxId: string;
  firstAt: string;
  events: TesterEvent[];
};

const ACTIONS = new Set<TesterAction>(['offer', 'accept', 'disburse', 'repay', 'settle', 'proveStanding']);

export function storeConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redis(command: unknown[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Tester store is not configured');
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  const body = (await res.json()) as { result?: unknown; error?: string };
  if (body.error) throw new Error(body.error);
  return body.result;
}

export function parseTesterEvent(raw: unknown): TesterEvent | null {
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

export async function recordTester(event: TesterEvent): Promise<void> {
  const key = `tally:wallet:${event.walletAddress}`;
  const existing = await redis(['GET', key]);
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
  await redis(['SADD', 'tally:wallets', event.walletAddress]);
  await redis(['SET', key, JSON.stringify(record)]);
}

export async function testerCount(): Promise<number> {
  const count = await redis(['SCARD', 'tally:wallets']);
  return typeof count === 'number' ? count : Number(count ?? 0);
}

export async function listTesters(): Promise<WalletRecord[]> {
  const members = await redis(['SMEMBERS', 'tally:wallets']);
  const wallets = Array.isArray(members) ? members.map(String) : [];
  const records: WalletRecord[] = [];
  for (const wallet of wallets) {
    const raw = await redis(['GET', `tally:wallet:${wallet}`]);
    if (typeof raw === 'string' && raw) records.push(JSON.parse(raw) as WalletRecord);
  }
  records.sort((a, b) => a.firstAt.localeCompare(b.firstAt));
  return records;
}

export type FeedbackNote = {
  walletAddress: string;
  rating: number;
  confused: string;
  add: string;
  xHandle: string;
  timestamp: string;
};

export async function recordFeedback(note: FeedbackNote): Promise<void> {
  await redis(['RPUSH', 'tally:feedback', JSON.stringify(note)]);
}

export async function listFeedback(): Promise<FeedbackNote[]> {
  const rows = await redis(['LRANGE', 'tally:feedback', '0', '-1']);
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => JSON.parse(String(row)) as FeedbackNote);
}
