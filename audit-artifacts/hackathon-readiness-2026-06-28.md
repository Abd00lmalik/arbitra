# Arbitra Hackathon Readiness Report - 2026-06-28

## Executive Summary

Arbitra's original final upload failure was caused by stale production contract wiring. The frontend called registry `0x5a84fa82958D375ffD0d8DA8e8E205173De326e4`, while the collateral vault expected registry `0xDE46d22134f0a9595188aA96dFFAC82561172b9f`. This caused `ArbitraCollateralVault.onlyRegistry` to revert inside `linkStakeToInvoice`.

The frontend and Vercel production bundle are now wired to the coherent Sepolia stack:

- Registry: `0xDE46d22134f0a9595188aA96dFFAC82561172b9f`
- Fingerprint registry: `0x4De4d767a628aa021f5E3bb6CC8B3Bf80880C4eC`
- Risk calculator: `0x4A33a848de45d79f6A8082D1d2aE93b3c85a1F91`
- Collateral vault: `0x5abc39D2a5D37CCB994B85298924a415415F2658`
- Escrow receiver: `0x6B1Abb3e6d0918F9B86e975Ef0FE93a8eBd81FAA`
- Platform verifier: `0x46F6935E41856D62d8f9ABd2b894ab27669a0dc9`

After this fix, the final upload call no longer fails with `Arbitra: only registry`. A second deployment-state blocker was found: the previous active collateral vault contained stale invoice ID links for invoice IDs `1`, `2`, and `3`, while the active registry had `invoiceCount = 0`. The clean registry tried to link invoice `1`, and the stale vault reverted with `Arbitra: invoice ID already staked`.

The secure remediation was to deploy a fresh collateral vault, set its registry to the active registry, update the active registry to point to the fresh vault, then update frontend and Vercel environment variables. This did not bypass access control or weaken `onlyRegistry`.

Fresh vault deployed:

- Collateral vault: `0x5abc39D2a5D37CCB994B85298924a415415F2658`
- `setRegistry` tx: `0x2110006ac67d1aaec57babf3854b42846b4a44019d71919c389fd53ee49dde60`
- `registry.setContracts` tx: `0xc21a736a1fcedceeb53866cf9d30a40631830687fa44de2e02e57d234845f596`
- Final upload tx: `0x0c2a6736b39981b51ee76e0c977472c31cb38d23bda417bf015b75f9dfef71af`
- Final upload gas used: `1,429,213`
- Final state: `invoiceCount = 1`, invoice `1` status `Pending`, supplier `0x73092e88D49946ac32b6Eb1a394f81bb553e411a`, face value `1000000`, collateral staked `true`, vault stake `50000`.

Known existing vault candidates were checked and are not suitable:

- `0x5DbD519573770b7cE26D744C568e465566a86ddd` has occupied invoice slots `1` through `5`.
- `0x1e8fdFAC6ecaac3fcf186B30A947000e4d604e88` has occupied invoice slots `1` and `2`.

Because the active registry starts at `invoiceCount = 0`, reusing either vault would preserve the same low-ID collision class. A fresh vault is the clean remediation.

## Current Upload Call Chain

```text
Frontend UploadInvoiceForm
|
v
ArbitraInvoiceRegistry.uploadInvoice
|
v
ArbitraCollateralVault.linkStakeToInvoice
|
v
onlyRegistry passes with fresh vault wiring
|
v
Invoice 1 is stored and collateral is linked
```

## Upload Pipeline Timing

Benchmarks from `scratch/benchmark_upload_pipeline.js`:

| Fixture | Method | Result | Total | OCR |
| --- | --- | --- | ---: | --- |
| One-page digital PDF | PDF text | success | 951 ms | skipped |
| Multi-page digital PDF | PDF text | success | 862 ms | skipped |
| Scanned fixture | OCR fallback | incomplete | 1210 ms | executed |
| Malformed PDF | page validation | structured error | 1.5 ms | skipped |

Digital PDFs parse under 2 seconds and do not invoke OCR unnecessarily.

## FHEVM Coverage Matrix

| Workflow | Uses FHE | Should Use FHE | Correct Implementation | Recommendation |
| --- | --- | --- | --- | --- |
| Onboarding KYB | Partial | Yes | Tax ID, KYB status, and risk score are encrypted in `ArbitraIdentity` with `allowThis` and wallet ACL | Keep, but reduce plaintext KYB artifacts in frontend/API logs |
| Invoice parsing | No | Mostly no | Server parses plaintext PDF | Clarify product claims: invoice contents are plaintext before encryption |
| Invoice value | Partial | Yes | Encrypted `faceValue` exists, but `faceValuePlaintext` is stored and displayed | Replace plaintext mirror with proof-bound FHE/public-decrypt settlement path |
| Due date | Yes | Yes | Stored as encrypted handle and ACL granted | Avoid duplicating maturity as plaintext where possible |
| Fingerprint | Partial | Yes | Encrypted fingerprint stored, but plaintext fingerprint is used for collateral mapping | Remove plaintext deterministic fingerprint from public state |
| Duplicate detection | Partial | Yes | FHE equality loop works, but enforcement is off-chain/advisory | Redesign duplicate prevention with verifier attestation or commit-reveal enforcement |
| Discount calculation | Partial | Yes | FHE computes discount, but plaintext discount is submitted and stored | Bind plaintext settlement values to FHE-derived values or remove mirrors |
| Marketplace | Partial | Yes | Investor access can request FHE handles, but cards use plaintext face values | Gate sensitive values behind decryption and avoid public aggregate leakage |
| Factoring | Partial | Yes | Purchase price handle exists, but payment amount is plaintext | Add confidential pricing flow or explicit public-price disclosure |
| Settlement | Partial | Yes | Confidential settlement ledger exists, but escrow stores plaintext economics | Move economics to encrypted handles and signed/public decrypt proofs |
| Notifications/NOA | No | Partial | Email/token APIs handle plaintext debtor email | Store only commitments on-chain and minimize server retention |

## Security Findings

### P0 - Duplicate prevention is advisory

Severity: High. Confidence: 90.

`ArbitraFingerprintRegistry.confirmAndRegister` cannot branch on the encrypted duplicate flag, and `ArbitraInvoiceRegistry.uploadInvoice` does not enforce a decrypted false result. A supplier who bypasses the frontend can still register/upload a duplicate if they satisfy collateral prerequisites.

Recommendation: require a platform/verifier attestation over the decrypted duplicate result, or redesign duplicate prevention around commitments that can be checked in plaintext without exposing invoice data.

### P0 - Plaintext economic mirrors undermine confidentiality claims

Severity: High. Confidence: 95.

`faceValuePlaintext`, `discountRatePlaintext`, purchase price, supplier reserve, platform fee, and settlement amount are stored or derived in plaintext. This conflicts with "zero plaintext" style positioning.

Recommendation: adjust claims immediately, then migrate pricing/settlement to FHE-bound values with a clear disclosure model.

### Resolved - Live deployment vault state was inconsistent with active registry

Severity: High. Confidence: 95.

The active registry reports `invoiceCount = 0`, but the active vault has `stakedCollateral[1] = 5000000`, `stakedCollateral[2] = 7563000`, and `stakedCollateral[3] = 8599500`. This blocks the first clean upload with `Arbitra: invoice ID already staked`.

Resolution: deployed and wired fresh collateral vault `0x5abc39D2a5D37CCB994B85298924a415415F2658`. Do not temporarily set `arbitraRegistry` to an EOA to clear state.

### P1 - Plaintext and encrypted values are not cryptographically bound

Severity: High. Confidence: 85.

The upload call accepts encrypted values plus independent plaintext mirrors. The contract cannot prove the plaintext face value or discount matches the encrypted input.

Recommendation: require verifier signatures over parsed values and encrypted input commitments, or use a public decrypt proof where public settlement values are intentionally revealed.

### P1 - Payment proof omits bank trace ID from the signed payload

Severity: Medium. Confidence: 80.

`repayInvoice` includes `bankTraceId` in the receipt hash, but `_verifyPaymentProof` signs only invoice ID, payment reference, amount, timestamp, and nonce.

Recommendation: include `bankTraceId` in `PAYMENT_RECEIVED_TYPEHASH`.

## Product And UX Findings

- Onboarding depends on Web3Auth email and wallet availability; disposable email testing did not complete reliably in the browser session.
- Upload gas requirements need clearer preflight language. The UI warns for 0.02 ETH, but final FHE transactions can vary with Sepolia gas.
- Success copy says all fields are FHE-encrypted, while the protocol still stores key economic fields in plaintext.
- Automatic debtor email is marked unavailable after upload; this is a demo risk for NOA flow.
- Marketplace and dashboard can imply confidentiality while showing plaintext amounts.

## Hackathon Judge Scores

| Category | Score | Reason |
| --- | ---: | --- |
| Confidential Computing | 6 | Real FHE handles and ACLs exist, but important business values remain plaintext |
| Zama Integration | 7 | Uses FHEVM primitives, external inputs, ACL grants, and encrypted comparisons |
| Product Quality | 7 | Strong concept and UI; final upload works after fresh-vault remediation, but other journeys need browser QA |
| User Experience | 6 | Good visual polish, but auth/gas/onboarding friction is high |
| Technical Depth | 8 | Multi-contract lifecycle, FHE risk, duplicate checking, escrow, KYB |
| Smart Contract Design | 6 | Good modularity, but duplicate enforcement and plaintext mirrors need redesign |
| Security | 5 | Access control wiring fixed, but confidentiality and invariant gaps remain |
| Demo Quality | 6 | Parser, registry wiring, and final upload are fixed; full auth/browser demo still needs hardening |
| Innovation | 8 | Confidential invoice factoring is a strong Zama use case |
| Production Readiness | 5 | Deployment remediation is complete, but claims, duplicate enforcement, and browser journey QA remain |

## Roadmap

### P0

- Update Vercel production environment and redeploy after vault remediation.
- Change public copy that overclaims "zero plaintext" until settlement confidentiality is redesigned.

### P1

- Enforce duplicate-prevention with verifier attestation or an alternative non-advisory mechanism.
- Bind plaintext settlement values to encrypted invoice inputs.
- Add signed `bankTraceId` to payment proof verification.
- Improve onboarding and gas preflight error messages.

### P2

- Move marketplace amount visibility behind FHE decryption or explicit user consent.
- Add browser E2E tests for supplier, debtor, investor, settlement, and NOA flows.
- Add deployment-state health checks that compare registry counters with vault state.

### P3

- Add mobile QA snapshots.
- Add richer empty states for marketplace, dashboard, portfolio, and debtor verification.
- Add analytics that do not leak sensitive invoice economics.

## Validation Evidence

- `npx hardhat compile`: passed.
- `npx hardhat test`: 24 passing.
- `npm run build` in `frontend`: passed.
- `scratch/check_sepolia_wiring.js`: coherent registry/fingerprint/vault/escrow/verifier wiring passed.
- Final upload tx `0x7a522f05ac9e5a8e5e524e99bc9640835114f41e19b3750c8668a76cf4ee2fd2`: no longer `onlyRegistry`; reverted with `Arbitra: invoice ID already staked` by `eth_call` replay.
- Vault candidate scan: both known existing vaults were dirty at low invoice IDs.
- Fresh vault remediation: `scripts/remediate_fresh_collateral_vault.js` deployed and wired `0x5abc39D2a5D37CCB994B85298924a415415F2658`.
- Final upload transaction `0x0c2a6736b39981b51ee76e0c977472c31cb38d23bda417bf015b75f9dfef71af`: mined with status `1` in block `11163742`, gas used `1,429,213`.
- Post-upload chain state: `invoiceCount = 1`, invoice `1` status `0`, supplier `0x73092e88D49946ac32b6Eb1a394f81bb553e411a`, `collateralStaked = true`, vault `stakedCollateral[1] = 50000`.
