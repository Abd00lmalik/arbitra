/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.27;

import { FHE, euint64, ebool }   from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig }    from "@fhevm/solidity/config/ZamaConfig.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { IERC7984 }              from "./interfaces/IERC7984.sol";
import { IERC7984Receiver }      from "@openzeppelin/confidential-contracts/interfaces/IERC7984Receiver.sol";

interface IArbitraRegistry {
    function onEscrowSettled(uint256 invoiceId) external;
}

/*
 * @file ArbitraEscrowReceiver.sol
 * @description Escrow contract implementing IERC7984Receiver for automated maturity settlement.
 */
contract ArbitraEscrowReceiver is ZamaEthereumConfig, Ownable2Step, IERC7984Receiver {

    /*************** Data Structures ***************/

    struct EscrowRecord {
        address supplier;
        address investor;
        euint64 encryptedFaceValue;
        uint256 maturityTimestamp;
        bool    isSettled;
        bool    isDisputed;
    }

    /*************** Storage ***************/

    /** @notice Escrow records indexed by invoice ID */
    mapping(uint256 => EscrowRecord) public escrows;

    /** @notice Trusted cUSDC token contract */
    address public immutable trustedCUSDC;

    /** @notice Main Arbitra Registry contract */
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
     * @param _cUSDC The address of the cUSDC token.
     */
    constructor(address _cUSDC) Ownable(msg.sender) {
        require(_cUSDC != address(0), "Arbitra: zero token address");
        trustedCUSDC = _cUSDC;
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
     * @param maturityTs The maturity timestamp.
     */
    function registerEscrow(
        uint256 invoiceId,
        address supplier,
        address investor,
        euint64 encFaceValue,
        uint256 maturityTs
    ) external onlyRegistry {
        require(escrows[invoiceId].supplier == address(0), "Arbitra: escrow already exists");

        escrows[invoiceId] = EscrowRecord({
            supplier: supplier,
            investor: investor,
            encryptedFaceValue: encFaceValue,
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

    /*************** IERC7984Receiver Implementation ***************/

    /**
     * @notice Callback invoked by cUSDC on confidential transfer.
     * @dev Homomorphically checks that payment amount >= face value and transfers to investor.
     */
    function onConfidentialTransferReceived(
        address /* operator */,
        address /* from */,
        euint64 amount,
        bytes calldata data
    ) external override returns (ebool) {
        require(msg.sender == trustedCUSDC, "Arbitra: invalid token source");

        uint256 invoiceId = abi.decode(data, (uint256));
        EscrowRecord storage rec = escrows[invoiceId];
        require(rec.supplier != address(0), "Arbitra: escrow record not found");
        require(!rec.isSettled, "Arbitra: already settled");
        require(!rec.isDisputed, "Arbitra: invoice disputed");
        require(block.timestamp >= rec.maturityTimestamp, "Arbitra: not yet mature");

        /* Validate that transferred amount is at least the face value */
        ebool isPaymentSufficient = FHE.ge(amount, rec.encryptedFaceValue);
        FHE.allow(isPaymentSufficient, msg.sender);

        /* Grant transient access to the cUSDC contract for transfer from escrow to investor */
        FHE.allowTransient(rec.encryptedFaceValue, trustedCUSDC);

        /* Transfer the face value of cUSDC to the investor */
        IERC7984(trustedCUSDC).confidentialTransfer(rec.investor, rec.encryptedFaceValue);

        rec.isSettled = true;
        emit ConfidentialMaturityPaid(invoiceId, rec.investor, block.timestamp);

        /* Notify registry to update stats and release collateral */
        IArbitraRegistry(arbitraRegistry).onEscrowSettled(invoiceId);

        return isPaymentSufficient;
    }
}
