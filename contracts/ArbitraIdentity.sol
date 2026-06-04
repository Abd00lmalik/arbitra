/**
 * @file ArbitraIdentity.sol
 * @description Stores FHE-encrypted compliance data for verified suppliers.
 *              Encrypted fields: taxID (euint32), kybStatus (ebool), riskScore (euint8).
 *              Encryption occurs client-side AFTER KYB approval is confirmed.
 *              Only wallets with a valid ArbitraSBT may submit encrypted data.
 */
/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.27;

import { FHE, euint32, euint8, ebool,
         externalEuint32, externalEuint8, externalEbool } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig }                              from "@fhevm/solidity/config/ZamaConfig.sol";
import { Ownable2Step, Ownable }                           from "@openzeppelin/contracts/access/Ownable2Step.sol";

interface IArbitraSBT {
    function hasValidSBT(address wallet) external view returns (bool);
}

contract ArbitraIdentity is ZamaEthereumConfig, Ownable2Step {

    /*************** State Variables ***************/

    /* SBT contract reference for access gating */
    IArbitraSBT public immutable sbtContract;

    /* Authorized relayer for gasless compliance submissions */
    address public complianceRelayer;

    /* FHE-encrypted compliance record per wallet */
    struct EncryptedCompliance {
        euint32 encryptedTaxID;     /* 32-bit tax ID ciphertext */
        ebool   encryptedKybStatus; /* true = approved */
        euint8  encryptedRiskScore; /* 0-100 raw risk score */
        uint256 submittedAt;
        bool    isSubmitted;
    }

    mapping(address => EncryptedCompliance) public encryptedCompliance;

    /*************** Events ***************/

    event EncryptedComplianceSubmitted(
        address indexed wallet,
        uint256 timestamp
    );

    event ComplianceRelayerUpdated(
        address indexed previousRelayer,
        address indexed newRelayer
    );

    /*************** Constructor ***************/

    /**
     * @notice Construct ArbitraIdentity.
     * @param initialOwner Owner of the contract (governance/compliance).
     * @param sbtContract_ Address of the ArbitraSBT contract.
     * @param complianceRelayer_ Authorized gasless compliance relayer address.
     */
    constructor(
        address initialOwner,
        address sbtContract_,
        address complianceRelayer_
    ) Ownable(initialOwner) {
        require(sbtContract_ != address(0), "ArbitraIdentity: zero SBT address");
        require(complianceRelayer_ != address(0), "ArbitraIdentity: zero relayer");
        sbtContract = IArbitraSBT(sbtContract_);
        complianceRelayer = complianceRelayer_;
    }

    /*************** External/Public Functions ***************/

    /**
     * @notice Submit FHE-encrypted compliance data after KYB approval.
     *         Caller MUST hold a valid, non-revoked ArbitraSBT.
     * @param encTaxID     ExternalEuint32 encrypted tax ID.
     * @param proofTaxID   ZKPoK proof for encTaxID.
     * @param encKybStatus ExternalEbool encrypted KYB approval flag.
     * @param proofKyb     ZKPoK proof for encKybStatus.
     * @param encRisk      ExternalEuint8 encrypted risk score.
     * @param proofRisk    ZKPoK proof for encRisk.
     */
    function submitEncryptedCompliance(
        externalEuint32 encTaxID,
        bytes calldata  proofTaxID,
        externalEbool   encKybStatus,
        bytes calldata  proofKyb,
        externalEuint8  encRisk,
        bytes calldata  proofRisk
    ) external {
        _submitEncryptedComplianceFor(
            msg.sender,
            encTaxID,
            proofTaxID,
            encKybStatus,
            proofKyb,
            encRisk,
            proofRisk
        );
    }

    /**
     * @notice Submit FHE-encrypted compliance data for a verified wallet using a relayer.
     *         Caller MUST be the governance owner or authorized relayer and the target wallet
     *         MUST hold a valid SBT.
     * @param wallet        Verified wallet receiving the encrypted compliance record.
     * @param encTaxID      ExternalEuint32 encrypted tax ID submitted by the authorized relayer.
     * @param proofTaxID    ZKPoK proof for encTaxID.
     * @param encKybStatus  ExternalEbool encrypted KYB approval flag submitted by the relayer.
     * @param proofKyb      ZKPoK proof for encKybStatus.
     * @param encRisk       ExternalEuint8 encrypted risk score submitted by the relayer.
     * @param proofRisk     ZKPoK proof for encRisk.
     */
    function submitEncryptedComplianceFor(
        address         wallet,
        externalEuint32 encTaxID,
        bytes calldata  proofTaxID,
        externalEbool   encKybStatus,
        bytes calldata  proofKyb,
        externalEuint8  encRisk,
        bytes calldata  proofRisk
    ) external {
        require(
            msg.sender == owner() || msg.sender == complianceRelayer,
            "ArbitraIdentity: unauthorized relayer"
        );
        require(wallet != address(0), "ArbitraIdentity: zero wallet");
        _submitEncryptedComplianceFor(
            wallet,
            encTaxID,
            proofTaxID,
            encKybStatus,
            proofKyb,
            encRisk,
            proofRisk
        );
    }

    /**
     * @notice Check if a wallet has submitted FHE compliance data.
     * @param wallet The wallet address to query.
     * @return True if encrypted compliance data exists.
     */
    function hasEncryptedCompliance(address wallet) external view returns (bool) {
        return encryptedCompliance[wallet].isSubmitted;
    }

    /**
     * @notice Get encrypted handles for a wallet's compliance data.
     *         Caller must have ACL permission (granted at submission time).
     * @param wallet The wallet address to query.
     * @return taxIDHandle Handle for the encrypted Tax ID.
     * @return kybHandle Handle for the encrypted KYB status.
     * @return riskHandle Handle for the encrypted risk score.
     */
    function getEncryptedHandles(address wallet) external view returns (
        bytes32 taxIDHandle,
        bytes32 kybHandle,
        bytes32 riskHandle
    ) {
        EncryptedCompliance storage c = encryptedCompliance[wallet];
        taxIDHandle = euint32.unwrap(c.encryptedTaxID);
        kybHandle   = ebool.unwrap(c.encryptedKybStatus);
        riskHandle  = euint8.unwrap(c.encryptedRiskScore);
    }

    /**
     * @notice Update the authorized gasless compliance relayer.
     * @param newRelayer New relayer address.
     */
    function setComplianceRelayer(address newRelayer) external onlyOwner {
        require(newRelayer != address(0), "ArbitraIdentity: zero relayer");
        address previousRelayer = complianceRelayer;
        complianceRelayer = newRelayer;
        emit ComplianceRelayerUpdated(previousRelayer, newRelayer);
    }

    /*************** Internal ***************/

    /**
     * @notice Internal shared implementation for direct and relayed compliance storage.
     * @param wallet        Wallet receiving the encrypted compliance record and ACL grants.
     * @param encTaxID      ExternalEuint32 encrypted tax ID.
     * @param proofTaxID    ZKPoK proof for encTaxID.
     * @param encKybStatus  ExternalEbool encrypted KYB approval flag.
     * @param proofKyb      ZKPoK proof for encKybStatus.
     * @param encRisk       ExternalEuint8 encrypted risk score.
     * @param proofRisk     ZKPoK proof for encRisk.
     */
    function _submitEncryptedComplianceFor(
        address         wallet,
        externalEuint32 encTaxID,
        bytes calldata  proofTaxID,
        externalEbool   encKybStatus,
        bytes calldata  proofKyb,
        externalEuint8  encRisk,
        bytes calldata  proofRisk
    ) internal {
        require(sbtContract.hasValidSBT(wallet), "ArbitraIdentity: no valid SBT");
        require(!encryptedCompliance[wallet].isSubmitted, "ArbitraIdentity: already submitted");

        /* Verify proofs and construct ciphertexts */
        euint32 eTaxID     = FHE.fromExternal(encTaxID,     proofTaxID);
        ebool   eKybStatus = FHE.fromExternal(encKybStatus, proofKyb);
        euint8  eRisk      = FHE.fromExternal(encRisk,      proofRisk);

        /* Grant contract persistent access to allow future reads/computations */
        FHE.allowThis(eTaxID);
        FHE.allowThis(eKybStatus);
        FHE.allowThis(eRisk);

        /* Grant verified wallet access to decrypt its own data */
        FHE.allow(eTaxID,     wallet);
        FHE.allow(eKybStatus, wallet);
        FHE.allow(eRisk,      wallet);

        /* Grant governance owner access to decrypt for compliance audits */
        FHE.allow(eTaxID,     owner());
        FHE.allow(eKybStatus, owner());
        FHE.allow(eRisk,      owner());

        encryptedCompliance[wallet] = EncryptedCompliance({
            encryptedTaxID:     eTaxID,
            encryptedKybStatus: eKybStatus,
            encryptedRiskScore: eRisk,
            submittedAt:        block.timestamp,
            isSubmitted:        true
        });

        emit EncryptedComplianceSubmitted(wallet, block.timestamp);
    }
}
