# Arbitra Confidentiality-Only FHE Audit

## 1. Executive Summary

Arbitra has meaningful Zama FHEVM integration, but its strongest confidentiality story is weakened by plaintext economic mirrors that drive production business logic. The protocol encrypts invoice face value, due date, purchase price, discount rate, fingerprint, compliance data, duplicate results, settlement ledger balances, and supplier repayment statistics. However, public contract state and frontend/API flows still expose face value, purchase price, discount rate, collateral amount, settlement split amounts, debtor email-linked token data, NOA contents, KYB risk scores, and marketplace aggregates.

The most important issue is not missing encryption primitives. It is that encrypted values are often duplicated as plaintext and the plaintext path is authoritative for USDC transfers, factoring economics, collateral, settlement, and marketplace stats. Reviewers will notice that the dApp advertises confidential invoice factoring while `faceValuePlaintext`, `getPurchasePricePlaintext`, and `getSettlementAudit` expose the core economics.

Classification key:

- A: Correctly using FHE already.
- B: Should absolutely use FHE.
- C: Could use FHE but low priority.
- D: Should remain plaintext.

## 2. Complete Confidentiality Matrix

| Field | Current implementation | Current visibility | Who should see it | Current confidentiality level | Class | Priority | Reason | Suggested implementation | Effort | Judge impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Invoice face value handle | `ArbitraInvoiceRegistry.Invoice.faceValue` as `euint64`; ACL to supplier, debtor, investor/access grantees | Encrypted handle public, cleartext gated by ACL | Supplier, debtor, authorized investors, platform verifier | Strong FHE storage | A | P0 maintain | This is the right use of FHE for selective disclosure and calculations | Keep encrypted handle as source of truth; remove public mirror dependency | Medium | High positive |
| `faceValuePlaintext` | Stored in registry, escrow, collateral flow; public getter and struct | Public on-chain and UI/API | Supplier, debtor, authorized investors, settlement parties | Plaintext | B | P0 | This is the single largest leak because it reveals invoice size and drives payments | Replace with encrypted value plus confidential computation for pricing; where ERC-20 transfer requires amount, reveal only to transaction parties or use signed settlement commitment | High | Very high |
| Due date handle | `dueDate` as `euint64`; ACL-gated decryption | Encrypted handle public | Supplier, debtor, authorized investors | Strong FHE storage | A | P1 maintain | Tenor affects credit pricing and should be selectively disclosed | Keep FHE handle; derive days-to-maturity from encrypted input or disclosed only to authorized investors | Medium | High positive |
| `maturityTimestamp` | Plain registry and escrow timestamp | Public on-chain and UI | Supplier, debtor, authorized investors, settlement automation | Plaintext | C | P2 | Operationally useful, but tenor can leak supplier liquidity pressure | Keep status/maturity buckets public, disclose exact due date by ACL | Medium | Medium |
| Purchase price handle | `purchasePrice` as `euint64` with ACL | Encrypted handle public | Supplier, factor investor, platform | Strong FHE storage | A | P0 maintain | Good encrypted output of pricing logic | Make it authoritative instead of computing plaintext mirror | Medium | High positive |
| `getPurchasePricePlaintext` | Public registry view computes from plaintext face value and discount | Public on-chain; used by modal and preflight | Authorized investors after access, supplier | Plaintext | B | P0 | Reveals financing offer and spread to all observers | Remove public getter; use ACL-gated decryption for investor quote, or KMS/public-decrypt only inside a transaction-specific settlement proof | High | Very high |
| Discount rate handle | `discountRateBps` as `euint64` | Encrypted handle public | Supplier and authorized investors | Strong FHE storage | A | P1 maintain | Discount rate is commercial pricing | Keep encrypted, avoid plaintext approximation as authority | Medium | High |
| `discountRatePlaintext` | Stored in registry and used for purchase price approximation | Public via struct/getters | Authorized investors and supplier | Plaintext | B | P0 | Leaks pricing model and margin | Compute discount homomorphically; expose only with ACL to authorized investor after risk access | Medium | Very high |
| Supplier reserve | `supplierReservePlaintext` in escrow audit | Public on-chain via `getSettlementAudit` | Supplier, investor, platform treasury, auditor | Plaintext | B | P0 | Reveals withheld proceeds and factoring economics | Store as encrypted settlement component; return handle with ACL to supplier/platform | Medium | High |
| Platform fee | `platformFeePlaintext` in escrow | Public on-chain via audit getter | Platform, investor where required, auditor | Plaintext | C | P1 | Fee schedule may be business-sensitive but less sensitive than face value | Store encrypted when dynamic; public static fee schedule can remain plaintext | Low-Medium | Medium |
| Investor payout amount | Derived from plaintext face value/reserve/fee and USDC transfer amount | Public through ERC-20 transfer logs and escrow state | Investor, platform, auditor | Plaintext | B | P0 | Reveals realized return and invoice size | Use confidential settlement ledger for internal accounting; for standard USDC, minimize additional contract/API disclosure and disclose only required transfer amount | High | High |
| Collateral amount | `stakeCollateral(fingerprint, faceValueUSDC)` computes and emits plaintext amount | Public on-chain | Supplier, protocol, possibly investor | Plaintext | B | P1 | 5 percent collateral reveals face value almost exactly | Accept encrypted face value and compute collateral requirement confidentially where possible; otherwise use tiered collateral buckets | High | High |
| Plaintext fingerprint | Upload and collateral link use `plaintextFingerprint`/fingerprint map | Public transaction calldata/state by fingerprint | Protocol duplicate checker, supplier | Plaintext/commitment-like | B | P0 | Fingerprint can enable invoice correlation and duplicate intelligence | Use salted deterministic commitment for stake linkage; keep FHE fingerprint for duplicate check | Medium | High |
| Encrypted fingerprint | `fingerprintHash` and fingerprint registry use `euint64` with duplicate check | Encrypted handles public | Protocol, supplier, owner for audit | FHE protected | A | P1 maintain | Useful for duplicate detection without raw fingerprint disclosure | Keep, but enforce duplicate result before registration | Medium | High |
| Duplicate detection result | `ebool` pending result, ACL to supplier/owner | Encrypted handle | Supplier and platform | FHE protected | A | P1 maintain | Appropriate confidential boolean | Strengthen lifecycle so duplicate check cannot be bypassed by separate registration path | Medium | Medium |
| Invoice PDF | Stored via `pdfStore`/download route and sent as base64 to API | Server/runtime and token-gated download | Supplier, debtor, platform, authorized investor if disclosed | Off-chain plaintext | B | P1 | PDF can contain all commercial terms, bank details, names, tax data | Store encrypted off-chain with per-recipient access; put hash/commitment on-chain | Medium | High |
| OCR/parser raw text | Parsed in backend and frontend state | Server logs/memory/browser state | Supplier and parsing service only | Plaintext transient | C | P2 | FHE does not help OCR; secure deletion and logging discipline matter more | Keep off-chain plaintext during parsing; never persist raw OCR unless encrypted | Low | Medium |
| Parser output | `faceValue`, `dueDate`, `invoiceNumber`, debtor email in API response/UI | Browser and backend | Supplier initially; debtor later; investors only after access | Plaintext | B | P1 | Parsed fields are core invoice facts | Encrypt before upload and avoid marketplace plaintext mirrors; keep review UI local to supplier | Medium | High |
| Invoice number | Token, NOA, verify page, parser output | Debtor token route, NOA, browser | Supplier, debtor, authorized investor | Plaintext | C | P2 | Identifies trade relationship but needed in NOA | Keep off-chain and token-gated; store salted commitment on-chain | Low | Medium |
| Debtor email | Token payload and NOA route; on-chain hash only | API token, email provider, NOA PDF | Supplier, debtor, platform mailer | Off-chain plaintext, on-chain hash | C | P1 | Email is PII; FHE not useful for delivery, but storage should be minimized | Keep plaintext only in short-lived encrypted token/mail flow; avoid embedding invoice economics in same token | Low | Medium |
| `debtorEmailHash` | SHA-256 email hash on-chain | Public commitment | Protocol and verifier | Deterministic hash | C | P2 | Hash may be dictionary-brute-forced for corporate emails | Use salted commitment signed by verifier; keep raw email off-chain | Low | Medium |
| Supplier identity | Wallet address and SBT | Public | Marketplace participants need issuer identity or pseudonym | Plaintext public address | D/C | P3 | Counterparty identity may be required for market trust | Keep wallet public; use optional pseudonymous issuer profiles for private mode | Medium | Low-Medium |
| Debtor identity wallet | `debtor` address in invoice | Public | Supplier, debtor, authorized investors | Plaintext public address | C | P2 | Debtor relationship can reveal customer list | For email-attested invoices, keep debtor address zero; for wallet-attested, consider commitment/pseudonym | Medium | Medium |
| Investor allocation | `investor` address and investor invoice list | Public | Investor, supplier, platform | Plaintext | C | P2 | Reveals portfolio strategy | Consider private allocation registry or encrypted investor sets for institutional mode | High | Medium |
| Invoice status | Enum in registry and UI | Public | All marketplace users | Plaintext | D | P3 | Lifecycle status is necessary market state | Keep plaintext | None | Neutral |
| Factored/settled flags | Status plus events | Public | Marketplace users | Plaintext | D | P3 | Needed for market operation | Keep plaintext | None | Neutral |
| KYB tax ID | Encrypted in `ArbitraIdentity`; plaintext in onboarding API/client | FHE on-chain, plaintext transient off-chain | User, compliance owner, relayer during KYB | Mixed | A/C | P1 | FHE storage is correct; off-chain KYB intake cannot be FHE-only | Keep FHE storage; avoid logging and encrypt at rest if persisted | Low | High positive |
| KYB status | Encrypted `ebool` plus public SBT existence | Encrypted detailed status, public pass/fail | User, compliance owner; market can know eligibility | Mixed | A/D | P2 | Public eligibility is product-required; detailed compliance can stay encrypted | Keep as is | Low | Medium |
| KYB risk score raw | Encrypted in identity, but raw score emitted in KYB oracle/SBT event and API response | Public on-chain events/API | User, compliance, maybe platform risk | Plaintext leak | B | P1 | Raw score is sensitive business/compliance data | Store only bucket publicly or no score event; keep raw risk score encrypted in identity | Medium | High |
| SBT risk bucket | `riskScoreBucket` in SBT record | Public | Market may need coarse accreditation tier | Plaintext bucket | D/C | P3 | Coarse public bucket is acceptable if product wants gating | Keep low/medium/high only; avoid raw score event | Low | Medium |
| Company name/registration/country | KYB API request and logs | Backend logs/runtime | Compliance provider, user, platform | Plaintext off-chain | C | P2 | KYB providers require plaintext; FHE not helpful for external checks | Minimize logs; encrypt stored KYB documents | Low | Medium |
| Risk assessment output | Deterministic frontend/backend risk score and summary | Investor UI after decrypt; sometimes local state | Authorized investors only | Plaintext in UI | C/B | P2 | Investors need the result, but public leakage weakens privacy story | Compute from decrypted values client-side for authorized users; do not persist public scores | Medium | Medium |
| Supplier repayment stats | `SupplierStats` encrypted totals/repaid/ratio | Encrypted handle; ACL to supplier | Supplier, authorized underwriters/platform | FHE protected | A | P1 maintain | Good FHE use for reputation | Add selective investor access via ACL when needed | Low | High |
| Marketplace total value | Sums `faceValuePlaintext` in `MarketplaceClient` | Public investor UI | Possibly marketplace operator; not all users | Plaintext aggregate | B | P1 | Aggregate leaks book size and can reveal individual values in thin markets | Use count/status public; show aggregate only to platform or compute encrypted/public range buckets | Medium | High |
| Portfolio analytics | Uses invoice lists, statuses, values | User dashboard/browser | Portfolio owner and platform | Mixed/plaintext | C/B | P2 | Portfolio holdings are commercially sensitive | Gate values behind user decryption; keep public counts only | Medium | Medium |
| Settlement ledger balances | `confidentialSettlementBalances` as `euint64` with ACL | Encrypted handle | Beneficiary only, platform if explicitly allowed | FHE protected | A | P1 maintain | Good confidential ledger pattern | Avoid plaintext audit outputs that reveal same split | Low | High |
| Payment reference | Hash/commitment on-chain but plaintext returned by mock API and NOA | API/UI/NOA, hash public | Debtor, lockbox, platform, relevant investor | Mixed | C | P2 | FHE is less useful than commitments for references | Keep salted commitments on-chain; reveal plaintext only in NOA/payment channel | Low | Medium |
| Bank trace ID | Hash on-chain, plaintext UI after simulation | API/UI | Platform, bank, auditor | Mixed | C | P2 | Deterministic commitment is appropriate; plaintext UI should be role-gated | Keep commitment on-chain and hide plaintext except platform/auditor | Low | Medium |
| Bank account/routing | Hardcoded in NOA PDF | Anyone with NOA link/token | Debtor and platform | Plaintext | D/C | P3 | Payment instructions must be visible to debtor | Keep off-chain/token-gated; avoid on-chain storage | Low | Low |
| Assignment/NOA contents | Generated PDF includes face value, due date, parties, payment ref | Token/download route | Debtor, supplier, platform, assignee | Plaintext document | C | P2 | NOA legally requires disclosure to debtor; FHE does not help PDF contents | Token-gate, expire, watermark, store encrypted off-chain; on-chain hash only | Low | Medium |
| Claimable proceeds | Confidential balance handle exists but UI may derive from settlement audit | Mixed | Beneficiary | Mixed | B | P1 | Claimable funds reveal economics | Use `getConfidentialSettlementBalance` and user decrypt; remove plaintext fallback | Medium | High |
| Public events with amounts | USDC transfers, collateral, KYB score, settlement metadata | Public logs | Varies | Plaintext public | B/C | P1-P2 | Event logs are permanent leaks | Avoid emitting sensitive amounts where not required; use commitments or encrypted handles | Medium | High |

## 3. Missing FHE Opportunities Ranked By Impact

1. Public economic mirrors: `faceValuePlaintext`, `discountRatePlaintext`, `getPurchasePricePlaintext`, escrow split fields. These most weaken the confidential computing story because they reveal exactly what FHE is supposed to protect.
2. Settlement economics: supplier reserve, investor payout, platform fee, claimable proceeds, and public settlement audit outputs should rely on encrypted ledger handles and commitments.
3. Marketplace and portfolio aggregates: public total value and invoice-level cards should not derive from plaintext face value in a thin market.
4. Collateral amount and fingerprint linkage: plaintext collateral reveals face value and plaintext fingerprints create correlation risk.
5. KYB raw risk score: current FHE compliance storage is good, but raw risk is still emitted/returned publicly through the SBT/oracle path.

## 4. Unnecessary FHE Usage

- Invoice PDF/OCR text should not use FHE. It is better handled by encrypted off-chain storage, short retention, and on-chain commitments.
- Payment reference and bank trace ID are better as salted commitments than FHE values. They need later proof/audit equality, not homomorphic computation.
- Public invoice status should remain plaintext. Encrypting status would hurt market usability and add little confidentiality.
- SBT ownership can remain public if it is only eligibility gating. Encrypting the fact of eligibility would complicate access control without much demo value.
- Encrypted discount and purchase price provide little practical value while plaintext mirrors remain authoritative. The fix is not to remove them, but to stop duplicating them into public business logic.

## 5. Plaintext Leakage Report

Critical leaks:

- `ArbitraInvoiceRegistry.faceValuePlaintext`: public invoice amount.
- `getPurchasePricePlaintext`: public factoring price.
- `discountRatePlaintext`: public financing spread input.
- `ArbitraEscrowReceiver.getSettlementAudit`: public purchase price, reserve, and fee split.

High leaks:

- Marketplace total value from `faceValuePlaintext`.
- Collateral amount from `stakeCollateral`, which reveals invoice size.
- KYB raw risk score in oracle/SBT events and API response.
- NOA/token/download paths containing debtor email, invoice number, face value, and due date.

Medium leaks:

- Plain debtor/supplier/investor relationships.
- Payment reference and bank trace plaintext in mock settlement UI.
- Parser output and browser state during invoice upload.
- Portfolio analytics and invoice lists.

## 6. Frontend Confidentiality Audit

- `MarketplaceClient.tsx` computes `totalValueShielded` from `faceValuePlaintext`, which contradicts the label and leaks book value.
- `InvoiceDetailModal.tsx` reads `getPurchasePricePlaintext`, uses plaintext face value for settlement simulation, and displays settlement audit metadata.
- `UploadInvoiceForm.tsx` keeps parsed `faceValue`, `dueDate`, `invoiceNumber`, and `debtorEmail` in client state and sends them to verification APIs.
- `VerifyClient.tsx` sends face value, due date, invoice number, and token details into NOA preview/download flows.
- The UI sometimes tells users financial fields are FHE-protected while using plaintext fallbacks for core actions. That mismatch will cost hackathon credibility.

## 7. Backend Confidentiality Audit

- `tokenStore.ts` signs JWTs containing debtor email, face value, due date, and invoice number. The token is not consumed server-side and uses `VERIFIER_PRIVATE_KEY` as a fallback token secret.
- `send-verify-email` receives invoice PDF base64 plus invoice economics and debtor email. This is acceptable for delivery only if retained briefly and never logged.
- `download-noa` accepts sensitive invoice details in query parameters and emits them into a PDF. This is legally necessary for the debtor but should be token-gated and not reused as a general public download.
- `mock-bank-webhook` returns plaintext payment reference and bank trace values to the UI. Use commitments on-chain and role-gate plaintext display.
- `kyb-verify` receives KYB data and returns raw risk score. FHE storage exists later, but the API and SBT event still leak the score.

## 8. Smart Contract Confidentiality Audit

- Registry: good FHE handle storage and ACL grants, but public plaintext mirrors drive factoring and getters. This is the largest confidentiality weakness.
- Escrow: confidential settlement ledger is good, but it is funded from plaintext split fields and public settlement audit returns those split fields.
- Collateral vault: plaintext collateral requirement reveals face value and maps collateral to deterministic fingerprint.
- Fingerprint registry: encrypted duplicate checking is a good FHE use. The current design still needs care because plaintext fingerprint paths elsewhere reduce its value.
- Identity: encrypted tax ID, KYB status, and risk score are strong, but raw KYB risk leaks through SBT/oracle.
- SBT/KYB oracle: public eligibility is fine; raw risk score in event and record should be reduced to bucket or moved fully into encrypted identity.

## 9. Final Recommended FHE Roadmap

P0:

- Remove or deprecate public `faceValuePlaintext`, `discountRatePlaintext`, and `getPurchasePricePlaintext` as user-facing/public data sources.
- Make encrypted purchase price/discount the authoritative quote for investor review.
- Replace public settlement split getter with encrypted balance handles plus commitment hashes.

P1:

- Redesign collateral staking so amount does not reveal exact face value. Use encrypted computation or tiered/bucketed collateral.
- Stop emitting or returning raw KYB risk score publicly. Keep raw score in `ArbitraIdentity` only.
- Gate marketplace values and portfolio proceeds behind FHE user decryption.
- Store invoice PDFs and parser outputs encrypted off-chain with on-chain hashes only.

P2:

- Replace deterministic debtor email hash with salted verifier commitment.
- Make NOA/download URLs short-lived, single-use, and scoped to debtor/supplier.
- Convert payment reference and bank trace to salted commitments with role-gated plaintext retrieval.

P3:

- Keep lifecycle status, invoice IDs, contract addresses, and broad eligibility signals plaintext.
- Consider optional pseudonymous supplier/debtor profiles for institutional demo mode.

## 10. Likely Zama Judge Weaknesses And Exact Fixes

Weakness 1: Core economics are public despite FHE handles.

Fix: make FHE handles the authoritative source for face value, purchase price, discount, reserve, and settlement balances. Remove public plaintext getters from marketplace and detail UI.

Weakness 2: Confidential settlement ledger is undermined by public settlement audit splits.

Fix: expose commitment hashes publicly and encrypted balance handles privately. Grant ACL to investor, supplier, treasury, and auditor roles.

Weakness 3: Marketplace claims "shielded" value while summing plaintext face values.

Fix: show public counts/status only; reveal values after `requestRiskAssessmentAccess` and user decrypt.

Weakness 4: KYB raw score leaks through non-FHE SBT/oracle path.

Fix: emit only coarse bucket or eligibility; store raw score exclusively in encrypted identity.

Weakness 5: Off-chain documents and tokens carry sensitive invoice details.

Fix: keep FHE for on-chain financial values and use conventional encryption/commitments for documents. Do not put face value/due date into long-lived query strings or reusable tokens.

Overall confidentiality score if judged today: 6.5/10. The implementation demonstrates real FHEVM usage, but public plaintext mirrors of the same business values would likely cost the most points with Zama reviewers.
