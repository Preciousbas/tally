export const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

export const fromHex = (hex: string): Uint8Array => {
  const clean = hex.replace(/^0x/, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

export const encodePk = (hexOrEmpty: string): Uint8Array => {
  const bytes = new Uint8Array(32);
  const clean = hexOrEmpty.replace(/^0x/, '').replace(/\s/g, '');
  if (!clean) return bytes;
  const parsed = fromHex(clean.padEnd(64, '0').slice(0, 64));
  bytes.set(parsed.slice(0, 32));
  return bytes;
};
