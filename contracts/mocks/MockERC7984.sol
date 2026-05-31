/* SPDX-License-Identifier: MIT */
pragma solidity ^0.8.27;

import { FHE, euint64, externalEuint64, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { IERC7984 } from "../interfaces/IERC7984.sol";
import { IERC7984Receiver } from "@openzeppelin/confidential-contracts/interfaces/IERC7984Receiver.sol";
import { IERC165 } from "@openzeppelin/contracts/interfaces/IERC165.sol";

/*
 * @file MockERC7984.sol
 * @description Test-only ERC-7984 mock implementation for local Hardhat environment.
 *              Implements operator approvals, transfers, and receiver callbacks.
 */
contract MockERC7984 is ZamaEthereumConfig {

    /*************** State ***************/

    /** @notice Token name */
    string public name = "Mock Confidential USDC";

    /** @notice Token symbol */
    string public symbol = "cUSDC";

    /** @notice Token decimals */
    uint8 public decimals = 6;

    /** @notice Encrypted balances per address */
    mapping(address => euint64) private _balances;

    /**
     * @notice ERC-7984 operator approvals: holder => operator => expiry.
     */
    mapping(address => mapping(address => uint48)) private _operators;

    /*************** Events ***************/

    /** @notice Emitted on operator set */
    event OperatorSet(address indexed holder, address indexed operator, uint48 until);

    /** @notice Emitted on confidential transfer */
    event ConfidentialTransfer(address indexed from, address indexed to, euint64 indexed amount);

    /*************** ERC-165 ***************/

    /**
     * @notice ERC-165 interface support.
     * @param interfaceId Interface ID being queried.
     * @return True if interface is supported.
     */
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC7984).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    /*************** Test Helpers ***************/

    /**
     * @notice Mint plaintext amount of encrypted tokens to an address.
     * @param to Recipient address.
     * @param amount Plaintext amount.
     */
    function mint(address to, uint64 amount) external {
        euint64 enc = FHE.asEuint64(amount);
        euint64 current = _balances[to];

        if (euint64.unwrap(current) == bytes32(0)) {
            _balances[to] = enc;
        } else {
            _balances[to] = FHE.add(current, enc);
        }

        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[to], to);
    }

    /*************** ERC-7984 Operators ***************/

    /**
     * @notice Set operator.
     * @param operator Spender address.
     * @param until Expiration timestamp.
     */
    function setOperator(address operator, uint48 until) external {
        _operators[msg.sender][operator] = until;
        emit OperatorSet(msg.sender, operator, until);
    }

    /**
     * @notice Check operator status.
     * @param holder Token holder address.
     * @param spender Spender address.
     * @return True if spender is an operator.
     */
    function isOperator(address holder, address spender) external view returns (bool) {
        return _operators[holder][spender] > uint48(block.timestamp);
    }

    /*************** Internal Transfers ***************/

    /**
     * @notice Internal helper to execute transfer.
     * @param from Source address.
     * @param to Destination address.
     * @param amount Encrypted amount handle.
     * @return The transferred handle.
     */
    function _transfer(
        address from,
        address to,
        euint64 amount
    ) internal returns (euint64) {
        euint64 fromBal = _balances[from];
        require(euint64.unwrap(fromBal) != bytes32(0), "MockERC7984: zero balance");

        euint64 newFromBal = FHE.sub(fromBal, amount);
        FHE.allowThis(newFromBal);
        FHE.allow(newFromBal, from);
        _balances[from] = newFromBal;

        euint64 toBal = _balances[to];
        if (euint64.unwrap(toBal) == bytes32(0)) {
            _balances[to] = amount;
        } else {
            euint64 newToBal = FHE.add(toBal, amount);
            FHE.allowThis(newToBal);
            FHE.allow(newToBal, to);
            _balances[to] = newToBal;
        }

        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[to], to);

        emit ConfidentialTransfer(from, to, amount);
        return amount;
    }

    /*************** ERC-7984 Transfers ***************/

    /**
     * @notice Transfer using an existing encrypted handle.
     * @param from Source address.
     * @param to Destination address.
     * @param amount Encrypted amount handle.
     * @return The transferred handle.
     */
    function confidentialTransferFrom(
        address from,
        address to,
        euint64 amount
    ) external returns (euint64) {
        require(
            from == msg.sender || _operators[from][msg.sender] > uint48(block.timestamp),
            "MockERC7984: not approved operator"
        );
        return _transfer(from, to, amount);
    }

    /**
     * @notice confidentialTransfer with external proof.
     * @param to Destination address.
     * @param encryptedAmount External encrypted amount.
     * @param inputProof Zero knowledge proof.
     * @return The transferred handle.
     */
    function confidentialTransfer(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (euint64) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        return _transfer(msg.sender, to, amount);
    }

    /**
     * @notice Transfer using handle directly.
     * @param to Destination address.
     * @param amount Encrypted amount handle.
     * @return The transferred handle.
     */
    function confidentialTransfer(address to, euint64 amount) external returns (euint64) {
        return _transfer(msg.sender, to, amount);
    }

    /**
     * @notice confidentialTransferFrom with external proof.
     * @param from Source address.
     * @param to Destination address.
     * @param encryptedAmount External encrypted amount.
     * @param inputProof Zero knowledge proof.
     * @return The transferred handle.
     */
    function confidentialTransferFrom(
        address from,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (euint64) {
        require(
            from == msg.sender || _operators[from][msg.sender] > uint48(block.timestamp),
            "MockERC7984: not operator"
        );
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        return _transfer(from, to, amount);
    }

    /*************** ERC-7984 Transfer & Call (Callbacks) ***************/

    /**
     * @notice confidentialTransferAndCall with data parameter, triggering callback.
     * @param to Destination address.
     * @param amount Encrypted amount handle.
     * @param data Additional data bytes.
     * @return The transferred handle.
     */
    function confidentialTransferAndCall(
        address to,
        euint64 amount,
        bytes calldata data
    ) external returns (euint64) {
        euint64 transferred = _transfer(msg.sender, to, amount);
        if (to.code.length > 0) {
            ebool success = IERC7984Receiver(to).onConfidentialTransferReceived(msg.sender, msg.sender, transferred, data);
            FHE.allowThis(success);
        }
        return transferred;
    }

    /**
     * @notice confidentialTransferFromAndCall with data parameter, triggering callback.
     * @param from Source address.
     * @param to Destination address.
     * @param amount Encrypted amount handle.
     * @param data Additional data bytes.
     * @return The transferred handle.
     */
    function confidentialTransferFromAndCall(
        address from,
        address to,
        euint64 amount,
        bytes calldata data
    ) external returns (euint64) {
        require(
            from == msg.sender || _operators[from][msg.sender] > uint48(block.timestamp),
            "MockERC7984: not operator"
        );
        euint64 transferred = _transfer(from, to, amount);
        if (to.code.length > 0) {
            ebool success = IERC7984Receiver(to).onConfidentialTransferReceived(msg.sender, from, transferred, data);
            FHE.allowThis(success);
        }
        return transferred;
    }

    /*************** ERC-7984 Reads ***************/

    /**
     * @notice Get encrypted balance handle.
     * @param account The account address.
     * @return The encrypted balance handle.
     */
    function confidentialBalanceOf(address account) external view returns (euint64) {
        return _balances[account];
    }

    /**
     * @notice Get total supply.
     * @return Zero handle.
     */
    function confidentialTotalSupply() external pure returns (euint64) {
        return euint64.wrap(bytes32(0));
    }

    /**
     * @notice Get contract URI.
     * @return Empty string.
     */
    function contractURI() external pure returns (string memory) {
        return "";
    }
}
