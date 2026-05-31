/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.27;

import { euint64, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";
import { IERC165 } from "@openzeppelin/contracts/interfaces/IERC165.sol";

/*
 * @file IERC7984.sol
 * @description Draft interface for a confidential fungible token standard utilizing the Zama FHE library.
 */
interface IERC7984 is IERC165 {
    /**
     * @dev Emitted when the expiration timestamp for an operator is updated for a given holder.
     */
    event OperatorSet(address indexed holder, address indexed operator, uint48 until);

    /**
     * @dev Emitted when a confidential transfer is made from one address to another.
     */
    event ConfidentialTransfer(address indexed from, address indexed to, euint64 indexed amount);

    /**
     * @dev Emitted when an encrypted amount is disclosed.
     */
    event AmountDisclosed(euint64 indexed encryptedAmount, uint64 amount);

    /**
     * @notice Get the name of the token.
     * @return The token name string.
     */
    function name() external view returns (string memory);

    /**
     * @notice Get the symbol of the token.
     * @return The token symbol string.
     */
    function symbol() external view returns (string memory);

    /**
     * @notice Get the number of decimals of the token.
     * @return The number of decimals.
     */
    function decimals() external view returns (uint8);

    /**
     * @notice Get the contract URI.
     * @return The contract URI string.
     */
    function contractURI() external view returns (string memory);

    /**
     * @notice Get the confidential total supply.
     * @return The encrypted total supply handle.
     */
    function confidentialTotalSupply() external view returns (euint64);

    /**
     * @notice Get the confidential balance of an account.
     * @param account The address of the account to query.
     * @return The encrypted balance handle.
     */
    function confidentialBalanceOf(address account) external view returns (euint64);

    /**
     * @notice Check if a spender is an operator for a holder.
     * @param holder The token holder address.
     * @param spender The operator address.
     * @return True if the spender is currently an operator.
     */
    function isOperator(address holder, address spender) external view returns (bool);

    /**
     * @notice Approve an operator for the caller until a specific timestamp.
     * @param operator The operator address.
     * @param until The expiration timestamp.
     */
    function setOperator(address operator, uint48 until) external;

    /**
     * @notice Transfer encrypted tokens using an external input proof.
     * @param to The recipient address.
     * @param encryptedAmount The encrypted amount handle.
     * @param inputProof The cryptographic proof of encryption validity.
     * @return The actual transferred encrypted amount handle.
     */
    function confidentialTransfer(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (euint64);

    /**
     * @notice Transfer encrypted tokens using a handle-only input.
     * @param to The recipient address.
     * @param amount The encrypted amount handle.
     * @return transferred The actual transferred encrypted amount handle.
     */
    function confidentialTransfer(address to, euint64 amount) external returns (euint64 transferred);

    /**
     * @notice Transfer encrypted tokens from a sender to a recipient.
     * @param from The sender address.
     * @param to The recipient address.
     * @param encryptedAmount The encrypted amount handle.
     * @param inputProof The cryptographic proof of encryption validity.
     * @return The actual transferred encrypted amount handle.
     */
    function confidentialTransferFrom(
        address from,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (euint64);

    /**
     * @notice Transfer encrypted tokens from a sender to a recipient using a handle-only input.
     * @param from The sender address.
     * @param to The recipient address.
     * @param amount The encrypted amount handle.
     * @return transferred The actual transferred encrypted amount handle.
     */
    function confidentialTransferFrom(address from, address to, euint64 amount) external returns (euint64 transferred);

    /**
     * @notice Transfer encrypted tokens with an external proof and callback.
     * @param to The recipient address.
     * @param encryptedAmount The encrypted amount handle.
     * @param inputProof The cryptographic proof of encryption validity.
     * @param data Additional data to forward to the callback.
     * @return transferred The actual transferred encrypted amount handle.
     */
    function confidentialTransferAndCall(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        bytes calldata data
    ) external returns (euint64 transferred);

    /**
     * @notice Transfer encrypted tokens with a handle-only input and callback.
     * @param to The recipient address.
     * @param amount The encrypted amount handle.
     * @param data Additional data to forward to the callback.
     * @return transferred The actual transferred encrypted amount handle.
     */
    function confidentialTransferAndCall(
        address to,
        euint64 amount,
        bytes calldata data
    ) external returns (euint64 transferred);

    /**
     * @notice Transfer encrypted tokens from a sender with an external proof and callback.
     * @param from The sender address.
     * @param to The recipient address.
     * @param encryptedAmount The encrypted amount handle.
     * @param inputProof The cryptographic proof of encryption validity.
     * @param data Additional data to forward to the callback.
     * @return transferred The actual transferred encrypted amount handle.
     */
    function confidentialTransferFromAndCall(
        address from,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        bytes calldata data
    ) external returns (euint64 transferred);

    /**
     * @notice Transfer encrypted tokens from a sender with a handle-only input and callback.
     * @param from The sender address.
     * @param to The recipient address.
     * @param amount The encrypted amount handle.
     * @param data Additional data to forward to the callback.
     * @return transferred The actual transferred encrypted amount handle.
     */
    function confidentialTransferFromAndCall(
        address from,
        address to,
        euint64 amount,
        bytes calldata data
    ) external returns (euint64 transferred);
}
