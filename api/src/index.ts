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

export class TallyAPI {
  private constructor(
    public readonly deployedContract: DeployedTallyContract,
    providers: TallyProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    providers.privateStateProvider.setContractAddress(this.deployedContractAddress);

    this.state$ = providers.publicDataProvider
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
    const providers = (this.deployedContract as any).providers;
    if (providers?.privateStateProvider) {
      const current: TallyPrivateState = await providers.privateStateProvider.get(
        tallyPrivateStateKey,
        this.deployedContractAddress,
      );
      await providers.privateStateProvider.set(
        tallyPrivateStateKey,
        this.deployedContractAddress,
        withTerms(current, amount, dueSlot),
      );
    }
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

  async proveStanding(): Promise<void> {
    await (this.deployedContract as any).callTx.proveStanding();
  }

  static async deploy(providers: TallyProviders, secretKey: Uint8Array, logger?: Logger): Promise<TallyAPI> {
    const deployedContract = await deployContract(providers as any, {
      compiledContract: CompiledTallyContract,
      privateStateId: tallyPrivateStateKey,
      initialPrivateState: createTallyPrivateState(secretKey),
    });
    return new TallyAPI(deployedContract, providers, logger);
  }

  static async join(
    providers: TallyProviders,
    contractAddress: ContractAddress,
    secretKey: Uint8Array,
    logger?: Logger,
  ): Promise<TallyAPI> {
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
