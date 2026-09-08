import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import { type TallyPrivateState } from '../../contract/src/index';

export const tallyPrivateStateKey = 'tallyPrivateState';
export type PrivateStateId = typeof tallyPrivateStateKey;

export type TallyCircuitKeys = 'offerLoan' | 'acceptLoan' | 'disburse' | 'repay' | 'settle';
export type TallyProviders = MidnightProviders<TallyCircuitKeys, PrivateStateId, TallyPrivateState>;
export type DeployedTallyContract = FoundContract<any>;

export type PublicLoanStatus = 'Vacant' | 'Offered' | 'Accepted' | 'Funded' | 'Repaid' | 'Settled' | 'Unknown';

export interface PublicLoan {
  readonly id: number;
  readonly status: PublicLoanStatus;
  readonly lenderPk: string;
  readonly borrowerPk: string;
  readonly paymentCommit: string;
}

export interface TallyDerivedState {
  readonly loanCount: number;
  readonly loans: PublicLoan[];
}
