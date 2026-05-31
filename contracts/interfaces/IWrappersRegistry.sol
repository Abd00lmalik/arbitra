/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.27;

/*
 * @file IWrappersRegistry.sol
 * @description Interface for Zama's Wrappers Registry, facilitating the resolution of confidential tokens.
 */
interface IWrappersRegistry {
    /**
     * @notice Get the confidential wrapper address for an underlying token.
     * @param underlying The address of the underlying public ERC-20 token.
     * @return The address of the confidential wrapped token.
     */
    function getWrapper(address underlying) external view returns (address);

    /**
     * @notice Query the confidential token address from the registry.
     * @param token The address of the underlying token.
     * @return found True if the token has a registered wrapper, and the wrapper address.
     */
    function getConfidentialTokenAddress(address token) external view returns (bool found, address confidentialToken);
}
