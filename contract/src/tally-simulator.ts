/**
 * TypeScript stand-in for tally.compact circuit logic.
 * Keep in lockstep with the Compact source.
 */

export enum LoanStatus {
  Vacant = 0,
  Offered = 1,
  Accepted = 2,
  Funded = 3,
  Repaid = 4,
  Settled = 5,
}

export interface LoanPublic {
  status: LoanStatus;
  lenderPk: Uint8Array;
  borrowerPk: Uint8Array;
  paymentCommit: Uint8Array;
}

const DOMAIN_PK = 'tally:user:pk:v1';
const DOMAIN_REL = 'tally:rel:v1:repaid';
const DOMAIN_NUL = 'tally:nul:v1';

export class TallySimulator {
  loans = new Map<bigint, LoanPublic>();
  nextId = 0n;
  relationshipLeaves: Uint8Array[] = [];
  nullifiers = new Set<string>();

  persistentHash(parts: Array<Uint8Array | string | bigint | number>): Uint8Array {
    const bytes = new Uint8Array(32);
    let h = 0n;
    const push = (b: number) => {
      h = (h * 31n + BigInt(b)) % 2n ** 252n;
    };
    for (const part of parts) {
      if (typeof part === 'string') {
        const enc = new TextEncoder().encode(part);
        for (const b of enc) push(b);
      } else if (typeof part === 'bigint' || typeof part === 'number') {
        let n = BigInt(part);
        for (let i = 0; i < 8; i++) {
          push(Number(n & 0xffn));
          n >>= 8n;
        }
      } else {
        for (const b of part) push(b);
      }
    }
    let x = h;
    for (let i = 31; i >= 0; i--) {
      bytes[i] = Number(x & 0xffn);
      x >>= 8n;
    }
    return bytes;
  }

  deriveUserPublicKey(sk: Uint8Array, pin: number): Uint8Array {
    const pinHash = this.persistentHash([BigInt(pin & 0xffff)]);
    return this.persistentHash([DOMAIN_PK, pinHash, sk]);
  }

  private hex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private requireLoan(loanId: bigint): LoanPublic {
    const loan = this.loans.get(loanId);
    if (!loan) throw new Error('loan not found');
    return loan;
  }

  offerLoan(sk: Uint8Array, pin: number, borrowerPk: Uint8Array, amount: bigint, due: bigint): bigint {
    if (amount <= 0n) throw new Error('amount must be positive');
    if (due <= 0n) throw new Error('due must be set');
    const lenderPk = this.deriveUserPublicKey(sk, pin);
    if (this.hex(lenderPk) === this.hex(borrowerPk)) throw new Error('cannot lend to self');
    this.nextId += 1n;
    const id = this.nextId;
    this.loans.set(id, {
      status: LoanStatus.Offered,
      lenderPk,
      borrowerPk,
      paymentCommit: new Uint8Array(32),
    });
    return id;
  }

  acceptLoan(sk: Uint8Array, pin: number, loanId: bigint): void {
    const loan = this.requireLoan(loanId);
    if (loan.status !== LoanStatus.Offered) throw new Error('loan is not offered');
    const caller = this.deriveUserPublicKey(sk, pin);
    if (this.hex(caller) !== this.hex(loan.borrowerPk)) throw new Error('not the borrower');
    if (this.hex(caller) === this.hex(loan.lenderPk)) throw new Error('cannot accept own offer');
    this.loans.set(loanId, { ...loan, status: LoanStatus.Accepted });
  }

  disburse(sk: Uint8Array, pin: number, loanId: bigint, paymentCommit: Uint8Array): void {
    const loan = this.requireLoan(loanId);
    if (loan.status !== LoanStatus.Accepted) throw new Error('loan is not accepted');
    const caller = this.deriveUserPublicKey(sk, pin);
    if (this.hex(caller) !== this.hex(loan.lenderPk)) throw new Error('not the lender');
    if (paymentCommit.every((b) => b === 0)) throw new Error('payment grain required');
    this.loans.set(loanId, { ...loan, status: LoanStatus.Funded, paymentCommit });
  }

  repay(sk: Uint8Array, pin: number, loanId: bigint): void {
    const loan = this.requireLoan(loanId);
    if (loan.status !== LoanStatus.Funded) throw new Error('loan is not funded');
    const caller = this.deriveUserPublicKey(sk, pin);
    if (this.hex(caller) !== this.hex(loan.borrowerPk)) throw new Error('not the borrower');
    this.loans.set(loanId, { ...loan, status: LoanStatus.Repaid });
  }

  settle(sk: Uint8Array, pin: number, loanId: bigint): void {
    const loan = this.requireLoan(loanId);
    if (loan.status !== LoanStatus.Repaid) throw new Error('loan is not repaid');
    const caller = this.deriveUserPublicKey(sk, pin);
    const isParty =
      this.hex(caller) === this.hex(loan.borrowerPk) || this.hex(caller) === this.hex(loan.lenderPk);
    if (!isParty) throw new Error('not a party to this loan');
    const nul = this.persistentHash([DOMAIN_NUL, loanId, loan.lenderPk, loan.borrowerPk]);
    const nulHex = this.hex(nul);
    if (this.nullifiers.has(nulHex)) throw new Error('already settled');
    this.nullifiers.add(nulHex);
    const leaf = this.persistentHash([DOMAIN_REL, loanId, loan.lenderPk, loan.borrowerPk]);
    this.relationshipLeaves.push(leaf);
    this.loans.set(loanId, { ...loan, status: LoanStatus.Settled });
  }

  /**
   * Private Allowlist Access — membership in settled relationships.
   * Returns yes/no without exposing amount or which leaf index.
   */
  proveStanding(sk: Uint8Array, pin: number, loanId: bigint): { ok: true; root: string } {
    const loan = this.requireLoan(loanId);
    if (loan.status !== LoanStatus.Settled) throw new Error('loan is not settled');
    const caller = this.deriveUserPublicKey(sk, pin);
    const isParty =
      this.hex(caller) === this.hex(loan.borrowerPk) || this.hex(caller) === this.hex(loan.lenderPk);
    if (!isParty) throw new Error('not a party to this loan');
    const leaf = this.persistentHash([DOMAIN_REL, loanId, loan.lenderPk, loan.borrowerPk]);
    const leafHex = this.hex(leaf);
    const onAllowlist = this.relationshipLeaves.some((l) => this.hex(l) === leafHex);
    if (!onAllowlist) throw new Error('not on allowlist');
    return { ok: true, root: this.relationshipRoot() };
  }

  /** Verifier view — only yes/no against a known allowlist root. */
  verifyStanding(proofRoot: string): boolean {
    return proofRoot === this.relationshipRoot() && this.relationshipLeaves.length > 0;
  }

  relationshipRoot(): string {
    return this.hex(this.persistentHash(this.relationshipLeaves));
  }
}
