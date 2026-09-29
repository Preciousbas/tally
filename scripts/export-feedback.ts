import { mkdirSync, writeFileSync } from 'node:fs';
import { listFeedback } from '../lib/tester-store.ts';

const notes = await listFeedback();
mkdirSync(new URL('../docs/feedback', import.meta.url), { recursive: true });
const lines = [
  '# Feedback responses',
  '',
  'Raw answers from the desk. One block per submission.',
  '',
];
if (notes.length === 0) {
  lines.push('No responses yet.');
} else {
  notes.forEach((note, index) => {
    lines.push(`## ${index + 1}. ${note.timestamp}`);
    lines.push('');
    lines.push(`- Wallet: ${note.walletAddress || 'not connected'}`);
    lines.push(`- Rating: ${note.rating}`);
    lines.push(`- What confused you: ${note.confused || '—'}`);
    lines.push(`- What should we add: ${note.add || '—'}`);
    lines.push(`- X: ${note.xHandle || '—'}`);
    lines.push('');
  });
}
writeFileSync(new URL('../docs/feedback/responses.md', import.meta.url), `${lines.join('\n')}`);
console.log(`Wrote docs/feedback/responses.md (${notes.length} responses)`);
