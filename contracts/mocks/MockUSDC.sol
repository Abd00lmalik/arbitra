/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.27;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/*
 * @file MockUSDC.sol
 * @description Standard ERC-20 USDC token mock for local testing.
 */
contract MockUSDC is ERC20 {
    
    /*************** Constructor ***************/

    constructor() ERC20("Mock USDC", "USDC") {}

    /*************** Public Functions ***************/

    /**
     * @notice Mint tokens to a given address.
     * @param to The recipient address.
     * @param amount The amount to mint.
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Get decimals (6 for USDC compatibility).
     * @return Decimal precision.
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
