Step 1 Production Audit Evidence

Deployed app:
- https://arbitra-dapp.vercel.app

Confirmed production findings:
- Dashboard landing renders and exposes a Login button.
- Register page renders and exposes the hybrid auth choices.
- Email path now opens the Web3Auth passwordless UI after app fixes.
- Web3Auth project configuration is pinned to `sapphire_devnet`.
- Passwordless OTP popup reaches the 6-digit verification screen.

Root causes identified and fixed:
- `frontend/src/providers/Web3AuthProvider.tsx`
  - Missing `AuthAdapter` registration caused `WalletInitializationError` for `email_passwordless`.
  - `connectTo("auth", { loginProvider: "email_passwordless" })` forced a missing `login_hint` error.
  - Switching production to `sapphire_mainnet` failed because the configured project actually belongs to `sapphire_devnet`.
- `frontend/src/providers/WagmiProvider.tsx`
  - Incorrect connector import path pulled the MetaMask SDK bundle into the app runtime.
- `frontend/src/components/layout/Sidebar.tsx`
  - Incorrect connector import path pulled the MetaMask SDK bundle into the app runtime.
- `frontend/src/app/register/page.tsx`
  - Incorrect connector import path pulled the MetaMask SDK bundle into the app runtime.
- `frontend/src/app/dashboard/DashboardClient.tsx`
  - Public landing path was separated from authenticated dashboard hooks to reduce pre-auth route instability.

Direct upstream evidence:
- `curl https://api.web3auth.io/...network=sapphire_mainnet...`
  - Response: `400`
  - Body: `network mismatch. Provided network "sapphire_mainnet" does not match project network "sapphire_devnet"`
- `curl https://api.web3auth.io/...network=sapphire_devnet...`
  - Response: `200`

Screenshots:
- `01-dashboard.png`
- `02-register.png`
- `03-register-email-ready.png`
- `04-after-email-click.png`
- `07-post-network-fix-register.png`
- `08-post-network-fix-after-email-click.png`
- `13-email-ui-inspect.png`
- `14-email-filled.png`
- `15-after-email-submit.png`
- `16-passwordless-popup-inspect.png`
- `20-connect-wallet-path.png`

Current verified limitations:
- OTP popup is reachable, but automatic verification was not completed because the disposable inbox used for automation did not receive a readable message during the audit window.
- Existing-wallet flow in the headless audit browser reports `Provider not found` because no injected wallet extension is available in that browser context.
