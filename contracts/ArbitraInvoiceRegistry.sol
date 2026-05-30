/* SPDX-License-Identifier: MIT */
/**
 * @file ArbitraInvoiceRegistry.sol
 * @description Core registry for Arbitra confidential invoice factoring.
 *              Stores invoice data as FHE ciphertexts, computes encrypted
 *              purchase prices using the formula P = V * (1 - d * t),
 *              tracks supplier repayment history in encrypted state, and
 *              integrates with real cUSDC (ERC-7984 wrapper) for settlement.
 *
 *              Payment token: official Zama cUSDC on Sepolia, discovered via
 *              the Wrappers Registry at 0x2f0750Bbb0A246059d80e94c454586a7F27a128e.
 */
pragma solidity ^0.8.27;

import { FHE, euint64, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { IERC7984 } from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

/*************** Contract ***************/

/**
 * @title  ArbitraInvoiceRegistry
 * @notice Decentralized confidential invoice factoring registry using Zama FHEVM.
 *         Suppliers upload invoices with FHE-encrypted face values and due dates.
 *         Purchase prices are computed homomorphically from encrypted repayment ratios.
 *         Investors settle via real cUSDC (Confidential USDC, ERC-7984).
 *
 * @dev    Inherits ZamaEthereumConfig for on-chain FHE verifier addresses.
 *         All FHE state changes call FHE.allowThis immediately after computation.
 *
 *         Operator model: investors call cUSDC.setOperator(registryAddress, expiry)
 *         before factoring. The registry calls cUSDC.confidentialTransferFrom using
 *         the handle-only overload (no proof needed — registry has ACL from allowTransient).
 *
 *         Solidity target: ^0.8.27, EVM: cancun.
 *
 * @custom:security-contact security@arbitra.finance
 */
contract ArbitraInvoiceRegistry is ZamaEthereumConfig, Ownable2Step {

    /*************** Constants ***************/

    /**
     * @notice Scaling denominator for discount math.
     *         discountRate is stored in basis points (BPS), 10000 = 100%.
     *         timeToMaturity is stored in days.
     *         Division denominator = SCALE_BPS * SCALE_DAYS = 3,650,000.
     */
    uint64 public constant SCALE_BPS      = 10_000;
    uint64 public constant SCALE_DAYS     = 365;
    uint64 public constant BPS_DAYS_DENOM = 3_650_000;

    /** @notice Default discount rate for new suppliers with no history: 8% = 800 BPS */
    uint64 public constant DEFAULT_DISCOUNT_BPS = 800;

    /** @notice Minimum discount rate (best suppliers): 2% = 200 BPS */
    uint64 public constant MIN_DISCOUNT_BPS = 200;

    /** @notice Maximum discount rate (worst or new suppliers): 15% = 1500 BPS */
    uint64 public constant MAX_DISCOUNT_BPS = 1_500;

    /**
     * @notice Default operator expiry duration: 7 days.
     *         Investors can set a longer/shorter expiry when calling setOperator on cUSDT.
     *         This constant is informational — the registry does NOT set operators.
     */
    uint48 public constant DEFAULT_OPERATOR_EXPIRY_SECONDS = 7 days;

    /*************** Data Structures ***************/

    /**
     * @notice On-chain invoice record.
     *         All financial fields are FHE ciphertexts.
     *         Identity and status fields are plaintext for UI routing.
     */
    struct Invoice {
        euint64  faceValue;       /* Encrypted face value in cUSDC micro-units (6 dec) */
        euint64  dueDate;         /* Encrypted due date as Unix timestamp               */
        euint64  purchasePrice;   /* Encrypted purchase price P = V*(1 - d*t)          */
        euint64  discountRate;    /* Encrypted discount rate in BPS at upload time      */
        address  supplier;        /* Supplier wallet (plaintext for routing)            */
        address  investor;        /* Investor wallet after factoring (address(0) if not)*/
        address  buyer;           /* Buyer wallet (plaintext)                           */
        bool     isFactored;      /* True once an investor has purchased                */
        bool     isRepaid;        /* True after supplier triggers successful repayment  */
        uint256  uploadTimestamp; /* Block timestamp at upload                          */
    }

    /**
     * @notice Per-supplier encrypted credit stats.
     *         Updated on each successful repayment.
     */
    struct SupplierStats {
        euint64 totalInvoices;     /* Count of all uploaded invoices      */
        euint64 repaidInvoices;    /* Count of on-time repaid invoices    */
        euint64 repaymentRatioBps; /* ratio = repaid/total * 10000 (BPS)  */
        bool    initialized;       /* Plaintext flag for first-upload path */
    }

    /*************** State ***************/

    /** @notice Total invoices ever uploaded */
    uint256 public invoiceCount;

    /** @notice Invoice storage by ID (1-indexed) */
    mapping(uint256 => Invoice) public invoices;

    /** @notice Supplier credit stats */
    mapping(address => SupplierStats) public supplierStats;

    /** @notice Invoice IDs per supplier */
    mapping(address => uint256[]) public supplierInvoiceIds;

    /** @notice Invoice IDs per investor (after factoring) */
    mapping(address => uint256[]) public investorInvoiceIds;

    /**
     * @notice Official cUSDC token (ERC-7984 wrapper).
     *         Address is resolved at deploy time from the Zama Wrappers Registry:
     *         Sepolia registry: 0x2f0750Bbb0A246059d80e94c454586a7F27a128e
     *         Call getWrapper(USDC_ADDRESS) to get cUSDC address.
     */
    IERC7984 public immutable cUSDC;

    /*************** Events ***************/

    /** @notice Emitted when a new invoice is uploaded */
    event InvoiceUploaded(
        uint256 indexed invoiceId,
        address indexed supplier,
        address indexed buyer,
        uint256 timestamp
    );

    /** @notice Emitted when an invoice is factored (purchased) by an investor */
    event InvoiceFactored(
        uint256 indexed invoiceId,
        address indexed investor,
        uint256 timestamp
    );

    /** @notice Emitted when a supplier repays a factored invoice */
    event InvoiceRepaid(
        uint256 indexed invoiceId,
        address indexed supplier,
        uint256 timestamp
    );

    /*************** Custom Errors ***************/

    /** @notice Thrown when cUSDC.isOperator returns false for the investor */
    error InvestorNotApprovedOperator(address investor, address registry);

    /*************** Constructor ***************/

    /**
     * @notice Deploy registry with the cUSDC address.
     * @param _cUSDC Address of the ERC-7984 cUSDC wrapper.
     *               On Sepolia: resolved via Wrappers Registry.getWrapper(USDC_SEPOLIA).
     *               On localhost: a MockERC7984 deployment.
     */
    constructor(address _cUSDC) Ownable(msg.sender) {
        require(_cUSDC != address(0), "Arbitra: zero cUSDC address");
        cUSDC = IERC7984(_cUSDC);
    }

    /*************** Supplier Functions ***************/

    /**
     * @notice Upload a new invoice with FHE-encrypted face value and due date.
     *         Discount rate is computed from encrypted supplier repayment history.
     *         Purchase price is computed homomorphically as P = V * (1 - d * t).
     *         ACL is granted to: this contract (allowThis) and the supplier (allow).
     * @param  encFaceValue    FHE-encrypted face value (cUSDT micro-units, 6 dec)
     * @param  proofFaceValue  ZKPoK proof for encFaceValue
     * @param  encDueDate      FHE-encrypted Unix timestamp due date
     * @param  proofDueDate    ZKPoK proof for encDueDate
     * @param  buyer           Plaintext buyer wallet address
     * @return invoiceId       The new invoice's numeric ID
     */
    function uploadInvoice(
        externalEuint64 encFaceValue,
        bytes calldata   proofFaceValue,
        externalEuint64 encDueDate,
        bytes calldata   proofDueDate,
        address          buyer
    ) external returns (uint256 invoiceId) {
        require(buyer != address(0), "Arbitra: zero buyer");

        /* Ingest user-provided encrypted inputs with proof verification */
        euint64 faceValue = FHE.fromExternal(encFaceValue, proofFaceValue);
        euint64 dueDate   = FHE.fromExternal(encDueDate, proofDueDate);

        /* Compute encrypted discount rate from supplier repayment history */
        euint64 discountRate = _computeDiscountRate(msg.sender);

        /*
         * Compute time to maturity in days (encrypted arithmetic).
         * timeToMaturityDays = (dueDate - block.timestamp) / 86400
         * Division by plaintext 86400 is valid (only plaintext divisors exist).
         */
        euint64 currentTime        = FHE.asEuint64(uint64(block.timestamp));
        euint64 secondsToMaturity  = FHE.sub(dueDate, currentTime);
        euint64 timeToMaturityDays = FHE.div(secondsToMaturity, 86_400);

        /*
         * Compute purchase price: P = V - V * d * t / BPS_DAYS_DENOM
         *
         * Safe max invoice size at euint64 (max ~1.84e19):
         *   V_max = 1.84e19 / (MAX_DISCOUNT_BPS * SCALE_DAYS) / SCALE_BPS
         *         = 1.84e19 / 1500 / 365 / 10000 ~ 3,356 USDT (6 dec)
         * For production, use euint128 or intermediate scaling.
         */
        euint64 vTimesD        = FHE.mul(faceValue, discountRate);
        euint64 vTimesDiscount = FHE.mul(vTimesD, timeToMaturityDays);
        euint64 discountAmt    = FHE.div(vTimesDiscount, BPS_DAYS_DENOM);
        euint64 purchasePrice  = FHE.sub(faceValue, discountAmt);

        /* Persist invoice */
        invoiceId = ++invoiceCount;
        Invoice storage inv = invoices[invoiceId];
        inv.faceValue      = faceValue;
        inv.dueDate        = dueDate;
        inv.purchasePrice  = purchasePrice;
        inv.discountRate   = discountRate;
        inv.supplier       = msg.sender;
        inv.buyer          = buyer;
        inv.uploadTimestamp = block.timestamp;

        /* ACL: grant this contract persistent access to all ciphertexts */
        FHE.allowThis(faceValue);
        FHE.allowThis(dueDate);
        FHE.allowThis(purchasePrice);
        FHE.allowThis(discountRate);

        /* ACL: grant supplier read/decrypt access to their own invoice data */
        FHE.allow(faceValue, msg.sender);
        FHE.allow(dueDate, msg.sender);
        FHE.allow(purchasePrice, msg.sender);
        FHE.allow(discountRate, msg.sender);

        /* Update supplier invoice index */
        supplierInvoiceIds[msg.sender].push(invoiceId);

        /* Increment supplier total invoices (encrypted) */
        _incrementSupplierInvoiceCount(msg.sender);

        emit InvoiceUploaded(invoiceId, msg.sender, buyer, block.timestamp);
    }

    /**
     * @notice Supplier triggers repayment for a factored invoice.
     *         On success: updates encrypted repayment stats and marks invoice repaid.
     * @param invoiceId  The invoice to repay
     */
    function triggerRepayment(uint256 invoiceId) external {
        Invoice storage inv = invoices[invoiceId];
        require(inv.supplier == msg.sender, "Arbitra: not supplier");
        require(inv.isFactored, "Arbitra: not factored");
        require(!inv.isRepaid, "Arbitra: already repaid");

        /* Mark repaid before state updates to prevent re-entrancy */
        inv.isRepaid = true;

        /* Update encrypted repayment ratio for the supplier */
        _recordSuccessfulRepayment(msg.sender);

        emit InvoiceRepaid(invoiceId, msg.sender, block.timestamp);
    }

    /*************** Investor Functions ***************/

    /**
     * @notice Investor factors (purchases) an invoice at its encrypted purchase price.
     *
     *         Pre-condition: investor must have called
     *           cUSDC.setOperator(registryAddress, expiry)
     *         before this call. The registry verifies operator status and reverts
     *         with InvestorNotApprovedOperator if not set.
     *
     *         Calls cUSDC.confidentialTransferFrom(investor, supplier, purchasePrice)
     *         using the handle-only overload — the registry must have transient ACL
     *         on purchasePrice, which it grants via FHE.allowTransient before the call.
     *
     * @param invoiceId  The invoice to purchase
     */
    function factorInvoice(uint256 invoiceId) external {
        Invoice storage inv = invoices[invoiceId];
        require(!inv.isFactored, "Arbitra: already factored");
        require(inv.supplier != address(0), "Arbitra: invalid invoice");
        require(inv.supplier != msg.sender, "Arbitra: supplier cannot factor own invoice");

        /* Verify investor has approved this registry as an operator on cUSDC */
        if (!cUSDC.isOperator(msg.sender, address(this))) {
            revert InvestorNotApprovedOperator(msg.sender, address(this));
        }

        /* Grant cUSDC transient ACL on purchasePrice for this tx's cross-contract call.
         * Without this, cUSDC.confidentialTransferFrom reverts with ACLNotAllowed()
         * when it attempts FHE operations on the handle.
         * Transient access expires after this transaction. */
        FHE.allowTransient(inv.purchasePrice, address(cUSDC));

        /* Transfer cUSDC from investor to supplier at the encrypted purchase price.
         * Uses the handle-only overload: caller (registry) must be an approved operator
         * for `from` (investor) — verified above via isOperator. */
        euint64 transferred = cUSDC.confidentialTransferFrom(
            msg.sender,
            inv.supplier,
            inv.purchasePrice
        );

        /* Verify transfer was not zero-handle (sanity check) */
        require(euint64.unwrap(transferred) != bytes32(0), "Arbitra: transfer returned zero handle");

        /* Update invoice state */
        inv.isFactored = true;
        inv.investor   = msg.sender;

        /* ACL: grant investor decrypt access to the purchase price they paid */
        FHE.allow(inv.purchasePrice, msg.sender);
        FHE.allow(inv.faceValue, msg.sender);
        FHE.allow(inv.discountRate, msg.sender);

        /* Index by investor */
        investorInvoiceIds[msg.sender].push(invoiceId);

        emit InvoiceFactored(invoiceId, msg.sender, block.timestamp);
    }

    /**
     * @notice Grant temporary decryption access to caller for risk assessment.
     *         Grants transient-tx ACL so a wallet can read encrypted values
     *         for the EIP-712 userDecrypt flow without permanent access.
     * @param invoiceId  The invoice to grant temporary access for
     */
    function grantRiskAssessmentAccess(uint256 invoiceId) external {
        Invoice storage inv = invoices[invoiceId];
        require(!inv.isFactored, "Arbitra: already factored");

        /* Transient access — valid for this transaction only */
        FHE.allowTransient(inv.faceValue, msg.sender);
        FHE.allowTransient(inv.dueDate, msg.sender);
        FHE.allowTransient(inv.purchasePrice, msg.sender);
        FHE.allowTransient(inv.discountRate, msg.sender);

        /* Also grant the supplier stats ratio for the risk assessment */
        SupplierStats storage stats = supplierStats[inv.supplier];
        if (stats.initialized) {
            FHE.allowTransient(stats.repaymentRatioBps, msg.sender);
        }
    }

    /*************** View Functions ***************/

    /**
     * @notice Get all invoice IDs uploaded by a supplier.
     * @param supplier  Supplier wallet address
     * @return          Array of invoice IDs
     */
    function getSupplierInvoices(address supplier) external view returns (uint256[] memory) {
        return supplierInvoiceIds[supplier];
    }

    /**
     * @notice Get all invoice IDs purchased by an investor.
     * @param investor  Investor wallet address
     * @return          Array of invoice IDs
     */
    function getInvestorInvoices(address investor) external view returns (uint256[] memory) {
        return investorInvoiceIds[investor];
    }

    /**
     * @notice Get all invoice IDs ever created (for marketplace listing).
     * @return ids  Array of all invoice IDs in order of creation
     */
    function getAllInvoiceIds() external view returns (uint256[] memory ids) {
        ids = new uint256[](invoiceCount);
        for (uint256 i = 0; i < invoiceCount; i++) {
            ids[i] = i + 1;
        }
    }

    /**
     * @notice Get the encrypted handles for an invoice (for frontend decryption).
     * @param invoiceId  The invoice ID
     * @return faceValueHandle     bytes32 handle
     * @return dueDateHandle       bytes32 handle
     * @return purchasePriceHandle bytes32 handle
     * @return discountRateHandle  bytes32 handle
     */
    function getInvoiceHandles(uint256 invoiceId) external view returns (
        bytes32 faceValueHandle,
        bytes32 dueDateHandle,
        bytes32 purchasePriceHandle,
        bytes32 discountRateHandle
    ) {
        Invoice storage inv = invoices[invoiceId];
        faceValueHandle     = euint64.unwrap(inv.faceValue);
        dueDateHandle       = euint64.unwrap(inv.dueDate);
        purchasePriceHandle = euint64.unwrap(inv.purchasePrice);
        discountRateHandle  = euint64.unwrap(inv.discountRate);
    }

    /**
     * @notice Get the repayment ratio handle for a supplier.
     * @param supplier  Supplier wallet address
     * @return ratioHandle  bytes32 handle (zero bytes32 if no history)
     */
    function getSupplierRatioHandle(address supplier) external view returns (bytes32 ratioHandle) {
        SupplierStats storage stats = supplierStats[supplier];
        if (!stats.initialized) return bytes32(0);
        ratioHandle = euint64.unwrap(stats.repaymentRatioBps);
    }

    /**
     * @notice Check if an investor has approved the registry as a cUSDC operator.
     * @param investor  The investor address to check
     * @return approved True if the registry is a valid operator for the investor
     */
    function isInvestorApproved(address investor) external view returns (bool approved) {
        return cUSDC.isOperator(investor, address(this));
    }

    /*************** Internal FHE Helpers ***************/

    /**
     * @notice Compute encrypted discount rate based on supplier's historical repayment ratio.
     *         Formula: rate = MAX - (MAX - MIN) * repaymentRatioBps / SCALE_BPS
     *         Better repayment history yields lower discount rate (more favorable pricing).
     *         New suppliers with no history receive DEFAULT_DISCOUNT_BPS (8%).
     * @param  supplier  The supplier wallet address
     * @return rate      Encrypted discount rate in BPS
     */
    function _computeDiscountRate(address supplier) internal returns (euint64 rate) {
        SupplierStats storage stats = supplierStats[supplier];

        if (!stats.initialized) {
            /* New supplier: use default rate. Trivial encryption is intentional here
               as the DEFAULT_DISCOUNT_BPS is a public protocol constant. */
            rate = FHE.asEuint64(DEFAULT_DISCOUNT_BPS);
            FHE.allowThis(rate);
            return rate;
        }

        /*
         * Dynamic rate based on encrypted repayment ratio:
         *   rateRange = MAX_DISCOUNT_BPS - MIN_DISCOUNT_BPS = 1300
         *   reduction = rateRange * repaymentRatioBps / SCALE_BPS
         *   rate      = MAX_DISCOUNT_BPS - reduction
         *
         * Example: repaymentRatioBps = 9000 (90% on-time)
         *   reduction = 1300 * 9000 / 10000 = 1170 BPS
         *   rate      = 1500 - 1170 = 330 BPS ~ 3.3%
         */
        euint64 maxRate   = FHE.asEuint64(MAX_DISCOUNT_BPS);
        euint64 minRate   = FHE.asEuint64(MIN_DISCOUNT_BPS);
        euint64 rateRange = FHE.sub(maxRate, minRate);

        euint64 numerator = FHE.mul(rateRange, stats.repaymentRatioBps);
        euint64 reduction = FHE.div(numerator, SCALE_BPS);
        rate              = FHE.sub(maxRate, reduction);

        FHE.allowThis(rate);
        FHE.allow(rate, supplier);
    }

    /**
     * @notice Increment the encrypted invoice count for a supplier.
     *         Initializes stats on first invoice.
     * @param supplier  The supplier wallet address
     */
    function _incrementSupplierInvoiceCount(address supplier) internal {
        SupplierStats storage stats = supplierStats[supplier];

        if (!stats.initialized) {
            stats.totalInvoices     = FHE.asEuint64(1);
            stats.repaidInvoices    = FHE.asEuint64(0);
            stats.repaymentRatioBps = FHE.asEuint64(0);
            stats.initialized       = true;

            FHE.allowThis(stats.totalInvoices);
            FHE.allowThis(stats.repaidInvoices);
            FHE.allowThis(stats.repaymentRatioBps);
            FHE.allow(stats.totalInvoices, supplier);
            FHE.allow(stats.repaidInvoices, supplier);
            FHE.allow(stats.repaymentRatioBps, supplier);
        } else {
            euint64 newTotal = FHE.add(stats.totalInvoices, FHE.asEuint64(1));
            FHE.allowThis(newTotal);
            FHE.allow(newTotal, supplier);
            stats.totalInvoices = newTotal;

            /* Re-compute repayment ratio with updated total */
            _recomputeRatio(supplier);
        }
    }

    /**
     * @notice Record a successful repayment for a supplier.
     *         Increments encrypted repaid count and recomputes ratio.
     * @param supplier  The supplier wallet address
     */
    function _recordSuccessfulRepayment(address supplier) internal {
        SupplierStats storage stats = supplierStats[supplier];
        require(stats.initialized, "Arbitra: no stats");

        euint64 newRepaid = FHE.add(stats.repaidInvoices, FHE.asEuint64(1));
        FHE.allowThis(newRepaid);
        FHE.allow(newRepaid, supplier);
        stats.repaidInvoices = newRepaid;

        _recomputeRatio(supplier);
    }

    /**
     * @notice Recompute the encrypted repayment ratio after any stats change.
     *         ratio = repaidInvoices * SCALE_BPS / totalInvoicesCount
     *
     * @dev    Since FHE.div only supports plaintext divisors, we use a plaintext
     *         shadow counter (the public invoice index length) for the division.
     *         The repaid count remains encrypted; only the total uses a shadow.
     *         The total count is already observable from public events (InvoiceUploaded),
     *         so this does not leak additional information.
     * @param  supplier  Supplier wallet address
     */
    function _recomputeRatio(address supplier) internal {
        SupplierStats storage stats = supplierStats[supplier];

        uint64 totalPlaintext = uint64(supplierInvoiceIds[supplier].length);
        if (totalPlaintext == 0) return;

        euint64 numerator = FHE.mul(stats.repaidInvoices, FHE.asEuint64(SCALE_BPS));
        euint64 newRatio  = FHE.div(numerator, totalPlaintext);
        FHE.allowThis(newRatio);
        FHE.allow(newRatio, supplier);
        stats.repaymentRatioBps = newRatio;
    }
}
