import { useState, useEffect, useCallback, useRef } from 'react';
import type { InitialAPI, ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { useTally } from './hooks/useTally';
import { BrowserTallyManager } from './contexts/BrowserTallyManager';
import { LoanStatus, TallySimulator } from '../../contract/src/tally-simulator';
import pino from 'pino';
import type { PublicLoan } from '../../api/src/common-types';
import { listCompatibleWallets, type WalletOption } from './wallets';
import { DESK_PIN, deriveRelationshipLeafHex, getBrowserDeskIdHex } from './deskId';

const NETWORK_ID = import.meta.env.VITE_NETWORK_ID ?? 'preprod';
const DEFAULT_CONTRACT = import.meta.env.VITE_DEFAULT_CONTRACT ?? '';
const SHOW_DEPLOY = DEFAULT_CONTRACT.trim().length === 0;

const LACE_INSTALL = 'https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiennaehnffkwbomagd';
const ONEAM_INSTALL = 'https://1am.xyz';
const DOCS_HOME = 'https://tally-a9233c8f.mintlify.site/';
const GITHUB_REPO = 'https://github.com/Preciousbas/tally';
const X_PROFILE = 'https://x.com/tally_lend';
const MIDNIGHT_HOME = 'https://midnight.network';
const PRIVACY_DOC = 'https://tally-a9233c8f.mintlify.site/docs/privacy';
const PREPROD_FAUCET = 'https://faucet.preprod.midnight.network/';

const DESK_MODE_KEY = 'tally.deskMode.v2';
const LOCAL_LOANS_KEY = 'tally.localLoans.v1';
const GRAIN_KEY = 'tally.stickCut';
const CONSENT_KEY = 'tally.testerConsent';
const LOAN_PAGE = 10;

function readConsent(): 'yes' | 'no' | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    if (value === 'yes' || value === 'no') return value;
  } catch {
    /* ignore */
  }
  return null;
}

function loanMatchesQuery(loan: PublicLoan, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  if (String(loan.id).includes(q)) return true;
  return loan.lenderPk.toLowerCase().includes(q) || loan.borrowerPk.toLowerCase().includes(q);
}

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
  if (msg.includes('not the borrower')) return 'This loan is not addressed to your private ID.';
  if (msg.includes('not the lender')) return 'Only the lender who offered this loan can send funds.';
  if (msg.includes('Private state missing') || msg.includes('corrupted')) {
    return 'Desk private state is missing. Join the contract again, then retry.';
  }
  if (msg.includes('count out of range')) return 'Count must be 1, 2, or 3.';
  if (msg.includes('duplicate leaf')) return 'Those repaid loans are not distinct enough for that count.';
  if (msg.includes('not a borrower leaf') || msg.includes('repaid leaf not in allowlist')) {
    return 'Only loans you repaid as the borrower count.';
  }
  if (msg.includes('not a party') || msg.includes('not on allowlist') || msg.includes('not a party leaf') || msg.includes('standing leaf not in allowlist')) {
    return 'No record for this private ID.';
  }
  if (msg.includes('wrong root')) return 'Allowlist root does not match.';
  if (msg.includes('loan is not settled')) return 'Settle the loan before proving your record.';
  if (msg.includes('Request failed') || msg.includes('submitting scoped transaction')) {
    return 'Wallet could not submit the transaction. Check tDUST, Preprod network, and approve the wallet prompt.';
  }
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

function connectorError(e: any): { code: string; reason: string } {
  const source = e?.type === 'DAppConnectorAPIError' ? e : e?.cause?.type === 'DAppConnectorAPIError' ? e.cause : e;
  const code = typeof source?.code === 'string' ? source.code : '';
  const reason = typeof source?.reason === 'string' ? source.reason.trim() : '';
  return { code, reason: reason || extractErrorMessage(e).trim() };
}

/** Shown when connect() or the address read fails. Loan submission keeps friendlyError. */
function connectFailureMessage(walletName: string, e: unknown): string {
  const { code, reason } = connectorError(e);
  const detail = reason.replace(/\s+/g, ' ');
  const opaque = /request failed|message channel closed|message port closed|asynchronous response/i.test(detail)
    && detail.length < 80;
  const extra = detail && !opaque ? ` ${detail}` : '';
  if (code === 'Rejected' || /user rejected/i.test(detail)) {
    return `${walletName} did not connect because the prompt was closed.`;
  }
  if (code === 'PermissionRejected') {
    return `${walletName} did not connect because it refused permission.${extra}`;
  }
  if (code === 'Disconnected' || /message channel closed/i.test(detail) || /message port closed/i.test(detail)) {
    return `${walletName} did not connect because it closed the browser port before answering.`;
  }
  if (code === 'InvalidRequest') {
    return detail
      ? `${walletName} did not connect because it rejected the request: ${detail}`
      : `${walletName} did not connect because it rejected the request.`;
  }
  if (/network id/i.test(detail)) {
    return `${walletName} did not connect because it is not set to Preprod.`;
  }
  if (code === 'InternalError' || /request failed/i.test(detail)) {
    return `${walletName} did not connect because the extension closed the request before it answered.${extra}`;
  }
  if (detail) return `${walletName} did not connect. ${detail}`;
  return `${walletName} did not connect.`;
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
    case 'Accepted': return 'Accepted — switch to Lender to send funds.';
    case 'Funded': return 'Funded — switch to Borrower to Repay.';
    case 'Repaid': return 'Repaid — Settle to close the loan.';
    case 'Settled': return 'Settled — Prove good record, then someone can check it.';
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

function CopyIcon() {
  return (
    <svg className="desk-id-icon" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="none">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.25" stroke="currentColor" strokeWidth="1.25" />
      <path d="M10.5 5.5V4.25A1.25 1.25 0 0 0 9.25 3H4.25A1.25 1.25 0 0 0 3 4.25v5A1.25 1.25 0 0 0 4.25 10.5H5.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

/** Copies this browser's Tally desk pk (Offer → Borrower id), not Lace/1AM address. */
function DeskIdCopy({ value }: { value: string }) {
  const [flash, setFlash] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      className={`desk-id-copy${flash ? ' flash' : ''}`}
      title="A private name for you on Tally. It isn't your wallet address."
      onClick={() => {
        void copyToClipboard(value).then((ok) => {
          if (!ok) return;
          setFlash(true);
          window.setTimeout(() => setFlash(false), 1200);
        });
      }}
    >
      <span>{flash ? 'Copied' : 'Your private ID'}</span>
      <CopyIcon />
    </button>
  );
}

function GrainFlap() {
  const [open, setOpen] = useState(false);

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
        How a loan works
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
              <span className="step">Send funds</span>
              <span className="gloss">the chain never sees how much</span>
            </li>
            <li>
              <span className="n">04</span>
              <span className="step">Repay</span>
              <span className="gloss">borrower pays it back</span>
            </li>
            <li>
              <span className="n">05</span>
              <span className="step">Settle</span>
              <span className="gloss">the repayment is recorded</span>
            </li>
            <li>
              <span className="n">06</span>
              <span className="step">Good record</span>
              <span className="gloss">prove it with a Pass, nothing else</span>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}

function WalletChoice({
  option,
  installHref,
  installLabel,
  fallbackIcon,
  onConnect,
}: {
  option?: WalletOption;
  installHref?: string;
  installLabel?: string;
  fallbackIcon?: string;
  onConnect: (option: WalletOption) => void;
}) {
  if (option) {
    return (
      <button type="button" className="wallet-row" onClick={() => void onConnect(option)}>
        {option.icon && <img src={option.icon} alt="" width={32} height={32} />}
        <span>
          <strong>{option.name}</strong>
          <small>Midnight wallet</small>
        </span>
        <span className="wallet-arrow" aria-hidden="true">→</span>
      </button>
    );
  }
  if (!installHref || !installLabel) return null;
  return (
    <a className="wallet-row" href={installHref} target="_blank" rel="noreferrer">
      {fallbackIcon && <img src={fallbackIcon} alt="" width={32} height={32} />}
      <span>
        <strong>{installLabel}</strong>
        <small>Midnight wallet</small>
      </span>
      <span className="wallet-arrow" aria-hidden="true">→</span>
    </a>
  );
}

function PrivateIdDetail() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="tech-toggle" onClick={() => setOpen((value) => !value)}>
        {open ? 'Hide technical details' : 'Show technical details'}
      </button>
      {open && (
        <span className="private-id-tech">Desk ID derivation uses a local secret and a fixed pin in this browser.</span>
      )}
    </>
  );
}

function readStoredDeskMode(): DeskMode {
  try {
    const v = localStorage.getItem(DESK_MODE_KEY);
    if (v === 'local' || v === 'chain') return v;
  } catch {
    /* ignore */
  }
  return 'local';
}

export default function App() {
  const [walletState, setWalletState] = useState<WalletState>('ready');
  const [walletOptions, setWalletOptions] = useState<WalletOption[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [walletAPI, setWalletAPI] = useState<InitialAPI | undefined>();
  const [wallet, setWallet] = useState<ConnectedAPI | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [testerConsent, setTesterConsent] = useState<'yes' | 'no' | null>(() => readConsent());
  const [testerCount, setTesterCount] = useState<number | null>(null);
  const [testerLogReady, setTesterLogReady] = useState(false);
  const [askFeedback, setAskFeedback] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [confused, setConfused] = useState('');
  const [wish, setWish] = useState('');
  const [xHandle, setXHandle] = useState('');
  const [website, setWebsite] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackThanks, setFeedbackThanks] = useState(false);
  const feedbackPanelRef = useRef<HTMLElement>(null);
  const feedbackButtonRef = useRef<HTMLButtonElement>(null);
  const feedbackWasOpen = useRef(false);
  const connectReturnRef = useRef<HTMLButtonElement | null>(null);
  const headerConnectRef = useRef<HTMLButtonElement>(null);
  const deskAnchorRef = useRef<HTMLElement>(null);
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
  const [loanQuery, setLoanQuery] = useState('');
  const [appliedLoanQuery, setAppliedLoanQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(LOAN_PAGE);
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
  const [repaidCount, setRepaidCount] = useState(1);
  const [countResult, setCountResult] = useState<StandingResult>(null);
  const [provedRepaidCounts, setProvedRepaidCounts] = useState<number[]>([]);
  const [verifyRootInput, setVerifyRootInput] = useState('');
  const [walletModal, setWalletModal] = useState<'install' | 'chooser' | null>(null);
  const [showTech, setShowTech] = useState(false);
  const [showStatusTech, setShowStatusTech] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testerSaveError, setTesterSaveError] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);

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

  const refreshTesterCount = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (!res.ok) return;
      const body = (await res.json()) as { count?: number; configured?: boolean };
      setTesterLogReady(Boolean(body.configured));
      if (typeof body.count === 'number') setTesterCount(body.count);
    } catch {
      setTesterLogReady(false);
    }
  }, []);

  const logOnChain = useCallback(async (action: string, txId: string, usedContract: string) => {
    if (readConsent() !== 'yes' || !address || !txId) return;
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          action,
          txId,
          contractAddress: usedContract,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        setTesterSaveError('Could not save you on the tester list. The loan still went through.');
        return;
      }
      setTesterSaveError(null);
      await refreshTesterCount();
    } catch {
      setTesterSaveError('Could not save you on the tester list. The loan still went through.');
    }
  }, [address, refreshTesterCount]);

  const noteChainSuccess = useCallback((action: string, txId: string, usedContract: string) => {
    void logOnChain(action, txId, usedContract);
    try {
      if (localStorage.getItem('tally.feedbackDone') === '1') return;
      if (localStorage.getItem('tally.feedbackPrompted') === '1') return;
      localStorage.setItem('tally.feedbackPrompted', '1');
    } catch {
      /* ignore */
    }
    setAskFeedback(true);
  }, [logOnChain]);

  useEffect(() => {
    void refreshTesterCount();
  }, [refreshTesterCount]);

  const feedbackVisible = askFeedback || feedbackOpen;

  useEffect(() => {
    if (!feedbackVisible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setAskFeedback(false);
      setFeedbackOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [feedbackVisible]);

  useEffect(() => {
    if (feedbackVisible) {
      feedbackPanelRef.current?.focus();
      feedbackWasOpen.current = true;
      return;
    }
    if (!feedbackWasOpen.current) return;
    feedbackWasOpen.current = false;
    feedbackButtonRef.current?.focus();
  }, [feedbackVisible]);

  const { loans: chainLoans, refresh, allowlistRoot, allowlistRoots } = useTally(deskMode === 'chain' ? contractAddress || null : null);
  const loans = deskMode === 'local' ? localLoans : chainLoans;
  const matchedLoans = [...loans]
    .sort((a, b) => b.id - a.id)
    .filter((loan) => loanMatchesQuery(loan, appliedLoanQuery));
  const visibleLoans = matchedLoans.slice(0, visibleCount);
  const selected = loans.find((l) => l.id === selectedId) ?? loans[loans.length - 1];

  const deskIdHex = (() => {
    if (deskMode === 'local') {
      const sk =
        role === 'borrower' ? keysRef.current.borrower
        : role === 'lender' ? keysRef.current.lender
        : keysRef.current.lender;
      return Array.from(simRef.current.deriveUserPublicKey(sk, DESK_PIN))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
    try {
      return getBrowserDeskIdHex();
    } catch {
      return '';
    }
  })();

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
    let stopped = false;
    const apply = () => {
      if (stopped) return;
      const options = listCompatibleWallets();
      if (options.length === 0) return;
      setWalletOptions(options);
      setSelectedWalletId((prev) => prev ?? options[0].id);
      setWalletState((current) => (current === 'connected' || current === 'connecting' ? current : 'ready'));
    };
    const frame = window.requestAnimationFrame(apply);
    const poll = window.setInterval(apply, 300);
    const stop = window.setTimeout(() => {
      window.clearInterval(poll);
      if (stopped) return;
      const options = listCompatibleWallets();
      if (options.length === 0) {
        setWalletState((current) => (current === 'connected' || current === 'connecting' ? current : 'no-wallet'));
      }
    }, 1500);
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      window.clearInterval(poll);
      window.clearTimeout(stop);
    };
  }, []);

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

  const connectWallet = useCallback(async (option: WalletOption) => {
    setWalletModal(null);
    setSelectedWalletId(option.id);
    setWalletAPI(option.api);
    setWalletState('connecting');
    setError(null);
    try {
      getManager().setPreferredWallet(option.api);
      const c = await option.api.connect(NETWORK_ID);
      setWallet(c);
      const { unshieldedAddress } = await c.getUnshieldedAddress();
      setAddress(unshieldedAddress);
      setWalletState('connected');
      setToast('Wallet connected on Preprod.');
    } catch (e) {
      setError(connectFailureMessage(option.name, e));
      setWalletState('ready');
    }
  }, [getManager]);

  const closeWalletModal = useCallback(() => {
    setWalletModal(null);
    connectReturnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!walletModal) return;
    const root = document.getElementById('wallet-modal');
    const focusables = () => (
      root
        ? [...root.querySelectorAll<HTMLElement>('button, a[href]')]
        : []
    );
    focusables()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeWalletModal();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [walletModal, closeWalletModal]);

  const beginConnect = useCallback((button: HTMLButtonElement | null) => {
    connectReturnRef.current = button;
    const options = listCompatibleWallets();
    setWalletOptions(options);
    if (options.length === 0) {
      setWalletModal('install');
      return;
    }
    setWalletModal('chooser');
  }, []);

  const openDemo = useCallback(() => {
    setDeskMode('local');
    setWalletModal(null);
    window.requestAnimationFrame(() => {
      deskAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

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
    setError('Connect a Midnight wallet on Preprod first. Or try the demo without a wallet.');
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
      const txId = await result.api.offerLoan(borrowerPk, amt, dueDays);
      const usedContract = result.api.deployedContractAddress || contractAddress;
      void noteChainSuccess('offer', txId, usedContract);
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
      const txId = await result.api.acceptLoan(selected.id);
      void noteChainSuccess('accept', txId, result.api.deployedContractAddress || contractAddress);
      setToast('Accepted. Switch to Lender to send funds.');
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
      const txId = await result.api.disburse(selected.id, grain);
      void noteChainSuccess('disburse', txId, result.api.deployedContractAddress || contractAddress);
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
      const txId = await result.api.repay(selected.id);
      void noteChainSuccess('repay', txId, result.api.deployedContractAddress || contractAddress);
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
      const txId = await result.api.settle(selected.id);
      void noteChainSuccess('settle', txId, result.api.deployedContractAddress || contractAddress);
      setToast('Settled. Prove your good record, then someone can check it.');
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
      setError('Settle the loan before proving your record.');
      return;
    }
    setStandingResult(null);
    setBusy('Proving standing…');
    if (deskMode === 'local') {
      if (!simRef.current.loans.has(BigInt(selected.id))) {
        setBusy(null);
        setStandingResult('fail');
        setError('This demo reset this session. Run Offer through Settle again, then prove your record.');
        return;
      }
      const sk = role === 'lender' ? keysRef.current.lender : keysRef.current.borrower;
      try {
        const proof = simRef.current.proveStanding(sk, 1234, BigInt(selected.id));
        setStandingRoot(proof.root);
        setVerifyRootInput(proof.root);
        setStandingResult('pass');
        setError(null);
        setToast('Record confirmed. Open technical details to copy the root.');
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
      const leafHex = deriveRelationshipLeafHex(selected.id, selected.lenderPk, selected.borrowerPk);
      const txId = await result.api.proveStanding(selected.id, counterparty, leafHex);
      void noteChainSuccess('proveStanding', txId, result.api.deployedContractAddress || contractAddress);
      const snapshot = await refresh();
      const root = snapshot?.allowlistRoot ?? allowlistRoot ?? null;
      if (!root) {
        // Circuit succeeded; leaf was inserted at Settle — root may lag indexer briefly.
        setStandingResult('pass');
        setStandingRoot(null);
        setError('Record proved. The root is not visible yet. Refresh in a few seconds, then open technical details to copy it.');
        setToast('Standing confirmed — refresh for allowlist root.');
        return;
      }
      setStandingResult('pass');
      setStandingRoot(root);
      setVerifyRootInput(root);
      setError(null);
      setToast('Record confirmed. Open technical details to copy the root.');
      setTimeout(() => void refresh(), 2500);
    } catch (e) {
      setStandingResult('fail');
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const onProveRepaidCount = async () => {
    const n = repaidCount;
    if (!Number.isInteger(n) || n < 1 || n > 3) {
      setCountResult('fail');
      setError(friendlyError(new Error('count out of range')));
      return;
    }
    const borrowerHex = (pk: Uint8Array) =>
      Array.from(pk).map((b) => b.toString(16).padStart(2, '0')).join('');
    if (deskMode === 'local') {
      const me = borrowerHex(simRef.current.deriveUserPublicKey(keysRef.current.borrower, DESK_PIN));
      const ids: bigint[] = [];
      for (const [id, loan] of simRef.current.loans) {
        const borrower = borrowerHex(loan.borrowerPk);
        if (loan.status === LoanStatus.Settled && borrower.toLowerCase() === me.toLowerCase()) ids.push(id);
      }
      if (ids.length < n) {
        setCountResult('fail');
        const listed = loans.some((loan) => loan.status === 'Settled');
        setError(listed && simRef.current.loans.size === 0
          ? 'Local simulator reset this session. Re-run Offer through Settle, then Prove repaid count.'
          : friendlyError(new Error('duplicate leaf')));
        return;
      }
      setCountResult(null);
      setBusy('Proving repaid count…');
      try {
        simRef.current.proveRepaidCount(keysRef.current.borrower, DESK_PIN, n, ids.slice(0, n));
        setCountResult('pass');
        setError(null);
        setToast('Repaid count confirmed.');
      } catch (e) {
        setCountResult('fail');
        setError(friendlyError(e));
      } finally {
        setBusy(null);
      }
      return;
    }
    const me = getBrowserDeskIdHex();
    const seen = new Set<number>();
    const rows = loans.filter((loan) => {
      if (loan.status !== 'Settled') return false;
      if (loan.borrowerPk.toLowerCase() !== me.toLowerCase()) return false;
      if (seen.has(loan.id)) return false;
      seen.add(loan.id);
      return true;
    });
    if (rows.length < n) {
      setCountResult('fail');
      setError(friendlyError(new Error('duplicate leaf')));
      return;
    }
    const picked = rows.slice(0, n);
    if (!requireWallet()) return;
    setCountResult(null);
    setBusy('Proving repaid count…');
    try {
      const result = await resolveApi();
      const txId = await result.api.proveRepaidCount(
        n,
        picked.map((loan) => ({
          loanId: loan.id,
          lenderPkHex: loan.lenderPk,
          leafHex: deriveRelationshipLeafHex(loan.id, loan.lenderPk, loan.borrowerPk),
        })),
      );
      void noteChainSuccess('proveRepaidCount', txId, result.api.deployedContractAddress || contractAddress);
      setProvedRepaidCounts((current) => (current.includes(n) ? current : [...current, n]));
      setCountResult('pass');
      setError(null);
      setToast('Repaid count confirmed.');
    } catch (e) {
      setCountResult('fail');
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const onCheckRepaidCount = () => {
    const n = repaidCount;
    if (!Number.isInteger(n) || n < 1 || n > 3) {
      setCountResult('fail');
      setError(friendlyError(new Error('count out of range')));
      return;
    }
    if (deskMode === 'local') {
      try {
        const me = Array.from(simRef.current.deriveUserPublicKey(keysRef.current.borrower, DESK_PIN))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        const ids: bigint[] = [];
        for (const [id, loan] of simRef.current.loans) {
          const borrower = Array.from(loan.borrowerPk).map((b) => b.toString(16).padStart(2, '0')).join('');
          if (loan.status === LoanStatus.Settled && borrower.toLowerCase() === me.toLowerCase()) ids.push(id);
        }
        if (ids.length < n) throw new Error('duplicate leaf');
        simRef.current.proveRepaidCount(keysRef.current.borrower, DESK_PIN, n, ids.slice(0, n));
        setCountResult('pass');
        setError(null);
        setToast('Yes for this count. Not which loans.');
      } catch (e) {
        setCountResult('fail');
        setError(friendlyError(e));
      }
      return;
    }
    const ok = provedRepaidCounts.includes(n);
    setCountResult(ok ? 'pass' : 'fail');
    setError(ok ? null : 'No repaid-count proof for that number in this session.');
    if (ok) setToast('Yes for this count. Not which loans.');
  };

  const onVerifyStanding = () => {
    const claimed = (verifyRootInput || standingRoot || '').trim().toLowerCase();
    if (!claimed) {
      setStandingResult('fail');
      setError('No record yet. Prove a good record first.');
      return;
    }
    if (deskMode === 'local') {
      const ok = simRef.current.verifyStanding(claimed);
      setStandingResult(ok ? 'pass' : 'fail');
      setError(ok ? null : 'Allowlist root does not match.');
      if (ok) setToast('Pass. Membership only.');
      return;
    }
    const known = new Set(
      [standingRoot, allowlistRoot, ...allowlistRoots]
        .filter((r): r is string => !!r)
        .map((r) => r.toLowerCase()),
    );
    const ok = known.has(claimed);
    setStandingResult(ok ? 'pass' : 'fail');
    setError(ok ? null : 'Allowlist root does not match.');
    if (ok) setToast('Pass. Membership only.');
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
    const addressBefore = (joinInput || contractAddress).trim();
    if (addressBefore) return;
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

  const isConnected = walletState === 'connected';

  const sendFeedback = async () => {
    if (feedbackStatus === 'sending') return;
    if (rating < 1 && !confused.trim() && !wish.trim()) {
      setFeedbackStatus('error');
      setFeedbackError('Add a rating or a note.');
      return;
    }
    setFeedbackStatus('sending');
    setFeedbackError(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: rating >= 1 ? rating : undefined,
          confused,
          add: wish,
          xHandle,
          walletAddress: address ?? undefined,
          page: window.location.pathname,
          desk: deskMode,
          website,
        }),
      });
      const type = res.headers.get('content-type') ?? '';
      const body = type.includes('application/json') ? await res.json().catch(() => null) : null;
      if (!res.ok || !type.includes('application/json')) {
        const message = body && typeof body.error === 'string'
          ? body.error
          : 'Feedback could not be saved. Try again later.';
        setFeedbackStatus('error');
        setFeedbackError(message);
        return;
      }
      localStorage.setItem('tally.feedbackDone', '1');
      setRating(0);
      setConfused('');
      setWish('');
      setXHandle('');
      setWebsite('');
      setFeedbackStatus('sent');
      setFeedbackThanks(true);
      setAskFeedback(false);
      setFeedbackOpen(false);
    } catch {
      setFeedbackStatus('error');
      setFeedbackError('Feedback could not be saved. Try again later.');
    }
  };

  const actionHint =
    role === 'lender'
      ? selected?.status === 'Accepted'
        ? 'Send funds when the loan is accepted.'
        : selected?.status === 'Repaid'
          ? 'Settle when the loan is repaid.'
          : selected?.status === 'Settled'
            ? 'Prove good record when the loan is settled.'
            : 'Offer starts the loan. Later actions unlock by step.'
      : role === 'borrower'
        ? selected?.status === 'Offered'
          ? 'Accept when the loan is offered.'
          : selected?.status === 'Funded'
            ? 'Repay when funds have been sent.'
            : selected?.status === 'Repaid'
              ? 'Settle when the loan is repaid.'
              : selected?.status === 'Settled'
                ? 'Prove good record when the loan is settled.'
                : 'Actions unlock when the loan reaches the right step.'
        : null;

  const connectControl = isConnected && address ? (
    <button
      type="button"
      className="chip"
      onClick={() => void copyToClipboard(address).then((ok) => ok && setToast('Address copied.'))}
      aria-label="Copy connected address"
    >
      {trunc(address)}
    </button>
  ) : (
    <button
      type="button"
      className="btn nav-connect"
      ref={headerConnectRef}
      onClick={(event) => beginConnect(event.currentTarget)}
    >
      {walletState === 'connecting' ? 'Connecting…' : 'Connect wallet'}
    </button>
  );

  return (
    <div className="desk">
      <header className="mast site-nav">
        <div className="brand">
          <img src="/tally-stick.svg" alt="" width={18} height={60} />
          <h1>Tally</h1>
        </div>
        <button
          type="button"
          className="nav-menu"
          aria-expanded={navOpen}
          aria-controls="site-links"
          onClick={() => setNavOpen((open) => !open)}
        >
          Menu
        </button>
        <nav id="site-links" className={navOpen ? 'site-links open' : 'site-links'}>
          <a href="#how-it-works" onClick={() => setNavOpen(false)}>How it works</a>
          <a href={DOCS_HOME} target="_blank" rel="noreferrer">Docs</a>
          <a href={GITHUB_REPO} target="_blank" rel="noreferrer">GitHub</a>
          {connectControl}
        </nav>
      </header>

      <section className="landing">
        <div className="landing-copy">
          <p className="live-pill"><span className="live-dot" aria-hidden="true" />Live on Midnight Preprod</p>
          <h2>
            <span className="line-cream">Lend to people you know.</span>
            <span className="line-tan">Keep the numbers private.</span>
          </h2>
          <p>
            Tally records every step of a loan on chain, but the amount and due date stay hidden. When it&apos;s repaid, you can prove your good record with a simple Pass, nothing else.
          </p>
          <div className="landing-actions">
            <button type="button" className="btn primary" onClick={openDemo}>Try the demo, no wallet needed</button>
            {!isConnected && (
              <button type="button" className="btn" onClick={(event) => beginConnect(event.currentTarget)}>Use with a wallet</button>
            )}
          </div>
          <p className="trust-line">Open source · Built on Midnight · Listed in Midnight&apos;s Awesome DApps</p>
        </div>
        <figure className="sample-loan">
          <div className="sample-card">
            <div className="sample-top">
              <span>Loan #12</span>
              <span className="seal settled">Settled</span>
            </div>
            <p className="sample-names">Ada <span aria-hidden="true">→</span> Koii</p>
            <p className="sample-note"><span>Public on chain</span><span>Private to you two</span></p>
            <dl>
              <div><dt>Lender</dt><dd>0e5f…6ba2</dd></div>
              <div><dt>Borrower</dt><dd>7a1c…b00f</dd></div>
              <div><dt>Amount</dt><dd className="sample-secret"><span className="blurred">48,000</span><span className="hidden-tag">Hidden</span></dd></div>
              <div><dt>Due date</dt><dd className="sample-secret"><span className="blurred">30 days</span><span className="hidden-tag">Hidden</span></dd></div>
            </dl>
            <ol className="sample-track">
              <li>Offer</li><li>Accept</li><li>Send</li><li>Repay</li><li>Settle</li>
            </ol>
            <div className="sample-pass">
              <div>
                <strong>Repayment record</strong>
                <span>Proven without amounts or dates.</span>
              </div>
              <span className="seal settled">Pass</span>
            </div>
          </div>
          <figcaption>The other half stays private.</figcaption>
        </figure>
      </section>

      <GrainFlap />

      <div className="trust-strip" role="status">
        <span>{deskMode === 'chain' ? 'Midnight Preprod' : 'Demo'}</span>
        <span className="trust-sep" aria-hidden="true">·</span>
        <DeskIdCopy value={deskIdHex} />
        <span className="trust-sep" aria-hidden="true">·</span>
        <button type="button" className="tech-toggle" onClick={() => setShowStatusTech((open) => !open)}>
          {showStatusTech ? 'Hide technical details' : 'Show technical details'}
        </button>
        <a href={PRIVACY_DOC} target="_blank" rel="noreferrer">Privacy</a>
      </div>
      {showStatusTech && (
        <div className="tech-row">
          <span>Loan book</span>
          {contractAddress
            ? <CopyableId value={contractAddress} label="loan book address" />
            : <span className="quiet">No loan book joined</span>}
        </div>
      )}
      {testerSaveError && <p className="feedback-msg error" role="alert">{testerSaveError}</p>}

      {isConnected && deskMode === 'chain' && testerConsent === null && (
        <section className="tester-banner" aria-labelledby="consent-title">
          <div>
            <h2 id="consent-title">Want to be listed as an early tester?</h2>
            <p>We&apos;ll show your public wallet address on our testers list. Only your address, nothing else.</p>
          </div>
          <div className="tester-banner-actions">
            <button type="button" className="btn primary" onClick={() => {
              localStorage.setItem(CONSENT_KEY, 'yes');
              setTesterConsent('yes');
            }}>Yes, list me</button>
            <button type="button" className="tester-dismiss" onClick={() => {
              localStorage.setItem(CONSENT_KEY, 'no');
              setTesterConsent('no');
            }}>No thanks</button>
          </div>
        </section>
      )}

      {deskMode === 'chain' && (
        <form
          className="join-rail"
          onSubmit={(event) => {
            event.preventDefault();
            onJoin();
          }}
          aria-label="Join Preprod contract"
        >
          <button
            type="button"
            className="tech-toggle advanced-toggle"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((open) => !open)}
          >
            {showAdvanced ? 'Hide advanced' : 'Advanced'}
          </button>
          {showAdvanced && (
            <>
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
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="join-actions">
                <button type="submit" className="btn">Use shared loan book</button>
                {SHOW_DEPLOY && (
                  <button type="button" className="btn" onClick={deploy} disabled={!isConnected || !!busy}>Deploy</button>
                )}
                <button
                  type="button"
                  className="btn"
                  onClick={() => contractAddress && copyToClipboard(contractAddress).then((ok) => ok && flashContract())}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </>
          )}
        </form>
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
            {deskMode === 'chain' ? 'Midnight Preprod' : 'Demo only. Not recorded on Preprod.'}
          </p>
        </div>

        <div className="toolbar-block">
          <div className="seg" role="group" aria-label="Role">
            <button type="button" className={role === 'lender' ? 'on' : ''} onClick={() => setRole('lender')}>Lender</button>
            <button type="button" className={role === 'borrower' ? 'on' : ''} onClick={() => setRole('borrower')}>Borrower</button>
            <button type="button" className={role === 'verifier' ? 'on' : ''} onClick={() => setRole('verifier')}>Check a record</button>
          </div>
          <p className="seg-caption">
            You are acting as {role === 'lender' ? 'Lender' : role === 'borrower' ? 'Borrower' : 'someone checking a record'}.
          </p>
        </div>
      </div>

      <main className="layout" id="desk" ref={deskAnchorRef}>
        <aside className="list">
          <p className="eyebrow">Desk</p>
          {deskMode === 'local' && (
            <p className="quiet list-note">This demo stays in the browser. It is not recorded on Preprod.</p>
          )}
          <form
            className="loan-find"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setAppliedLoanQuery(loanQuery);
              setVisibleCount(LOAN_PAGE);
            }}
          >
            <input
              value={loanQuery}
              onChange={(e) => setLoanQuery(e.target.value)}
              placeholder="Loan id or private ID"
              aria-label="Loan id or private ID"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="loan-find-submit" aria-label="Search">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="6.75" cy="6.75" r="4.25" stroke="currentColor" strokeWidth="1.25" />
                <path d="M10.15 10.15L13.4 13.4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
              </svg>
            </button>
          </form>
          {loans.length === 0 ? (
            <>
              <p className="quiet">No loans yet.</p>
              <p className="quiet">Fill in an amount and a due date, then press Offer. On Local desk you don&apos;t need a wallet.</p>
            </>
          ) : matchedLoans.length === 0 ? (
            <p className="quiet">No matching loan.</p>
          ) : (
            <>
              {visibleLoans.map((loan) => (
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
              ))}
              {visibleCount < matchedLoans.length && (
                <button
                  type="button"
                  className="btn list-more"
                  onClick={() => setVisibleCount((count) => count + LOAN_PAGE)}
                >
                  Show more
                </button>
              )}
            </>
          )}
        </aside>

        <article className="instrument">
          <p className="eyebrow">Loan</p>
          {selected ? (
            <>
              <div className="head-row">
                <h3>Loan {selected.id}</h3>
                <span className={`seal ${selected.status.toLowerCase()}`} aria-label={`Status ${selected.status}`}>{selected.status}</span>
              </div>
              <button type="button" className="tech-toggle" onClick={() => setShowTech((open) => !open)}>
                {showTech ? 'Hide technical details' : 'Show technical details'}
              </button>
              {showTech && (
                <dl className="tech-dl">
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
                        ? <CopyableId value={selected.paymentCommit} label="payment" />
                        : '—'}
                    </dd>
                  </div>
                </dl>
              )}
              <dl>
                <div>
                  <dt>Amount</dt>
                  <dd className="quiet">Hidden</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="quiet">Offer a loan to begin.</p>
          )}

          {role === 'lender' && (
            <div className="fields">
              <label>
                Amount
                <span className="field-hint">required · Hidden</span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  required
                />
              </label>
              <label>
                Due in days
                <span className="field-hint">Hidden · default 30</span>
                <input value={due} onChange={(e) => setDue(e.target.value)} inputMode="numeric" placeholder="30" />
              </label>
              {deskMode === 'chain' && (
                <label>
                  Borrower private ID
                  <span className="field-hint">their private ID · not a wallet address</span>
                  <input value={borrowerPk} onChange={(e) => setBorrowerPk(e.target.value)} placeholder="their private ID" />
                </label>
              )}
              <label>
                Payment
                <input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="Lace payment id" />
              </label>
              <div className="actions">
                <button type="button" className="btn primary" disabled={!!busy} onClick={onOffer}>Offer</button>
                {loans.length > 0 && (
                  <>
                    <button type="button" className="btn primary" disabled={!!busy || selected?.status !== 'Accepted'} onClick={onDisburse}>Send funds</button>
                    <button type="button" className="btn" disabled={!!busy || selected?.status !== 'Repaid'} onClick={onSettle}>Settle</button>
                    <button type="button" className="btn" disabled={!!busy || selected?.status !== 'Settled'} onClick={onProveStanding}>Prove good record</button>
                  </>
                )}
              </div>
              {loans.length === 0 ? (
                <p className="quiet">Fill in an amount and a due date, then press Offer. On Local desk you don&apos;t need a wallet.</p>
              ) : actionHint && <p className="action-hint">{actionHint}</p>}
            </div>
          )}

          {role === 'borrower' && loans.length > 0 && (
            <div className="fields">
              <div className="actions">
                <button type="button" className="btn primary" disabled={!!busy || selected?.status !== 'Offered'} onClick={onAccept}>Accept</button>
                <button type="button" className="btn primary" disabled={!!busy || selected?.status !== 'Funded'} onClick={onRepay}>Repay</button>
                <button type="button" className="btn" disabled={!!busy || selected?.status !== 'Repaid'} onClick={onSettle}>Settle</button>
                <button type="button" className="btn" disabled={!!busy || selected?.status !== 'Settled'} onClick={onProveStanding}>Prove good record</button>
                <label>
                  N
                  <select
                    aria-label="Repaid count"
                    value={repaidCount}
                    onChange={(e) => setRepaidCount(Number(e.target.value))}
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </label>
                <button type="button" className="btn" disabled={!!busy} onClick={onProveRepaidCount}>Prove loans repaid</button>
              </div>
              {actionHint && <p className="action-hint">{actionHint}</p>}
            </div>
          )}

          {role === 'verifier' && (
            <div className="fields">
              {!standingRoot && !verifyRootInput && !loans.some((l) => l.status === 'Settled') ? (
                <p className="quiet verifier-empty">
                  No settled loan yet. Finish Offer through Settle, prove a good record, then come back here.
                </p>
              ) : (
                <p className="quiet">
                  You only learn yes or no. Not the amount, the due date, or which loan.
                </p>
              )}
              {showTech && (
                <label>
                  Allowlist root
                  <input
                    value={verifyRootInput || standingRoot || ''}
                    onChange={(e) => setVerifyRootInput(e.target.value)}
                    placeholder="root from a good-record proof"
                    aria-label="Allowlist root"
                  />
                </label>
              )}
              {!showTech && (
                <button type="button" className="tech-toggle" onClick={() => setShowTech(true)}>Show technical details</button>
              )}
              <dl>
                <div>
                  <dt>Record</dt>
                  <dd>
                    {standingResult === 'pass' && <span className="seal settled" aria-label="Standing pass">Pass</span>}
                    {standingResult === 'fail' && <span className="seal vacant" aria-label="Standing fail">Fail</span>}
                    {!standingResult && '—'}
                  </dd>
                </div>
              </dl>
              <div className="actions">
                <button type="button" className="btn primary" disabled={!!busy} onClick={onVerifyStanding}>Check record</button>
              </div>
              <label>
                At least this many repaid
                <select
                  aria-label="At least this many repaid"
                  value={repaidCount}
                  onChange={(e) => setRepaidCount(Number(e.target.value))}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </label>
              <p className="quiet">You learn yes or no for this count, not which loans.</p>
              <dl>
                <div>
                  <dt>Repaid count</dt>
                  <dd>
                    {countResult === 'pass' && <span className="seal settled" aria-label="Repaid count pass">Pass</span>}
                    {countResult === 'fail' && <span className="seal vacant" aria-label="Repaid count fail">Fail</span>}
                    {!countResult && '—'}
                  </dd>
                </div>
              </dl>
              <div className="actions">
                <button type="button" className="btn" disabled={!!busy} onClick={onCheckRepaidCount}>Check repaid count</button>
              </div>
            </div>
          )}

          {(role === 'lender' || role === 'borrower') && (
            <div className="standing-panel" aria-live="polite">
              {busy === 'Proving standing…' && <p className="quiet busy-line">Proving good record…</p>}
              {standingResult === 'pass' && (
                <>
                  <p className="standing-line">
                    <span className="seal settled" aria-label="Record confirmed">Record confirmed</span>
                  </p>
                  {showTech && standingRoot && (
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
              {busy === 'Proving repaid count…' && <p className="quiet busy-line">Proving repaid count…</p>}
              {countResult === 'pass' && (
                <p className="standing-line">
                  <span className="seal settled" aria-label="Repaid count pass">Pass</span>
                </p>
              )}
              {countResult === 'fail' && (
                <p className="standing-line">
                  <span className="seal vacant" aria-label="Repaid count fail">Fail</span>
                </p>
              )}
            </div>
          )}

          {busy && busy !== 'Proving standing…' && busy !== 'Proving repaid count…' && (
            <p className="quiet busy-line" aria-live="polite">{busy}</p>
          )}
        </article>
      </main>

      {feedbackVisible && (
        <section
          className="start-card feedback-card"
          aria-labelledby="feedback-title"
          ref={feedbackPanelRef}
          tabIndex={-1}
        >
          <div className="feedback-head">
            <h2 id="feedback-title">Feedback</h2>
            <button type="button" className="btn" onClick={() => {
              setAskFeedback(false);
              setFeedbackOpen(false);
            }}>Close</button>
          </div>
          <p className="quiet" id="rating-question">How easy was Tally to use today?</p>
          <div className="rating-row" role="group" aria-labelledby="rating-question">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={rating === n ? 'btn rating-on' : 'btn'}
                aria-pressed={rating === n}
                aria-label={`Rate ${n} out of 5`}
                onClick={() => setRating(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="rating-ends">
            <span>1 = Very hard</span>
            <span>5 = Very easy</span>
          </div>
          <label>
            Anything confusing?
            <span className="feedback-optional">optional</span>
            <input maxLength={1000} value={confused} onChange={(e) => setConfused(e.target.value)} />
            {confused.length > 900 && <span className="quiet">{confused.length} / 1000</span>}
          </label>
          <label>
            What would you like us to add?
            <span className="feedback-optional">optional</span>
            <input maxLength={1000} value={wish} onChange={(e) => setWish(e.target.value)} />
            {wish.length > 900 && <span className="quiet">{wish.length} / 1000</span>}
          </label>
          <label>
            X handle, optional
            <input maxLength={16} value={xHandle} onChange={(e) => setXHandle(e.target.value)} placeholder="@name" />
          </label>
          <div className="hp">
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          <button
            type="button"
            className="btn primary"
            disabled={feedbackStatus === 'sending' || (rating < 1 && !confused.trim() && !wish.trim())}
            onClick={() => void sendFeedback()}
          >
            {feedbackStatus === 'sending' ? 'Sending…' : 'Send'}
          </button>
          {feedbackStatus === 'sending' && <p className="quiet busy-line">Sending…</p>}
          {feedbackStatus === 'error' && feedbackError && (
            <p className="feedback-msg error" role="alert">{feedbackError}</p>
          )}
        </section>
      )}

      <section className="how" id="how-it-works">
        <p className="eyebrow">For judges</p>
        <h2>How it works</h2>
        <dl>
          <div>
            <dt>Compact circuits</dt>
            <dd>Each loan step is a circuit. The chain records the step. The amount stays off the public row.</dd>
          </div>
          <div>
            <dt>Witnesses</dt>
            <dd>Amount and due date are private inputs. The proof checks them. The public loan does not store them.</dd>
          </div>
          <div>
            <dt>Merkle allowlist</dt>
            <dd>A settled repayment can join a private list. A later proof shows membership without naming the loan.</dd>
          </div>
          <div>
            <dt>Nullifiers</dt>
            <dd>Each repayment leaf can be added once. The nullifier stops the same loan being counted again.</dd>
          </div>
          <div>
            <dt className="plain-term">How your private ID is made</dt>
            <dd>
              A private name for you on Tally. It is not your wallet address.
              {' '}
              <PrivateIdDetail />
            </dd>
          </div>
        </dl>
      </section>

      <footer className="site-foot">
        <div className="foot-brand">
          <img src="/tally-stick.svg" alt="" width={18} height={60} />
          <strong>Tally</strong>
        </div>
        <nav className="foot-links" aria-label="Footer">
          <a href={DOCS_HOME} target="_blank" rel="noreferrer">Docs</a>
          <a href={GITHUB_REPO} target="_blank" rel="noreferrer">GitHub</a>
          <a href={X_PROFILE} target="_blank" rel="noreferrer">X</a>
          <a href={MIDNIGHT_HOME} target="_blank" rel="noreferrer">Built on Midnight</a>
        </nav>
        <div className="foot-actions">
          {feedbackThanks && (
            <p className="feedback-thanks" role="status">Thanks, we read every note.</p>
          )}
          {!feedbackVisible && (
            <button
              type="button"
              className="btn"
              ref={feedbackButtonRef}
              onClick={() => {
                setFeedbackStatus('idle');
                setFeedbackError(null);
                setFeedbackThanks(false);
                setFeedbackOpen(true);
              }}
            >
              Feedback
            </button>
          )}
        </div>
        <p className="foot-meta">Apache-2.0 · Running on Midnight Preprod</p>
      </footer>

      {walletModal && (
        <div className="wallet-backdrop" onClick={closeWalletModal}>
          <div
            id="wallet-modal"
            className="wallet-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-x" onClick={closeWalletModal} aria-label="Close">×</button>
            {walletModal === 'chooser' ? (
              <>
                <h2 id="wallet-modal-title">Choose a wallet</h2>
                <p>
                  {walletOptions.some((option) => option.product === '1am') && walletOptions.some((option) => option.product === 'lace')
                    ? 'Two Midnight wallets are installed in this browser.'
                    : 'Continue with the wallet in this browser, or install the other one.'}
                </p>
                <div className="wallet-rows">
                  <WalletChoice
                    option={walletOptions.find((option) => option.product === '1am')}
                    installHref={ONEAM_INSTALL}
                    installLabel="Install 1AM Wallet"
                    fallbackIcon="/wallets/1am.ico"
                    onConnect={connectWallet}
                  />
                  <WalletChoice
                    option={walletOptions.find((option) => option.product === 'lace')}
                    installHref={LACE_INSTALL}
                    installLabel="Install Lace Wallet"
                    fallbackIcon="/wallets/lace.png"
                    onConnect={connectWallet}
                  />
                  {walletOptions.filter((option) => option.product === 'other').map((option) => (
                    <WalletChoice key={option.id} option={option} onConnect={connectWallet} />
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 id="wallet-modal-title">Connect a Midnight wallet</h2>
                <p>We couldn&apos;t find a wallet in this browser. Install one to continue, then refresh this page.</p>
                <div className="wallet-rows">
                  <a className="wallet-row" href={ONEAM_INSTALL} target="_blank" rel="noreferrer">
                    <img src="/wallets/1am.ico" alt="" width={32} height={32} />
                    <span>
                      <strong>Install 1AM Wallet</strong>
                      <small>Midnight wallet</small>
                    </span>
                    <span className="wallet-arrow" aria-hidden="true">→</span>
                  </a>
                  <a className="wallet-row" href={LACE_INSTALL} target="_blank" rel="noreferrer">
                    <img src="/wallets/lace.png" alt="" width={32} height={32} />
                    <span>
                      <strong>Install Lace Wallet</strong>
                      <small>Midnight wallet</small>
                    </span>
                    <span className="wallet-arrow" aria-hidden="true">→</span>
                  </a>
                </div>
                <button type="button" className="demo-link" onClick={openDemo}>No wallet? Try the demo instead</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
