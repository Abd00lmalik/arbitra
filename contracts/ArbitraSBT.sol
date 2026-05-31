/* SPDX-License-Identifier: MIT */
/**
 * @file ArbitraSBT.sol
 * @description Non-transferable Soulbound Token for supplier KYB verification.
 *              Minted exclusively by the MockKYBOracle.
 *              Once minted, hasValidSBT[wallet] = true, unlocking marketplace access.
 *              SBT is non-transferable: transfers and approvals revert.
 */

pragma solidity ^0.8.27;

import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ERC721 }                from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ArbitraSBT is ERC721, Ownable2Step {

    /*************** State Variables ***************/

    /* Soulbound flag: wallet -> SBT exists */
    mapping(address => bool) public hasValidSBT;

    /* SBT metadata per token */
    struct SBTRecord {
        address wallet;
        bytes32 kybVerificationId;  /* keccak256(KYB-MOCK-XXXXX) */
        bytes32 attestationHash;    /* hash of full oracle response */
        uint8   riskScoreBucket;    /* 0=low(0-33), 1=medium(34-66), 2=high(67-100) */
        uint256 mintTimestamp;
        bool    isRevoked;
    }

    mapping(uint256 => SBTRecord) public sbtRecords;
    mapping(address => uint256)   public walletToTokenId;

    uint256 private _tokenIdCounter;

    /* KYB Oracle contract authorized to mint SBTs */
    address public kybOracle;

    /*************** Events ***************/

    event SBTMinted(
        address indexed wallet,
        uint256 indexed tokenId,
        bytes32 kybVerificationId,
        uint8   riskScore,
        uint256 timestamp
    );

    event SBTRevoked(
        address indexed wallet,
        uint256 indexed tokenId,
        uint256 timestamp
    );

    event KYBOracleSet(
        address indexed oracle
    );

    /*************** Constructor ***************/

    /**
     * @notice Construct ArbitraSBT.
     * @param initialOwner Owner of the contract (governance).
     */
    constructor(address initialOwner) ERC721("ArbitraSoulboundToken", "aSBT") Ownable(initialOwner) {}

    /*************** External/Public Functions ***************/

    /**
     * @notice Set the KYB Oracle contract address.
     * @param kybOracle_ The oracle contract address.
     */
    function setKYBOracle(address kybOracle_) external onlyOwner {
        require(kybOracle_ != address(0), "ArbitraSBT: zero address");
        kybOracle = kybOracle_;
        emit KYBOracleSet(kybOracle_);
    }

    /**
     * @notice Mint an SBT to a verified supplier wallet.
     *         Called exclusively by the KYB Oracle contract.
     * @param wallet            The supplier's embedded wallet address.
     * @param kybVerificationId Hash of the mock verification ID.
     * @param attestationHash   Hash of the full oracle response.
     * @param riskScore         Raw risk score 0-100 from MockKYBOracle.
     */
    function mintSBT(
        address wallet,
        bytes32 kybVerificationId,
        bytes32 attestationHash,
        uint8   riskScore
    ) external {
        require(msg.sender == kybOracle, "ArbitraSBT: unauthorized");
        require(!hasValidSBT[wallet], "ArbitraSBT: SBT already exists");
        require(wallet != address(0), "ArbitraSBT: zero wallet");

        uint256 tokenId = ++_tokenIdCounter;
        uint8 bucket = riskScore <= 33 ? 0 : riskScore <= 66 ? 1 : 2;

        sbtRecords[tokenId] = SBTRecord({
            wallet:             wallet,
            kybVerificationId:  kybVerificationId,
            attestationHash:    attestationHash,
            riskScoreBucket:    bucket,
            mintTimestamp:      block.timestamp,
            isRevoked:          false
        });

        walletToTokenId[wallet]  = tokenId;
        hasValidSBT[wallet]      = true;

        _safeMint(wallet, tokenId);

        emit SBTMinted(wallet, tokenId, kybVerificationId, riskScore, block.timestamp);
    }

    /**
     * @notice Revoke an SBT on fraud or re-verification failure.
     * @param wallet The wallet address whose SBT is being revoked.
     */
    function revokeSBT(address wallet) external onlyOwner {
        require(hasValidSBT[wallet], "ArbitraSBT: no SBT");
        uint256 tokenId = walletToTokenId[wallet];
        sbtRecords[tokenId].isRevoked = true;
        hasValidSBT[wallet]           = false;
        emit SBTRevoked(wallet, tokenId, block.timestamp);
    }

    /*************** Soulbound Overrides ***************/

    /**
     * @dev Block ERC721 transfers.
     */
    function transferFrom(address, address, uint256) public pure override {
        revert("ArbitraSBT: soulbound - non-transferable");
    }

    /**
     * @dev Block ERC721 safe transfers with data.
     */
    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert("ArbitraSBT: soulbound - non-transferable");
    }

    /**
     * @dev Block ERC721 approvals.
     */
    function approve(address, uint256) public pure override {
        revert("ArbitraSBT: soulbound - approvals disabled");
    }

    /**
     * @dev Block ERC721 operator approvals.
     */
    function setApprovalForAll(address, bool) public pure override {
        revert("ArbitraSBT: soulbound - approvals disabled");
    }

    /**
     * @dev Enforce soulbound rule at token transfer hook level.
     */
    function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
        address previousOwner = super._update(to, tokenId, auth);
        require(previousOwner == address(0), "ArbitraSBT: soulbound - non-transferable");
        return previousOwner;
    }
}
