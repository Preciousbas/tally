import { writeFileSync } from 'node:fs';
import { listTesters } from '../lib/tester-store.ts';

const EXPLORER_TX = 'https://explorer.preprod.midnight.network/tx';

const records = await listTesters();
const lines = [
  '# Tally Preprod testers',
  '',
  'Unique wallets that agreed to be listed. Each row is the first on-chain action from that wallet.',
  'Later transactions stay in the store. This table shows the first one.',
  '',
  'Explorer: [Night Scan, Preprod](https://explorer.preprod.midnight.network/).',
  '',
  '| Wallet address | First action | Transaction | Date |',
  '| --- | --- | --- | --- |',
];

if (records.length === 0) {
  lines.push('| — | — | — | — |');
  lines.push('');
  lines.push('No testers recorded yet.');
} else {
  for (const record of records) {
    const when = record.firstAt.slice(0, 10);
    const tx = record.firstTxId
      ? `[${record.firstTxId.slice(0, 10)}…](${EXPLORER_TX}/${record.firstTxId})`
      : '—';
    lines.push(`| \`${record.walletAddress}\` | ${record.firstAction} | ${tx} | ${when} |`);
  }
}

lines.push('');
writeFileSync(new URL('../docs/USERS.md', import.meta.url), `${lines.join('\n')}`);
console.log(`Wrote docs/USERS.md (${records.length} wallets)`);
