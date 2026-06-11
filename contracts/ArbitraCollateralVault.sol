/**
 * @file ArbitraCollateralVault.sol
 * @description Manages supplier USDC collateral staking, releasing, and slashing.
 */
/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.27;

import { Ownable2Step, Ownable }   from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { IERC20 }                   from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 }                from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ArbitraCollateralVault is Ownable2Step {
    using SafeERC20 for IERC20;

    /*************** Constants ***************/

    /** @notice Collateral requirement: 5% = 500 BPS of face value */
    uint256 public constant COLLATERAL_BPS = 500;

    /*************** Enums ***************/

    enum StakeState {
        UNSTAKED,
        STAKED_PENDING_REGISTRATION,
        REGISTERED,
        FINANCED,
        REPAID,
        STAKE_RELEASED,
        SLASHED
    }

    /*************** Storage ***************/

    /** @notice Address of the USDC ERC-20 contract */
    IERC20 public immutable usdc;

    /** @notice Address of the main Arbitra Registry contract */
    address public arbitraRegistry;

    /** @notice Staked collateral per invoice ID (in USDC plaintext micro-units) */
    mapping(uint256 => uint256) public stakedCollateral;

    /** @notice Supplier associated with each invoice ID */
    mapping(uint256 => address) public invoiceSupplier;

    /** @notice Staked collateral per invoice fingerprint (in USDC plaintext micro-units) */
    mapping(uint256 => uint256) public stakedCollateralByFingerprint;

    /** @notice Supplier associated with each invoice fingerprint */
    mapping(uint256 => address) public supplierByFingerprint;

    /** @notice Stake state mapping (keys can be fingerprint or sequential invoiceId) */
    mapping(uint256 => StakeState) public stakeStates;

    /** @notice Indicates if the collateral for a given invoice has been slashed */
    mapping(uint256 => bool) public isSlashed;

    /*************** Events ***************/

    /** @notice Emitted when collateral is staked for an invoice */
    event CollateralStaked(uint256 indexed invoiceId, address indexed supplier, uint256 amount);

    /** @notice Emitted when collateral is released back to the supplier */
    event CollateralReleased(uint256 indexed invoiceId, address indexed supplier, uint256 amount);

    /** @notice Emitted when collateral is slashed and redirected to the investor */
    event CollateralSlashed(uint256 indexed invoiceId, address indexed investor, uint256 amount);

    /** @notice Emitted when a fingerprint stake is linked to a sequential invoice ID */
    event StakeLinked(uint256 indexed invoiceId, uint256 indexed fingerprint, uint256 amount);

    /*************** Modifiers ***************/

    /**
     * @dev Restricts execution to the Arbitra Registry contract.
     */
    modifier onlyRegistry() {
        require(msg.sender == arbitraRegistry, "Arbitra: only registry");
        _;
    }

    /*************** Constructor ***************/

    /**
     * @notice Deploy the collateral vault with USDC contract.
     * @param _usdc The address of the USDC token.
     */
    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "Arbitra: zero usdc address");
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

    /*************** Public Functions ***************/

    /**
     * @notice Stake USDC collateral for a given invoice fingerprint.
     * @dev Called by the supplier before invoice upload.
     * @param fingerprint The deterministic fingerprint of the invoice.
     * @param faceValueUSDC The face value of the invoice in USDC micro-units.
     */
    function stakeCollateral(uint256 fingerprint, uint256 faceValueUSDC) external {
        require(stakedCollateralByFingerprint[fingerprint] == 0, "Arbitra: already staked");
        require(stakeStates[fingerprint] == StakeState.UNSTAKED, "Arbitra: invalid state for staking");

        uint256 requiredCollateral = (faceValueUSDC * COLLATERAL_BPS) / 10000;
        require(requiredCollateral > 0, "Arbitra: collateral too small");

        supplierByFingerprint[fingerprint] = msg.sender;
        stakedCollateralByFingerprint[fingerprint] = requiredCollateral;
        stakeStates[fingerprint] = StakeState.STAKED_PENDING_REGISTRATION;

        usdc.safeTransferFrom(msg.sender, address(this), requiredCollateral);

        emit CollateralStaked(fingerprint, msg.sender, requiredCollateral);
    }

    /*************** Registry Functions ***************/

    /**
     * @notice Link a staked collateral from fingerprint to sequential invoice ID.
     * @dev Called by the registry contract during upload.
     * @param invoiceId The sequential ID of the registered invoice.
     * @param fingerprint The deterministic fingerprint of the invoice.
     */
    function linkStakeToInvoice(uint256 invoiceId, uint256 fingerprint) external onlyRegistry {
        require(stakedCollateralByFingerprint[fingerprint] > 0, "Arbitra: no stake found for fingerprint");
        require(supplierByFingerprint[fingerprint] != address(0), "Arbitra: zero supplier");
        require(stakedCollateral[invoiceId] == 0, "Arbitra: invoice ID already staked");
        require(stakeStates[fingerprint] == StakeState.STAKED_PENDING_REGISTRATION, "Arbitra: stake not pending");

        uint256 amount = stakedCollateralByFingerprint[fingerprint];
        address supplier = supplierByFingerprint[fingerprint];

        stakedCollateral[invoiceId] = amount;
        invoiceSupplier[invoiceId] = supplier;
        stakeStates[invoiceId] = StakeState.REGISTERED;

        stakedCollateralByFingerprint[fingerprint] = 0;
        supplierByFingerprint[fingerprint] = address(0);
        stakeStates[fingerprint] = StakeState.UNSTAKED;

        emit StakeLinked(invoiceId, fingerprint, amount);
    }

    /**
     * @notice Update the stake state of a registered invoice.
     * @dev Called by registry on status changes (like financing).
     * @param invoiceId The sequential ID of the invoice.
     * @param newState The new StakeState to transition to.
     */
    function updateStakeState(uint256 invoiceId, StakeState newState) external onlyRegistry {
        StakeState currentState = stakeStates[invoiceId];

        if (newState == StakeState.FINANCED) {
            require(currentState == StakeState.REGISTERED, "Arbitra: must be REGISTERED to finance");
        } else if (newState == StakeState.REPAID) {
            require(currentState == StakeState.FINANCED || currentState == StakeState.REGISTERED, "Arbitra: invalid state for repayment");
        }

        stakeStates[invoiceId] = newState;
    }

    /**
     * @notice Release staked collateral back to the supplier.
     * @dev Called by registry on invoice settlement.
     * @param invoiceId The ID of the invoice.
     */
    function releaseCollateral(uint256 invoiceId) external onlyRegistry {
        uint256 amount = stakedCollateral[invoiceId];
        address supplier = invoiceSupplier[invoiceId];

        require(amount > 0, "Arbitra: no staked collateral");
        require(!isSlashed[invoiceId], "Arbitra: collateral slashed");

        StakeState currentState = stakeStates[invoiceId];
        require(currentState == StakeState.REGISTERED || currentState == StakeState.FINANCED || currentState == StakeState.REPAID, "Arbitra: invalid state for release");

        stakedCollateral[invoiceId] = 0;
        stakeStates[invoiceId] = StakeState.STAKE_RELEASED;

        usdc.safeTransfer(supplier, amount);

        emit CollateralReleased(invoiceId, supplier, amount);
    }

    /**
     * @notice Slash supplier collateral and pay out to the investor.
     * @dev Called by registry on confirmed invoice fraud.
     * @param invoiceId The ID of the invoice.
     * @param investorToCompensate The investor address receiving the slashed funds.
     */
    function slashCollateral(uint256 invoiceId, address investorToCompensate) external onlyRegistry {
        uint256 amount = stakedCollateral[invoiceId];

        require(amount > 0, "Arbitra: no staked collateral");
        require(!isSlashed[invoiceId], "Arbitra: already slashed");

        StakeState currentState = stakeStates[invoiceId];
        require(currentState == StakeState.REGISTERED || currentState == StakeState.FINANCED, "Arbitra: invalid state for slashing");

        isSlashed[invoiceId] = true;
        stakedCollateral[invoiceId] = 0;
        stakeStates[invoiceId] = StakeState.SLASHED;

        usdc.safeTransfer(investorToCompensate, amount);

        emit CollateralSlashed(invoiceId, investorToCompensate, amount);
    }
}
