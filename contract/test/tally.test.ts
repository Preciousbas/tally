import { describe, it, expect, beforeEach } from 'vitest';
import { LoanStatus, TallySimulator } from '../src/tally-simulator';

describe('Tally identity', () => {
  it('derives a stable public key from secret + PIN', () => {
    const sim = new TallySimulator();
    const sk = new Uint8Array(32).fill(7);
    const a = sim.deriveUserPublicKey(sk, 1234);
    const b = sim.deriveUserPublicKey(sk, 1234);
    expect(a).toEqual(b);
    expect(a).not.toEqual(sim.deriveUserPublicKey(sk, 1235));
    expect(a).not.toEqual(sim.deriveUserPublicKey(new Uint8Array(32).fill(8), 1234));
  });
});

describe('Tally loan lifecycle', () => {
  let sim: TallySimulator;
  let lenderSk: Uint8Array;
  let borrowerSk: Uint8Array;
  let strangerSk: Uint8Array;
  const pin = 1234;
  let borrowerPk: Uint8Array;
  const grain = new Uint8Array(32).fill(9);

  beforeEach(() => {
    sim = new TallySimulator();
    lenderSk = new Uint8Array(32).fill(1);
    borrowerSk = new Uint8Array(32).fill(2);
    strangerSk = new Uint8Array(32).fill(3);
    borrowerPk = sim.deriveUserPublicKey(borrowerSk, pin);
  });

  it('originates Offered without storing amount', () => {
    const id = sim.offerLoan(lenderSk, pin, borrowerPk, 50n, 99n);
    const loan = sim.loans.get(id)!;
    expect(loan.status).toBe(LoanStatus.Offered);
    expect(loan.paymentCommit.every((b) => b === 0)).toBe(true);
    expect((loan as unknown as { amount?: bigint }).amount).toBeUndefined();
  });

  it('rejects zero amount and self-lend', () => {
    expect(() => sim.offerLoan(lenderSk, pin, borrowerPk, 0n, 1n)).toThrow('amount must be positive');
    const lenderPk = sim.deriveUserPublicKey(lenderSk, pin);
    expect(() => sim.offerLoan(lenderSk, pin, lenderPk, 10n, 1n)).toThrow('cannot lend to self');
  });

  it('accepts only the named borrower', () => {
    const id = sim.offerLoan(lenderSk, pin, borrowerPk, 50n, 1n);
    expect(() => sim.acceptLoan(strangerSk, pin, id)).toThrow('not the borrower');
    expect(() => sim.acceptLoan(lenderSk, pin, id)).toThrow('not the borrower');
    sim.acceptLoan(borrowerSk, pin, id);
    expect(sim.loans.get(id)!.status).toBe(LoanStatus.Accepted);
  });

  it('disburses only after accept, with a payment grain, as the lender', () => {
    const id = sim.offerLoan(lenderSk, pin, borrowerPk, 50n, 1n);
    expect(() => sim.disburse(lenderSk, pin, id, grain)).toThrow('loan is not accepted');
    sim.acceptLoan(borrowerSk, pin, id);
    expect(() => sim.disburse(borrowerSk, pin, id, grain)).toThrow('not the lender');
    expect(() => sim.disburse(lenderSk, pin, id, new Uint8Array(32))).toThrow('payment grain required');
    sim.disburse(lenderSk, pin, id, grain);
    const loan = sim.loans.get(id)!;
    expect(loan.status).toBe(LoanStatus.Funded);
    expect(loan.paymentCommit).toEqual(grain);
  });

  it('repays as borrower then settles once, inserting a relationship leaf', () => {
    const id = sim.offerLoan(lenderSk, pin, borrowerPk, 50n, 1n);
    sim.acceptLoan(borrowerSk, pin, id);
    sim.disburse(lenderSk, pin, id, grain);
    expect(() => sim.repay(lenderSk, pin, id)).toThrow('not the borrower');
    sim.repay(borrowerSk, pin, id);
    expect(sim.loans.get(id)!.status).toBe(LoanStatus.Repaid);
    const rootBefore = sim.relationshipRoot();
    sim.settle(borrowerSk, pin, id);
    expect(sim.loans.get(id)!.status).toBe(LoanStatus.Settled);
    expect(sim.relationshipLeaves.length).toBe(1);
    expect(sim.relationshipRoot()).not.toBe(rootBefore);
    expect(() => sim.settle(lenderSk, pin, id)).toThrow('loan is not repaid');
  });

  it('rejects a second settle via nullifier when status is forced', () => {
    const id = sim.offerLoan(lenderSk, pin, borrowerPk, 50n, 1n);
    sim.acceptLoan(borrowerSk, pin, id);
    sim.disburse(lenderSk, pin, id, grain);
    sim.repay(borrowerSk, pin, id);
    sim.settle(lenderSk, pin, id);
    sim.loans.get(id)!.status = LoanStatus.Repaid;
    expect(() => sim.settle(lenderSk, pin, id)).toThrow('already settled');
  });
});

describe('Tally proveStanding (Private Allowlist Access)', () => {
  let sim: TallySimulator;
  let lenderSk: Uint8Array;
  let borrowerSk: Uint8Array;
  let strangerSk: Uint8Array;
  const pin = 1234;
  let borrowerPk: Uint8Array;
  let lenderPk: Uint8Array;
  const grain = new Uint8Array(32).fill(9);

  const settleOnce = () => {
    const id = sim.offerLoan(lenderSk, pin, borrowerPk, 50n, 1n);
    sim.acceptLoan(borrowerSk, pin, id);
    sim.disburse(lenderSk, pin, id, grain);
    sim.repay(borrowerSk, pin, id);
    sim.settle(borrowerSk, pin, id);
    return id;
  };

  beforeEach(() => {
    sim = new TallySimulator();
    lenderSk = new Uint8Array(32).fill(1);
    borrowerSk = new Uint8Array(32).fill(2);
    strangerSk = new Uint8Array(32).fill(3);
    borrowerPk = sim.deriveUserPublicKey(borrowerSk, pin);
    lenderPk = sim.deriveUserPublicKey(lenderSk, pin);
  });

  it('proves standing for a settled party without exposing amount', () => {
    const id = settleOnce();
    const proof = sim.proveStanding(borrowerSk, pin, id);
    expect(proof.ok).toBe(true);
    expect(proof.root).toBe(sim.relationshipRoot());
    expect(sim.verifyStanding(proof.root)).toBe(true);
    expect(sim.proveStanding(lenderSk, pin, id, borrowerPk).ok).toBe(true);
  });

  it('rejects a non-member stranger or unsettled loan', () => {
    const id = settleOnce();
    expect(() => sim.proveStanding(strangerSk, pin, id)).toThrow('not a party to this loan');
    expect(() => sim.proveStanding(borrowerSk, pin, id, sim.deriveUserPublicKey(strangerSk, pin))).toThrow(
      'not on allowlist',
    );
    const openId = sim.offerLoan(lenderSk, pin, borrowerPk, 10n, 1n);
    expect(() => sim.proveStanding(lenderSk, pin, openId)).toThrow('loan is not settled');
  });

  it('rejects a wrong claimed root; verifier learns yes or no only', () => {
    const id = settleOnce();
    expect(() => sim.proveStanding(borrowerSk, pin, id, lenderPk, '00'.repeat(32))).toThrow('wrong root');
    const proof = sim.proveStanding(lenderSk, pin, id);
    expect(sim.verifyStanding(proof.root)).toBe(true);
    expect(sim.verifyStanding('deadbeef')).toBe(false);
  });
});
