export type TallyPrivateState = {
  readonly secretKey: Uint8Array;
  readonly pin: number;
  readonly loanAmount: bigint;
  readonly dueSlot: bigint;
  /** Settled loan id for proveStanding (witness). */
  readonly standingLoanId: bigint;
  /** Counterparty pk for proveStanding (witness). */
  readonly standingCounterpartyPk: Uint8Array;
  /** Relationship leaf bytes for Merkle path lookup (witness). */
  readonly standingLeaf: Uint8Array;
};

export const createTallyPrivateState = (
  secretKey: Uint8Array,
  pin = 1234,
  loanAmount = 50n,
  dueSlot = 1n,
): TallyPrivateState => ({
  secretKey,
  pin,
  loanAmount,
  dueSlot,
  standingLoanId: 0n,
  standingCounterpartyPk: new Uint8Array(32),
  standingLeaf: new Uint8Array(32),
});

export const withTerms = (
  state: TallyPrivateState,
  loanAmount: bigint,
  dueSlot: bigint,
): TallyPrivateState => ({
  ...state,
  loanAmount,
  dueSlot,
});

export const withPin = (state: TallyPrivateState, pin: number): TallyPrivateState => ({
  ...state,
  pin,
});

export const withStanding = (
  state: TallyPrivateState,
  standingLoanId: bigint,
  standingCounterpartyPk: Uint8Array,
  standingLeaf: Uint8Array,
): TallyPrivateState => ({
  ...state,
  standingLoanId,
  standingCounterpartyPk,
  standingLeaf,
});

const pinToUint16 = (pin: number): bigint => BigInt(pin & 0xffff);

type LedgerLike = {
  relationships: {
    findPathForLeaf: (leaf: Uint8Array) => unknown;
  };
};

export const createWitnesses = () => ({
  getUserSecret: ({
    privateState,
  }: {
    privateState: TallyPrivateState;
  }): [TallyPrivateState, Uint8Array] => [privateState, privateState.secretKey],
  getPin: ({
    privateState,
  }: {
    privateState: TallyPrivateState;
  }): [TallyPrivateState, bigint] => [privateState, pinToUint16(privateState.pin)],
  getLoanAmount: ({
    privateState,
  }: {
    privateState: TallyPrivateState;
  }): [TallyPrivateState, bigint] => [privateState, privateState.loanAmount],
  getDueSlot: ({
    privateState,
  }: {
    privateState: TallyPrivateState;
  }): [TallyPrivateState, bigint] => [privateState, privateState.dueSlot],
  getStandingLoanId: ({
    privateState,
  }: {
    privateState: TallyPrivateState;
  }): [TallyPrivateState, bigint] => [privateState, privateState.standingLoanId],
  getStandingCounterpartyPk: ({
    privateState,
  }: {
    privateState: TallyPrivateState;
  }): [TallyPrivateState, Uint8Array] => [privateState, privateState.standingCounterpartyPk],
  getRelationshipPath: ({
    privateState,
    ledger,
  }: {
    privateState: TallyPrivateState;
    ledger: LedgerLike;
  }): [TallyPrivateState, unknown] => {
    const path = ledger.relationships.findPathForLeaf(privateState.standingLeaf);
    if (!path) throw new Error('standing leaf not in allowlist');
    return [privateState, path];
  },
});
