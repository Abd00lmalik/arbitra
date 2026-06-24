# Arbitra Audit - Deterministic Financial Core and FHE Coverage

Date: 2026-06-24

## Scope

This audit covered:

- Gemini and LLM dependency usage across the repository
- Zama FHE workflow coverage across the current product lifecycle
- Notice of Assignment generation and determinism
- Settlement roadmap status
- Post-change verification after removing Gemini from the financial core

## A. Gemini Dependency Audit

| File Path | Purpose | Downstream Dependencies | Removal Risk | Status |
|---|---|---|---|---|
| `frontend/src/lib/gemini.ts` | Prior server-side Gemini wrapper for underwriting and document extraction | `/api/risk-assessment`, `/api/parse-invoice`, upload UX | High before migration, zero after replacement | Removed |
| `frontend/src/app/api/parse-invoice/route.ts` | Invoice parsing endpoint | Upload wizard, duplicate check prep, FHE inputs | Critical because parsed values feed encryption and upload | Replaced with deterministic pipeline |
| `frontend/src/app/api/risk-assessment/route.ts` | Investor underwriting endpoint | Marketplace and invoice detail panels | Medium | Replaced with deterministic model |
| `frontend/src/hooks/useRiskAssessment.ts` | Frontend consumer of risk endpoint | `RiskAssessmentPanel` | Low | Updated to deterministic path |
| `frontend/src/components/invoice/RiskAssessmentPanel.tsx` | Investor-facing risk UI | Marketplace and invoice detail modal | Low | Updated copy and expectations |
| `frontend/src/lib/tokenStore.ts` | Verification-token signing secret source | Email attestation flow | Medium because fallback secret touched auth | Gemini fallback removed |
| `contracts/ArbitraInvoiceRegistry.sol` | Legacy boolean naming: `geminiUnderwritingEnabled`, `enableGeminiUnderwriting` | ABI, frontend tuple parsing, deployed storage layout | High if renamed now because deployed ABI/storage would drift | Left in place as legacy naming only |
| `frontend/src/lib/contracts.ts` | ABI/type mirror for deployed contract field names | All registry reads/writes | High if renamed now | Left in place as legacy naming only |
| `frontend/src/hooks/useArbitraRegistry.ts` | Mock invoice data still includes `geminiUnderwritingEnabled` | Mock marketplace state | Low | Left in place because it mirrors contract tuple shape |
| `frontend/src/components/landing/*` and `frontend/src/app/page.tsx` | Marketing copy referencing Gemini | Landing page only | Low | Updated to deterministic wording |
| `README.md` | Documentation referencing Gemini path | Developer onboarding | Low | Updated |
| `frontend/package-lock.json` | Transitive `@gemini-wallet/core` package from wallet dependencies | Wallet SDK dependency tree, not invoice ingestion | Low | Left untouched; not part of financial core |

### Gemini removal conclusion

Gemini and LLM execution have been removed from the financial core:

- invoice ingestion
- field extraction
- OCR fallback chain
- risk assessment API

Remaining Gemini mentions are either:

- legacy on-chain ABI and storage names that should not be renamed before the hackathon, or
- transitive package names unrelated to invoice parsing, or
- test/documentation references describing the removal itself.

## B. Zama / FHE Coverage Audit

| Workflow | Uses FHE Today? | Correct? | Should Use FHE? | Recommended Change | Evidence |
|---|---|---|---|---|---|
| Onboarding SBT gate | No | N/A | No | Keep as-is | `contracts/ArbitraSBT.sol`, `frontend/src/app/register/page.tsx` |
| KYB encrypted compliance storage | Yes | Yes | Yes | Keep as-is | `contracts/ArbitraIdentity.sol` uses `FHE.fromExternal`, `allowThis`, `allow` |
| Compliance storage relay | Yes | Yes | Yes | Keep as-is | `frontend/src/app/api/compliance-store/route.ts` encrypts tax ID, KYB status, risk score |
| Invoice upload | Yes | Mostly | Yes | Keep FHE flow; deterministic parsing now feeds it | `contracts/ArbitraInvoiceRegistry.sol:232-336`, `frontend/src/components/invoice/UploadInvoiceForm.tsx` |
| Invoice amount confidentiality | Yes | Partially | Yes | Long-term reduce plaintext dependence; do not refactor before hackathon | Encrypted `faceValue` plus plaintext `faceValuePlaintext` in `ArbitraInvoiceRegistry.sol` |
| Due date confidentiality | Yes | Yes | Yes | Keep as-is | Encrypted `dueDate` stored and debtor gets ACL |
| Discount calculation | Yes | Mostly | Yes | Keep current FHE discount math; plaintext approximation remains for settlement/payment rail compatibility | `ArbitraInvoiceRegistry.sol`, `ArbitraRiskCalculator.sol` |
| Risk scoring | Partially | Partially | Partly | Deterministic off-chain model is acceptable for hackathon, but not confidential yet | `frontend/src/lib/risk-assessment.ts` |
| Duplicate invoice detection | Yes | Yes | Yes | Keep as-is | `contracts/ArbitraFingerprintRegistry.sol` |
| Debtor attestation | Partially | Yes | Partially | Keep as-is | Debtor decrypts FHE values off-chain and attests via EIP-712 |
| Investor review | Yes | Mostly | Yes | Keep; continue to gate decryption access | `requestRiskAssessmentAccess`, `InvoiceDetailModal`, decrypt hooks |
| Factoring | Yes | Partially | Yes | Keep current lifecycle; plaintext purchase rail still needed | `factorInvoice` uses encrypted state plus plaintext USDC transfer |
| Collateral | No | Yes | No | Keep as-is | `ArbitraCollateralVault.sol` uses plaintext staking amounts |
| Repayment | Yes | Yes | Yes | Keep and demo aggressively | `ArbitraEscrowReceiver.sol:repayInvoice` |
| Settlement | Yes | Yes | Yes | Keep and demo aggressively | Oracle proof, settlement event, encrypted payout ledger |
| Payout accounting | Yes | Yes | Yes | Keep as-is | `_applyConfidentialSettlement`, `_creditConfidentialBalance` |
| NOA generation | No | Now deterministic | No for document text itself | Keep deterministic code generation | `frontend/src/app/api/download-noa/route.ts` |
| Audit trail | Partially | Mostly | Partly | Keep, and surface document hashes where useful | settlement audit metadata on-chain, document headers off-chain |
| Analytics | No | N/A | Maybe later | Defer; not a hackathon blocker | Marketplace/dashboard use plaintext or mock summaries |

### Already using FHE correctly

- Encrypted compliance storage
- Encrypted duplicate detection
- Encrypted invoice face value, due date, purchase price, discount rate storage
- Investor and debtor ACL-gated decryption
- Encrypted settlement balance ledger
- Encrypted supplier repayment ratio

### Should use FHE more, but not necessarily before the hackathon

- Investor-facing off-chain risk model inputs
- Public analytics aggregates
- Plaintext face value and discount approximations used for payment rails
- Marketplace preview values and some non-critical UI hints

## C. NOA Audit

### Pre-change state

The NOA route already used code-based PDF generation and did not depend on Gemini:

- File: `frontend/src/app/api/download-noa/route.ts`
- Renderer: `pdf-lib`
- Inputs: invoice ID, supplier, debtor, face value, due date, verification mode, token-derived metadata
- Non-determinism: generation timestamp only

### Gaps found

- No assignment hash
- No document hash exposure
- No payment reference
- No mock lockbox bank details
- No explicit settlement instructions block

### Implemented change

The NOA route now:

- remains deterministic and code-generated
- derives an `assignmentHash`
- computes and exposes a document hash through response headers
- includes a payment reference
- includes mock lockbox routing/account instructions
- includes structured settlement instructions

## Implemented Changes

### Deterministic invoice ingestion

Added:

- `frontend/src/lib/ingestion/pdf.extractor.ts`
- `frontend/src/lib/ingestion/ocr.extractor.ts`
- `frontend/src/lib/ingestion/invoice.parser.ts`
- `frontend/src/lib/ingestion/ingestion.validator.ts`
- `frontend/src/lib/ingestion/ingestion.service.ts`
- `frontend/src/lib/ingestion/types.ts`

Behavior:

1. native PDF text extraction first
2. validation gate
3. single OCR fallback
4. regex and heuristic parsing only
5. `InvoiceDraft` output with extraction metadata

### Deterministic risk assessment

Added:

- `frontend/src/lib/risk-assessment.ts`

Replaced Gemini-backed underwriting with deterministic scoring in:

- `frontend/src/app/api/risk-assessment/route.ts`
- `frontend/src/hooks/useRiskAssessment.ts`
- `frontend/src/components/invoice/RiskAssessmentPanel.tsx`

### NOA hardening

Updated:

- `frontend/src/app/api/download-noa/route.ts`

New outputs:

- payment reference
- assignment hash
- mock lockbox details
- settlement instructions
- response headers:
  - `X-Arbitra-Assignment-Hash`
  - `X-Arbitra-Document-Hash`

### Documentation and product copy

Updated:

- `README.md`
- `frontend/src/app/page.tsx`
- `frontend/src/components/landing/FeaturesSection.tsx`
- `frontend/src/components/landing/HowItWorks.tsx`
- `frontend/src/components/landing/HeroSection.tsx`
- `frontend/src/components/landing/TrustBar.tsx`
- `frontend/src/components/landing/PhoneMockup.tsx`
- `frontend/src/components/landing/LockVaultIllustration.tsx`

## Phase 5 - Post-Implementation FHE Gap Analysis

| Opportunity | Impact | Complexity | Recommended Priority |
|---|---|---|---|
| Remove `faceValuePlaintext` from economic source of truth | High | High | P2 after hackathon |
| Remove `discountRatePlaintext` approximation | High | High | P2 after hackathon |
| Make underwriting itself confidential | Medium | Medium | P2 |
| Hide marketplace amount hints until decryption | Medium | Medium | P1/P2 |
| Confidential portfolio analytics | Low | Medium | P3 |
| Confidential NOA metadata anchoring on-chain | Medium | Medium | P2 |

## Phase 6 - Settlement Roadmap Verification

| Item | Status | Evidence |
|---|---|---|
| Oracle payment proof | Implemented | `frontend/src/app/api/mock-bank-webhook/route.ts`, `ArbitraEscrowReceiver.sol:_verifyPaymentProof` |
| Encrypted payout ledger | Implemented | `confidentialSettlementBalances`, `_creditConfidentialBalance` |
| Confidential settlement balances | Implemented | `getConfidentialSettlementBalance` |
| Settlement dashboard | Implemented | `frontend/src/components/shared/InvoiceDetailModal.tsx` |
| Audit trail | Implemented | `getSettlementAudit`, `SettlementFinalized`, UI surfacing |
| Invoice retirement / settlement finalization | Implemented at status layer | `onEscrowSettled`, registry status -> `Settled`; no NFT burn path exists because registry is not NFT-based |

## Validation Performed

- `npx hardhat compile`
- `npx hardhat test test/InvoiceIngestion.test.ts`
- `cd frontend && npm run build`

## Remaining Gaps for the Zama Hackathon

1. Legacy Gemini-named ABI/storage fields remain on-chain for compatibility.
2. Plaintext payment-rail artifacts still exist for USDC transfer compatibility.
3. The risk model is deterministic but not confidential.
4. The OCR path is local and deterministic, but still heavier than text-native PDFs for demo use.

## Recommendation

For the hackathon, this is the right stopping point:

- keep the working FHE lifecycle intact
- demo deterministic ingestion as a trust and reproducibility upgrade
- demo confidential settlement as the differentiated end-to-end payoff
- avoid renaming deployed ABI/state just to remove legacy wording
