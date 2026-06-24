# Arbitra - Confidential Invoice Factoring Registry

> Decentralized invoice factoring on Ethereum using **Zama FHEVM v0.11**. Financial data is protected with Fully Homomorphic Encryption so buyers, investors, and the public cannot see face values, due dates, or purchase prices without authorization.

## Architecture

```text
arbitra/
|-- contracts/
|   |-- ArbitraInvoiceRegistry.sol   # Core FHE registry
|   `-- mocks/
|       `-- MockCUSDC.sol            # Confidential USDC mock
|-- test/
|   `-- ArbitraInvoiceRegistry.test.ts
|-- deploy/
|   |-- 00_deploy_registry.ts
|   `-- 01_seed_mock_data.ts
|-- scripts/
|   `-- fhe-lint.js                  # Anti-pattern linter
`-- frontend/
    `-- src/
        |-- app/                     # Next.js App Router
        |-- components/              # UI components
        |-- hooks/                   # React hooks (wagmi)
        |-- lib/                     # SDK, contracts, deterministic ingestion
        `-- providers/               # WagmiProvider, ZamaProvider
```

## Quick Start

### 1. Install contract dependencies

```bash
cd arbitra
npm install
# Relayer SDK must be pinned EXACT for mock-utils compatibility:
npm install --save-dev --save-exact @zama-fhe/relayer-sdk@0.4.1
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local with your keys
```

### 3. Compile contracts

```bash
npm run compile
```

### 4. Run tests

```bash
npm test
```

### 5. Deploy locally

```bash
npm run deploy:local
```

### 6. Deploy to Sepolia

```bash
npm run deploy:sepolia
```

### 7. Run FHE lint

```bash
npm run lint:fhe
```

### 8. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Navigate to `http://localhost:3000`.

## Deterministic Financial Core

Arbitra's invoice ingestion pipeline is now deterministic and reproducible:

1. Native PDF text extraction
2. Validation gate
3. Local OCR fallback
4. Regex and heuristic parsing
5. Structured `InvoiceDraft` output

There are no LLM or Gemini calls in the financial-core ingestion path.

## FHE Details

| Feature | Value |
|---|---|
| Framework | Zama FHEVM v0.11 |
| Config | ZamaEthereumConfig (ZamaConfig.sol) |
| Encrypted types | euint64 |
| Operations | add, sub, mul, div (plaintext RHS), select |
| Decryption | EIP-712 userDecrypt (private), makePubliclyDecryptable (public) |
| Max demo invoice | $3,356 USDC (euint64 overflow limit) |

### Purchase Price Formula

```text
P = V * (1 - d * t)
P = V - V * d * t / BPS_DAYS_DENOM

where:
  V = face value (euint64, cUSDC micro-units)
  d = discount rate in BPS (euint64, 200-1500)
  t = time to maturity in days (euint64)
  BPS_DAYS_DENOM = 3,650,000 (plaintext constant)
```

### Discount Rate Scoring

Supplier discount rates are computed entirely on-chain from encrypted repayment history:

```text
rateRange = MAX_DISCOUNT (1500 BPS) - MIN_DISCOUNT (200 BPS) = 1300 BPS
reduction = rateRange * repaymentRatioBps / SCALE_BPS
rate = MAX_DISCOUNT - reduction
```

A supplier with 90% on-time repayment gets: `1500 - (1300 * 9000 / 10000) = 330 BPS ~= 3.3%`

## Security Notes

- ACL grants use `FHE.allowThis()` and `FHE.allow(handle, user)` after every stored encrypted computation
- Investors only get decrypt access after `factorInvoice` is confirmed
- Financial-core ingestion is deterministic and local, with OCR as the only fallback
- For production, increase max invoice size by using `euint128` or intermediate scaling

## License

MIT
