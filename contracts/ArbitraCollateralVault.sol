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

    /*************** Storage ***************/

    /** @notice Address of the USDC ERC-20 contract */
    IERC20 public immutable usdc;

    /** @notice Address of the main Arbitra Registry contract */
    address public arbitraRegistry;

    /** @notice Staked collateral per invoice ID (in USDC plaintext micro-units) */
    mapping(uint256 => uint256) public stakedCollateral;

    /** @notice Supplier associated with each invoice ID */
    mapping(uint256 => address) public invoiceSupplier;

    /** @notice Indicates if the collateral for a given invoice has been slashed */
    mapping(uint256 => bool) public isSlashed;

    /*************** Events ***************/

    /** @notice Emitted when collateral is staked for an invoice */
    event CollateralStaked(uint256 indexed invoiceId, address indexed supplier, uint256 amount);

    /** @notice Emitted when collateral is released back to the supplier */
    event CollateralReleased(uint256 indexed invoiceId, address indexed supplier, uint256 amount);

    /** @notice Emitted when collateral is slashed and redirected to the investor */
    event CollateralSlashed(uint256 indexed invoiceId, address indexed investor, uint256 amount);

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
     * @notice Stake USDC collateral for a given invoice.
     * @dev Called by the supplier before invoice upload.
     * @param invoiceId The ID of the invoice being collateralized.
     * @param faceValueUSDC The face value of the invoice in USDC micro-units.
     */
    function stakeCollateral(uint256 invoiceId, uint256 faceValueUSDC) external {
        require(stakedCollateral[invoiceId] == 0, "Arbitra: already staked");

        uint256 requiredCollateral = (faceValueUSDC * COLLATERAL_BPS) / 10000;
        require(requiredCollateral > 0, "Arbitra: collateral too small");

        invoiceSupplier[invoiceId] = msg.sender;
        stakedCollateral[invoiceId] = requiredCollateral;

        usdc.safeTransferFrom(msg.sender, address(this), requiredCollateral);

        emit CollateralStaked(invoiceId, msg.sender, requiredCollateral);
    }

    /*************** Registry Functions ***************/

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

        stakedCollateral[invoiceId] = 0;
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

        isSlashed[invoiceId] = true;
        stakedCollateral[invoiceId] = 0;

        usdc.safeTransfer(investorToCompensate, amount);

        emit CollateralSlashed(invoiceId, investorToCompensate, amount);
    }
}
