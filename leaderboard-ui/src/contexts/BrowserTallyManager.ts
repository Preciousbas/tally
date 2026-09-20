import { TallyAPI, type TallyCircuitKeys, type TallyProviders } from '../../../api/src/index';
import { type ContractAddress, fromHex, toHex } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { BehaviorSubject, catchError, concatMap, filter, firstValueFrom, interval, map, type Observable, take, throwError, timeout } from 'rxjs';
import { pipe as fnPipe } from 'fp-ts/function';
import { type Logger } from 'pino';
import { type ConnectedAPI, type InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { Binding, type FinalizedTransaction, Proof, SignatureEnabled, Transaction, type TransactionId } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { findCompatibleWallet } from '../wallets';
import { type TallyPrivateState } from '../../../contract/src/index';
import { inMemoryPrivateStateProvider } from '../in-memory-private-state-provider';
import { type NetworkId, setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import { readOrCreateTallySecret } from '../deskId';

export type TallyDeployment =
  | { readonly status: 'in-progress' }
  | { readonly status: 'deployed'; readonly api: TallyAPI }
  | { readonly status: 'failed'; readonly error: Error };

export class BrowserTallyManager {
  readonly #deploymentsSubject = new BehaviorSubject<Array<BehaviorSubject<TallyDeployment>>>([]);
  #initializedProviders: Promise<TallyProviders> | undefined;
  #preferredWallet: InitialAPI | undefined;

  constructor(private readonly logger: Logger) {}

  /** Use the same wallet the user connected in the desk UI (Connect + Deploy stay in sync). */
  setPreferredWallet(wallet: InitialAPI | undefined): void {
    this.#preferredWallet = wallet;
    this.#initializedProviders = undefined;
  }

  resolve(contractAddress?: ContractAddress): Observable<TallyDeployment> {
    const deployments = this.#deploymentsSubject.value;
    const existing = deployments.find(
      (d) => d.value.status === 'deployed' && d.value.api.deployedContractAddress === contractAddress,
    );
    if (existing) return existing;

    const secretKey = this.getSecretKey();
    const deployment = new BehaviorSubject<TallyDeployment>({ status: 'in-progress' });
    if (contractAddress) {
      void this.run(deployment, (providers) => TallyAPI.join(providers, contractAddress, secretKey, this.logger));
    } else {
      void this.run(deployment, (providers) => TallyAPI.deploy(providers, secretKey, this.logger));
    }
    this.#deploymentsSubject.next([...deployments, deployment]);
    return deployment;
  }

  private getSecretKey(): Uint8Array {
    return readOrCreateTallySecret();
  }

  private getProviders(): Promise<TallyProviders> {
    return (
      this.#initializedProviders ??
      (this.#initializedProviders = initializeProviders(this.logger, this.#preferredWallet))
    );
  }

  private async run(
    deployment: BehaviorSubject<TallyDeployment>,
    factory: (providers: TallyProviders) => Promise<TallyAPI>,
  ): Promise<void> {
    try {
      const providers = await this.getProviders();
      const api = await factory(providers);
      deployment.next({ status: 'deployed', api });
    } catch (error: unknown) {
      console.error('Contract operation failed:', error);
      let err: Error;
      if (error instanceof Error) {
        err = error;
      } else if (typeof error === 'string') {
        err = new Error(error);
      } else {
        err = new Error(JSON.stringify(error) || 'Unknown error during contract operation');
      }
      deployment.next({ status: 'failed', error: err });
    }
  }
}

const initializeProviders = async (logger: Logger, preferredWallet?: InitialAPI): Promise<TallyProviders> => {
  const networkId = (import.meta.env.VITE_NETWORK_ID ?? 'preprod') as NetworkId;
  setNetworkId(networkId);

  const connectedAPI = await connectToWallet(logger, networkId, preferredWallet);
  const config = await connectedAPI.getConfiguration();
  const proofServerUri = config.proverServerUri!;
  const shieldedAddresses = await connectedAPI.getShieldedAddresses();
  const zkConfigProvider = new FetchZkConfigProvider<TallyCircuitKeys>(window.location.origin, fetch.bind(window));

  return {
    privateStateProvider: inMemoryPrivateStateProvider<string, TallyPrivateState>(),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(proofServerUri, zkConfigProvider),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    walletProvider: {
      getCoinPublicKey: () => shieldedAddresses.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => shieldedAddresses.shieldedEncryptionPublicKey,
      balanceTx: async (tx: UnboundTransaction): Promise<FinalizedTransaction> => {
        const received = await connectedAPI.balanceUnsealedTransaction(toHex(tx.serialize()));
        return Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature', 'proof', 'binding', fromHex(received.tx));
      },
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        await connectedAPI.submitTransaction(toHex(tx.serialize()));
        return tx.identifiers()[0];
      },
    },
  };
};

const connectToWallet = (logger: Logger, networkId: string, preferredWallet?: InitialAPI): Promise<ConnectedAPI> => {
  if (preferredWallet) {
    return preferredWallet.connect(networkId);
  }

  return firstValueFrom(
    fnPipe(
      interval(100),
      map(() => findCompatibleWallet()),
      filter((api): api is InitialAPI => !!api),
      take(1),
      timeout({
        first: 10_000,
        with: () => throwError(() => new Error('Could not find a Midnight wallet. Install Lace or 1AM.')),
      }),
      concatMap(async (initialAPI) => initialAPI.connect(networkId)),
      timeout({
        first: 120_000,
        with: () => throwError(() => new Error('Wallet failed to respond. Unlock the extension and approve the connection.')),
      }),
      catchError((error) => throwError(() => (error instanceof Error ? error : new Error('Wallet not authorized')))),
    ),
  );
};
