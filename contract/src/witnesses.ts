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
  readonly repaidLoanId0: bigint;
  readonly repaidLenderPk0: Uint8Array;
  readonly repaidLeaf0: Uint8Array;
  readonly repaidLoanId1: bigint;
  readonly repaidLenderPk1: Uint8Array;
  readonly repaidLeaf1: Uint8Array;
  readonly repaidLoanId2: bigint;
  readonly repaidLenderPk2: Uint8Array;
  readonly repaidLeaf2: Uint8Array;
};

const emptyPk = (): Uint8Array => new Uint8Array(32);

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
  repaidLoanId0: 0n,
  repaidLenderPk0: emptyPk(),
  repaidLeaf0: emptyPk(),
  repaidLoanId1: 0n,
  repaidLenderPk1: emptyPk(),
  repaidLeaf1: emptyPk(),
  repaidLoanId2: 0n,
  repaidLenderPk2: emptyPk(),
  repaidLeaf2: emptyPk(),
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

export type RepaidCountSlot = {
  readonly loanId: bigint;
  readonly lenderPk: Uint8Array;
  readonly leaf: Uint8Array;
};

export const withRepaidCount = (
  state: TallyPrivateState,
  slots: readonly [RepaidCountSlot, RepaidCountSlot, RepaidCountSlot],
): TallyPrivateState => ({
  ...state,
  repaidLoanId0: slots[0].loanId,
  repaidLenderPk0: slots[0].lenderPk,
  repaidLeaf0: slots[0].leaf,
  repaidLoanId1: slots[1].loanId,
  repaidLenderPk1: slots[1].lenderPk,
  repaidLeaf1: slots[1].leaf,
  repaidLoanId2: slots[2].loanId,
  repaidLenderPk2: slots[2].lenderPk,
  repaidLeaf2: slots[2].leaf,
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
  getRepaidLoanId0: ({ privateState }: { privateState: TallyPrivateState }): [TallyPrivateState, bigint] => [
    privateState,
    privateState.repaidLoanId0,
  ],
  getRepaidLenderPk0: ({ privateState }: { privateState: TallyPrivateState }): [TallyPrivateState, Uint8Array] => [
    privateState,
    privateState.repaidLenderPk0,
  ],
  getRepaidPath0: pathWitness((state) => state.repaidLeaf0),
  getRepaidLoanId1: ({ privateState }: { privateState: TallyPrivateState }): [TallyPrivateState, bigint] => [
    privateState,
    privateState.repaidLoanId1,
  ],
  getRepaidLenderPk1: ({ privateState }: { privateState: TallyPrivateState }): [TallyPrivateState, Uint8Array] => [
    privateState,
    privateState.repaidLenderPk1,
  ],
  getRepaidPath1: pathWitness((state) => state.repaidLeaf1),
  getRepaidLoanId2: ({ privateState }: { privateState: TallyPrivateState }): [TallyPrivateState, bigint] => [
    privateState,
    privateState.repaidLoanId2,
  ],
  getRepaidLenderPk2: ({ privateState }: { privateState: TallyPrivateState }): [TallyPrivateState, Uint8Array] => [
    privateState,
    privateState.repaidLenderPk2,
  ],
  getRepaidPath2: pathWitness((state) => state.repaidLeaf2),
});

function pathWitness(leafOf: (state: TallyPrivateState) => Uint8Array) {
  return ({
    privateState,
    ledger,
  }: {
    privateState: TallyPrivateState;
    ledger: LedgerLike;
  }): [TallyPrivateState, unknown] => {
    const path = ledger.relationships.findPathForLeaf(leafOf(privateState));
    if (!path) throw new Error('repaid leaf not in allowlist');
    return [privateState, path];
  };
}
