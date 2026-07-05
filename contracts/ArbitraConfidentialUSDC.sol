/**
 * @file ArbitraConfidentialUSDC.sol
 * @description Confidential ERC-7984 wrapper over standard USDC.
 *              Investors shield USDC into cUSDC, which is then transferred
 *              confidentially to suppliers via the Arbitra registry.
 *              Settlement arithmetic runs homomorphically inside ArbitraEscrowReceiver.
 */
/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.27;

import { ZamaEthereumConfig }    from "@fhevm/solidity/config/ZamaConfig.sol";
import { ERC7984ERC20Wrapper }   from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";
import { ERC7984 }               from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import { IERC20 }                from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ArbitraConfidentialUSDC
 * @notice Confidential ERC-7984 token that wraps standard USDC.
 * @dev Inherits all shield (wrap), unshield (unwrap / finalizeUnwrap),
 *      and confidential-transfer logic from ERC7984ERC20Wrapper.
 *      ZamaEthereumConfig wires the contract to the Zama coprocessor endpoints
 *      on the current network.
 *
 * Payment flow:
 *   1. Investor calls usdc.approve(address(this), amount) then wrap(investor, amount).
 *   2. Investor calls setOperator(registry, until) to let the registry pull cUSDC.
 *   3. ArbitraInvoiceRegistry calls confidentialTransferFrom on factoring.
 *   4. ArbitraEscrowReceiver calls confidentialTransfer to split payout at maturity.
 *
 * @custom:security-contact security@arbitra.example
 */
contract ArbitraConfidentialUSDC is ZamaEthereumConfig, ERC7984ERC20Wrapper {

    /*************** Constructor ***************/

    /**
     * @notice Deploy the confidential USDC wrapper.
     * @param underlying_ The address of the standard ERC-20 USDC token.
     */
    constructor(IERC20 underlying_)
        ERC7984("Confidential USDC", "cUSDC", "")
        ERC7984ERC20Wrapper(underlying_)
    {}
}
