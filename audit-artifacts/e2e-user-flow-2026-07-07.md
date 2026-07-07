# Arbitra End-to-End User Flow Audit (Sepolia vNext)

Generated against branch `codex/confidentiality-refactor-final` at commit `280914f` on 2026-07-07.

## Executive Summary

- The investor-side cUSDC factoring path is implemented and the frontend gas-cap revert was repaired in `frontend/src/components/shared/InvoiceDetailModal.tsx:319` and `frontend/src/hooks/useArbitraRegistry.ts:321`.
- Real Circle Sepolia USDC is wrapped through a real ERC-7984 wrapper at `0xBf7BF8aF778fA83cCfb6e18B53ACa13A0a0A0Fe1`, validated against `underlying() == 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` and `decimals() == 6`.
- Confidential cUSDC transfer amounts are hidden on-chain inside ERC-7984 encrypted handles, but full invoice-economics confidentiality is still only partial because `faceValuePlaintext`, `discountRatePlaintext`, and maturity repayment `amount` remain public execution inputs in the factoring stack.

## Confidentiality Verdict

- cUSDC balances and cUSDC transfer amounts are confidential at the token layer. The wrapper and token standard use encrypted `euint64` balances and encrypted transfer amounts: `contracts/ArbitraConfidentialUSDC.sol:32`, `contracts/ArbitraConfidentialUSDC.sol:40`, `node_modules/@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol:100`, `node_modules/@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol:110`, `node_modules/@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol:124`, `node_modules/@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol:142`, `node_modules/@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol:82`, `node_modules/@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol:94`, `node_modules/@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol:114`.
- Invoice business data is not fully confidential end to end. Public fields still exist in the registry and escrow flows: `contracts/ArbitraInvoiceRegistry.sol:93`, `contracts/ArbitraInvoiceRegistry.sol:269`, `contracts/ArbitraInvoiceRegistry.sol:762`, `contracts/ArbitraEscrowReceiver.sol:170`, `contracts/ArbitraEscrowReceiver.sol:260`, `contracts/ArbitraEscrowReceiver.sol:316`.
- Practical conclusion: cUSDC transfer amounts are hidden on-chain, but invoice face value, flat discount hints, and repayment amount are still partially visible through public contract state or public calldata.

## 1. User opens the site and connects wallet

| What happens | File | Function | Status |
| --- | --- | --- | --- |
| Dashboard wallet entry renders the authenticated shell and wallet CTAs. | `frontend/src/app/dashboard/DashboardClient.tsx:212` | `AuthenticatedDashboard` | Implemented |
| "My Wallet" opens the authoritative wallet surface. | `frontend/src/app/dashboard/DashboardClient.tsx:268`, `frontend/src/app/dashboard/DashboardClient.tsx:277`, `frontend/src/app/dashboard/DashboardClient.tsx:290` | Wallet modal + `WalletAddressCard` render | Implemented |
| Verify page also reuses the same wallet card for debtor flows. | `frontend/src/app/verify/[invoiceId]/VerifyClient.tsx:852` | `WalletAddressCard` render | Implemented |

Broken links / notes:
- The user prompt mentions RainbowKit, but the live app also supports embedded wallet handling and custom signer paths, not only plain wagmi browser wallets.

ACL / confidentiality boundary:
- None yet. This step is wallet/session setup only.

## 2. Supplier selects Supplier role and completes KYB registration

| What happens | File | Function | Status |
| --- | --- | --- | --- |
| Registration page checks existing SBTs and routes verified users forward. | `frontend/src/app/register/page.tsx:426` | `checkExistingSBTAndRoute` | Implemented |
| Supplier submits KYB form data to the backend/oracle flow. | `frontend/src/app/register/page.tsx:650` | `handleKYBSubmit` | Implemented |
| Supplier mints the supplier SBT after attestation succeeds. | `frontend/src/app/register/page.tsx:725`, `frontend/src/app/register/page.tsx:1669` | `handleMintSBT`, `SBT_MINTED` stage | Implemented |
| Supplier SBT minting is performed by the KYB oracle contract. | `contracts/MockKYBOracle.sol:101`, `contracts/ArbitraSBT.sol:88` | `submitKYBAttestation`, `mintSBT` | Implemented |
| Encrypted compliance storage requires an existing supplier or investor SBT. | `contracts/ArbitraIdentity.sol:118`, `contracts/ArbitraIdentity.sol:148`, `contracts/ArbitraIdentity.sol:203` | `submitEncryptedComplianceFor`, `hasEncryptedCompliance`, `_submitEncryptedComplianceFor` | Implemented |
| Gasless encrypted compliance is relayed into the identity contract. | `frontend/src/app/api/compliance-store/route.ts:111`, `frontend/src/app/api/compliance-store/route.ts:233` | `POST`, `submitEncryptedComplianceFor` | Implemented |

Broken links / notes:
- Registration is hybrid, not a pure on-chain self-service flow. The oracle backend and compliance API are part of the required path.

ACL / confidentiality boundary:
- `ArbitraIdentity` grants encrypted compliance ACL to the verified wallet and governance owner: `contracts/ArbitraIdentity.sol:229` through `contracts/ArbitraIdentity.sol:237`.

## 3. Supplier opens My Wallet

| What happens | File | Function | Status |
| --- | --- | --- | --- |
| The dashboard wallet card shows ETH, USDC, and cUSDC. | `frontend/src/components/ui/WalletAddressCard.tsx:74`, `frontend/src/components/ui/WalletAddressCard.tsx:236` | `WalletAddressCard` | Implemented |
| Sidebar wallet panel shows the same ETH, USDC, and cUSDC state through the same shared hook. | `frontend/src/components/shared/WalletPanel.tsx:33`, `frontend/src/components/shared/WalletPanel.tsx:95` | `WalletPanel` | Implemented |
| Shared wallet hook reads ETH, public USDC, confidential cUSDC, permit state, operator state, and pending unshield state. | `frontend/src/hooks/useConfidentialWallet.ts:174`, `frontend/src/hooks/useConfidentialWallet.ts:200`, `frontend/src/hooks/useConfidentialWallet.ts:201`, `frontend/src/hooks/useConfidentialWallet.ts:202`, `frontend/src/hooks/useConfidentialWallet.ts:203`, `frontend/src/hooks/useConfidentialWallet.ts:211` | `useConfidentialWallet` | Implemented |
| Empty cUSDC state distinguishes `never_shielded` from real zero balance and maps `NoCiphertextError` safely. | `frontend/src/lib/confidentialWalletState.ts:51`, `frontend/src/lib/confidentialWalletState.ts:76`, `frontend/src/lib/confidentialWalletState.ts:97`, `test/ConfidentialWalletStateFrontend.test.ts:43` | `deriveConfidentialBalanceState` + regression tests | Implemented |

Broken links / notes:
- None on the wallet balance surface after the cUSDC state refactor.

ACL / confidentiality boundary:
- User decryption of cUSDC balance requires a permit and wrapper validation before `useConfidentialBalance` executes: `frontend/src/hooks/useConfidentialWallet.ts:174`.

## 4. Supplier navigates to Upload Invoice

| What happens | File | Function | Status |
| --- | --- | --- | --- |
| Upload access is gated on valid supplier SBT plus encrypted compliance. | `frontend/src/app/upload/UploadClient.tsx:35`, `frontend/src/app/upload/UploadClient.tsx:46`, `frontend/src/app/upload/UploadClient.tsx:97` | `hasValidSBT`, `hasEncryptedCompliance` checks | Implemented |
| Step 1 parses PDF data with deterministic parsing and local OCR fallback. | `frontend/src/components/invoice/UploadInvoiceForm.tsx:340`, `frontend/src/app/api/parse-invoice/route.ts:153` | `processFiles`, `POST` | Implemented |
| Step 2 validates preview fields including debtor email and extracted values. | `frontend/src/components/invoice/UploadInvoiceForm.tsx:231`, `frontend/src/components/invoice/UploadInvoiceForm.tsx:591`, `frontend/src/components/invoice/UploadInvoiceForm.tsx:1212` | local form state and validation | Implemented |
| Step 3 runs encrypted duplicate checking, collateral staking, fingerprint registration, and `uploadInvoice` to the registry. | `frontend/src/components/invoice/UploadInvoiceForm.tsx:533`, `frontend/src/components/invoice/UploadInvoiceForm.tsx:570`, `frontend/src/components/invoice/UploadInvoiceForm.tsx:713`, `frontend/src/components/invoice/UploadInvoiceForm.tsx:872`, `frontend/src/components/invoice/UploadInvoiceForm.tsx:911`, `frontend/src/components/invoice/UploadInvoiceForm.tsx:926`, `frontend/src/hooks/useArbitraRegistry.ts:346`, `contracts/ArbitraInvoiceRegistry.sol:269` | duplicate-check path, `stakeCollateral`, `confirmAndRegister`, `uploadInvoice` | Implemented |
| Step 4 creates and returns the debtor verification link. | `frontend/src/components/invoice/UploadInvoiceForm.tsx:974`, `frontend/src/components/invoice/UploadInvoiceForm.tsx:992`, `frontend/src/app/api/send-verify-email/route.ts:23`, `frontend/src/app/api/send-verify-email/route.ts:55`, `frontend/src/app/api/send-verify-email/route.ts:56` | verification email API | Implemented |
| The collateral actually locked during upload is public USDC, not cUSDC. | `contracts/ArbitraCollateralVault.sol:112`, `contracts/ArbitraInvoiceRegistry.sol:286` | `stakeCollateral`, collateral precondition in `uploadInvoice` | Implemented |

Broken links / notes:
- The prompt says `registerInvoice()`, but the real registry write is `uploadInvoice(...)`: `contracts/ArbitraInvoiceRegistry.sol:269`, `frontend/src/hooks/useArbitraRegistry.ts:346`.
- Upload still stores public invoice hints (`faceValuePlaintext`, `discountRatePlaintext`) on-chain, so the upload path is not fully confidential.

ACL / confidentiality boundary:
- Upload grants supplier ACL to face value, due date, purchase price, discount rate, risk score, and risk band; debtor gets face value, due date, purchase price, and discount rate when a debtor address is supplied: `contracts/ArbitraInvoiceRegistry.sol:393`, `contracts/ArbitraInvoiceRegistry.sol:394`, `contracts/ArbitraInvoiceRegistry.sol:395`, `contracts/ArbitraInvoiceRegistry.sol:396`, `contracts/ArbitraInvoiceRegistry.sol:397`, `contracts/ArbitraInvoiceRegistry.sol:398`, `contracts/ArbitraInvoiceRegistry.sol:401`, `contracts/ArbitraInvoiceRegistry.sol:402`, `contracts/ArbitraInvoiceRegistry.sol:403`, `contracts/ArbitraInvoiceRegistry.sol:404`.

## 5. Supplier sends attestation link to debtor

| What happens | File | Function | Status |
| --- | --- | --- | --- |
| The backend issues a verification token and URL. | `frontend/src/app/api/send-verify-email/route.ts:55`, `frontend/src/app/api/send-verify-email/route.ts:56` | `createVerifyToken`, `verifyUrl` generation | Implemented |
| If email delivery is not configured, the API still returns the manual verification URL. | `frontend/src/app/api/send-verify-email/route.ts:60` through `frontend/src/app/api/send-verify-email/route.ts:66` | manual-link fallback | Implemented |

Broken links / notes:
- Email delivery is optional. Without `RESEND_API_KEY`, this becomes a manual link-sharing flow.

ACL / confidentiality boundary:
- No new FHE ACL grant occurs here. This is off-chain token and URL distribution.

## 6. Debtor opens attestation link and confirms

| What happens | File | Function | Status |
| --- | --- | --- | --- |
| Verify page validates the token off-chain before showing the attestation UI. | `frontend/src/app/verify/[invoiceId]/VerifyClient.tsx:139`, `frontend/src/app/api/verify-token/route.ts:20` | `fetch("/api/verify-token")`, `validateVerifyToken` | Implemented |
| Debtor locally decrypts face value and due date through wallet-signed EIP-712 flow. | `frontend/src/app/verify/[invoiceId]/VerifyClient.tsx:180`, `frontend/src/app/verify/[invoiceId]/VerifyClient.tsx:194`, `frontend/src/app/verify/[invoiceId]/VerifyClient.tsx:243` | local decrypt and typed-data signatures | Implemented |
| Wallet debtor attestation writes to `confirmInvoice(...)` on-chain. | `frontend/src/app/verify/[invoiceId]/VerifyClient.tsx:266`, `frontend/src/app/verify/[invoiceId]/VerifyClient.tsx:268`, `contracts/ArbitraInvoiceRegistry.sol:419` | `confirmInvoice` | Implemented |
| Email-verifier fallback writes `confirmInvoiceEmailVerified(...)` on-chain through the backend verifier key. | `frontend/src/app/verify/[invoiceId]/VerifyClient.tsx:290`, `frontend/src/app/api/attest-email/route.ts:213`, `frontend/src/app/api/attest-email/route.ts:227`, `frontend/src/app/api/attest-email/route.ts:248`, `frontend/src/app/api/attest-email/route.ts:266`, `contracts/ArbitraInvoiceRegistry.sol:456` | `attest-email` route, `confirmInvoiceEmailVerified` | Implemented |
| Plaid sandbox UI is only a mock bank-link step. | `frontend/src/components/shared/PlaidModal.tsx:90`, `frontend/src/components/shared/PlaidModal.tsx:136`, `frontend/src/app/verify/[invoiceId]/VerifyClient.tsx:830` | `PlaidModal` | Partial |

Broken links / notes:
- Plaid attestation is hybrid and partially mocked. The authoritative on-chain step is `confirmInvoice` or `confirmInvoiceEmailVerified`; Plaid itself is not the trust anchor.
- Status after attestation changes from `Pending` to `Attested`: `contracts/ArbitraInvoiceRegistry.sol:438`.

ACL / confidentiality boundary:
- Debtor can decrypt only the fields granted during upload. The verify screen correctly treats decryption as wallet-local and ACL-gated.

## 7. Investor connects wallet and selects Investor role

| What happens | File | Function | Status |
| --- | --- | --- | --- |
| Registration checks investor SBT separately from supplier SBT. | `frontend/src/app/register/page.tsx:426`, `frontend/src/app/register/page.tsx:650`, `frontend/src/app/register/page.tsx:725` | onboarding checks and mint flow | Implemented |
| Marketplace access requires valid investor SBT plus encrypted compliance. | `frontend/src/app/marketplace/MarketplaceClient.tsx:52`, `frontend/src/app/marketplace/MarketplaceClient.tsx:65`, `frontend/src/app/marketplace/MarketplaceClient.tsx:121` | `hasValidSBT`, `hasEncryptedCompliance` | Implemented |
| Investor-specific SBT infra is deployed separately from supplier SBT infra. | `contracts/ArbitraSBT.sol:88`, `deployments/sepolia/ArbitraInvestorSBT.json:2`, `deployments/sepolia/MockKYBOracleInvestor.json:2` | investor token + investor oracle | Implemented |

Broken links / notes:
- Yes, investor KYB/SBT is required too. Investor access is not open to unverified wallets.

ACL / confidentiality boundary:
- Same encrypted compliance model as supplier onboarding.

## 8. Investor My Wallet, shield USDC -> cUSDC

| What happens | File | Function | Status |
| --- | --- | --- | --- |
| Wallet surfaces show ETH, USDC, cUSDC, shield, unshield, and operator approval controls. | `frontend/src/components/ui/WalletAddressCard.tsx:236`, `frontend/src/components/ui/WalletAddressCard.tsx:273`, `frontend/src/components/ui/WalletAddressCard.tsx:332`, `frontend/src/components/ui/WalletAddressCard.tsx:440`, `frontend/src/components/shared/WalletPanel.tsx:95`, `frontend/src/components/shared/WalletPanel.tsx:154`, `frontend/src/components/shared/WalletPanel.tsx:202`, `frontend/src/components/shared/WalletPanel.tsx:239` | wallet surfaces | Implemented |
| Shielding uses the new Zama Token SDK hook family. | `frontend/src/hooks/useConfidentialWallet.ts:200`, `frontend/src/hooks/useConfidentialWallet.ts:246` | `useShield`, `shield` callback | Implemented |
| Wrapper contract is the real ERC-7984 confidential USDC wrapper. | `contracts/ArbitraConfidentialUSDC.sol:32`, `contracts/ArbitraConfidentialUSDC.sol:40`, `node_modules/@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol:82` | wrapper constructor and `wrap` | Implemented |
| The holder ends up with an encrypted cUSDC balance handle, not a public ERC-20 amount. | `node_modules/@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol:100`, `frontend/src/hooks/useConfidentialWallet.ts:174` | `confidentialBalanceOf`, `useConfidentialBalance` | Implemented |

Broken links / notes:
- The user does not manually handle `euint64` values; the SDK and wrapper manage the encrypted balance handle lifecycle.

ACL / confidentiality boundary:
- Balance decryption requires user permit + token-session flow before `useConfidentialBalance` runs.

## 9. Investor browses Marketplace and decrypts review data

| What happens | File | Function | Status |
| --- | --- | --- | --- |
| Marketplace listing is built from on-chain registry reads. | `frontend/src/hooks/useArbitraRegistry.ts:570` | `useRealInvoiceList` | Implemented |
| Investor must request on-chain decrypt access before reviewing protected invoice fields. | `contracts/ArbitraInvoiceRegistry.sol:500`, `frontend/src/components/shared/InvoiceDetailModal.tsx:296`, `frontend/src/hooks/useArbitraRegistry.ts:531` | `requestRiskAssessmentAccess` | Implemented |
| After ACL grant, investor signs EIP-712 messages to decrypt invoice handles locally. | `frontend/src/components/shared/InvoiceDetailModal.tsx:239`, `frontend/src/components/shared/InvoiceDetailModal.tsx:265`, `frontend/src/hooks/useInvoiceDecrypt.ts:51`, `frontend/src/hooks/useInvoiceDecrypt.ts:95` | `handleDecrypt`, `useInvoiceDecrypt` | Implemented |
| Final underwriting output is shown only if underwriting handles exist and decrypt successfully. | `contracts/ArbitraInvoiceRegistry.sol:656`, `frontend/src/components/shared/InvoiceDetailModal.tsx:709`, `frontend/src/components/shared/InvoiceDetailModal.tsx:1031` | `getUnderwritingHandles`, investor review UI | Partial |

Broken links / notes:
- Existing invoices created on older registry versions may lack decryptable underwriting handles. The modal already flags this as a blocker to capital deployment.
- Public invoice fields still include supplier, debtor, timestamps, status, and plaintext hints in the struct.

ACL / confidentiality boundary:
- `requestRiskAssessmentAccess` grants permanent ACL to `faceValue`, `dueDate`, `purchasePrice`, `discountRateBps`, `riskScore`, and `riskBand` for the investor wallet: `contracts/ArbitraInvoiceRegistry.sol:506`, `contracts/ArbitraInvoiceRegistry.sol:507`, `contracts/ArbitraInvoiceRegistry.sol:508`, `contracts/ArbitraInvoiceRegistry.sol:509`, `contracts/ArbitraInvoiceRegistry.sol:510`, `contracts/ArbitraInvoiceRegistry.sol:511`.

## 10. Investor deploys cUSDC to escrow

| What happens | File | Function | Status |
| --- | --- | --- | --- |
| Investor funding is triggered from the invoice modal. | `frontend/src/components/shared/InvoiceDetailModal.tsx:319`, `frontend/src/components/shared/InvoiceDetailModal.tsx:815` | `handleFactorClick` | Implemented |
| Frontend now estimates and pads `factorInvoice` gas instead of hard-capping it at 1,000,000. | `frontend/src/components/shared/InvoiceDetailModal.tsx:66`, `frontend/src/components/shared/InvoiceDetailModal.tsx:81`, `frontend/src/components/shared/InvoiceDetailModal.tsx:361`, `frontend/src/hooks/useArbitraRegistry.ts:321` | gas estimation + `useFactorInvoice` | Implemented |
| Contract entrypoint is `ArbitraInvoiceRegistry.factorInvoice(invoiceId)`. | `contracts/ArbitraInvoiceRegistry.sol:523`, `frontend/src/hooks/useArbitraRegistry.ts:321` | `factorInvoice` | Implemented |
| Investor must have previously granted ERC-7984 operator rights to the registry. | `frontend/src/hooks/useConfidentialWallet.ts:203`, `frontend/src/hooks/useConfidentialWallet.ts:345`, `node_modules/@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol:110` | `useConfidentialSetOperator`, `setOperator` | Implemented |
| The registry uses `confidentialTransferFrom(investor, escrow, purchasePrice)` on cUSDC. | `contracts/ArbitraInvoiceRegistry.sol:553`, `node_modules/@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol:142` | confidential transfer into escrow | Implemented |
| The purchase-price formula is flat discount pricing, not the annualized formula in the prompt. | `contracts/ArbitraRiskCalculator.sol:50` | `calculatePurchasePrice` | Partial |

Broken links / notes:
- The prompt formula `P = V * (1 - d * t / BPS_DAYS_DENOM)` is not what the current code runs. The live contract uses flat discount `P = V - V * d / 10000`, and `timeToMaturityDays` is unused for pricing compatibility.

ACL / confidentiality boundary:
- Before transfer, the registry grants `purchasePrice` ACL to `cUsdc`, investor, and escrow, grants `faceValue` ACL to investor and escrow, and grants escrow ACL to the zero-value encrypted platform-fee handle: `contracts/ArbitraInvoiceRegistry.sol:540`, `contracts/ArbitraInvoiceRegistry.sol:541`, `contracts/ArbitraInvoiceRegistry.sol:542`, `contracts/ArbitraInvoiceRegistry.sol:543`, `contracts/ArbitraInvoiceRegistry.sol:544`, `contracts/ArbitraInvoiceRegistry.sol:548`, `contracts/ArbitraInvoiceRegistry.sol:549`.

## 11. Escrow sends cUSDC to supplier

| What happens | File | Function | Status |
| --- | --- | --- | --- |
| The registry immediately registers the escrow record after pulling cUSDC from the investor. | `contracts/ArbitraInvoiceRegistry.sol:560` | `registerEscrow` call | Implemented |
| Escrow automatically forwards encrypted purchase price to the supplier. | `contracts/ArbitraEscrowReceiver.sol:170`, `contracts/ArbitraEscrowReceiver.sol:211`, `contracts/ArbitraEscrowReceiver.sol:217` | `registerEscrow`, `confidentialTransfer(supplier, encPurchasePrice)` | Implemented |
| No extra manual release step is required for the initial supplier payout. | `contracts/ArbitraEscrowReceiver.sol:170` through `contracts/ArbitraEscrowReceiver.sol:217` | `registerEscrow` | Implemented |

Broken links / notes:
- None in the current vNext path. This supplier payout is automatic once factoring succeeds.

ACL / confidentiality boundary:
- Escrow stores encrypted face value, purchase price, and platform fee; it grants supplier and investor ACL to the stored encrypted handles before forwarding the encrypted purchase price: `contracts/ArbitraEscrowReceiver.sol:208`, `contracts/ArbitraEscrowReceiver.sol:209`, `contracts/ArbitraEscrowReceiver.sol:211`, `contracts/ArbitraEscrowReceiver.sol:212`, `contracts/ArbitraEscrowReceiver.sol:214`, `contracts/ArbitraEscrowReceiver.sol:218`.

## 12. Supplier sees cUSDC arrive in wallet/dashboard

| What happens | File | Function | Status |
| --- | --- | --- | --- |
| Supplier wallet reads the same shared cUSDC balance hook as the investor. | `frontend/src/hooks/useConfidentialWallet.ts:174`, `frontend/src/components/ui/WalletAddressCard.tsx:236`, `frontend/src/components/shared/WalletPanel.tsx:95` | `useConfidentialBalance`, wallet UI | Implemented |
| Successful factoring UI explicitly tells the investor that the supplier can now view or unshield the received cUSDC. | `frontend/src/components/shared/InvoiceDetailModal.tsx:843` through `frontend/src/components/shared/InvoiceDetailModal.tsx:852` | factoring success state | Implemented |

Broken links / notes:
- None. Supplier visibility uses the same cUSDC token path as the investor wallet.

ACL / confidentiality boundary:
- Supplier receives ACL to `encPurchasePrice` in escrow record setup and receives actual cUSDC token balance through the ERC-7984 transfer.

## 13. Supplier unshields cUSDC back to USDC

| What happens | File | Function | Status |
| --- | --- | --- | --- |
| Wallet surfaces expose unshield controls and resume flow. | `frontend/src/components/ui/WalletAddressCard.tsx:332`, `frontend/src/components/ui/WalletAddressCard.tsx:406`, `frontend/src/components/shared/WalletPanel.tsx:170`, `frontend/src/components/shared/WalletPanel.tsx:213` | unshield UI | Implemented |
| Frontend uses resumable two-phase unshield APIs. | `frontend/src/hooks/useConfidentialWallet.ts:201`, `frontend/src/hooks/useConfidentialWallet.ts:202`, `frontend/src/hooks/useConfidentialWallet.ts:295`, `frontend/src/hooks/useConfidentialWallet.ts:306`, `frontend/src/hooks/useConfidentialWallet.ts:335` | `useUnshield`, `useResumeUnshield`, `savePendingUnshield`, `clearPendingUnshield` | Implemented |
| Wrapper contract uses unwrap plus finalizeUnwrap, matching the SDK's two-phase model. | `node_modules/@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol:94`, `node_modules/@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol:114` | `unwrap`, `finalizeUnwrap` | Implemented |

Broken links / notes:
- None. This is correctly a two-step resumable unshield flow, not a one-step unwrap.

ACL / confidentiality boundary:
- Unshield decryption proof is handled through the token SDK/session flow rather than custom app logic.

## 14. Supplier withdraws USDC to any external wallet

| What happens | File | Function | Status |
| --- | --- | --- | --- |
| Wallet card exposes a withdraw/send view for ETH and public USDC transfers. | `frontend/src/components/ui/WalletAddressCard.tsx:74`, `frontend/src/components/ui/WalletAddressCard.tsx:133`, `frontend/src/components/ui/WalletAddressCard.tsx:171` | `WalletAddressCard`, `handleSend` | Implemented |
| The local-bank off-ramp UI is still locked and not implemented. | `frontend/src/components/ui/WalletAddressCard.tsx:551` | "To Local Bank" card | Missing |

Broken links / notes:
- External wallet withdrawal is implemented for ETH and public USDC only. Direct bank off-ramp is not live.

ACL / confidentiality boundary:
- This step occurs after cUSDC is unshielded into public USDC, so confidentiality no longer applies to the outbound ERC-20 transfer.

## Supporting Contracts

### ArbitraCollateralVault

- Purpose: stores the supplier's public USDC first-loss collateral, links that stake to the invoice fingerprint and invoice ID, releases it after successful settlement, and slashes it on fraud: `contracts/ArbitraCollateralVault.sol:112`, `contracts/ArbitraCollateralVault.sol:136`, `contracts/ArbitraCollateralVault.sol:162`, `contracts/ArbitraCollateralVault.sol:179`, `contracts/ArbitraCollateralVault.sol:203`.
- Where it fits: it is a precondition for `uploadInvoice(...)`, and its state is updated again during factoring and settlement: `contracts/ArbitraInvoiceRegistry.sol:286`, `contracts/ArbitraInvoiceRegistry.sol:537`, `contracts/ArbitraInvoiceRegistry.sol:593`.

### ArbitraRiskCalculator

- Purpose: computes encrypted discount rate, encrypted purchase price, and encrypted underwriting outputs: `contracts/ArbitraRiskCalculator.sol:23`, `contracts/ArbitraRiskCalculator.sol:50`, `contracts/ArbitraRiskCalculator.sol:80`.
- When it is called: during `uploadInvoice(...)` after the registry assembles supplier stats, expected delay days, tenor, and reputation inputs: `contracts/ArbitraInvoiceRegistry.sol:315` through `contracts/ArbitraInvoiceRegistry.sol:349`.

### ArbitraFingerprintRegistry

- Purpose: holds encrypted invoice fingerprints, blocks duplicate financing, and prevents reuse of the same encrypted fingerprint handle commitment: `contracts/ArbitraFingerprintRegistry.sol:91`, `contracts/ArbitraFingerprintRegistry.sol:131`, `contracts/ArbitraFingerprintRegistry.sol:168`, `contracts/ArbitraFingerprintRegistry.sol:199`.
- When it blocks a tx: duplicate registration is blocked if the same fingerprint handle was already used, and supplier-side duplicate check results are expected to be decrypted off-chain before continuing: `contracts/ArbitraFingerprintRegistry.sol:103`, `contracts/ArbitraFingerprintRegistry.sol:182`, `frontend/src/components/invoice/UploadInvoiceForm.tsx:576`.

## Plaid Attestation Verdict

- Plaid is hybrid and currently mock-assisted, not a fully on-chain attestation system.
- Off-chain / UI side: `frontend/src/components/shared/PlaidModal.tsx:90`, `frontend/src/components/shared/PlaidModal.tsx:136`.
- On-chain authoritative side: `contracts/ArbitraInvoiceRegistry.sol:419` and `contracts/ArbitraInvoiceRegistry.sol:456`, invoked from `frontend/src/app/verify/[invoiceId]/VerifyClient.tsx:268` and `frontend/src/app/api/attest-email/route.ts:266`.

## Current Deployment State (Sepolia vNext)

| Contract | Address | Evidence |
| --- | --- | --- |
| ArbitraInvoiceRegistry | `0x7a3B97658e8aEFA74e28CD675d73f448cbd359B6` | `deployments/sepolia/ArbitraInvoiceRegistry.json:2` |
| ArbitraEscrowReceiver | `0x9d9E1be5E7340D5f82DD226E07F8c4391E7f8E35` | `deployments/sepolia/ArbitraEscrowReceiver.json:2` |
| ArbitraCollateralVault | `0x85945875ebC2BC857E2bEC6c8483A732A990c7BA` | `deployments/sepolia/ArbitraCollateralVault.json:2` |
| ArbitraFingerprintRegistry | `0xcFf939E8468f10394A19DB15B2F6a725985Fa2A8` | `deployments/sepolia/ArbitraFingerprintRegistry.json:2` |
| ArbitraRiskCalculator | `0x1d957EaD11bbDA340254FD753721d263fc7E6dA2` | `deployments/sepolia/ArbitraRiskCalculator.json:2` |
| ArbitraConfidentialUSDC | `0xBf7BF8aF778fA83cCfb6e18B53ACa13A0a0A0Fe1` | `deployments/sepolia/ArbitraConfidentialUSDC.json:2` |
| ArbitraIdentity | `0xF343B260c40C77670c40ED575dF8f42B8b1EB592` | `deployments/sepolia/ArbitraIdentity.json:2` |
| ArbitraSBT | `0x1B88e4d2c70F137B0F7e40c52921D03e7849DF65` | `deployments/sepolia/ArbitraSBT.json:2` |
| ArbitraInvestorSBT | `0x52DfdBA750528207216f3d558D5f3aD04Be23e3b` | `deployments/sepolia/ArbitraInvestorSBT.json:2` |
| MockKYBOracle | `0x295558A582bBc3Ff122Eb43abC01FB5d0fEE2c43` | `deployments/sepolia/MockKYBOracle.json:2` |
| MockKYBOracleInvestor | `0x0Ef1168bcd5542048Fc3457016EF70C77eEF562C` | `deployments/sepolia/MockKYBOracleInvestor.json:2` |

## Open Gaps That Still Matter

1. Full financial confidentiality is still partial because the registry and escrow continue to store or accept plaintext invoice values for some settlement boundaries.
2. The pricing formula in code is flat discount, not the annualized formula described in the prompt.
3. Plaid is not the trust anchor. It is a hybrid/mock UI assist around a separate on-chain or backend-verifier attestation path.
4. Legacy invoices without underwriting handles can still block the investor review-to-funding sequence even though the upgraded vNext path is correct for new invoices.
