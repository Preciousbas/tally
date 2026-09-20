# Identity

> Desk ID is secret + PIN. It is not ownPublicKey() and not a Lace address.

Tally authorizes loan parties with a Compact-derived public key. The wallet (Lace or 1AM) signs and submits transactions. Those are different keys.

## Derivation

From `contract/tally.compact`:

```compact
circuit deriveUserPublicKey(sk: Bytes<32>, pin: Uint<16>): Bytes<32> {
  const pinHash = persistentHash<Uint<16>>(pin);
  return persistentHash<Vector<3, Bytes<32>>>([
    pad(32, "tally:user:pk:v1"),
    pinHash,
    sk
  ]);
}
```

Same secret + PIN ⇒ same 32-byte grain. Change either input ⇒ different grain. Tests in `contract/test/tally.test.ts` assert that.

`ownPublicKey()` is not used anywhere in `tally.compact`.

## What the desk shows as Desk ID

The trust-strip **Desk ID** button copies this grain as 64 hex. Offer → **Borrower id** on Preprod expects that value. The field hint says “their Desk ID · not Lace address”.

Lender id / Borrower id on an instrument are the same grains, truncated in the row and copyable in full.

## Preprod

| Piece | Where it lives |
| --- | --- |
| Secret | `localStorage['tally-midnight-secret']` — 32 random bytes, created on first use |
| PIN | `DESK_PIN = 1234` in `leaderboard-ui/src/deskId.ts` and `createTallyPrivateState` |
| Public grain | `deriveChainDeskIdHex` → Compact `_deriveUserPublicKey_0` |
| Join / Deploy | `BrowserTallyManager.getSecretKey()` reads the same secret |

The desk does not currently expose a PIN field. The PIN is a witness default, not a user-entered code in the UI.

`deskId.ts` calls the compiled Compact helpers on purpose. Preprod must not use `TallySimulator`'s toy hash.

Two Chrome profiles ⇒ two secrets ⇒ two Desk IDs. That is how Lender and Borrower stay distinct on one machine.

## Local desk

Local desk does not read `tally-midnight-secret` for circuit calls. It uses fixed demo keys:

- Lender secret: `Uint8Array(32).fill(1)`
- Borrower secret: `Uint8Array(32).fill(2)`
- PIN: `1234`

Offer names the built-in borrower automatically, so the Borrower id field is hidden. The Desk ID chip still reflects the selected role's demo key (simulator hash, not Compact hash).

## Relationship leaf

Settle inserts:

```compact
persistentHash([
  pad(32, "tally:rel:v1:repaid"),
  loanIdBytes(loanId),
  lenderPk,
  borrowerPk
])
```

`proveStanding` rebuilds that leaf as lender or as borrower from witnesses. `deriveRelationshipLeafHex` in `deskId.ts` matches the on-chain function so the Merkle path lookup succeeds on Preprod.

## What this is not

- Not a Lace/1AM payment address (`mn_addr_…`)
- Not a legal name or KYC handle
- Not `ownPublicKey()`
- Not a W3C verifiable credential
- Not a proof of *which* counterparty you settled with

## Next steps


  - [Privacy](/privacy) — What those grains leak, and what they do not.
  - [Preprod guide](/preprod) — Copy Desk ID on one profile, paste it on the other.
