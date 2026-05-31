/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.27;

import { FHE, euint64, ebool }   from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig }    from "@fhevm/solidity/config/ZamaConfig.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { IERC20 }                from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 }             from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IArbitraRegistry {
    function onEscrowSettled(uint256 invoiceId) external;
    function getFaceValuePlaintext(uint256 invoiceId) external view returns (uint256);
    function platformVerifier() external view returns (address);
}

/*
 * @file ArbitraEscrowReceiver.sol
 * @description Escrow contract for automated maturity settlement.
 */
contract ArbitraEscrowReceiver is ZamaEthereumConfig, Ownable2Step {
    using SafeERC20 for IERC20;

    /*************** Data Structures ***************/

    struct EscrowRecord {
        address supplier;
        address investor;
        euint64 encryptedFaceValue;   /* Still stored for FHE display */
        uint256 faceValuePlaintext;   /* For USDC transfer */
        uint256 maturityTimestamp;
        bool    isSettled;
        bool    isDisputed;
    }

    /*************** Storage ***************/

    /* Escrow records indexed by invoice ID */
    mapping(uint256 => EscrowRecord) public escrows;

    /* Address of standard USDC */
    IERC20 public immutable usdc;

    /* Main Arbitra Registry contract */
    address public arbitraRegistry;

    /*************** Events ***************/

    /** @notice Emitted when a maturity payment is received and processed */
    event ConfidentialMaturityPaid(uint256 indexed invoiceId, address indexed investor, uint256 timestamp);

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
    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "Arbitra: zero token address");
        usdc = IERC20(_usdc);
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

    /*************** Registry Functions ***************/

    /**
     * @notice Register an escrow record for an invoice.
     * @param invoiceId The invoice ID.
     * @param supplier The supplier address.
     * @param investor The investor address.
     * @param encFaceValue The FHE encrypted face value handle.
     * @param faceValuePlaintext The plaintext face value in USDC micro-units.
     * @param maturityTs The maturity timestamp.
     */
    function registerEscrow(
        uint256 invoiceId,
        address supplier,
        address investor,
        euint64 encFaceValue,
        uint256 faceValuePlaintext,
        uint256 maturityTs
    ) external onlyRegistry {
        require(escrows[invoiceId].supplier == address(0), "Arbitra: escrow already exists");

        escrows[invoiceId] = EscrowRecord({
            supplier: supplier,
            investor: investor,
            encryptedFaceValue: encFaceValue,
            faceValuePlaintext: faceValuePlaintext,
            maturityTimestamp: maturityTs,
            isSettled: false,
            isDisputed: false
        });

        FHE.allowThis(encFaceValue);
        FHE.allow(encFaceValue, supplier);
        FHE.allow(encFaceValue, investor);
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
     * @notice Debtor calls this to settle an invoice at maturity.
     *         Sends USDC directly from debtor's wallet to the escrow receiver,
     *         which then distributes to the investor.
     *         Requires: debtor has approved this contract for faceValuePlaintext USDC.
     * @param invoiceId  The invoice to settle
     */
    function settleInvoice(uint256 invoiceId) external {
        EscrowRecord storage rec = escrows[invoiceId];
        require(!rec.isSettled,                        "Arbitra: already settled");
        require(!rec.isDisputed,                       "Arbitra: invoice disputed");
        require(block.timestamp >= rec.maturityTimestamp, "Arbitra: not yet mature");

        uint256 faceValue = IArbitraRegistry(arbitraRegistry).getFaceValuePlaintext(invoiceId);
        require(faceValue > 0, "Arbitra: zero face value");

        /* Pull USDC from debtor (msg.sender) to this contract */
        bool pullOk = usdc.transferFrom(msg.sender, address(this), faceValue);
        require(pullOk, "Arbitra: USDC pull failed");

        /* Push USDC from this contract to investor */
        bool pushOk = usdc.transfer(rec.investor, faceValue);
        require(pushOk, "Arbitra: USDC push failed");

        rec.isSettled = true;
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
        require(
            msg.sender == arbitraRegistry || msg.sender == IArbitraRegistry(arbitraRegistry).platformVerifier(),
            "Arbitra: unauthorized"
        );
        EscrowRecord storage rec = escrows[invoiceId];
        require(!rec.isSettled,  "Arbitra: already settled");

        uint256 faceValue = IArbitraRegistry(arbitraRegistry).getFaceValuePlaintext(invoiceId);
        uint256 balance   = usdc.balanceOf(address(this));
        require(balance >= faceValue, "Arbitra: insufficient escrow balance");

        bool pushOk = usdc.transfer(rec.investor, faceValue);
        require(pushOk, "Arbitra: USDC push failed");

        rec.isSettled = true;
        emit ConfidentialMaturityPaid(invoiceId, rec.investor, block.timestamp);
        IArbitraRegistry(arbitraRegistry).onEscrowSettled(invoiceId);
    }
}
