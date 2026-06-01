/**
 * @file ArbitraFingerprintRegistry.sol
 * @description Stores encrypted SHA-256 invoice fingerprints and provides duplicate detection.
 */
/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.27;

import { FHE, euint64, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig }     from "@fhevm/solidity/config/ZamaConfig.sol";
import { Ownable2Step, Ownable }  from "@openzeppelin/contracts/access/Ownable2Step.sol";

contract ArbitraFingerprintRegistry is ZamaEthereumConfig, Ownable2Step {

    /*************** Constants ***************/

    /** @notice Maximum registered fingerprints for MVP limit to avoid gas limits */
    uint256 public constant MAX_FINGERPRINTS = 500;

    /*************** Storage ***************/

    /** @notice List of all registered fingerprints */
    euint64[] private _fingerprints;

    /** @notice Total fingerprints registered */
    uint256 public fingerprintCount;

    /** @notice Mapping from invoice ID to its fingerprint */
    mapping(uint256 => euint64) private _invoiceFingerprints;

    /** @notice Registry address with authorization to register */
    address public arbitraRegistry;

    /*************** Events ***************/

    /** @notice Emitted when a new fingerprint is registered */
    event FingerprintRegistered(uint256 indexed invoiceId, uint256 count);

    /*************** Constructor ***************/

    /**
     * @notice Constructor to initialize ownership.
     */
    constructor() Ownable(msg.sender) {}

    /*************** Admin Functions ***************/

    /**
     * @notice Set the main Arbitra Registry contract address.
     * @param _registry The address of the ArbitraInvoiceRegistry contract.
     */
    function setRegistry(address _registry) external onlyOwner {
        require(_registry != address(0), "Arbitra: zero address");
        arbitraRegistry = _registry;
    }

    /*************** Registry Functions ***************/

    /**
     * @notice Register a new invoice fingerprint.
     * @param invoiceId The ID of the invoice.
     * @param fingerprint The encrypted fingerprint euint64 handle.
     * @return Stored euint64 fingerprint.
     */
    function registerFingerprint(
        uint256 invoiceId,
        euint64 fingerprint
    ) external returns (euint64) {
        require(msg.sender == arbitraRegistry, "Arbitra: not authorized registry");
        require(fingerprintCount < MAX_FINGERPRINTS, "Arbitra: limit reached");

        _fingerprints.push(fingerprint);
        _invoiceFingerprints[invoiceId] = fingerprint;
        fingerprintCount++;

        FHE.allowThis(fingerprint);
        FHE.allow(fingerprint, msg.sender);
        FHE.allow(fingerprint, owner());

        emit FingerprintRegistered(invoiceId, fingerprintCount);
        return fingerprint;
    }

    /**
     * @notice Perform homomorphic duplicate detection against all registered fingerprints.
     * @param eNew The encrypted fingerprint euint64 handle to check.
     * @return isDuplicate Encrypted boolean indicating if duplicate exists.
     */
    function checkDuplicate(
        euint64 eNew
    ) external returns (ebool isDuplicate) {
        ebool eAnyDuplicate = FHE.asEbool(false);

        for (uint256 i = 0; i < fingerprintCount; i++) {
            ebool eMatch = FHE.eq(eNew, _fingerprints[i]);
            eAnyDuplicate = FHE.or(eAnyDuplicate, eMatch);
        }

        isDuplicate = eAnyDuplicate;

        FHE.allowThis(isDuplicate);
        FHE.allow(isDuplicate, msg.sender);
        FHE.allow(isDuplicate, owner());
    }

    /**
     * @notice Retrieve the encrypted fingerprint for a specific invoice.
     * @param invoiceId The ID of the invoice.
     * @return The encrypted fingerprint euint64.
     */
    function getFingerprint(uint256 invoiceId) external view returns (euint64) {
        return _invoiceFingerprints[invoiceId];
    }
}
