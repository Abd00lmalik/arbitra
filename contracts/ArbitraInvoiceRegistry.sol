/**
 * @file ArbitraInvoiceRegistry.sol
 * @description Main orchestrator for Arbitra v2.0 trade finance platform.
 */
/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.27;

import { FHE, euint64, externalEuint64, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig }                    from "@fhevm/solidity/config/ZamaConfig.sol";
import { Ownable2Step, Ownable }                 from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ECDSA }                                 from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { EIP712 }                                from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { IERC20 }                                 from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IArbitraFingerprintRegistry {
    function registerFingerprint(uint256 invoiceId, euint64 fingerprint) external returns (euint64);
    function checkDuplicate(euint64 eNew) external returns (ebool);
}

interface IArbitraSBT {
    function hasValidSBT(address wallet) external view returns (bool);
}

interface IArbitraRiskCalculator {
    function calculateConfidentialDiscount(euint64 eBaseRate, euint64 eReputationMultiplier, euint64 eExpectedDelayDays) external returns (euint64);
    function calculatePurchasePrice(euint64 eFaceValue, euint64 eDiscountBps, uint64 timeToMaturityDays) external returns (euint64);
}

interface IArbitraCollateralVault {
    function stakedCollateral(uint256 invoiceId) external view returns (uint256);
    function invoiceSupplier(uint256 invoiceId) external view returns (address);
    function stakedCollateralByFingerprint(uint256 fingerprint) external view returns (uint256);
    function supplierByFingerprint(uint256 fingerprint) external view returns (address);
    function linkStakeToInvoice(uint256 invoiceId, uint256 fingerprint) external;
    function updateStakeState(uint256 invoiceId, uint8 newState) external;
    function releaseCollateral(uint256 invoiceId) external;
    function slashCollateral(uint256 invoiceId, address investorToCompensate) external;
}

interface IArbitraEscrowReceiver {
    function registerEscrow(
        uint256 invoiceId,
        address supplier,
        address investor,
        euint64 encFaceValue,
        uint256 faceValuePlaintext,
        uint256 purchasePricePlaintext,
        uint256 platformFeePlaintext,
        uint256 maturityTs
    ) external;
    function initiateDispute(uint256 invoiceId) external;
    function resolveDispute(uint256 invoiceId, bool fraudConfirmed) external;
}

contract ArbitraInvoiceRegistry is ZamaEthereumConfig, Ownable2Step, EIP712 {

    /*************** Constants ***************/

    uint64 public constant SCALE_BPS = 10000;
    uint256 public constant DEFAULT_DISCOUNT_BPS = 800; /* 8% discount floor */

    /*************** Data Structures ***************/

    enum InvoiceStatus {
        Pending,
        Attested,
        Factored,
        Settled,
        Disputed,
        Slashed
    }

    struct Invoice {
        euint64  faceValue;
        euint64  dueDate;
        euint64  purchasePrice;
        euint64  discountRateBps;
        euint64  fingerprintHash;
        uint256 faceValuePlaintext;  /* Face value in USDC micro-units (6 dec).
                                Used for standard ERC-20 USDC payment flows.
                                The encrypted faceValue is used for all FHE
                                calculations; this field is used only when
                                transferring USDC between wallets. */
        uint256 discountRatePlaintext; /* Plaintext discount rate approximation in BPS */
        address  supplier;
        address  investor;
        address  debtor;
        uint256  uploadTimestamp;
        uint256  maturityTimestamp;
        InvoiceStatus status;
        bool     geminiUnderwritingEnabled;
        bytes32  debtorAttestationHash;
        bool     collateralStaked;
        bytes32  debtorEmailHash;      /* keccak256(debtorEmail) - email-verified path */
        bool     isEmailVerified;      /* true if attested via platform email flow */
    }

    struct SupplierStats {
        euint64 totalInvoices;
        euint64 repaidInvoices;
        euint64 repaymentRatioBps;
        bool    initialized;
    }

    /*************** Storage ***************/

    uint256 public invoiceCount;
    mapping(uint256 => Invoice) public invoices;
    mapping(address => SupplierStats) public supplierStats;
    mapping(address => uint256[]) public supplierInvoiceIds;
    mapping(address => uint256[]) public investorInvoiceIds;

    IERC20 public immutable usdc;
    address public fpRegistry;
    address public riskCalc;
    address public collateralVault;
    address public escrowReceiver;
    address public sbtContract;

    /**
     * @notice Platform verifier wallet address.
     *         Signs email-verified attestations on behalf of non-crypto debtors.
     *         Set in constructor, updatable by owner.
     */
    address public platformVerifier;

    bytes32 private constant ATTESTATION_TYPEHASH = keccak256(
        "InvoiceAttestation(uint256 invoiceId,bytes32 attestationCommitment,address supplier)"
    );

    /* Email-verified attestation type hash */
    bytes32 private constant EMAIL_ATTESTATION_TYPEHASH = keccak256(
        "EmailAttestation(uint256 invoiceId,bytes32 emailHash,uint256 verifiedAt,uint256 expiresAt)"
    );

    /*************** Events ***************/

    event InvoiceUploaded(uint256 indexed invoiceId, address indexed supplier, address indexed debtor, uint256 timestamp);
    event InvoiceAttested(uint256 indexed invoiceId, address indexed debtor, uint256 timestamp);
    event InvoiceFactored(uint256 indexed invoiceId, address indexed investor, uint256 timestamp);
    event InvoiceSettled(uint256 indexed invoiceId, uint256 timestamp);
    event InvoiceDisputed(uint256 indexed invoiceId, uint256 timestamp);
    event DisputeResolved(uint256 indexed invoiceId, bool fraudConfirmed, uint256 timestamp);
    event InvoiceEmailVerified(
        uint256 indexed invoiceId,
        bytes32 indexed emailHash,
        uint256 timestamp
    );
    event PlatformVerifierUpdated(address indexed newVerifier);

    /*************** Constructor ***************/

    /**
     * @notice Constructor to initialize main configurations.
     * @param _usdc The address of standard USDC.
     * @param _fpRegistry The address of the fingerprint registry.
     * @param _riskCalculator The address of the risk calculator.
     * @param _collateralVault The address of the collateral vault.
     * @param _escrowReceiver The address of the escrow receiver.
     * @param _platformVerifier The address of the platform verifier.
     * @param initialOwner The address of the initial owner of the contract.
     */
    constructor(
        address _usdc,
        address _fpRegistry,
        address _riskCalculator,
        address _collateralVault,
        address _escrowReceiver,
        address _platformVerifier,
        address initialOwner
    ) EIP712("Arbitra", "2") Ownable(initialOwner) {
        require(_usdc != address(0), "Arbitra: zero USDC");
        require(_fpRegistry != address(0), "Arbitra: zero fpRegistry");
        require(_riskCalculator != address(0), "Arbitra: zero riskCalculator");
        require(_collateralVault != address(0), "Arbitra: zero collateralVault");
        require(_escrowReceiver != address(0), "Arbitra: zero escrowReceiver");
        require(_platformVerifier != address(0), "Arbitra: zero verifier");
        require(initialOwner != address(0), "Arbitra: zero initial owner");

        usdc = IERC20(_usdc);
        fpRegistry = _fpRegistry;
        riskCalc = _riskCalculator;
        collateralVault = _collateralVault;
        escrowReceiver = _escrowReceiver;
        platformVerifier = _platformVerifier;
    }

    /*************** Admin Functions ***************/

    /**
     * @notice Set addresses of cooperating contracts.
     */
    function setContracts(
        address _fpRegistry,
        address _riskCalc,
        address _collateralVault,
        address _escrowReceiver
    ) external onlyOwner {
        require(_fpRegistry != address(0), "Arbitra: zero fpRegistry");
        require(_riskCalc != address(0), "Arbitra: zero riskCalc");
        require(_collateralVault != address(0), "Arbitra: zero collateralVault");
        require(_escrowReceiver != address(0), "Arbitra: zero escrowReceiver");

        fpRegistry = _fpRegistry;
        riskCalc = _riskCalc;
        collateralVault = _collateralVault;
        escrowReceiver = _escrowReceiver;
    }

    /**
     * @notice Update the platform verifier address.
     * @param _verifier New platform verifier wallet address
     */
    function setPlatformVerifier(address _verifier) external onlyOwner {
        require(_verifier != address(0), "Arbitra: zero verifier");
        platformVerifier = _verifier;
        emit PlatformVerifierUpdated(_verifier);
    }

    /**
     * @notice Set the Soulbound Token contract address.
     * @param _sbt Address of the ArbitraSBT contract.
     */
    function setSBTContract(address _sbt) external onlyOwner {
        require(_sbt != address(0), "Arbitra: zero SBT address");
        sbtContract = _sbt;
    }

    /*************** Supplier Functions ***************/

    /**
     * @notice Upload a new invoice with FHE-encrypted face value, due date, base rate, and multiplier.
     */
    function uploadInvoice(
        externalEuint64  encFaceValue,
        bytes calldata   proofFaceValue,
        externalEuint64  encDueDate,
        bytes calldata   proofDueDate,
        externalEuint64  encFingerprint,
        bytes calldata   proofFingerprint,
        externalEuint64  encBaseRate,
        bytes calldata   proofBaseRate,
        externalEuint64  encReputationMultiplier,
        bytes calldata   proofRepMult,
        address          debtor,
        bool             enableGeminiUnderwriting,
        uint256          faceValuePlaintext_,
        uint256          plaintextFingerprint,
        uint256          discountRatePlaintext_
    ) external returns (uint256 invoiceId) {
        if (debtor != address(0)) {
            require(debtor != msg.sender, "Arbitra: debtor cannot be supplier");
        }

        invoiceId = invoiceCount + 1;

        /* Verify supplier has staked collateral for this invoice fingerprint */
        uint256 collateralStakedAmount = IArbitraCollateralVault(collateralVault).stakedCollateralByFingerprint(plaintextFingerprint);
        require(collateralStakedAmount > 0, "Arbitra: collateral not staked");
        require(IArbitraCollateralVault(collateralVault).supplierByFingerprint(plaintextFingerprint) == msg.sender, "Arbitra: invalid collateral depositor");

        /* Link stake on collateral vault */
        IArbitraCollateralVault(collateralVault).linkStakeToInvoice(invoiceId, plaintextFingerprint);

        /* Ingest encrypted inputs */
        euint64 faceValue = FHE.fromExternal(encFaceValue, proofFaceValue);
        euint64 dueDate = FHE.fromExternal(encDueDate, proofDueDate);
        euint64 baseRate = FHE.fromExternal(encBaseRate, proofBaseRate);
        euint64 reputationMultiplier = FHE.fromExternal(encReputationMultiplier, proofRepMult);
        euint64 rawFingerprint = FHE.fromExternal(encFingerprint, proofFingerprint);

        /* Grant fpRegistry transient access to the fingerprint handle for registration */
        FHE.allowTransient(rawFingerprint, fpRegistry);

        /* Register fingerprint on-chain */
        euint64 fingerprintHash = IArbitraFingerprintRegistry(fpRegistry).registerFingerprint(invoiceId, rawFingerprint);

        /* Compute Expected Delay Days from supplier repayment ratio */
        SupplierStats storage stats = supplierStats[msg.sender];
        euint64 eExpectedDelayDays;
        if (stats.initialized) {
            eExpectedDelayDays = FHE.div(FHE.sub(FHE.asEuint64(10000), stats.repaymentRatioBps), 1000);
        } else {
            eExpectedDelayDays = FHE.asEuint64(10);
        }

        /* Calculate Time to Maturity in days (plaintext) */
        uint64 ttmDays = 30;

        /* Grant riskCalc transient access to the inputs for discount calculation */
        FHE.allowTransient(baseRate, riskCalc);
        FHE.allowTransient(reputationMultiplier, riskCalc);
        FHE.allowTransient(eExpectedDelayDays, riskCalc);

        /* Compute discount rate and purchase price */
        euint64 discountRateBps = IArbitraRiskCalculator(riskCalc).calculateConfidentialDiscount(baseRate, reputationMultiplier, eExpectedDelayDays);

        /* Grant riskCalc transient access to inputs for purchase price calculation */
        FHE.allowTransient(faceValue, riskCalc);
        FHE.allowTransient(discountRateBps, riskCalc);

        euint64 purchasePrice = IArbitraRiskCalculator(riskCalc).calculatePurchasePrice(faceValue, discountRateBps, ttmDays);

        /* Persist invoice details */
        Invoice storage inv = invoices[invoiceId];
        inv.faceValue = faceValue;
        inv.faceValuePlaintext = faceValuePlaintext_;
        inv.discountRatePlaintext = discountRatePlaintext_;
        inv.dueDate = dueDate;
        inv.purchasePrice = purchasePrice;
        inv.discountRateBps = discountRateBps;
        inv.fingerprintHash = fingerprintHash;
        inv.supplier = msg.sender;
        inv.debtor = debtor;
        inv.uploadTimestamp = block.timestamp;
        /* Set default maturity timestamp to current time + seconds to maturity (simulated maturity check) */
        inv.maturityTimestamp = block.timestamp + 30 days; /* Fallback baseline */
        inv.status = InvoiceStatus.Pending;
        inv.geminiUnderwritingEnabled = enableGeminiUnderwriting;
        inv.collateralStaked = true;

        /* Grant permissions */
        FHE.allowThis(faceValue);
        FHE.allowThis(dueDate);
        FHE.allowThis(purchasePrice);
        FHE.allowThis(discountRateBps);
        FHE.allowThis(fingerprintHash);

        FHE.allow(faceValue, msg.sender);
        FHE.allow(dueDate, msg.sender);
        FHE.allow(purchasePrice, msg.sender);
        FHE.allow(discountRateBps, msg.sender);

        if (debtor != address(0)) {
            FHE.allow(faceValue, debtor);
            FHE.allow(dueDate, debtor);
            FHE.allow(purchasePrice, debtor);
            FHE.allow(discountRateBps, debtor);
        }

        supplierInvoiceIds[msg.sender].push(invoiceId);
        _incrementSupplierInvoiceCount(msg.sender);
        invoiceCount = invoiceId;

        emit InvoiceUploaded(invoiceId, msg.sender, debtor, block.timestamp);
    }

    /*************** Debtor Functions ***************/

    /**
     * @notice Confirm and attest the invoice by signing the EIP-712 attestation.
     */
    function confirmInvoice(
        uint256 invoiceId,
        bytes calldata eip712Signature,
        bytes32 attestationCommitment
    ) external {
        Invoice storage inv = invoices[invoiceId];
        require(inv.status == InvoiceStatus.Pending, "Arbitra: not pending");
        require(msg.sender == inv.debtor, "Arbitra: not debtor");

        bytes32 structHash = keccak256(abi.encode(
            ATTESTATION_TYPEHASH,
            invoiceId,
            attestationCommitment,
            inv.supplier
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, eip712Signature);
        require(recovered == msg.sender, "Arbitra: invalid attestation");

        inv.status = InvoiceStatus.Attested;
        inv.debtorAttestationHash = attestationCommitment;

        emit InvoiceAttested(invoiceId, msg.sender, block.timestamp);
    }

    /**
     * @notice Confirm an invoice via platform-signed email verification.
     *         Called only by the platformVerifier address after the debtor
     *         has verified their email and confirmed the invoice details
     *         through the Arbitra web app. The debtor's identity is committed
     *         as keccak256(email) - the raw email is never stored on-chain.
     * @param invoiceId         The invoice to attest
     * @param emailHash         keccak256 of the debtor's verified email address
     * @param verifiedAt        Unix timestamp when email was verified
     * @param expiresAt         Unix timestamp when the token expires (verifiedAt + 72h)
     * @param platformSignature EIP-712 signature from platformVerifier wallet
     */
    function confirmInvoiceEmailVerified(
        uint256 invoiceId,
        bytes32 emailHash,
        uint256 verifiedAt,
        uint256 expiresAt,
        bytes calldata platformSignature
    ) external {
        require(msg.sender == platformVerifier, "Arbitra: not platform verifier");
        require(block.timestamp <= expiresAt,   "Arbitra: verification token expired");
        require(emailHash != bytes32(0),        "Arbitra: empty email hash");

        Invoice storage inv = invoices[invoiceId];
        require(inv.status == InvoiceStatus.Pending, "Arbitra: not pending");
        require(inv.supplier != address(0),          "Arbitra: invalid invoice");

        /* Verify EIP-712 signature from platformVerifier */
        bytes32 structHash = keccak256(abi.encode(
            EMAIL_ATTESTATION_TYPEHASH,
            invoiceId,
            emailHash,
            verifiedAt,
            expiresAt
        ));
        bytes32 digest  = _hashTypedDataV4(structHash);
        address signer  = ECDSA.recover(digest, platformSignature);
        require(signer == platformVerifier, "Arbitra: invalid platform signature");

        /* Update invoice state */
        inv.status          = InvoiceStatus.Attested;
        inv.debtorEmailHash = emailHash;
        inv.isEmailVerified = true;

        FHE.allow(inv.faceValue,     platformVerifier);
        FHE.allow(inv.purchasePrice, platformVerifier);

        emit InvoiceAttested(invoiceId, address(0), block.timestamp);
        emit InvoiceEmailVerified(invoiceId, emailHash, block.timestamp);
    }

    /*************** Investor Functions ***************/

    /**
     * @notice Request permanent permissions as an SBT holder for risk assessment.
     */
    function requestRiskAssessmentAccess(uint256 invoiceId) external {
        require(sbtContract != address(0), "Arbitra: SBT not configured");
        require(IArbitraSBT(sbtContract).hasValidSBT(msg.sender), "Arbitra: must hold SBT");
        Invoice storage inv = invoices[invoiceId];
        require(inv.status == InvoiceStatus.Attested, "Arbitra: not attested");

        FHE.allow(inv.faceValue, msg.sender);
        FHE.allow(inv.dueDate, msg.sender);
        FHE.allow(inv.purchasePrice, msg.sender);
        FHE.allow(inv.discountRateBps, msg.sender);
    }

    /**
     * @notice Factor (purchase) an invoice at its computed purchase price.
     */
    function factorInvoice(uint256 invoiceId) external {
        Invoice storage inv = invoices[invoiceId];
        require(inv.status == InvoiceStatus.Attested, "Arbitra: not attested");
        require(inv.supplier != msg.sender, "Arbitra: supplier cannot factor own");

        /* Compute purchase price in plaintext.
         * Formula: purchasePricePlaintext = faceValuePlaintext * (10000 - discountBps) / 10000
         * discountBps is an encrypted value - use the pre-computed plaintext approximation
         * stored at upload time, OR require the investor to provide it after decryption.
         *
         * Pragmatic approach for v2.2: compute purchase price from plaintext face value
         * and the plaintext equivalent of the encrypted discount rate.
         * The encrypted values are still used for all FHE display and calculation logic.
         */
        uint256 purchasePricePlaintext = _computePurchasePricePlaintext(invoiceId);
        uint256 platformFeePlaintext = 0;

        inv.investor = msg.sender;
        inv.status = InvoiceStatus.Factored;

        /* Transition stake state to FINANCED */
        IArbitraCollateralVault(collateralVault).updateStakeState(invoiceId, 3);

        /* Transfer USDC from investor to supplier */
        bool ok = usdc.transferFrom(msg.sender, inv.supplier, purchasePricePlaintext);
        require(ok, "Arbitra: USDC transfer failed");

        FHE.allow(inv.purchasePrice, msg.sender);
        FHE.allow(inv.faceValue, msg.sender);
        FHE.allow(inv.faceValue, escrowReceiver);

        /* Register escrow receiver payout */
        IArbitraEscrowReceiver(escrowReceiver).registerEscrow(
            invoiceId,
            inv.supplier,
            msg.sender,
            inv.faceValue,
            inv.faceValuePlaintext,
            purchasePricePlaintext,
            platformFeePlaintext,
            inv.maturityTimestamp
        );

        investorInvoiceIds[msg.sender].push(invoiceId);

        emit InvoiceFactored(invoiceId, msg.sender, block.timestamp);
    }

    /*************** Escrow Callback ***************/

    /**
     * @notice Callback triggered by the escrow receiver when repayment is finalized.
     */
    function onEscrowSettled(uint256 invoiceId) external {
        require(msg.sender == escrowReceiver, "Arbitra: not escrow receiver");
        Invoice storage inv = invoices[invoiceId];
        require(inv.status == InvoiceStatus.Factored, "Arbitra: not factored");

        inv.status = InvoiceStatus.Settled;
        _recordSuccessfulRepayment(inv.supplier);
        IArbitraCollateralVault(collateralVault).releaseCollateral(invoiceId);

        emit InvoiceSettled(invoiceId, block.timestamp);
    }

    /*************** Governance Functions ***************/

    /**
     * @notice Place an invoice under dispute.
     */
    function initiateDispute(uint256 invoiceId) external onlyOwner {
        Invoice storage inv = invoices[invoiceId];
        require(inv.status == InvoiceStatus.Factored, "Arbitra: not factored");

        inv.status = InvoiceStatus.Disputed;
        IArbitraEscrowReceiver(escrowReceiver).initiateDispute(invoiceId);

        emit InvoiceDisputed(invoiceId, block.timestamp);
    }

    /**
     * @notice Resolve dispute, potentially slashing the supplier.
     */
    function resolveDispute(uint256 invoiceId, bool fraudConfirmed) external onlyOwner {
        Invoice storage inv = invoices[invoiceId];
        require(inv.status == InvoiceStatus.Disputed, "Arbitra: not disputed");

        if (fraudConfirmed) {
            inv.status = InvoiceStatus.Slashed;
            IArbitraCollateralVault(collateralVault).slashCollateral(invoiceId, inv.investor);
            IArbitraEscrowReceiver(escrowReceiver).resolveDispute(invoiceId, true);
        } else {
            inv.status = InvoiceStatus.Factored;
            IArbitraEscrowReceiver(escrowReceiver).resolveDispute(invoiceId, false);
        }

        emit DisputeResolved(invoiceId, fraudConfirmed, block.timestamp);
    }

    /*************** View Functions ***************/

    /**
     * @notice Retrieve encrypted handles for an invoice.
     */
    function getInvoiceHandles(uint256 invoiceId) external view returns (
        bytes32 faceValueHandle,
        bytes32 dueDateHandle,
        bytes32 purchasePriceHandle,
        bytes32 discountRateHandle
    ) {
        Invoice storage inv = invoices[invoiceId];
        faceValueHandle = euint64.unwrap(inv.faceValue);
        dueDateHandle = euint64.unwrap(inv.dueDate);
        purchasePriceHandle = euint64.unwrap(inv.purchasePrice);
        discountRateHandle = euint64.unwrap(inv.discountRateBps);
    }

    /**
     * @notice Retrieve the repayment ratio handle for a supplier.
     */
    function getSupplierRatioHandle(address supplier) external view returns (bytes32 ratioHandle) {
        SupplierStats storage stats = supplierStats[supplier];
        if (!stats.initialized) return bytes32(0);
        ratioHandle = euint64.unwrap(stats.repaymentRatioBps);
    }

    /**
     * @notice Public duplicate check that converts input on-chain in the main registry context.
     */
    function checkDuplicate(
        externalEuint64 encFingerprint,
        bytes calldata proof
    ) external returns (ebool) {
        euint64 eNew = FHE.fromExternal(encFingerprint, proof);

        /* Grant fpRegistry transient access to check duplicate handle */
        FHE.allowTransient(eNew, fpRegistry);

        ebool isDup = IArbitraFingerprintRegistry(fpRegistry).checkDuplicate(eNew);
        FHE.allowThis(isDup);
        FHE.allow(isDup, msg.sender);
        FHE.allow(isDup, owner());
        return isDup;
    }

    /**
     * @notice Check allowance status on USDC.
     */
    function isInvestorApproved(address investor) external view returns (bool approved) {
        return usdc.allowance(investor, address(this)) > 0;
    }

    /**
     * @notice Compute purchase price in plaintext USDC micro-units.
     *         Uses the stored plaintext face value and the DEFAULT_DISCOUNT_BPS
     *         as a floor. In production, this would use a KMS-decrypted discount
     *         from the encrypted state. For v2.2, uses the plaintext approximation.
     * @param invoiceId  The invoice to compute for
     * @return           Purchase price in USDC micro-units (6 decimals)
     */
    function _computePurchasePricePlaintext(uint256 invoiceId) internal view returns (uint256) {
        Invoice storage inv = invoices[invoiceId];
        uint256 fv          = inv.faceValuePlaintext;
        /* Use stored discountRatePlaintext or fallback to DEFAULT_DISCOUNT_BPS */
        uint256 discBps     = inv.discountRatePlaintext;
        if (discBps == 0) {
            discBps = DEFAULT_DISCOUNT_BPS;
        }
        /* Changed from annualized to flat discount calculation per user feedback.
           Trade finance users expect a simple flat financing fee rather than a time-amortized yield,
           which simplifies reconciliations and matches real-world factoring pricing. */
        /* Formula: P = V * (1 - d) where d = discBps/10000 */
        uint256 discountAmt = (fv * discBps) / 10000;
        return fv > discountAmt ? fv - discountAmt : 0;
    }

    /**
     * @notice Get the plaintext purchase price for display and payment.
     * @param invoiceId  The invoice
     * @return           Purchase price in USDC micro-units
     */
    function getPurchasePricePlaintext(uint256 invoiceId) external view returns (uint256) {
        return _computePurchasePricePlaintext(invoiceId);
    }

    /**
     * @notice Get the plaintext face value for display and payment.
     * @param invoiceId  The invoice
     * @return           Face value in USDC micro-units
     */
    function getFaceValuePlaintext(uint256 invoiceId) external view returns (uint256) {
        return invoices[invoiceId].faceValuePlaintext;
    }

    /**
     * @notice Get all invoices uploaded by a supplier.
     */
    function getSupplierInvoices(address supplier) external view returns (uint256[] memory) {
        return supplierInvoiceIds[supplier];
    }

    /**
     * @notice Get all invoices factored by an investor.
     */
    function getInvestorInvoices(address investor) external view returns (uint256[] memory) {
        return investorInvoiceIds[investor];
    }

    /**
     * @notice Get all invoice IDs.
     */
    function getAllInvoiceIds() external view returns (uint256[] memory ids) {
        ids = new uint256[](invoiceCount);
        for (uint256 i = 0; i < invoiceCount; i++) {
            ids[i] = i + 1;
        }
    }

    /*************** Internal credit tracking ***************/

    function _incrementSupplierInvoiceCount(address supplier) internal {
        SupplierStats storage stats = supplierStats[supplier];

        if (!stats.initialized) {
            stats.totalInvoices = FHE.asEuint64(1);
            stats.repaidInvoices = FHE.asEuint64(0);
            stats.repaymentRatioBps = FHE.asEuint64(0);
            stats.initialized = true;

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

            _recomputeRatio(supplier);
        }
    }

    function _recordSuccessfulRepayment(address supplier) internal {
        SupplierStats storage stats = supplierStats[supplier];
        require(stats.initialized, "Arbitra: no stats");

        euint64 newRepaid = FHE.add(stats.repaidInvoices, FHE.asEuint64(1));
        FHE.allowThis(newRepaid);
        FHE.allow(newRepaid, supplier);
        stats.repaidInvoices = newRepaid;

        _recomputeRatio(supplier);
    }

    function _recomputeRatio(address supplier) internal {
        SupplierStats storage stats = supplierStats[supplier];
        uint64 totalPlaintext = uint64(supplierInvoiceIds[supplier].length);
        if (totalPlaintext == 0) return;

        euint64 numerator = FHE.mul(stats.repaidInvoices, FHE.asEuint64(SCALE_BPS));
        euint64 newRatio = FHE.div(numerator, totalPlaintext);
        FHE.allowThis(newRatio);
        FHE.allow(newRatio, supplier);
        stats.repaymentRatioBps = newRatio;
    }
}
