import { useState, useEffect, useCallback, useRef } from 'react';
import type { InitialAPI, ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { useTally } from './hooks/useTally';
import { BrowserTallyManager } from './contexts/BrowserTallyManager';
import { TallySimulator } from '../../contract/src/tally-simulator';
import pino from 'pino';
import type { PublicLoan } from '../../api/src/common-types';
import { listCompatibleWallets, type WalletOption } from './wallets';

const NETWORK_ID = import.meta.env.VITE_NETWORK_ID ?? 'preprod';
const DEFAULT_CONTRACT = import.meta.env.VITE_DEFAULT_CONTRACT ?? '';

const LACE_INSTALL = 'https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiennaehnffkwbomagd';
const ONEAM_INSTALL = 'https://www.1am.xyz/';
const PRIVACY_DOC = 'https://github.com/Preciousbas/tally#privacy-model';

const DESK_MODE_KEY = 'tally.deskMode';
const LOCAL_BANNER_KEY = 'tally.localBannerDismissed';
const LOCAL_LOANS_KEY = 'tally.localLoans.v1';
const GRAIN_KEY = 'tally.stickCut';

type WalletState = 'detecting' | 'no-wallet' | 'ready' | 'connecting' | 'connected';
type Role = 'lender' | 'borrower' | 'verifier';
type StandingResult = 'pass' | 'fail' | null;
type DeskMode = 'chain' | 'local';

function trunc(addr: string): string {
  return addr.length <= 20 ? addr : `${addr.slice(0, 10)}…${addr.slice(-8)}`;
}

function friendlyError(e: any): string {
  const msg = extractErrorMessage(e);
  if (msg.includes('User rejected')) return 'Transaction cancelled.';
  if (msg.includes('not the borrower')) return 'This instrument is not addressed to your key.';
  if (msg.includes('not the lender')) return 'Only the originating lender can disburse.';
  if (msg.includes('not a party') || msg.includes('not on allowlist') || msg.includes('not a party leaf')) {
    return 'No standing for this identity on the allowlist.';
  }
  if (msg.includes('wrong root')) return 'Allowlist root does not match.';
  if (msg.includes('loan is not settled')) return 'Settle the instrument before proving standing.';
  if (msg.includes('Failed to fetch') || msg.includes('Failed Proof Server')) return 'Proof server unreachable. Start Docker on port 6300.';
  if (msg.includes('insufficient') || msg.includes('DUST')) return 'Insufficient DUST. Register tNIGHT for dust in your wallet.';
  if (msg.includes('Network ID')) return 'Set your wallet to Preprod.';
  if (msg.includes('not compiled') || msg.includes('artifacts')) return 'Compact artifacts missing. Compile tally.compact first.';
  return msg || 'Something failed. Check the console.';
}

function extractErrorMessage(e: any): string {
  if (!e) return '';
  if (e.message) return e.message;
  const failure = e?.cause?.failure;
  if (failure?.message) return failure.message;
  if (e?.cause?.message) return e.cause.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function hashGrain(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = (h >>> 0).toString(16).padStart(8, '0');
  return hex.repeat(8).slice(0, 64);
}

function nextStepForStatus(status: PublicLoan['status']): string | null {
  switch (status) {
    case 'Offered': return 'Offered — switch to Borrower to Accept.';
    case 'Accepted': return 'Accepted — switch to Lender to Disburse.';
    case 'Funded': return 'Funded — switch to Borrower to Repay.';
    case 'Repaid': return 'Repaid — Settle to mint the allowlist leaf.';
    case 'Settled': return 'Settled — Prove standing, then Verifier can Verify access.';
    default: return null;
  }
}

function isHexContract(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value.trim());
}

function CopyableId({ value, label }: { value: string; label?: string }) {
  const [flash, setFlash] = useState(false);
  if (!value) return <span>—</span>;
  return (
    <button
      type="button"
      className={`copy-id${flash ? ' flash' : ''}`}
      title={label ? `Copy ${label}` : 'Copy'}
      aria-label={label ? `Copy ${label}` : `Copy ${trunc(value)}`}
      onClick={() => {
        void copyToClipboard(value).then((ok) => {
          if (!ok) return;
          setFlash(true);
          window.setTimeout(() => setFlash(false), 1200);
        });
      }}
    >
      {flash ? 'Copied' : trunc(value)}
    </button>
  );
}

function GrainFlap() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(GRAIN_KEY) !== '1';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(GRAIN_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <section className={`flap${open ? ' open' : ''}`}>
      <button
        type="button"
        className="flap-tab"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        aria-controls="stick-cut-panel"
        id="stick-cut-tab"
      >
        How a stick is cut
        <span className="flap-mark" aria-hidden="true" />
      </button>
      <div className="flap-body" id="stick-cut-panel" role="region" aria-labelledby="stick-cut-tab">
        <div className="flap-inner">
          <ol className="notches">
            <li>
              <span className="n">01</span>
              <span className="step">Offer</span>
              <span className="gloss">amount and due stay private</span>
            </li>
            <li>
              <span className="n">02</span>
              <span className="step">Accept</span>
              <span className="gloss">borrower agrees</span>
            </li>
            <li>
              <span className="n">03</span>
              <span className="step">Disburse</span>
              <span className="gloss">pay out. Chain never sees how much</span>
            </li>
            <li>
              <span className="n">04</span>
              <span className="step">Repay</span>
              <span className="gloss">borrower pays it back</span>
            </li>
            <li>
              <span className="n">05</span>
              <span className="step">Settle</span>
              <span className="gloss">mint allowlist leaf</span>
            </li>
            <li>
              <span className="n">06</span>
              <span className="step">Standing</span>
              <span className="gloss">prove membership only</span>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}

function readStoredDeskMode(): DeskMode {
  try {
    const v = localStorage.getItem(DESK_MODE_KEY);
    if (v === 'local' || v === 'chain') return v;
  } catch {
    /* ignore */
  }
  return 'chain';
}

function readBannerDismissed(): boolean {
  try {
    return localStorage.getItem(LOCAL_BANNER_KEY) === '1';
  } catch {
    return false;
  }
}

export default function App() {
  const [walletState, setWalletState] = useState<WalletState>('detecting');
  const [walletOptions, setWalletOptions] = useState<WalletOption[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [walletAPI, setWalletAPI] = useState<InitialAPI | undefined>();
  const [wallet, setWallet] = useState<ConnectedAPI | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT);
  const [joinInput, setJoinInput] = useState(DEFAULT_CONTRACT);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rootCopied, setRootCopied] = useState(false);
  const [contractFlash, setContractFlash] = useState(false);
  const [role, setRole] = useState<Role>('lender');
  const [borrowerPk, setBorrowerPk] = useState('');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [localLoans, setLocalLoans] = useState<PublicLoan[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_LOANS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as PublicLoan[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [deskMode, setDeskMode] = useState<DeskMode>(readStoredDeskMode);
  const [standingRoot, setStandingRoot] = useState<string | null>(null);
  const [standingResult, setStandingResult] = useState<StandingResult>(null);
  const [verifyRootInput, setVerifyRootInput] = useState('');
  const [showLocalBanner, setShowLocalBanner] = useState(() => !readBannerDismissed());
  const [deskReady, setDeskReady] = useState(false);
  const autoLocalOnce = useRef(false);

  const simRef = useRef(new TallySimulator());
  const keysRef = useRef({
    lender: new Uint8Array(32).fill(1),
    borrower: new Uint8Array(32).fill(2),
  });
  const managerRef = useRef<BrowserTallyManager | null>(null);
  const getManager = useCallback(() => {
    if (!managerRef.current) {
      managerRef.current = new BrowserTallyManager(pino({ level: 'warn', browser: { asObject: true } }));
    }
    return managerRef.current;
  }, []);

  const { loans: chainLoans, refresh } = useTally(deskMode === 'chain' ? contractAddress || null : null);
  const loans = deskMode === 'local' ? localLoans : chainLoans;
  const selected = loans.find((l) => l.id === selectedId) ?? loans[loans.length - 1];
  const selectedWalletName =
    walletOptions.find((w) => w.id === selectedWalletId)?.name
    ?? walletOptions[0]?.name
    ?? 'Wallet';

  useEffect(() => {
    setDeskReady(true);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DESK_MODE_KEY, deskMode);
    } catch {
      /* ignore */
    }
  }, [deskMode]);

  useEffect(() => {
    if (deskMode !== 'local') return;
    try {
      localStorage.setItem(LOCAL_LOANS_KEY, JSON.stringify(localLoans));
    } catch {
      /* ignore */
    }
  }, [localLoans, deskMode]);

  useEffect(() => {
    const syncWallets = (): WalletOption[] => listCompatibleWallets();

    const initial = syncWallets();
    if (initial.length > 0) {
      setWalletOptions(initial);
      setSelectedWalletId((prev) => prev ?? initial[0].id);
      setWalletState('ready');
      return;
    }

    let elapsed = 0;
    const t = setInterval(() => {
      elapsed += 100;
      const options = syncWallets();
      if (options.length > 0) {
        setWalletOptions(options);
        setSelectedWalletId((prev) => prev ?? options[0].id);
        setWalletState('ready');
        clearInterval(t);
      } else if (elapsed >= 5_000) {
        setWalletState('no-wallet');
        clearInterval(t);
      }
    }, 100);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (walletState !== 'no-wallet' || autoLocalOnce.current) return;
    autoLocalOnce.current = true;
    setDeskMode('local');
    setShowLocalBanner(true);
  }, [walletState]);

  useEffect(() => {
    if (!selectedWalletId) {
      setWalletAPI(undefined);
      return;
    }
    const pick = walletOptions.find((w) => w.id === selectedWalletId) ?? walletOptions[0];
    if (pick) setWalletAPI(pick.api);
  }, [selectedWalletId, walletOptions]);

  useEffect(() => {
    if (!copied && !contractFlash && !rootCopied) return;
    const t = window.setTimeout(() => {
      setCopied(false);
      setContractFlash(false);
      setRootCopied(false);
    }, 2200);
    return () => window.clearTimeout(t);
  }, [copied, contractFlash, rootCopied]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const flashContract = useCallback(() => {
    setContractFlash(true);
    setCopied(true);
  }, []);

  const announceStatus = useCallback((status: PublicLoan['status']) => {
    const tip = nextStepForStatus(status);
    if (tip) setToast(tip);
  }, []);

  const connect = useCallback(async () => {
    if (!walletAPI) {
      setError('No wallet selected. Install Lace or 1AM, then refresh.');
      return;
    }
    setWalletState('connecting');
    setError(null);
    try {
      getManager().setPreferredWallet(walletAPI);
      const c = await walletAPI.connect(NETWORK_ID);
      setWallet(c);
      const { unshieldedAddress } = await c.getUnshieldedAddress();
      setAddress(unshieldedAddress);
      setWalletState('connected');
      setToast('Wallet connected on Preprod.');
    } catch (e) {
      setError(friendlyError(e));
      setWalletState(walletOptions.length ? 'ready' : 'no-wallet');
    }
  }, [walletAPI, getManager, walletOptions.length]);

  const resolveApi = useCallback(async () => {
    const manager = getManager();
    const deployment$ = manager.resolve((contractAddress || undefined) as any);
    return new Promise<any>((resolve, reject) => {
      const sub = deployment$.subscribe((d) => {
        if (d.status === 'deployed') { Promise.resolve().then(() => sub.unsubscribe()); resolve(d); }
        if (d.status === 'failed') { Promise.resolve().then(() => sub.unsubscribe()); reject(d.error); }
      });
    });
  }, [contractAddress, getManager]);

  const snapshotLocal = () => {
    const sim = simRef.current;
    const next: PublicLoan[] = [];
    for (const [id, loan] of sim.loans) {
      const names = ['Vacant', 'Offered', 'Accepted', 'Funded', 'Repaid', 'Settled'] as const;
      next.push({
        id: Number(id),
        status: names[loan.status],
        lenderPk: Array.from(loan.lenderPk).map((b) => b.toString(16).padStart(2, '0')).join(''),
        borrowerPk: Array.from(loan.borrowerPk).map((b) => b.toString(16).padStart(2, '0')).join(''),
        paymentCommit: Array.from(loan.paymentCommit).map((b) => b.toString(16).padStart(2, '0')).join(''),
      });
    }
    setLocalLoans(next);
    if (next.length) {
      const last = next[next.length - 1];
      setSelectedId(last.id);
      announceStatus(last.status);
    }
  };

  const runLocal = (fn: () => void) => {
    try {
      fn();
      snapshotLocal();
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  const requireAmount = (): bigint | null => {
    const raw = amount.trim();
    if (!raw) {
      setError('Amount is required and must be greater than 0.');
      return null;
    }
    try {
      const n = BigInt(raw);
      if (n <= 0n) {
        setError('Amount must be greater than 0.');
        return null;
      }
      return n;
    } catch {
      setError('Amount must be a whole number greater than 0.');
      return null;
    }
  };

  const requireWallet = (): boolean => {
    if (wallet) return true;
    setError('Connect Lace or 1AM on Preprod first. Or switch to Local desk to run the demo without a wallet.');
    return false;
  };

  const onOffer = async () => {
    const amt = requireAmount();
    if (amt === null) return;
    const dueDays = (() => {
      const raw = due.trim();
      if (!raw) return 30n;
      try {
        const n = BigInt(raw);
        return n > 0n ? n : 30n;
      } catch {
        return 30n;
      }
    })();

    if (deskMode === 'local') {
      const pk = simRef.current.deriveUserPublicKey(keysRef.current.borrower, 1234);
      runLocal(() => {
        simRef.current.offerLoan(keysRef.current.lender, 1234, pk, amt, dueDays);
      });
      return;
    }
    if (!requireWallet()) return;
    setBusy('Offering');
    try {
      const result = await resolveApi();
      if (!contractAddress) setContractAddress(result.api.deployedContractAddress);
      await result.api.offerLoan(borrowerPk, amt, dueDays);
      setToast('Offered — switch to Borrower to Accept.');
      setTimeout(() => refresh(), 2500);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const onAccept = async () => {
    if (!selected) return;
    if (deskMode === 'local') {
      if (!simRef.current.loans.has(BigInt(selected.id))) {
        setError('Local simulator reset this session. Offer a new loan on Local desk to continue.');
        return;
      }
      runLocal(() => simRef.current.acceptLoan(keysRef.current.borrower, 1234, BigInt(selected.id)));
      return;
    }
    if (!requireWallet()) return;
    setBusy('Accepting');
    try {
      const result = await resolveApi();
      await result.api.acceptLoan(selected.id);
      setToast('Accepted — switch to Lender to Disburse.');
      setTimeout(() => refresh(), 2500);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const onDisburse = async () => {
    if (!selected) return;
    const grain = hashGrain(paymentRef || `tally-preprod-${selected.id}-${Date.now()}`);
    if (deskMode === 'local') {
      if (!simRef.current.loans.has(BigInt(selected.id))) {
        setError('Local simulator reset this session. Offer a new loan on Local desk to continue.');
        return;
      }
      const bytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) bytes[i] = parseInt(grain.slice(i * 2, i * 2 + 2), 16);
      runLocal(() => simRef.current.disburse(keysRef.current.lender, 1234, BigInt(selected.id), bytes));
      return;
    }
    if (!requireWallet()) return;
    setBusy('Disbursing');
    try {
      const result = await resolveApi();
      await result.api.disburse(selected.id, grain);
      setToast('Funded — switch to Borrower to Repay.');
      setTimeout(() => refresh(), 2500);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const onRepay = async () => {
    if (!selected) return;
    if (deskMode === 'local') {
      if (!simRef.current.loans.has(BigInt(selected.id))) {
        setError('Local simulator reset this session. Offer a new loan on Local desk to continue.');
        return;
      }
      runLocal(() => simRef.current.repay(keysRef.current.borrower, 1234, BigInt(selected.id)));
      return;
    }
    if (!requireWallet()) return;
    setBusy('Repaying');
    try {
      const result = await resolveApi();
      await result.api.repay(selected.id);
      setToast('Repaid — Settle to mint the allowlist leaf.');
      setTimeout(() => refresh(), 2500);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const onSettle = async () => {
    if (!selected) return;
    if (deskMode === 'local') {
      if (!simRef.current.loans.has(BigInt(selected.id))) {
        setError('Local simulator reset this session. Offer a new loan on Local desk to continue.');
        return;
      }
      runLocal(() => simRef.current.settle(keysRef.current.borrower, 1234, BigInt(selected.id)));
      return;
    }
    if (!requireWallet()) return;
    setBusy('Settling');
    try {
      const result = await resolveApi();
      await result.api.settle(selected.id);
      setToast('Settled — Prove standing, then Verifier can Verify access.');
      setTimeout(() => refresh(), 2500);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const onProveStanding = async () => {
    if (!selected) return;
    if (selected.status !== 'Settled') {
      setError('Settle the instrument before proving standing.');
      return;
    }
    setStandingResult(null);
    setBusy('Proving standing…');
    if (deskMode === 'local') {
      if (!simRef.current.loans.has(BigInt(selected.id))) {
        setBusy(null);
        setStandingResult('fail');
        setError('Local simulator reset this session. Re-run Offer through Settle, then Prove standing.');
        return;
      }
      const sk = role === 'lender' ? keysRef.current.lender : keysRef.current.borrower;
      try {
        const proof = simRef.current.proveStanding(sk, 1234, BigInt(selected.id));
        setStandingRoot(proof.root);
        setVerifyRootInput(proof.root);
        setStandingResult('pass');
        setError(null);
        setToast('Standing confirmed — copy the root for the Verifier.');
      } catch (e) {
        setStandingRoot(null);
        setStandingResult('fail');
        setError(friendlyError(e));
      } finally {
        setBusy(null);
      }
      return;
    }
    if (!requireWallet()) {
      setBusy(null);
      return;
    }
    try {
      const result = await resolveApi();
      const counterparty = role === 'lender' ? selected.borrowerPk : selected.lenderPk;
      await result.api.proveStanding(selected.id, counterparty, selected.paymentCommit);
      setStandingResult('pass');
      setStandingRoot(selected.paymentCommit);
      setVerifyRootInput(selected.paymentCommit);
      setToast('Standing confirmed — copy the root for the Verifier.');
      setTimeout(() => refresh(), 2500);
    } catch (e) {
      setStandingResult('fail');
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const onVerifyStanding = () => {
    const claimed = (verifyRootInput || standingRoot || '').trim();
    if (!claimed) {
      setStandingResult('fail');
      setError('No standing proof yet. A party must prove standing first.');
      return;
    }
    if (deskMode === 'local') {
      const ok = simRef.current.verifyStanding(claimed);
      setStandingResult(ok ? 'pass' : 'fail');
      setError(ok ? null : 'Allowlist root does not match.');
      if (ok) setToast('Verifier Pass — membership only.');
      return;
    }
    const ok = !!standingRoot && claimed === standingRoot;
    setStandingResult(ok ? 'pass' : 'fail');
    setError(ok ? null : 'Allowlist root does not match.');
    if (ok) setToast('Verifier Pass — membership only.');
  };

  const onJoin = () => {
    const value = (joinInput || contractAddress).trim();
    if (!value) {
      setError('Paste a Midnight Preprod contract address (64 hex chars) to Join.');
      return;
    }
    if (!isHexContract(value)) {
      setError('Contract address must be 64 hex characters.');
      return;
    }
    setContractAddress(value);
    setJoinInput(value);
    setError(null);
    setToast('Joined Preprod contract.');
    flashContract();
  };

  const deploy = async () => {
    if (!requireWallet() || !walletAPI) return;
    setBusy('Deploying');
    try {
      getManager().setPreferredWallet(walletAPI);
      const result = await resolveApi();
      setContractAddress(result.api.deployedContractAddress);
      setJoinInput(result.api.deployedContractAddress);
      await copyToClipboard(result.api.deployedContractAddress);
      flashContract();
      setToast('Deployed — address copied.');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const dismissLocalBanner = () => {
    setShowLocalBanner(false);
    try {
      localStorage.setItem(LOCAL_BANNER_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const isConnected = walletState === 'connected';
  const actionHint =
    role === 'lender'
      ? selected?.status === 'Accepted'
        ? 'Disburse available when status is Accepted.'
        : selected?.status === 'Repaid'
          ? 'Settle available when status is Repaid.'
          : selected?.status === 'Settled'
            ? 'Prove standing available when status is Settled.'
            : 'Offer creates the instrument. Later actions unlock by status.'
      : role === 'borrower'
        ? selected?.status === 'Offered'
          ? 'Accept available when status is Offered.'
          : selected?.status === 'Funded'
            ? 'Repay available when status is Funded.'
            : selected?.status === 'Repaid'
              ? 'Settle available when status is Repaid.'
              : selected?.status === 'Settled'
                ? 'Prove standing available when status is Settled.'
                : 'Actions unlock when the instrument reaches the right status.'
        : null;

  const walletGate = (() => {
    if (walletState === 'detecting') {
      return <span className="chip quiet" aria-live="polite">Detecting…</span>;
    }
    if (walletState === 'connecting') {
      return <span className="chip quiet" aria-live="polite">Connecting…</span>;
    }
    if (isConnected && address) {
      return (
        <button
          type="button"
          className="chip"
          onClick={() => void copyToClipboard(address).then((ok) => ok && setToast('Address copied.'))}
          aria-label="Copy connected address"
        >
          {trunc(address)}
        </button>
      );
    }
    if (walletState === 'no-wallet') {
      return (
        <div className="install-links">
          <a className="btn primary" href={LACE_INSTALL} target="_blank" rel="noreferrer">Install Lace</a>
          <a className="btn" href={ONEAM_INSTALL} target="_blank" rel="noreferrer">Install 1AM</a>
        </div>
      );
    }
    return (
      <>
        {walletOptions.length > 1 && (
          <select
            className="wallet-select"
            value={selectedWalletId ?? ''}
            onChange={(e) => setSelectedWalletId(e.target.value)}
            aria-label="Choose wallet"
          >
            {walletOptions.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        )}
        <button className="btn primary" onClick={connect} disabled={!walletAPI}>
          {`Connect ${selectedWalletName}`}
        </button>
      </>
    );
  })();

  if (!deskReady) {
    return (
      <div className="desk desk-loading" aria-busy="true" aria-live="polite">
        <p className="eyebrow">Tally</p>
        <p className="quiet">Loading desk…</p>
        <div className="skeleton-block" />
        <div className="skeleton-block short" />
      </div>
    );
  }

  return (
    <div className="desk">
      <header className="mast">
        <div className="brand">
          <img src="/tally-stick.svg" alt="" width={18} height={60} />
          <h1>Tally</h1>
        </div>
        <div className="mast-actions">
          {walletGate}
        </div>
      </header>
      <p className="mast-hint">
        Preprod needs Lace or 1AM. Or switch to Local desk to run the full demo without a wallet.
      </p>

      <section className="hero">
        <h2>The other half stays private.</h2>
        <p className="hero-sub">
          Private trade credit. Prove repaid standing without showing the book.
        </p>
      </section>

      <GrainFlap />

      <div className="trust-strip" role="status">
        <span>Midnight Preprod</span>
        <span className="trust-sep" aria-hidden="true">·</span>
        <span className="trust-contract">
          {contractAddress ? <CopyableId value={contractAddress} label="contract address" /> : 'No contract joined'}
        </span>
        <span className="trust-sep" aria-hidden="true">·</span>
        <a href={PRIVACY_DOC} target="_blank" rel="noreferrer">Privacy model</a>
      </div>

      {showLocalBanner && walletState === 'no-wallet' && deskMode === 'chain' && (
        <div className="notice notice-info" role="status">
          <span>Run the demo here (Local desk) — no wallet. Preprod when Lace is ready.</span>
          <div className="notice-actions">
            <button type="button" onClick={() => { setDeskMode('local'); dismissLocalBanner(); }}>Use Local desk</button>
            <button type="button" onClick={dismissLocalBanner}>Close</button>
          </div>
        </div>
      )}

      {showLocalBanner && walletState === 'no-wallet' && deskMode === 'local' && (
        <div className="notice notice-info" role="status">
          <span>Local desk is ready — no wallet. Offer through Settle, then Prove standing.</span>
          <button type="button" onClick={dismissLocalBanner}>Close</button>
        </div>
      )}

      {error && (
        <div className="notice" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>Close</button>
        </div>
      )}

      {toast && (
        <div className="notice notice-toast" role="status" aria-live="polite">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)}>Close</button>
        </div>
      )}

      <div className="toolbar">
        <div className="toolbar-block">
          <div className="seg" role="group" aria-label="Desk mode">
            <button type="button" className={deskMode === 'chain' ? 'on' : ''} onClick={() => setDeskMode('chain')}>Preprod</button>
            <button type="button" className={deskMode === 'local' ? 'on' : ''} onClick={() => setDeskMode('local')}>Local desk</button>
          </div>
          <p className="seg-caption">
            {deskMode === 'chain' ? 'Preprod = live Midnight' : 'Local desk = in-browser simulator (session-only circuits)'}
          </p>
        </div>

        <div className="toolbar-block">
          <div className="seg" role="group" aria-label="Role">
            <button type="button" className={role === 'lender' ? 'on' : ''} onClick={() => setRole('lender')}>Lender</button>
            <button type="button" className={role === 'borrower' ? 'on' : ''} onClick={() => setRole('borrower')}>Borrower</button>
            <button type="button" className={role === 'verifier' ? 'on' : ''} onClick={() => setRole('verifier')}>Verifier</button>
          </div>
          <p className="seg-caption">
            You are acting as {role === 'lender' ? 'Lender' : role === 'borrower' ? 'Borrower' : 'Verifier'} on this desk.
          </p>
        </div>

        {deskMode === 'chain' && (
          <div className="join-block">
            <label className="contract-label" htmlFor="contract-join">
              Midnight Preprod
            </label>
            <div className="join-field">
              <input
                id="contract-join"
                className={contractFlash ? 'flash' : undefined}
                value={joinInput || contractAddress}
                onChange={(e) => setJoinInput(e.target.value)}
                placeholder="64-hex contract address"
                aria-label="Midnight Preprod contract address"
              />
            </div>
            <div className="join-actions">
              <button type="button" className="btn" onClick={onJoin}>Join</button>
              <button type="button" className="btn" onClick={deploy} disabled={!isConnected || !!busy}>Deploy</button>
              <button
                type="button"
                className="btn"
                onClick={() => contractAddress && copyToClipboard(contractAddress).then((ok) => ok && flashContract())}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>

      <main className="layout">
        <aside className="list">
          <p className="eyebrow">Desk</p>
          {deskMode === 'local' && (
            <p className="quiet list-note">Local instruments are session-only for circuits. History may restore as a list after refresh.</p>
          )}
          {loans.length === 0 ? (
            <p className="quiet">No instruments yet.</p>
          ) : (
            loans.map((loan) => (
              <button
                key={loan.id}
                type="button"
                className={`row ${selected?.id === loan.id ? 'active' : ''}`}
                onClick={() => setSelectedId(loan.id)}
                aria-current={selected?.id === loan.id ? 'true' : undefined}
              >
                <span>#{loan.id}</span>
                <span className={`seal ${loan.status.toLowerCase()}`} aria-label={`Status ${loan.status}`}>{loan.status}</span>
              </button>
            ))
          )}
        </aside>

        <article className="instrument">
          <p className="eyebrow">Instrument</p>
          {selected ? (
            <>
              <div className="head-row">
                <h3>Loan {selected.id}</h3>
                <span className={`seal ${selected.status.toLowerCase()}`} aria-label={`Status ${selected.status}`}>{selected.status}</span>
              </div>
              <dl>
                <div>
                  <dt>Lender id</dt>
                  <dd><CopyableId value={selected.lenderPk} label="lender id" /></dd>
                </div>
                <div>
                  <dt>Borrower id</dt>
                  <dd><CopyableId value={selected.borrowerPk} label="borrower id" /></dd>
                </div>
                <div>
                  <dt>Payment</dt>
                  <dd>
                    {selected.paymentCommit.replace(/0/g, '')
                      ? <CopyableId value={selected.paymentCommit} label="payment commitment" />
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd className="quiet">off-ledger</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="quiet">Offer a loan to cut the first stick.</p>
          )}

          {role === 'lender' && (
            <div className="fields">
              <label>
                Amount
                <span className="field-hint">required · stays off-ledger</span>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="how much" required />
              </label>
              <label>
                Due in days
                <span className="field-hint">witness only · default 30</span>
                <input value={due} onChange={(e) => setDue(e.target.value)} inputMode="numeric" placeholder="30" />
              </label>
              {deskMode === 'chain' && (
                <label>
                  Borrower id
                  <input value={borrowerPk} onChange={(e) => setBorrowerPk(e.target.value)} placeholder="borrower's id" />
                </label>
              )}
              <label>
                Payment
                <input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="Lace payment id" />
              </label>
              <div className="actions">
                <button type="button" className="btn primary" disabled={!!busy} onClick={onOffer}>Offer</button>
                <button type="button" className="btn primary" disabled={!!busy || selected?.status !== 'Accepted'} onClick={onDisburse}>Disburse</button>
                <button type="button" className="btn" disabled={!!busy || selected?.status !== 'Repaid'} onClick={onSettle}>Settle</button>
                <button type="button" className="btn" disabled={!!busy || selected?.status !== 'Settled'} onClick={onProveStanding}>Prove standing</button>
              </div>
              {actionHint && <p className="action-hint">{actionHint}</p>}
            </div>
          )}

          {role === 'borrower' && (
            <div className="fields">
              <div className="actions">
                <button type="button" className="btn primary" disabled={!!busy || selected?.status !== 'Offered'} onClick={onAccept}>Accept</button>
                <button type="button" className="btn primary" disabled={!!busy || selected?.status !== 'Funded'} onClick={onRepay}>Repay</button>
                <button type="button" className="btn" disabled={!!busy || selected?.status !== 'Repaid'} onClick={onSettle}>Settle</button>
                <button type="button" className="btn" disabled={!!busy || selected?.status !== 'Settled'} onClick={onProveStanding}>Prove standing</button>
              </div>
              {actionHint && <p className="action-hint">{actionHint}</p>}
            </div>
          )}

          {role === 'verifier' && (
            <div className="fields">
              {!standingRoot && !verifyRootInput && !loans.some((l) => l.status === 'Settled') ? (
                <p className="quiet verifier-empty">
                  No settled instrument and no allowlist root yet. Complete Offer through Settle, then Prove standing, then return here.
                </p>
              ) : (
                <p className="quiet">
                  Third party check. You only learn yes or no — not amount, due, or which leaf.
                </p>
              )}
              <label>
                Allowlist root
                <input
                  value={verifyRootInput || standingRoot || ''}
                  onChange={(e) => setVerifyRootInput(e.target.value)}
                  placeholder="root from standing proof"
                  aria-label="Allowlist root"
                />
              </label>
              <dl>
                <div>
                  <dt>Standing</dt>
                  <dd>
                    {standingResult === 'pass' && <span className="seal settled" aria-label="Standing pass">Pass</span>}
                    {standingResult === 'fail' && <span className="seal vacant" aria-label="Standing fail">Fail</span>}
                    {!standingResult && '—'}
                  </dd>
                </div>
              </dl>
              <div className="actions">
                <button type="button" className="btn primary" disabled={!!busy} onClick={onVerifyStanding}>Verify access</button>
              </div>
            </div>
          )}

          {(role === 'lender' || role === 'borrower') && (
            <div className="standing-panel" aria-live="polite">
              {busy === 'Proving standing…' && <p className="quiet busy-line">Proving standing…</p>}
              {standingResult === 'pass' && (
                <>
                  <p className="standing-line">
                    <span className="seal settled" aria-label="Standing confirmed">Standing confirmed</span>
                  </p>
                  {standingRoot && (
                    <div className="root-row">
                      <span className="quiet">Allowlist root</span>
                      <code className="root-value">{trunc(standingRoot)}</code>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => void copyToClipboard(standingRoot).then((ok) => {
                          if (ok) setRootCopied(true);
                        })}
                      >
                        {rootCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                </>
              )}
              {standingResult === 'fail' && (
                <p className="standing-line">
                  <span className="seal vacant" aria-label="Standing failed">Standing failed</span>
                </p>
              )}
            </div>
          )}

          {busy && busy !== 'Proving standing…' && (
            <p className="quiet busy-line" aria-live="polite">{busy}</p>
          )}
        </article>
      </main>
    </div>
  );
}
