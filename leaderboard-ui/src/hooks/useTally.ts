import { useState, useEffect, useCallback } from 'react';
import { ContractState } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { Tally } from '../../../contract/src/index';
import { toHex } from '../../../api/src/utils/index.js';
import type { PublicLoan, PublicLoanStatus } from '../../../api/src/common-types.js';
import { digestToHex } from '../deskId';

const INDEXER_URL = import.meta.env.VITE_INDEXER_URL ?? 'https://indexer.preprod.midnight.network/api/v4/graphql';

const CONTRACT_STATE_QUERY = `
  query ContractState($address: HexEncoded!) {
    contractAction(address: $address) {
      state
    }
  }
`;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

const statusFromLedger = (status: unknown): PublicLoanStatus => {
  const names: PublicLoanStatus[] = ['Vacant', 'Offered', 'Accepted', 'Funded', 'Repaid', 'Settled'];
  if (typeof status === 'number' && names[status]) return names[status];
  if (status && typeof status === 'object') {
    const s = status as Record<string, boolean>;
    if (s.isOffered) return 'Offered';
    if (s.isAccepted) return 'Accepted';
    if (s.isFunded) return 'Funded';
    if (s.isRepaid) return 'Repaid';
    if (s.isSettled) return 'Settled';
  }
  return 'Unknown';
};

function collectRoots(ledgerState: ReturnType<typeof Tally.ledger>): {
  current: string | null;
  all: string[];
} {
  const roots = new Set<string>();
  let current: string | null = null;
  try {
    current = digestToHex(ledgerState.relationships.root());
    roots.add(current);
  } catch {
    /* empty tree */
  }
  try {
    const hist = ledgerState.relationships.history();
    let step = hist.next();
    while (!step.done) {
      roots.add(digestToHex(step.value));
      step = hist.next();
    }
  } catch {
    /* no history iterator */
  }
  return { current, all: [...roots] };
}

export function useTally(contractAddress: string | null, refreshInterval = 15_000) {
  const [loans, setLoans] = useState<PublicLoan[]>([]);
  const [loanCount, setLoanCount] = useState(0);
  const [allowlistRoot, setAllowlistRoot] = useState<string | null>(null);
  const [allowlistRoots, setAllowlistRoots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLoans = useCallback(async () => {
    if (!contractAddress || !/^[0-9a-fA-F]{64}$/.test(contractAddress)) return;

    try {
      setLoading(true);
      const res = await fetch(INDEXER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: CONTRACT_STATE_QUERY, variables: { address: contractAddress } }),
      });
      const gql = await res.json();
      if (gql.errors) throw new Error(gql.errors[0]?.message ?? 'Indexer query failed');
      const stateHex = gql.data?.contractAction?.state;
      if (!stateHex) throw new Error('Contract not found');

      const contractState = ContractState.deserialize(hexToBytes(stateHex));
      const ledgerState = Tally.ledger(contractState.data);
      const parsed: PublicLoan[] = [];
      for (const [key, entry] of ledgerState.loans) {
        parsed.push({
          id: Number(key),
          status: statusFromLedger(entry.status),
          lenderPk: toHex(entry.lenderPk),
          borrowerPk: toHex(entry.borrowerPk),
          paymentCommit: toHex(entry.paymentCommit),
        });
      }
      parsed.sort((a, b) => a.id - b.id);
      const { current, all } = collectRoots(ledgerState);
      setLoans(parsed);
      setLoanCount(Number(ledgerState.nextId));
      setAllowlistRoot(current);
      setAllowlistRoots(all);
      setError(null);
      return { loans: parsed, allowlistRoot: current, allowlistRoots: all };
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [contractAddress]);

  useEffect(() => {
    void fetchLoans();
  }, [fetchLoans]);

  useEffect(() => {
    if (!contractAddress) return;
    const interval = setInterval(() => void fetchLoans(), refreshInterval);
    return () => clearInterval(interval);
  }, [contractAddress, refreshInterval, fetchLoans]);

  return {
    loans,
    loanCount,
    allowlistRoot,
    allowlistRoots,
    loading,
    error,
    refresh: fetchLoans,
  };
}
