import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import semver from 'semver';

export const COMPATIBLE_CONNECTOR_API_VERSION = '4.x';

export type WalletProduct = '1am' | 'lace' | 'other';

export type WalletOption = {
  readonly id: string;
  readonly name: string;
  readonly api: InitialAPI;
  readonly product: WalletProduct;
  readonly icon: string;
};

const LACE_RDNS = 'io.lace.wallet';
const ONEAM_RDNS = 'com.midnight.1am';

export function walletProduct(id: string, api: Pick<InitialAPI, 'rdns' | 'name'>): WalletProduct {
  const rdns = String(api.rdns ?? '').trim().toLowerCase();
  const label = String(api.name ?? '').trim().toLowerCase();
  const key = id.toLowerCase();
  if (rdns === LACE_RDNS || label.includes('lace') || key.includes('lace') || key === 'mnlace') return 'lace';
  if (rdns === ONEAM_RDNS || label.includes('1am') || key.includes('1am')) return '1am';
  return 'other';
}

function displayName(product: WalletProduct, api: Pick<InitialAPI, 'name'>, id: string): string {
  if (product === 'lace') return 'Lace Wallet';
  if (product === '1am') return '1AM Wallet';
  const name = String(api.name ?? '').trim();
  if (name) return name.slice(0, 48);
  return id.length > 16 ? `${id.slice(0, 10)}…` : id;
}

/** Wallet icons are shown in an img tag, so only https and image data URLs are accepted. */
export function walletIcon(product: WalletProduct, icon: string | undefined): string {
  const fallback = product === 'lace' ? '/wallets/lace.png' : product === '1am' ? '/wallets/1am.ico' : '';
  const value = (icon ?? '').trim();
  if (value.startsWith('https://') || value.startsWith('data:image/')) return value;
  return fallback;
}

function isCompatibleWallet(wallet: unknown): wallet is InitialAPI {
  return (
    !!wallet &&
    typeof wallet === 'object' &&
    'apiVersion' in wallet &&
    semver.satisfies((wallet as InitialAPI).apiVersion, COMPATIBLE_CONNECTOR_API_VERSION)
  );
}

/** Enumerate connector v4 wallets injected at window.midnight. Lace uses a fresh UUID key; identify it by rdns. */
export function listCompatibleWallets(): WalletOption[] {
  const midnight = window.midnight;
  if (!midnight) return [];

  const seen = new Set<WalletProduct>();
  const options: WalletOption[] = [];
  for (const [id, api] of Object.entries(midnight)) {
    if (!isCompatibleWallet(api)) continue;
    const product = walletProduct(id, api);
    if (product !== 'other' && seen.has(product)) continue;
    seen.add(product);
    options.push({
      id,
      name: displayName(product, api, id),
      api,
      product,
      icon: walletIcon(product, api.icon),
    });
  }
  return options;
}

export function findCompatibleWallet(preferredId?: string): InitialAPI | undefined {
  const wallets = listCompatibleWallets();
  if (wallets.length === 0) return undefined;
  if (preferredId) {
    return wallets.find((w) => w.id === preferredId)?.api ?? wallets[0]?.api;
  }
  return wallets[0]?.api;
}
