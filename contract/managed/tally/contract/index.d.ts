import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum LoanStatus { Vacant = 0,
                         Offered = 1,
                         Accepted = 2,
                         Funded = 3,
                         Repaid = 4,
                         Settled = 5
}

export type Witnesses<PS> = {
  getUserSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  getPin(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  getLoanAmount(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  getDueSlot(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
}

export type ImpureCircuits<PS> = {
  offerLoan(context: __compactRuntime.CircuitContext<PS>,
            borrowerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  acceptLoan(context: __compactRuntime.CircuitContext<PS>, loanId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  disburse(context: __compactRuntime.CircuitContext<PS>,
           loanId_0: bigint,
           paymentCommit_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  repay(context: __compactRuntime.CircuitContext<PS>, loanId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  settle(context: __compactRuntime.CircuitContext<PS>, loanId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  offerLoan(context: __compactRuntime.CircuitContext<PS>,
            borrowerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  acceptLoan(context: __compactRuntime.CircuitContext<PS>, loanId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  disburse(context: __compactRuntime.CircuitContext<PS>,
           loanId_0: bigint,
           paymentCommit_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  repay(context: __compactRuntime.CircuitContext<PS>, loanId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  settle(context: __compactRuntime.CircuitContext<PS>, loanId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  offerLoan(context: __compactRuntime.CircuitContext<PS>,
            borrowerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  acceptLoan(context: __compactRuntime.CircuitContext<PS>, loanId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  disburse(context: __compactRuntime.CircuitContext<PS>,
           loanId_0: bigint,
           paymentCommit_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  repay(context: __compactRuntime.CircuitContext<PS>, loanId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  settle(context: __compactRuntime.CircuitContext<PS>, loanId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  loans: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): { status: LoanStatus,
                             lenderPk: Uint8Array,
                             borrowerPk: Uint8Array,
                             paymentCommit: Uint8Array
                           };
    [Symbol.iterator](): Iterator<[bigint, { status: LoanStatus,
  lenderPk: Uint8Array,
  borrowerPk: Uint8Array,
  paymentCommit: Uint8Array
}]>
  };
  readonly nextId: bigint;
  relationships: {
    isFull(): boolean;
    checkRoot(rt_0: { field: bigint }): boolean;
    root(): __compactRuntime.MerkleTreeDigest;
    firstFree(): bigint;
    pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
    findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined;
    history(): Iterator<__compactRuntime.MerkleTreeDigest>
  };
  nullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
