export type TallyPrivateState = {
  readonly secretKey: Uint8Array;
  readonly pin: number;
  readonly loanAmount: bigint;
  readonly dueSlot: bigint;
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
});
