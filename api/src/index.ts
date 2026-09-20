/**
 * Shared Tally API — Lace or CLI providers.
 */

import * as Tally from '../../contract/managed/tally/contract/index.js';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { type Logger } from 'pino';
import {
  type TallyDerivedState,
  type PublicLoan,
  type PublicLoanStatus,
  type TallyProviders,
  type DeployedTallyContract,
  tallyPrivateStateKey,
} from './common-types.js';
import {
  CompiledTallyContract,
  createTallyPrivateState,
  withTerms,
  withStanding,
  type TallyPrivateState,
} from '../../contract/src/index';
import * as utils from './utils/index.js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { map, type Observable } from 'rxjs';

const statusFromLedger = (status: unknown): PublicLoanStatus => {
  if (status == null) return 'Unknown';
  if (typeof status === 'object') {
    const s = status as Record<string, boolean>;
    if (s.isOffered) return 'Offered';
    if (s.isAccepted) return 'Accepted';
    if (s.isFunded) return 'Funded';
    if (s.isRepaid) return 'Repaid';
    if (s.isSettled) return 'Settled';
    if (s.isVacant) return 'Vacant';
  }
  const names: PublicLoanStatus[] = ['Vacant', 'Offered', 'Accepted', 'Funded', 'Repaid', 'Settled'];
  if (typeof status === 'number' && names[status]) return names[status];
  return 'Unknown';
};

/** Provider is scoped via setContractAddress — get/set take only (id) / (id, state). */
async function requirePrivateState(psp: {
  get: (id: typeof tallyPrivateStateKey) => Promise<TallyPrivateState | null>;
}): Promise<TallyPrivateState> {
  const current = await psp.get(tallyPrivateStateKey);
  if (!current || !(current.secretKey instanceof Uint8Array) || current.secretKey.length !== 32) {
    throw new Error('Private state missing or corrupted. Join the contract again on this desk.');
  }
  return current;
}

export class TallyAPI {
  private constructor(
    public readonly deployedContract: DeployedTallyContract,
    private readonly providers: TallyProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    this.providers.privateStateProvider.setContractAddress(this.deployedContractAddress);

    this.state$ = this.providers.publicDataProvider
      .contractStateObservable(this.deployedContractAddress, { type: 'latest' })
      .pipe(
        map((contractState) => Tally.ledger(contractState.data)),
        map((ledgerState): TallyDerivedState => {
          const loans: PublicLoan[] = [];
          for (const [key, entry] of ledgerState.loans) {
            loans.push({
              id: Number(key),
              status: statusFromLedger(entry.status),
              lenderPk: utils.toHex(entry.lenderPk),
              borrowerPk: utils.toHex(entry.borrowerPk),
              paymentCommit: utils.toHex(entry.paymentCommit),
            });
          }
          loans.sort((a, b) => a.id - b.id);
          return { loanCount: Number(ledgerState.nextId), loans };
        }),
      );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<TallyDerivedState>;

  async offerLoan(borrowerPkHex: string, amount: bigint, dueSlot: bigint): Promise<void> {
    const psp = this.providers.privateStateProvider;
    psp.setContractAddress(this.deployedContractAddress);
    const current = await requirePrivateState(psp);
    await psp.set(tallyPrivateStateKey, withTerms(current, amount, dueSlot));
    await (this.deployedContract as any).callTx.offerLoan(utils.encodePk(borrowerPkHex));
  }

  async acceptLoan(loanId: number): Promise<void> {
    await (this.deployedContract as any).callTx.acceptLoan(BigInt(loanId));
  }

  async disburse(loanId: number, paymentCommitHex: string): Promise<void> {
    await (this.deployedContract as any).callTx.disburse(BigInt(loanId), utils.encodePk(paymentCommitHex));
  }

  async repay(loanId: number): Promise<void> {
    await (this.deployedContract as any).callTx.repay(BigInt(loanId));
  }

  async settle(loanId: number): Promise<void> {
    await (this.deployedContract as any).callTx.settle(BigInt(loanId));
  }

  /**
   * Private Allowlist Access — prove settled-relationship membership.
   * Leaf / loan id / counterparty stay in private state; verifier learns yes/no only.
   */
  async proveStanding(
    loanId: number,
    counterpartyPkHex: string,
    relationshipLeafHex: string,
  ): Promise<void> {
    const psp = this.providers.privateStateProvider;
    psp.setContractAddress(this.deployedContractAddress);
    const current = await requirePrivateState(psp);
    const leafHex = relationshipLeafHex.replace(/^0x/, '').replace(/\s/g, '');
    await psp.set(
      tallyPrivateStateKey,
      withStanding(
        current,
        BigInt(loanId),
        utils.encodePk(counterpartyPkHex),
        utils.fromHex(leafHex.padStart(64, '0').slice(0, 64)),
      ),
    );
    await (this.deployedContract as any).callTx.proveStanding();
  }

  static async deploy(providers: TallyProviders, secretKey: Uint8Array, logger?: Logger): Promise<TallyAPI> {
    const deployedContract = await deployContract(providers as any, {
      compiledContract: CompiledTallyContract,
      privateStateId: tallyPrivateStateKey,
      initialPrivateState: createTallyPrivateState(secretKey),
    });
    const api = new TallyAPI(deployedContract, providers, logger);
    await providers.privateStateProvider.set(tallyPrivateStateKey, createTallyPrivateState(secretKey));
    return api;
  }

  static async join(
    providers: TallyProviders,
    contractAddress: ContractAddress,
    secretKey: Uint8Array,
    logger?: Logger,
  ): Promise<TallyAPI> {
    providers.privateStateProvider.setContractAddress(contractAddress);
    // Always re-seed desk secret — prior 3-arg set() calls could leave a corrupted string in store.
    await providers.privateStateProvider.set(tallyPrivateStateKey, createTallyPrivateState(secretKey));
    const deployedContract = await findDeployedContract(providers as any, {
      contractAddress,
      compiledContract: CompiledTallyContract,
      privateStateId: tallyPrivateStateKey,
      initialPrivateState: createTallyPrivateState(secretKey),
    });
    return new TallyAPI(deployedContract, providers, logger);
  }
}

export * as utils from './utils/index.js';
export * from './common-types.js';
