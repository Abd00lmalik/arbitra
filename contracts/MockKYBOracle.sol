/* SPDX-License-Identifier: MIT */
/**
 * @file MockKYBOracle.sol
 * @description On-chain record and verifier of MockKYB attestations.
 *              Verifies EIP-712 signatures generated off-chain by the trusted oracle backend.
 *              Includes nonce-based replay protection and strict expiration bounds.
 *              Triggers ArbitraSBT minting upon successful validation.
 */

pragma solidity ^0.8.27;

import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ECDSA }                  from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { EIP712 }                 from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

interface IArbitraSBT {
    function mintSBT(
        address wallet,
        bytes32 kybVerificationId,
        bytes32 attestationHash,
        uint8   riskScore
    ) external;
}

contract MockKYBOracle is EIP712, Ownable2Step {

    /*************** State Variables ***************/

    /* SBT contract reference */
    IArbitraSBT public immutable sbtContract;

    /* EIP-712 type hash for KYB attestation */
    bytes32 private constant KYB_TYPEHASH = keccak256(
        "KYBAttestation(address wallet,bytes32 verificationId,bytes32 attestationHash,uint8 riskScore,uint256 timestamp,uint256 nonce)"
    );

    /* Track used attestation hashes to prevent signature reuse */
    mapping(bytes32 => bool) public usedAttestations;

    /* Track nonces per wallet to prevent EIP-712 signature replay */
    mapping(address => uint256) public nonces;

    /* Trusted oracle backend address */
    address public oracleBackend;

    /*************** Events ***************/

    event KYBAttestationSubmitted(
        address indexed wallet,
        bytes32 indexed verificationId,
        uint8   riskScore,
        uint256 timestamp
    );

    event OracleBackendSet(
        address indexed oldBackend,
        address indexed newBackend
    );

    /*************** Constructor ***************/

    /**
     * @notice Construct MockKYBOracle.
     * @param initialOwner Owner of the contract.
     * @param sbtContract_ Address of the ArbitraSBT contract.
     * @param oracleBackend_ Trusted oracle backend address.
     */
    constructor(
        address initialOwner,
        address sbtContract_,
        address oracleBackend_
    ) EIP712("Arbitra", "2") Ownable(initialOwner) {
        require(sbtContract_ != address(0), "MockKYBOracle: zero SBT address");
        require(oracleBackend_ != address(0), "MockKYBOracle: zero backend address");
        sbtContract = IArbitraSBT(sbtContract_);
        oracleBackend = oracleBackend_;
    }

    /*************** External/Public Functions ***************/

    /**
     * @notice Set a new trusted oracle backend address.
     * @param newBackend The new backend address.
     */
    function setOracleBackend(address newBackend) external onlyOwner {
        require(newBackend != address(0), "MockKYBOracle: zero address");
        emit OracleBackendSet(oracleBackend, newBackend);
        oracleBackend = newBackend;
    }

    /**
     * @notice Submit a KYB attestation and mint an SBT.
     *         Callable by any wallet (typically the client/user) carrying a valid signature.
     * @param wallet           Supplier's wallet address.
     * @param verificationId   Hash of the mock verification ID.
     * @param attestationHash  Hash of the full oracle response.
     * @param riskScore        Raw risk score 0-100.
     * @param timestamp        Signature timestamp.
     * @param signature        EIP-712 signature from oracle backend.
     */
    function submitKYBAttestation(
        address wallet,
        bytes32 verificationId,
        bytes32 attestationHash,
        uint8   riskScore,
        uint256 timestamp,
        bytes calldata signature
    ) external {
        require(!usedAttestations[attestationHash], "MockKYBOracle: attestation replayed");
        require(block.timestamp <= timestamp + 300, "MockKYBOracle: attestation expired");
        require(riskScore <= 100, "MockKYBOracle: invalid risk score");

        uint256 currentNonce = nonces[wallet];

        /* Verify EIP-712 signature from oracle backend */
        bytes32 structHash = keccak256(abi.encode(
            KYB_TYPEHASH,
            wallet,
            verificationId,
            attestationHash,
            riskScore,
            timestamp,
            currentNonce
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == oracleBackend, "MockKYBOracle: invalid oracle signature");

        /* Update nonces and used signatures to prevent replays */
        nonces[wallet] = currentNonce + 1;
        usedAttestations[attestationHash] = true;

        /* Call SBT contract to mint */
        sbtContract.mintSBT(wallet, verificationId, attestationHash, riskScore);

        emit KYBAttestationSubmitted(wallet, verificationId, riskScore, block.timestamp);
    }
}
