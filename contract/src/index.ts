import { CompiledContract } from '@midnight-ntwrk/compact-js';

export * as Tally from '../managed/tally/contract/index.js';
export {
  createWitnesses,
  createTallyPrivateState,
  withTerms,
  withPin,
} from './witnesses.js';
export type { TallyPrivateState } from './witnesses.js';

import * as TallyContract from '../managed/tally/contract/index.js';
import { createWitnesses } from './witnesses.js';

export const CompiledTallyContract = CompiledContract.make(
  'tally',
  TallyContract.Contract,
).pipe(
  CompiledContract.withWitnesses(createWitnesses()),
  CompiledContract.withCompiledFileAssets('./managed/tally'),
);
