/**
 * @file ArbitraFingerprintRegistry.sol
 * @description Stores invoice fingerprints in a secure mapping and provides O(1) duplicate detection.
 */
/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.27;

import { FHE, euint64, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig }     from "@fhevm/solidity/config/ZamaConfig.sol";
import { Ownable2Step, Ownable }  from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @notice Stores invoice fingerprints and exposes duplicate checks.
 * @custom:security-contact security@arbitra.example
 */
contract ArbitraFingerprintRegistry is ZamaEthereumConfig, Ownable2Step {

    /*************** Constants ***************/

    /** @notice Maximum registered fingerprints for MVP limit to avoid gas limits */
    uint256 public constant MAX_FINGERPRINTS = 10000;

    /*************** Storage ***************/

    /** @notice List of all registered fingerprints (encrypted handles) */
    euint64[] private _fingerprints;

    /** @notice Total fingerprints registered */
    uint256 public fingerprintCount;

    /** @notice Mapping from invoice ID to its fingerprint */
    mapping(uint256 => euint64) private _invoiceFingerprints;

    /** @notice Mapping from plaintext fingerprint hash (uint256 representation of Keccak256) to registration status */
    mapping(uint256 => bool) public registeredHashes;

    /** @notice Registry address with authorization to register */
    address public arbitraRegistry;

    /*************** Events ***************/

    /** @notice Emitted when a new fingerprint is registered */
    event FingerprintRegistered(uint256 indexed invoiceId, address indexed supplier, uint256 timestamp);

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
     * @param plaintextFingerprint The plaintext fingerprint hash.
     * @return Stored euint64 fingerprint.
     */
    function registerFingerprint(
        uint256 invoiceId,
        euint64 fingerprint,
        uint256 plaintextFingerprint
    ) external returns (euint64) {
        require(msg.sender == arbitraRegistry, "Arbitra: not authorized registry");
        require(fingerprintCount < MAX_FINGERPRINTS, "Arbitra: limit reached");
        require(!registeredHashes[plaintextFingerprint], "Arbitra: duplicate fingerprint");

        registeredHashes[plaintextFingerprint] = true;
        _fingerprints.push(fingerprint);
        _invoiceFingerprints[invoiceId] = fingerprint;
        fingerprintCount++;

        FHE.allowThis(fingerprint);
        FHE.allow(fingerprint, msg.sender);
        FHE.allow(fingerprint, owner());

        emit FingerprintRegistered(invoiceId, msg.sender, block.timestamp);
        return fingerprint;
    }

    /*************** View Functions ***************/

    /**
     * @notice Check if a fingerprint has already been registered on-chain.
     * @param plaintextFingerprint The plaintext fingerprint to check.
     * @return true if duplicate exists, false otherwise.
     */
    function isDuplicate(uint256 plaintextFingerprint) external view returns (bool) {
        return registeredHashes[plaintextFingerprint];
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
