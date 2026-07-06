/**
 * @file ArbitraEscrowReceiver.sol
 * @description Escrow contract for automated maturity settlement.
 */
/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.27;

import { FHE, euint64 }          from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig }    from "@fhevm/solidity/config/ZamaConfig.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { IERC20 }                from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 }             from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ECDSA }                 from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { EIP712 }                from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

interface IArbitraRegistry {
    function onEscrowSettled(uint256 invoiceId) external;
    function getFaceValuePlaintext(uint256 invoiceId) external view returns (uint256);
    function platformVerifier() external view returns (address);
}

/**
 * @notice Minimal interface for the cUSDC ERC-7984 wrapper used at settlement.
 */
interface IArbitraConfidentialUSDC {
    function wrap(address to, uint256 amount) external returns (euint64);
    function confidentialTransfer(address to, euint64 amount) external returns (euint64);
}

contract ArbitraEscrowReceiver is ZamaEthereumConfig, Ownable2Step, EIP712 {
    using SafeERC20 for IERC20;

    /*************** Constants ***************/

    bytes32 private constant PAYMENT_RECEIVED_TYPEHASH = keccak256(
        "PaymentReceived(uint256 invoiceId,bytes32 paymentReference,uint256 amount,uint256 receivedAt,uint256 nonce)"
    );

    /*************** Data Structures ***************/

    struct EscrowRecord {
        address supplier;
        address investor;
        euint64 encryptedFaceValue;    /* FHE handle for display */
        euint64 encryptedPurchasePrice; /* FHE handle - what the investor paid */
        euint64 encryptedPlatformFee;  /* FHE handle - protocol fee portion */
        uint256 faceValuePlaintext;    /* For debtor USDC pull and repayInvoice check */
        uint256 maturityTimestamp;
        uint256 settledAt;
        uint256 paymentNonce;
        bytes32 paymentReference;
        bytes32 bankTraceId;
        bytes32 settlementReceiptHash;
        bool    isSettled;
        bool    isDisputed;
    }

    /*************** Storage ***************/

    /* Escrow records indexed by invoice ID */
    mapping(uint256 => EscrowRecord) public escrows;

    /* Address of standard USDC */
    IERC20 public immutable usdc;

    /* Address of ArbitraConfidentialUSDC (cUSDC) ERC-7984 wrapper */
    address public cUsdc;

    /* Main Arbitra Registry contract */
    address public arbitraRegistry;

    /* Platform treasury for protocol settlement fees */
    address public platformTreasury;

    /* Idempotency guard for signed bank payment proofs */
    mapping(bytes32 => bool) public processedPayments;

    /* Confidential settlement ledger indexed by beneficiary */
    mapping(address => euint64) private confidentialSettlementBalances;

    /*************** Events ***************/

    /** @notice Emitted when a maturity payment is received and processed */
    event ConfidentialMaturityPaid(uint256 indexed invoiceId, address indexed investor, uint256 timestamp);

    /** @notice Emitted when a signed repayment proof finalizes settlement */
    event SettlementFinalized(uint256 indexed invoiceId, bytes32 indexed paymentReference, bytes32 indexed settlementReceiptHash);

    /** @notice Emitted when a dispute is initiated */
    event DisputeInitiated(uint256 indexed invoiceId);

    /** @notice Emitted when a dispute is resolved */
    event DisputeResolved(uint256 indexed invoiceId, bool fraudConfirmed);

    /*************** Modifiers ***************/

    modifier onlyRegistry() {
        require(msg.sender == arbitraRegistry, "Arbitra: only registry");
        _;
    }

    /*************** Constructor ***************/

    /**
     * @notice Deploy the escrow receiver.
     * @param _usdc The address of standard USDC.
     */
    constructor(address _usdc) Ownable(msg.sender) EIP712("ArbitraSettlement", "1") {
        require(_usdc != address(0), "Arbitra: zero token address");
        usdc = IERC20(_usdc);
        platformTreasury = msg.sender;
    }

    /*************** Admin Functions ***************/

    /**
     * @notice Set the registry address.
     * @param _registry The main Arbitra registry address.
     */
    function setRegistry(address _registry) external onlyOwner {
        require(_registry != address(0), "Arbitra: zero registry address");
        arbitraRegistry = _registry;
    }

    /**
     * @notice Set the platform treasury for fee ledger credits.
     * @param _platformTreasury The treasury wallet address.
     */
    function setPlatformTreasury(address _platformTreasury) external onlyOwner {
        require(_platformTreasury != address(0), "Arbitra: zero treasury address");
        platformTreasury = _platformTreasury;
    }

    /**
     * @notice Set the ArbitraConfidentialUSDC (cUSDC) wrapper address.
     * @param _cUsdc The deployed ArbitraConfidentialUSDC contract address.
     */
    function setCUsdc(address _cUsdc) external onlyOwner {
        require(_cUsdc != address(0), "Arbitra: zero cUSDC address");
        cUsdc = _cUsdc;
    }

    /**
     * @notice Emergency admin function to clear a stale or orphaned escrow record.
     *         Only callable by the owner. Use when a prior partial factoring attempt
     *         left a stale escrow entry that prevents re-factoring an Attested invoice.
     * @param invoiceId  The invoice whose escrow record should be cleared.
     */
    function adminClearEscrow(uint256 invoiceId) external onlyOwner {
        require(
            !escrows[invoiceId].isSettled,
            "Arbitra: cannot clear a settled escrow"
        );
        delete escrows[invoiceId];
    }

    /*************** Registry Functions ***************/

    /**
     * @notice Register an escrow record for an invoice.
     * @param invoiceId The invoice ID.
     * @param supplier The supplier address.
     * @param investor The investor address.
     * @param encFaceValue The FHE encrypted face value handle.
     * @param faceValuePlaintext The plaintext face value in USDC micro-units (debtor settlement).
     * @param encPurchasePrice The encrypted purchase price paid to the supplier via cUSDC.
     * @param encPlatformFee The encrypted protocol fee amount.
     * @param maturityTs The maturity timestamp.
     */
    function registerEscrow(
        uint256 invoiceId,
        address supplier,
        address investor,
        euint64 encFaceValue,
        uint256 faceValuePlaintext,
        euint64 encPurchasePrice,
        euint64 encPlatformFee,
        uint256 maturityTs
    ) external onlyRegistry {
        /*
         * Allow overwriting a stale escrow record (from a prior partial factoring attempt
         * on this invoice ID before the registry was redeployed) as long as it has not
         * already been settled.  A settled escrow must never be overwritten.
         */
        require(
            !escrows[invoiceId].isSettled,
            "Arbitra: escrow already settled"
        );

        escrows[invoiceId] = EscrowRecord({
            supplier:               supplier,
            investor:               investor,
            encryptedFaceValue:     encFaceValue,
            encryptedPurchasePrice: encPurchasePrice,
            encryptedPlatformFee:   encPlatformFee,
            faceValuePlaintext:     faceValuePlaintext,
            maturityTimestamp:      maturityTs,
            settledAt:              0,
            paymentNonce:           0,
            paymentReference:       bytes32(0),
            bankTraceId:            bytes32(0),
            settlementReceiptHash:  bytes32(0),
            isSettled:              false,
            isDisputed:             false
        });

        FHE.allowThis(encFaceValue);
        FHE.allow(encFaceValue, supplier);
        FHE.allow(encFaceValue, investor);
        FHE.allowThis(encPurchasePrice);
        FHE.allow(encPurchasePrice, investor);
        FHE.allow(encPurchasePrice, supplier);
        FHE.allowThis(encPlatformFee);
        FHE.allow(encPlatformFee, investor);

        /* Forward purchase price to supplier */
        FHE.allow(encPurchasePrice, cUsdc);
        IArbitraConfidentialUSDC(cUsdc).confidentialTransfer(supplier, encPurchasePrice);
    }

    /**
     * @notice Put an invoice under dispute.
     * @param invoiceId The invoice ID.
     */
    function initiateDispute(uint256 invoiceId) external onlyRegistry {
        require(escrows[invoiceId].supplier != address(0), "Arbitra: escrow not found");
        escrows[invoiceId].isDisputed = true;
        emit DisputeInitiated(invoiceId);
    }

    /**
     * @notice Resolve a dispute.
     * @param invoiceId The invoice ID.
     * @param fraudConfirmed True if fraud was confirmed.
     */
    function resolveDispute(uint256 invoiceId, bool fraudConfirmed) external onlyRegistry {
        require(escrows[invoiceId].supplier != address(0), "Arbitra: escrow not found");
        if (fraudConfirmed) {
            escrows[invoiceId].isSettled = true;
        } else {
            escrows[invoiceId].isDisputed = false;
        }
        emit DisputeResolved(invoiceId, fraudConfirmed);
    }

    /*************** Settlement Functions ***************/

    /**
     * @notice Finalize repayment using a platform-signed bank payment proof.
     * @dev Credits encrypted payout balances from the stored factoring economics
     *      and grants beneficiary ACL after each stored encrypted balance update.
     * @param invoiceId The invoice to repay.
     * @param paymentReference Bank or lockbox payment reference commitment.
     * @param amount Received payment amount in USDC micro-units.
     * @param receivedAt Timestamp reported by the mock bank webhook.
     * @param nonce Unique payment proof nonce.
     * @param bankTraceId Bank trace identifier commitment.
     * @param signature Platform verifier EIP-712 signature over the payment proof.
     */
    function repayInvoice(
        uint256 invoiceId,
        bytes32 paymentReference,
        uint256 amount,
        uint256 receivedAt,
        uint256 nonce,
        bytes32 bankTraceId,
        bytes calldata signature
    ) external {
        EscrowRecord storage rec = escrows[invoiceId];
        require(rec.supplier != address(0), "Arbitra: escrow not found");
        require(!rec.isSettled, "Arbitra: already settled");
        require(!rec.isDisputed, "Arbitra: invoice disputed");
        require(amount == rec.faceValuePlaintext, "Arbitra: payment amount mismatch");
        require(paymentReference != bytes32(0), "Arbitra: empty payment reference");
        require(bankTraceId != bytes32(0), "Arbitra: empty bank trace");

        bytes32 paymentId = keccak256(abi.encode(invoiceId, paymentReference, amount, receivedAt, nonce));
        require(!processedPayments[paymentId], "Arbitra: payment already processed");

        address signer = _verifyPaymentProof(invoiceId, paymentReference, amount, receivedAt, nonce, signature);
        processedPayments[paymentId] = true;

        require(cUsdc != address(0), "Arbitra: cUSDC not configured");

        /* Wrap the received standard USDC into cUSDC so it can be distributed confidentially */
        usdc.approve(cUsdc, amount);
        IArbitraConfidentialUSDC(cUsdc).wrap(address(this), amount);

        _applyConfidentialSettlement(rec);

        bytes32 receiptHash = keccak256(
            abi.encode(invoiceId, paymentReference, amount, receivedAt, nonce, bankTraceId, signer)
        );

        rec.isSettled = true;
        rec.settledAt = block.timestamp;
        rec.paymentNonce = nonce;
        rec.paymentReference = paymentReference;
        rec.bankTraceId = bankTraceId;
        rec.settlementReceiptHash = receiptHash;

        emit ConfidentialMaturityPaid(invoiceId, rec.investor, block.timestamp);
        emit SettlementFinalized(invoiceId, paymentReference, receiptHash);

        IArbitraRegistry(arbitraRegistry).onEscrowSettled(invoiceId);
    }

    /**
     * @notice Debtor calls this to settle an invoice at maturity.
     *         Pulls USDC from the debtor, wraps it into cUSDC, then applies
     *         the confidential FHE settlement to distribute payout handles to
     *         investor, supplier, and platform treasury.
     *         Requires: debtor has approved this contract for faceValuePlaintext USDC.
     * @param invoiceId The invoice to settle.
     */
    function settleInvoice(uint256 invoiceId) external {
        require(cUsdc != address(0), "Arbitra: cUSDC not configured");
        EscrowRecord storage rec = escrows[invoiceId];
        require(!rec.isSettled,                          "Arbitra: already settled");
        require(!rec.isDisputed,                         "Arbitra: invoice disputed");
        require(block.timestamp >= rec.maturityTimestamp, "Arbitra: not yet mature");

        uint256 faceValue = IArbitraRegistry(arbitraRegistry).getFaceValuePlaintext(invoiceId);
        require(faceValue > 0, "Arbitra: zero face value");

        /* Pull USDC from debtor (msg.sender) to this contract */
        bool pullOk = usdc.transferFrom(msg.sender, address(this), faceValue);
        require(pullOk, "Arbitra: USDC pull failed");

        /*
         * Wrap received USDC into cUSDC so the settlement arithmetic runs
         * homomorphically inside _applyConfidentialSettlement.
         */
        usdc.approve(cUsdc, faceValue);
        IArbitraConfidentialUSDC(cUsdc).wrap(address(this), faceValue);

        _applyConfidentialSettlement(rec);

        rec.isSettled = true;
        rec.settledAt = block.timestamp;
        emit ConfidentialMaturityPaid(invoiceId, rec.investor, block.timestamp);

        IArbitraRegistry(arbitraRegistry).onEscrowSettled(invoiceId);
    }

    /**
     * @notice Platform-initiated settlement (for simulate maturity flow).
     *         Only callable by the registry or platform verifier.
     *         Useful for demo/testing when debtor has pre-funded this contract.
     * @param invoiceId  The invoice to settle
     */
    function settleInvoicePlatform(uint256 invoiceId) external {
        require(cUsdc != address(0), "Arbitra: cUSDC not configured");
        require(
            msg.sender == arbitraRegistry || msg.sender == IArbitraRegistry(arbitraRegistry).platformVerifier(),
            "Arbitra: unauthorized"
        );
        EscrowRecord storage rec = escrows[invoiceId];
        require(!rec.isSettled,  "Arbitra: already settled");

        uint256 faceValue = IArbitraRegistry(arbitraRegistry).getFaceValuePlaintext(invoiceId);
        uint256 balance   = usdc.balanceOf(address(this));
        require(balance >= faceValue, "Arbitra: insufficient escrow balance");

        /*
         * Wrap the pre-funded USDC balance into cUSDC so the settlement
         * arithmetic runs homomorphically.
         */
        usdc.approve(cUsdc, faceValue);
        IArbitraConfidentialUSDC(cUsdc).wrap(address(this), faceValue);

        _applyConfidentialSettlement(rec);

        rec.isSettled = true;
        emit ConfidentialMaturityPaid(invoiceId, rec.investor, block.timestamp);
        IArbitraRegistry(arbitraRegistry).onEscrowSettled(invoiceId);
    }

    /*************** View Functions ***************/

    /**
     * @notice Get a beneficiary's confidential settlement balance handle.
     * @param beneficiary The settlement beneficiary.
     * @return balanceHandle The encrypted ledger balance handle.
     */
    function getConfidentialSettlementBalance(address beneficiary) external view returns (bytes32 balanceHandle) {
        balanceHandle = euint64.unwrap(confidentialSettlementBalances[beneficiary]);
    }

    /**
     * @notice Get settlement audit metadata for an invoice.
     * @dev Returns only commitment hashes and timestamp; plaintext economic
     *      values are now stored as encrypted handles.
     * @param invoiceId The invoice ID.
     * @return paymentReference The payment reference commitment.
     * @return bankTraceId The mock bank trace commitment.
     * @return settlementReceiptHash The settlement receipt commitment.
     * @return settledAt The on-chain settlement timestamp.
     */
    function getSettlementAudit(uint256 invoiceId) external view returns (
        bytes32 paymentReference,
        bytes32 bankTraceId,
        bytes32 settlementReceiptHash,
        uint256 settledAt
    ) {
        EscrowRecord storage rec = escrows[invoiceId];
        paymentReference       = rec.paymentReference;
        bankTraceId            = rec.bankTraceId;
        settlementReceiptHash  = rec.settlementReceiptHash;
        settledAt              = rec.settledAt;
    }

    /**
     * @notice Get settlement commitments for an invoice without returning plaintext economics.
     * @param invoiceId The invoice ID.
     * @return paymentReference The payment reference commitment.
     * @return bankTraceId The mock bank trace commitment.
     * @return settlementReceiptHash The settlement receipt commitment.
     * @return settledAt The on-chain settlement timestamp.
     */
    function getSettlementCommitments(uint256 invoiceId) external view returns (
        bytes32 paymentReference,
        bytes32 bankTraceId,
        bytes32 settlementReceiptHash,
        uint256 settledAt
    ) {
        EscrowRecord storage rec = escrows[invoiceId];
        paymentReference = rec.paymentReference;
        bankTraceId = rec.bankTraceId;
        settlementReceiptHash = rec.settlementReceiptHash;
        settledAt = rec.settledAt;
    }

    /*************** Internal Functions ***************/

    function _verifyPaymentProof(
        uint256 invoiceId,
        bytes32 paymentReference,
        uint256 amount,
        uint256 receivedAt,
        uint256 nonce,
        bytes calldata signature
    ) internal view returns (address signer) {
        bytes32 structHash = keccak256(abi.encode(
            PAYMENT_RECEIVED_TYPEHASH,
            invoiceId,
            paymentReference,
            amount,
            receivedAt,
            nonce
        ));
        signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(signer == IArbitraRegistry(arbitraRegistry).platformVerifier(), "Arbitra: invalid payment proof");
    }

    function _applyConfidentialSettlement(EscrowRecord storage rec) internal {
        /*
         * Supplier already received the discounted purchase price at factor time.
         * At maturity, the wrapped debtor repayment is distributed only to:
         *   1. the investor, net of any explicit encrypted platform fee; and
         *   2. the platform treasury for that explicit encrypted fee.
         */
        euint64 encInvestorRepayment = FHE.sub(rec.encryptedFaceValue, rec.encryptedPlatformFee);

        FHE.allowThis(encInvestorRepayment);
        FHE.allow(encInvestorRepayment, rec.investor);
        FHE.allow(encInvestorRepayment, cUsdc);
        FHE.allow(rec.encryptedPlatformFee, cUsdc);

        /*
         * Confidential transfers: cUSDC moves the encrypted debtor repayment to
         * the investor, with the explicit encrypted platform fee transferred
         * separately when configured.
         */
        IArbitraConfidentialUSDC(cUsdc).confidentialTransfer(rec.investor, encInvestorRepayment);
        IArbitraConfidentialUSDC(cUsdc).confidentialTransfer(platformTreasury, rec.encryptedPlatformFee);

        /*
         * Also credit the virtual settlement ledger to support on-chain audit
         * queries and unit test assertions.
         */
        _creditConfidentialBalance(rec.investor, encInvestorRepayment);
        _creditConfidentialBalance(platformTreasury, rec.encryptedPlatformFee);
    }

    function _creditConfidentialBalance(address beneficiary, euint64 amount) internal {
        euint64 currentBalance = confidentialSettlementBalances[beneficiary];
        euint64 newBalance;

        if (FHE.isInitialized(currentBalance)) {
            newBalance = FHE.add(currentBalance, amount);
        } else {
            newBalance = amount;
        }

        confidentialSettlementBalances[beneficiary] = newBalance;
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, beneficiary);
    }

}
