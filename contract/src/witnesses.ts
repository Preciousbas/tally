export type TallyPrivateState = {
  readonly secretKey: Uint8Array;
  readonly pin: number;
  readonly loanAmount: bigint;
  readonly dueSlot: bigint;
  readonly standingLoanId: bigint;
  readonly standingCounterpartyPk: Uint8Array;
  /** Opaque Merkle path from ledger findPathForLeaf; shape depends on Compact runtime. */
  readonly relationshipPath: unknown | null;
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
  relationshipPath: null,
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
  relationshipPath: unknown,
): TallyPrivateState => ({
  ...state,
  standingLoanId,
  standingCounterpartyPk,
  relationshipPath,
});

const pinToUint16 = (pin: number): bigint => BigInt(pin & 0xffff);

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
  }: {
    privateState: TallyPrivateState;
  }): [TallyPrivateState, unknown] => {
    if (privateState.relationshipPath == null) {
      throw new Error('relationship path missing — settle a loan before proveStanding');
    }
    return [privateState, privateState.relationshipPath];
  },
});
