/**
 * Compact helpers for Preprod desk identity + standing leaf/root.
 * Must match on-chain circuits — do not use TallySimulator's toy hash for Preprod.
 */
import { convertFieldToBytes } from '@midnight-ntwrk/compact-runtime';
import { Contract } from '../../contract/managed/tally/contract/index.js';
import { fromHex } from '../../api/src/utils/index.js';

export const DESK_PIN = 1234;
const SECRET_STORAGE_KEY = 'tally-midnight-secret';

type CompactContract = {
  _deriveUserPublicKey_0: (sk: Uint8Array, pin: number) => Uint8Array;
  _relationshipLeaf_0: (loanId: bigint, lenderPk: Uint8Array, borrowerPk: Uint8Array) => Uint8Array;
};

const stubWitnesses = {
  getUserSecret: () => [{}, new Uint8Array(32)] as const,
  getPin: () => [{}, BigInt(DESK_PIN)] as const,
  getLoanAmount: () => [{}, 0n] as const,
  getDueSlot: () => [{}, 0n] as const,
  getRelationshipPath: () => [{}, null] as const,
  getStandingLoanId: () => [{}, 0n] as const,
  getStandingCounterpartyPk: () => [{}, new Uint8Array(32)] as const,
};

function compactContract(): CompactContract {
  return new Contract(stubWitnesses as never) as unknown as CompactContract;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Same secret Join/Deploy uses (`tally-midnight-secret` in localStorage). */
export function readOrCreateTallySecret(): Uint8Array {
  const stored = localStorage.getItem(SECRET_STORAGE_KEY);
  if (stored) {
    return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  }
  const secret = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(SECRET_STORAGE_KEY, btoa(String.fromCharCode(...secret)));
  return secret;
}

/** Compact-hashed desk public key (64 hex). Paste into Offer → Borrower id. */
export function deriveChainDeskIdHex(secretKey: Uint8Array, pin = DESK_PIN): string {
  return toHex(compactContract()._deriveUserPublicKey_0(secretKey, pin));
}

export function getBrowserDeskIdHex(): string {
  return deriveChainDeskIdHex(readOrCreateTallySecret());
}

/** Allowlist leaf inserted at Settle — witness for proveStanding path lookup. */
export function deriveRelationshipLeafHex(
  loanId: bigint | number,
  lenderPkHex: string,
  borrowerPkHex: string,
): string {
  const leaf = compactContract()._relationshipLeaf_0(
    BigInt(loanId),
    fromHex(lenderPkHex.replace(/^0x/, '').padStart(64, '0').slice(0, 64)),
    fromHex(borrowerPkHex.replace(/^0x/, '').padStart(64, '0').slice(0, 64)),
  );
  return toHex(leaf);
}

/** Serialize Compact MerkleTreeDigest `{ field }` to 64 hex for verifier paste. */
export function digestToHex(digest: { field: bigint } | Uint8Array): string {
  if (digest instanceof Uint8Array) return toHex(digest);
  return toHex(convertFieldToBytes(32, digest.field, 'relationships.root'));
}
