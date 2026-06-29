# Arbitra Confidentiality Refactor Final Audit

Date: 2026-06-29
Branch: codex/confidentiality-refactor-final

## 1. What Changed

- Fixed live investor access wiring: `ArbitraInvoiceRegistry.sbtContract()` now points to investor SBT `0x52DfdBA750528207216f3d558D5f3aD04Be23e3b`.
- Updated deployment wiring to prefer `ArbitraInvestorSBT` for registry risk-access gates when it exists.
- Added `scripts/configure_investor_sbt_access.js` to verify owner/signer and configure live registry SBT wiring.
- Added a regression test proving a supplier SBT alone cannot call `requestRiskAssessmentAccess`, while an investor SBT holder can.
- Added `ArbitraEscrowReceiver.getSettlementCommitments()` so clients can read payment reference, bank trace, receipt hash, and timestamp without pulling plaintext settlement economics.
- Stopped marketplace stats from aggregating public face value.
- Stopped marketplace mini-cards from deriving size tier from `faceValuePlaintext`.
- Stopped invoice detail modal from reading `getPurchasePricePlaintext` for investor factoring UI.
- Stopped invoice detail modal from reading `getSettlementAudit`; it now uses commitment-only settlement metadata.
- Moved risk assessment execution into the client hook after authorized decryption, so decrypted inputs are not posted to `/api/risk-assessment` in the normal investor flow.

## 2. Why This Improves Confidentiality

The refactor moves Arbitra closer to selective disclosure:

- Before access, investors see non-financial metadata: status, verification, maturity bucket, funding state, and collateral/funding indicators.
- After `requestRiskAssessmentAccess`, investors can decrypt the financial values they are permitted to review.
- Marketplace screens no longer leak deal size through public total-value stats or size tiers.
- Detail screens no longer use public plaintext purchase price as the UI source of truth.
- Settlement screens no longer call a getter that returns purchase price, supplier reserve, and platform fee.
- Decrypted underwriting inputs stay in the authorized browser session instead of being sent to a backend API route.

## 3. Remaining Plaintext Business Values

| Field | Why It Still Exists | Boundary? | Future Removal |
| --- | --- | --- | --- |
| `faceValuePlaintext` in registry | Needed for standard ERC20 collateral and settlement amount checks in current architecture. | Yes: ERC20, collateral, mock bank reconciliation. | Replace with confidential token rails or private settlement adapter. |
| `discountRatePlaintext` in registry | Needed for current plaintext USDC purchase-price transfer amount. | Yes: ERC20 purchase execution. | Derive only at authorized boundary or move to confidential token factoring. |
| `_computePurchasePricePlaintext()` | Required to transfer standard USDC from investor to supplier. | Yes: ERC20 transfer amount. | Replace with encrypted accounting plus confidential token transfer. |
| `EscrowRecord.purchasePricePlaintext` | Required to reconcile standard USDC transfer and legacy settlement audit. | Yes: settlement adapter compatibility. | Make legacy getter admin-only or remove in next ABI version. |
| `EscrowRecord.supplierReservePlaintext` | Required to credit current settlement split from a standard ERC20 repayment. | Yes: settlement adapter compatibility. | Compute encrypted reserve directly once purchase path is confidential. |
| `EscrowRecord.platformFeePlaintext` | Required to credit current platform fee from a standard ERC20 repayment. | Yes: settlement adapter compatibility. | Store commitment and encrypted fee only. |
| Mock bank `paymentReferencePlain` and `bankTracePlain` | Displayed only in simulation response to the actor executing the mock rail. | Yes: demo/mock rail. | Replace with bank-side encrypted envelope and public commitment. |
| NOA face value and due date | Legal notice must contain assigned invoice terms. | Yes: legal document generation. | Gate download and watermark access, keep on-chain commitment. |
| Parser/OCR extracted invoice text | Required to ingest uploaded invoices. | Yes: ingestion pipeline. | Encrypt at rest and purge after draft confirmation. |

## 4. Updated Confidentiality Matrix

| Field | Current Protection | Decision | Reason |
| --- | --- | --- | --- |
| Invoice face value | FHE handle plus plaintext boundary field | Uses FHE correctly, boundary remains | Needs selective disclosure and computation; standard ERC20 still requires clear transfer amount. |
| Due date | FHE handle plus maturity timestamp | Uses FHE correctly, boundary remains | Maturity bucket can be public; exact date should be disclosed only after access or in legal docs. |
| Fingerprint | Encrypted handle plus plaintext fingerprint input | Uses FHE plus commitment/hash | Duplicate detection benefits from FHE; document hash style data also benefits from commitments. |
| Discount rate | FHE handle plus plaintext boundary | Should use FHE | Deal economics should be selectively disclosed; plaintext remains only for current ERC20 purchase execution. |
| Purchase price | FHE computed handle plus plaintext ERC20 transfer amount | Uses FHE correctly, boundary remains | Final amount must be revealed to execute standard USDC transfer today. |
| Supplier reserve | Plaintext settlement field plus encrypted ledger credit | Should use FHE | Reserve reveals economics; keep plaintext only at settlement boundary. |
| Platform fee | Plaintext settlement field plus encrypted ledger credit | Could use FHE | Commercially sensitive but lower priority than face value and purchase price. |
| Investor proceeds | Confidential settlement balance handle | Uses FHE correctly | Claimable balances are commercially sensitive and benefit from ACL-based decryption. |
| Supplier repayment stats | Encrypted ratio/stat handles | Uses FHE correctly | Enables confidential reputation without exposing supplier history. |
| Compliance/KYB attributes | Encrypted compliance attributes | Uses FHE correctly | Access gating and compliance checks benefit from encrypted predicates. |
| Supplier identity | Wallet address and SBT status | Should remain plaintext | Counterparty identity and role credentials are required for settlement and access control. |
| Debtor identity | Wallet address, email hash | Mixed: hash/signature/plaintext email boundary | Debtor wallet is protocol identity; email should remain off-chain with hash/attestation on-chain. |
| Invoice PDF | Off-chain uploaded document | Should use conventional encryption | FHE does not help with document rendering; encrypt at rest with access policy. |
| Parser output | Backend draft data | Should use conventional encryption and retention limits | Operational text, not on-chain computable data. |
| NOA contents | Generated legal document | Should use signatures and conventional encryption | Needs legal readability; use access control, signatures, and commitments. |
| Payment reference | Commitment/hash on-chain, mock plaintext response | Should use commitments | Exact bank trace is not useful for FHE computation. |
| Bank trace | Commitment/hash on-chain, mock plaintext response | Should use commitments | Audit integrity matters more than homomorphic math. |
| Marketplace total value | Removed from public UI | Should not be plaintext | Public aggregate leaked deal size and weakened selective disclosure story. |
| Marketplace card size tier | Removed from public UI | Should not be plaintext-derived | Tier leaked face value before authorization. |
| Risk score | Derived after authorized decrypt | Could use FHE but low priority | Current model is deterministic; full encrypted scoring would improve demo but needs careful threshold design. |
| Invoice status | Plaintext enum | Should remain plaintext | Lifecycle state must be public for market coordination. |
| Collateral status | Plaintext status | Should remain plaintext | Investors need to know whether collateral exists; amount can remain boundary/private. |

## 5. Recommended Cryptographic Primitive By Field

| Field | Recommended Primitive |
| --- | --- |
| Face value, due date, discount, purchase price, repayment history, confidential balances | Zama FHEVM |
| Invoice PDF, OCR text, parser draft, NOA PDF | Conventional encryption plus signed commitments |
| Invoice hash, payment reference, bank trace, settlement receipt | Commitments/hashes |
| Debtor attestation, email verification, KYB oracle authorization | Signatures |
| Invoice status, funding status, role credential existence, maturity bucket | Plaintext |

## 6. Plaintext Leakage Report

High impact fixed in this pass:

- Public marketplace total face value aggregate.
- Marketplace size tier derived from `faceValuePlaintext`.
- Investor detail reliance on public `getPurchasePricePlaintext`.
- Settlement panel reliance on public `getSettlementAudit`.
- Normal investor risk flow posting decrypted hints to `/api/risk-assessment`.

High impact remaining:

- Registry and escrow still store plaintext economics to support standard USDC execution.
- Legacy public getters still expose plaintext economics for ABI compatibility.
- Upload and NOA routes receive sensitive invoice terms at integration boundaries.

Medium impact remaining:

- Mock bank webhook receives plaintext amount.
- Scripts print plaintext invoice fields for diagnostics.
- Portfolio/dashboard should be reviewed again for any public economics display after future UI changes.

## 7. Frontend Confidentiality Audit

- Marketplace now shows counts/statuses instead of public financial totals.
- Invoice mini-card now uses status-derived bands, not face-value tiers.
- Invoice detail modal requires decrypted purchase price before capital deployment.
- Invoice detail modal reads settlement commitments, not settlement plaintext splits.
- Risk model runs locally after authorized decryption in the normal flow.
- Remaining frontend boundary: mock settlement uses `faceValuePlaintext` as the bank rail amount.

## 8. Backend Confidentiality Audit

- `/api/risk-assessment` still exists for compatibility but is no longer used by the normal modal flow.
- `/api/mock-bank-webhook` remains a demo rail and receives amount as plaintext.
- `/api/download-noa` remains a legal document boundary and should be access-controlled and logged.
- `/api/parse-invoice` necessarily sees uploaded document data during ingestion and should encrypt at rest and purge drafts aggressively.

## 9. Smart Contract Confidentiality Audit

- `requestRiskAssessmentAccess` is correctly investor-SBT gated after live wiring and deployment script changes.
- FHE ACL granting remains the right model for investor selective disclosure.
- `getSettlementCommitments` reduces client dependency on plaintext settlement economics.
- Legacy plaintext getters remain public for compatibility and are the main on-chain confidentiality weakness left.
- Standard ERC20 transfers are the main architectural reason plaintext economics still exist.

## 10. Zama Hackathon Assessment

| Category | Score | Rationale |
| --- | ---: | --- |
| Confidential Computing | 8 | Major deal values use FHE and UI now demonstrates selective disclosure; ERC20 boundary remains plaintext. |
| Zama Integration | 8 | Good encrypted handles, ACL grants, duplicate/stat logic; full confidential purchase/settlement rails remain future work. |
| Product Quality | 8 | Blocking investor access wiring fixed and marketplace no longer leaks economics. |
| User Experience | 7 | Disclosure flow is clearer; lint tooling and live no-attested-invoice validation remain gaps. |
| Technical Depth | 8 | Uses FHE for meaningful computation and ACL decryption, not blanket encryption. |
| Smart Contract Design | 7 | Additive compatibility preserved; legacy plaintext getters weaken the story. |
| Security | 7 | Access wiring fixed; public plaintext boundary getters should be removed or restricted in next ABI. |
| Demo Quality | 8 | Judge can see the selective disclosure story more clearly. |
| Innovation | 8 | Confidential factoring economics are differentiated. |
| Production Readiness | 6 | Needs confidential token rails, data retention controls, non-interactive lint setup, and restricted legacy getters. |

## 11. Highest Impact Next Steps

P0:

- Remove or restrict public plaintext economics getters in a v3 ABI.
- Replace standard USDC purchase and settlement with confidential token rails or a private settlement adapter.

P1:

- Make risk scoring fully FHE-based for threshold outputs and authorized final score disclosure.
- Encrypt parser/OCR drafts at rest and add automatic purge after upload confirmation.

P2:

- Replace mock bank plaintext trace response with actor-only encrypted envelope plus on-chain commitment.
- Add dashboard and portfolio tests proving pre-access economics are hidden.

P3:

- Add non-interactive ESLint configuration.
- Split diagnostic scripts into safe redacted defaults and explicit debug modes.
