import { useState, useEffect, useCallback, useRef } from 'react';
import type { InitialAPI, ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { useTally } from './hooks/useTally';
import { BrowserTallyManager } from './contexts/BrowserTallyManager';
import { TallySimulator } from '../../contract/src/tally-simulator';
import pino from 'pino';
import type { PublicLoan } from '../../api/src/common-types';
import { findCompatibleWallet, listCompatibleWallets, type WalletOption } from './wallets';

const NETWORK_ID = import.meta.env.VITE_NETWORK_ID ?? 'preprod';
const DEFAULT_CONTRACT = import.meta.env.VITE_DEFAULT_CONTRACT ?? '';

type WalletState = 'detecting' | 'no-wallet' | 'ready' | 'connecting' | 'connected';
type Role = 'lender' | 'borrower' | 'verifier';
type StandingResult = 'pass' | 'fail' | null;

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
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
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

const GRAIN_KEY = 'tally.stickCut';

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
      /* ignore quota / private mode */
    }
  }, []);

  const toggle = () => setOpen((prev) => !prev);

  return (
    <section className={`flap${open ? ' open' : ''}`}>
      <button type="button" className="flap-tab" onClick={toggle} aria-expanded={open}>
        How a stick is cut
        <span className="flap-mark" aria-hidden="true" />
      </button>
      <div className="flap-body">
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

export default function App() {
  const [walletState, setWalletState] = useState<WalletState>('detecting');
  const [walletOptions, setWalletOptions] = useState<WalletOption[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [walletAPI, setWalletAPI] = useState<InitialAPI | undefined>();
  const [wallet, setWallet] = useState<ConnectedAPI | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT);
  const [joinInput, setJoinInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [contractFlash, setContractFlash] = useState(false);
  const [role, setRole] = useState<Role>('lender');
  const [borrowerPk, setBorrowerPk] = useState('');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [localLoans, setLocalLoans] = useState<PublicLoan[]>([]);
  const [deskMode, setDeskMode] = useState<'chain' | 'local'>('chain');
  const [standingRoot, setStandingRoot] = useState<string | null>(null);
  const [standingResult, setStandingResult] = useState<StandingResult>(null);
  const [verifyRootInput, setVerifyRootInput] = useState('');

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
    if (!selectedWalletId) {
      setWalletAPI(undefined);
      return;
    }
    const pick = walletOptions.find((w) => w.id === selectedWalletId) ?? walletOptions[0];
    if (pick) setWalletAPI(pick.api);
  }, [selectedWalletId, walletOptions]);

  useEffect(() => {
    if (!copied && !contractFlash) return;
    const t = window.setTimeout(() => {
      setCopied(false);
      setContractFlash(false);
    }, 2200);
    return () => window.clearTimeout(t);
  }, [copied, contractFlash]);

  const flashContract = useCallback(() => {
    setContractFlash(true);
    setCopied(true);
  }, []);

  const connect = useCallback(async () => {
    if (!walletAPI) return;
    setWalletState('connecting');
    setError(null);
    try {
      getManager().setPreferredWallet(walletAPI);
      const c = await walletAPI.connect(NETWORK_ID);
      setWallet(c);
      const { unshieldedAddress } = await c.getUnshieldedAddress();
      setAddress(unshieldedAddress);
      setWalletState('connected');
    } catch (e) {
      setError(friendlyError(e));
      setWalletState('ready');
    }
  }, [walletAPI, getManager]);

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
    if (next.length) setSelectedId(next[next.length - 1].id);
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

  const onOffer = async () => {
    if (deskMode === 'local') {
      const pk = simRef.current.deriveUserPublicKey(keysRef.current.borrower, 1234);
      runLocal(() => {
        simRef.current.offerLoan(keysRef.current.lender, 1234, pk, BigInt(amount || '1'), BigInt(due || '30'));
      });
      return;
    }
    if (!wallet) return;
    setBusy('Offering');
    try {
      const result = await resolveApi();
      if (!contractAddress) setContractAddress(result.api.deployedContractAddress);
      await result.api.offerLoan(borrowerPk, BigInt(amount || '1'), BigInt(due || '30'));
      setTimeout(() => refresh(), 2500);
    } catch (e) { setError(friendlyError(e)); }
    finally { setBusy(null); }
  };

  const onAccept = async () => {
    if (!selected) return;
    if (deskMode === 'local') {
      runLocal(() => simRef.current.acceptLoan(keysRef.current.borrower, 1234, BigInt(selected.id)));
      return;
    }
    setBusy('Accepting');
    try {
      const result = await resolveApi();
      await result.api.acceptLoan(selected.id);
      setTimeout(() => refresh(), 2500);
    } catch (e) { setError(friendlyError(e)); }
    finally { setBusy(null); }
  };

  const onDisburse = async () => {
    if (!selected) return;
    const grain = hashGrain(paymentRef || `tally-preprod-${selected.id}-${Date.now()}`);
    if (deskMode === 'local') {
      const bytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) bytes[i] = parseInt(grain.slice(i * 2, i * 2 + 2), 16);
      runLocal(() => simRef.current.disburse(keysRef.current.lender, 1234, BigInt(selected.id), bytes));
      return;
    }
    setBusy('Disbursing');
    try {
      const result = await resolveApi();
      await result.api.disburse(selected.id, grain);
      setTimeout(() => refresh(), 2500);
    } catch (e) { setError(friendlyError(e)); }
    finally { setBusy(null); }
  };

  const onRepay = async () => {
    if (!selected) return;
    if (deskMode === 'local') {
      runLocal(() => simRef.current.repay(keysRef.current.borrower, 1234, BigInt(selected.id)));
      return;
    }
    setBusy('Repaying');
    try {
      const result = await resolveApi();
      await result.api.repay(selected.id);
      setTimeout(() => refresh(), 2500);
    } catch (e) { setError(friendlyError(e)); }
    finally { setBusy(null); }
  };

  const onSettle = async () => {
    if (!selected) return;
    if (deskMode === 'local') {
      runLocal(() => simRef.current.settle(keysRef.current.borrower, 1234, BigInt(selected.id)));
      return;
    }
    setBusy('Settling');
    try {
      const result = await resolveApi();
      await result.api.settle(selected.id);
      setTimeout(() => refresh(), 2500);
    } catch (e) { setError(friendlyError(e)); }
    finally { setBusy(null); }
  };

  const onProveStanding = async () => {
    if (!selected) return;
    setStandingResult(null);
    if (deskMode === 'local') {
      const sk = role === 'lender' ? keysRef.current.lender : keysRef.current.borrower;
      try {
        const proof = simRef.current.proveStanding(sk, 1234, BigInt(selected.id));
        setStandingRoot(proof.root);
        setVerifyRootInput(proof.root);
        setStandingResult('pass');
        setError(null);
      } catch (e) {
        setStandingRoot(null);
        setStandingResult('fail');
        setError(friendlyError(e));
      }
      return;
    }
    setBusy('Proving standing');
    try {
      const result = await resolveApi();
      const counterparty = role === 'lender' ? selected.borrowerPk : selected.lenderPk;
      // Prefer Local desk for the allowlist demo when Preprod proving is slow.
      await result.api.proveStanding(selected.id, counterparty, selected.paymentCommit);
      setStandingResult('pass');
      setStandingRoot(selected.paymentCommit);
      setVerifyRootInput(selected.paymentCommit);
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
      return;
    }
    const ok = !!standingRoot && claimed === standingRoot;
    setStandingResult(ok ? 'pass' : 'fail');
    setError(ok ? null : 'Allowlist root does not match.');
  };

  const deploy = async () => {
    if (!wallet || !walletAPI) return;
    setBusy('Deploying');
    try {
      getManager().setPreferredWallet(walletAPI);
      const result = await resolveApi();
      setContractAddress(result.api.deployedContractAddress);
      await copyToClipboard(result.api.deployedContractAddress);
      flashContract();
    } catch (e) { setError(friendlyError(e)); }
    finally { setBusy(null); }
  };

  const isConnected = walletState === 'connected';

  return (
    <div className="desk">
      <header className="mast">
        <div className="brand">
          <img src="/tally-stick.svg" alt="" width={18} height={60} />
          <h1>Tally</h1>
        </div>
        <div className="mast-actions">
          {walletOptions.length > 1 && walletState !== 'connected' && (
            <select
              className="wallet-select"
              value={selectedWalletId ?? ''}
              onChange={(e) => setSelectedWalletId(e.target.value)}
              disabled={walletState === 'connecting'}
            >
              {walletOptions.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          )}
          {isConnected && address ? (
            <span className="chip">{trunc(address)}</span>
          ) : walletState === 'no-wallet' ? (
            <span className="chip quiet">Install Lace or 1AM</span>
          ) : (
            <button className="btn primary" onClick={connect} disabled={walletState !== 'ready' || !walletAPI}>
              {walletState === 'connecting' ? 'Connecting' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </header>

      <section className="hero">
        <h2>The other half stays private.</h2>
        <p className="hero-sub">Amount and due stay off-ledger. The explorer sees status only.</p>
      </section>

      <GrainFlap />

      {error && (
        <div className="notice" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>Close</button>
        </div>
      )}

      <div className="toolbar">
        <div className="seg">
          <button className={deskMode === 'chain' ? 'on' : ''} onClick={() => setDeskMode('chain')}>Preprod</button>
          <button className={deskMode === 'local' ? 'on' : ''} onClick={() => setDeskMode('local')}>Local desk</button>
        </div>
        <div className="seg">
          <button className={role === 'lender' ? 'on' : ''} onClick={() => setRole('lender')}>Lender</button>
          <button className={role === 'borrower' ? 'on' : ''} onClick={() => setRole('borrower')}>Borrower</button>
          <button className={role === 'verifier' ? 'on' : ''} onClick={() => setRole('verifier')}>Verifier</button>
        </div>
        {deskMode === 'chain' && (
          <div className="join">
            <input
              className={contractFlash ? 'flash' : undefined}
              value={joinInput || contractAddress}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="Contract Address"
              aria-label="Contract address"
            />
            <button className="btn" onClick={() => setContractAddress(joinInput.trim())}>Join</button>
            <button className="btn" onClick={deploy} disabled={!isConnected || !!busy}>Deploy</button>
            <button
              className="btn"
              onClick={() => contractAddress && copyToClipboard(contractAddress).then((ok) => ok && flashContract())}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      <main className="layout">
        <aside className="list">
          <p className="eyebrow">Desk</p>
          {loans.length === 0 ? (
            <p className="quiet">No instruments yet.</p>
          ) : (
            loans.map((loan) => (
              <button
                key={loan.id}
                className={`row ${selected?.id === loan.id ? 'active' : ''}`}
                onClick={() => setSelectedId(loan.id)}
              >
                <span>#{loan.id}</span>
                <span className={`seal ${loan.status.toLowerCase()}`}>{loan.status}</span>
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
                <span className={`seal ${selected.status.toLowerCase()}`}>{selected.status}</span>
              </div>
              <dl>
                <div><dt>Lender id</dt><dd>{trunc(selected.lenderPk)}</dd></div>
                <div><dt>Borrower id</dt><dd>{trunc(selected.borrowerPk)}</dd></div>
                <div><dt>Payment</dt><dd>{selected.paymentCommit.replace(/0/g, '') ? trunc(selected.paymentCommit) : '—'}</dd></div>
                <div><dt>Amount</dt><dd className="quiet">off-ledger</dd></div>
              </dl>
            </>
          ) : (
            <p className="quiet">Offer a loan to cut the first stick.</p>
          )}

          {role === 'lender' && (
            <div className="fields">
              <label>
                Amount
                <span className="field-hint">stays off-ledger</span>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="how much" />
              </label>
              <label>
                Due in days
                <span className="field-hint">witness only</span>
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
                <button className="btn primary" disabled={!!busy} onClick={onOffer}>Offer</button>
                <button className="btn primary" disabled={!!busy || selected?.status !== 'Accepted'} onClick={onDisburse}>Disburse</button>
                <button className="btn" disabled={!!busy || selected?.status !== 'Repaid'} onClick={onSettle}>Settle</button>
                <button className="btn" disabled={!!busy || selected?.status !== 'Settled'} onClick={onProveStanding}>Prove standing</button>
              </div>
            </div>
          )}

          {role === 'borrower' && (
            <div className="actions">
              <button className="btn primary" disabled={!!busy || selected?.status !== 'Offered'} onClick={onAccept}>Accept</button>
              <button className="btn primary" disabled={!!busy || selected?.status !== 'Funded'} onClick={onRepay}>Repay</button>
              <button className="btn" disabled={!!busy || selected?.status !== 'Repaid'} onClick={onSettle}>Settle</button>
              <button className="btn" disabled={!!busy || selected?.status !== 'Settled'} onClick={onProveStanding}>Prove standing</button>
            </div>
          )}

          {role === 'verifier' && (
            <div className="fields">
              <p className="quiet">
                Third party check. You only learn yes or no — not amount, due, or which leaf.
              </p>
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
                    {standingResult === 'pass' && <span className="seal settled">Pass</span>}
                    {standingResult === 'fail' && <span className="seal vacant">Fail</span>}
                    {!standingResult && '—'}
                  </dd>
                </div>
              </dl>
              <div className="actions">
                <button className="btn primary" disabled={!!busy} onClick={onVerifyStanding}>Verify access</button>
              </div>
            </div>
          )}

          {(role === 'lender' || role === 'borrower') && standingResult && (
            <p className="standing-line" aria-live="polite">
              {standingResult === 'pass' ? (
                <span className="seal settled">Standing confirmed</span>
              ) : (
                <span className="seal vacant">Standing failed</span>
              )}
            </p>
          )}

          {busy && <p className="quiet busy-line" aria-live="polite">{busy}</p>}
        </article>
      </main>
    </div>
  );
}
