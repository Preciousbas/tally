import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import semver from 'semver';

export const COMPATIBLE_CONNECTOR_API_VERSION = '4.x';

/** Official extension install pages for the no-wallet chip. Not wallet keys. */
export const LACE_INSTALL_URL =
  'https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk';
export const ONE_AM_INSTALL_URL =
  'https://chromewebstore.google.com/detail/1am/bphnkdkcnfhompoegfpgnkidcjfbojjp';

export type WalletOption = {
  readonly id: string;
  readonly name: string;
  readonly api: InitialAPI;
};

function isCompatibleWallet(wallet: unknown): wallet is InitialAPI {
  return (
    !!wallet &&
    typeof wallet === 'object' &&
    'apiVersion' in wallet &&
    semver.satisfies((wallet as InitialAPI).apiVersion, COMPATIBLE_CONNECTOR_API_VERSION)
  );
}

export function getWalletDisplayName(id: string): string {
  const lower = id.toLowerCase();
  if (lower === '1am' || lower.includes('1am')) return '1AM';
  if (lower.includes('lace') || lower === 'mnlace') return 'Lace';
  return id.length > 16 ? `${id.slice(0, 10)}…` : id;
}

/** Enumerate connector v4 wallets injected at window.midnight (never hardcode mnLace). */
export function listCompatibleWallets(): WalletOption[] {
  const midnight = window.midnight;
  if (!midnight) return [];

  return Object.entries(midnight)
    .filter((entry): entry is [string, InitialAPI] => isCompatibleWallet(entry[1]))
    .map(([id, api]) => ({ id, name: getWalletDisplayName(id), api }));
}

export function findCompatibleWallet(preferredId?: string): InitialAPI | undefined {
  const wallets = listCompatibleWallets();
  if (wallets.length === 0) return undefined;
  if (preferredId) {
    return wallets.find((w) => w.id === preferredId)?.api ?? wallets[0]?.api;
  }
  return wallets[0]?.api;
}
