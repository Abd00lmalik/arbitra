/**
 * @file ArbitraFingerprintRegistry.sol
 * @description Stores encrypted SHA-256 invoice fingerprints and provides duplicate detection.
 */
/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.27;

import { FHE, euint64, externalEuint64, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig }     from "@fhevm/solidity/config/ZamaConfig.sol";
import { Ownable2Step, Ownable }  from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @notice Stores encrypted invoice fingerprints and exposes supplier duplicate checks.
 * @dev Pending uniqueness checks persist the encrypted hash, face value, and duplicate
 *      result so the supplier can decrypt the result before registering the fingerprint.
 * @custom:security-contact security@arbitra.example
 */
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

    /** @notice Pending encrypted duplicate result by supplier */
    mapping(address => ebool) private _pendingDuplicateChecks;

    /** @notice Pending encrypted fingerprint hash by supplier */
    mapping(address => euint64) private _pendingHashes;

    /** @notice Pending encrypted face value by supplier */
    mapping(address => euint64) private _pendingFaceValues;

    /** @notice Whether a supplier has a pending check ready to register */
    mapping(address => bool) public hasPendingDuplicateCheck;

    /** @notice Registry address with authorization to register */
    address public arbitraRegistry;

    /*************** Events ***************/

    /** @notice Emitted when a new fingerprint is registered */
    event FingerprintRegistered(uint256 indexed invoiceId, address indexed supplier, uint256 timestamp);

    /** @notice Emitted when a supplier starts an encrypted duplicate check */
    event DuplicateCheckInitiated(address indexed supplier, uint256 timestamp);

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

        /* Prevent double registration if confirmAndRegister was already called */
        if (euint64.unwrap(_invoiceFingerprints[invoiceId]) != bytes32(0)) {
            return _invoiceFingerprints[invoiceId];
        }

        _fingerprints.push(fingerprint);
        _invoiceFingerprints[invoiceId] = fingerprint;
        fingerprintCount++;

        FHE.allowThis(fingerprint);
        FHE.allow(fingerprint, msg.sender);
        FHE.allow(fingerprint, owner());

        emit FingerprintRegistered(invoiceId, msg.sender, block.timestamp);
        return fingerprint;
    }

    /**
     * @notice Submit encrypted invoice data for supplier-side duplicate checking.
     * @dev The supplier must decrypt the returned handle off-chain before choosing
     *      whether to continue. Stored pending handles receive persistent ACL so
     *      this contract can reuse the hash if confirmAndRegister is called later.
     * @param encHash Encrypted 64-bit invoice fingerprint.
     * @param proofHash ZK proof bound to encHash.
     * @param encFaceValue Encrypted invoice face value in USDC micro-units.
     * @param proofFaceValue ZK proof bound to encFaceValue.
     * @return duplicateResultHandle Handle of the encrypted duplicate result.
     */
    function checkInvoiceUniqueness(
        externalEuint64 encHash,
        bytes calldata proofHash,
        externalEuint64 encFaceValue,
        bytes calldata proofFaceValue
    ) external returns (bytes32 duplicateResultHandle) {
        euint64 eHash = FHE.fromExternal(encHash, proofHash);
        euint64 eFaceValue = FHE.fromExternal(encFaceValue, proofFaceValue);
        ebool eIsDuplicate = FHE.asEbool(false);

        for (uint256 i = 0; i < fingerprintCount; i++) {
            ebool eMatch = FHE.eq(eHash, _fingerprints[i]);
            eIsDuplicate = FHE.or(eIsDuplicate, eMatch);
        }

        _pendingDuplicateChecks[msg.sender] = eIsDuplicate;
        _pendingHashes[msg.sender] = eHash;
        _pendingFaceValues[msg.sender] = eFaceValue;
        hasPendingDuplicateCheck[msg.sender] = true;

        FHE.allowThis(eIsDuplicate);
        FHE.allow(eIsDuplicate, msg.sender);
        FHE.allowThis(eHash);
        FHE.allow(eHash, msg.sender);
        FHE.allowThis(eFaceValue);
        FHE.allow(eFaceValue, msg.sender);

        emit DuplicateCheckInitiated(msg.sender, block.timestamp);
        return FHE.toBytes32(eIsDuplicate);
    }

    /**
     * @notice Register the supplier's pending fingerprint after an off-chain uniqueness confirmation.
     * @dev This function cannot branch on the encrypted duplicate flag. Callers must decrypt
     *      getDuplicateCheckHandle first and call only when the result is false.
     * @param invoiceId Invoice ID to bind to the pending fingerprint.
     */
    function confirmAndRegister(uint256 invoiceId) external {
        require(hasPendingDuplicateCheck[msg.sender], "Arbitra: no pending check");
        require(fingerprintCount < MAX_FINGERPRINTS, "Arbitra: limit reached");

        euint64 fingerprint = _pendingHashes[msg.sender];
        _fingerprints.push(fingerprint);
        _invoiceFingerprints[invoiceId] = fingerprint;
        fingerprintCount++;
        hasPendingDuplicateCheck[msg.sender] = false;

        FHE.allowThis(fingerprint);
        FHE.allow(fingerprint, msg.sender);
        FHE.allow(fingerprint, owner());
        if (arbitraRegistry != address(0)) {
            FHE.allow(fingerprint, arbitraRegistry);
        }

        emit FingerprintRegistered(invoiceId, msg.sender, block.timestamp);
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

    /**
     * @notice Get the encrypted duplicate-check result handle for a supplier.
     * @param supplier The supplier wallet address.
     * @return handle The encrypted ebool duplicate result handle.
     */
    function getDuplicateCheckHandle(address supplier) external view returns (bytes32 handle) {
        return FHE.toBytes32(_pendingDuplicateChecks[supplier]);
    }
}
