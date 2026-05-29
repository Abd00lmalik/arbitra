// SPDX-License-Identifier: MIT
/**
 * @file MockERC7984.sol
 * @description Minimal ERC-7984 shim for local Hardhat testing.
 *              Implements the subset of IERC7984 used by ArbitraInvoiceRegistry:
 *                - setOperator / isOperator  (time-bounded operator approval)
 *                - confidentialTransferFrom(from, to, euint64) (handle overload)
 *                - confidentialBalanceOf(address)
 *              Additionally provides a test-only plaintext mint for fast setup.
 *              Does NOT implement wrap/unwrap/finalizeUnwrap (not needed for tests).
 * @dev    Not for production use. No access control on mint.
 */
pragma solidity ^0.8.27;

import { FHE, euint64, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { IERC7984 } from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import { IERC165 } from "@openzeppelin/contracts/interfaces/IERC165.sol";

/**
 * @title  MockERC7984
 * @notice Test-only ERC-7984 shim for local Hardhat environment.
 *         Replaces MockCUSDC. Implements operator approval and encrypted transfers
 *         using the same interface as the real Zama cUSDT wrapper on Sepolia.
 * @custom:security-contact security@arbitra.finance
 */
contract MockERC7984 is ZamaEthereumConfig {

    /****** State ******/

    /** @notice Token name */
    string public name = "Mock Confidential USDT";

    /** @notice Token symbol */
    string public symbol = "cUSDT";

    /** @notice Token decimals (6 for USDT compatibility) */
    uint8 public decimals = 6;

    /** @notice Encrypted balances per address */
    mapping(address => euint64) private _balances;

    /**
     * @notice ERC-7984 operator approvals: holder => operator => expiry (Unix seconds).
     *         isOperator returns true iff expiry > block.timestamp.
     */
    mapping(address => mapping(address => uint48)) private _operators;

    /****** Events ******/

    /** @notice Emitted on operator set (ERC-7984) */
    event OperatorSet(address indexed holder, address indexed operator, uint48 until);

    /** @notice Emitted on any confidential transfer (no amount for privacy) */
    event ConfidentialTransfer(address indexed from, address indexed to, euint64 indexed amount);

    /****** ERC-165 ******/

    /**
     * @notice ERC-165 interface support.
     */
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC7984).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    /****** Test Helper ******/

    /**
     * @notice Mint plaintext amount of encrypted tokens to an address.
     *         Test-only. No access control.
     * @param to     Recipient
     * @param amount Plaintext amount in micro-units
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

    /****** ERC-7984 Operator Model ******/

    /**
     * @notice Set `operator` as an approved operator for `msg.sender` until `until`.
     *         Passes ERC-7984's time-bounded approval model.
     * @param operator  The address to approve as operator
     * @param until     Unix timestamp expiry (must be in the future)
     */
    function setOperator(address operator, uint48 until) external {
        _operators[msg.sender][operator] = until;
        emit OperatorSet(msg.sender, operator, until);
    }

    /**
     * @notice Returns true if `spender` is currently an operator for `holder`.
     * @param holder   The token holder
     * @param spender  The potential operator
     * @return         True if operator expiry > block.timestamp
     */
    function isOperator(address holder, address spender) external view returns (bool) {
        return _operators[holder][spender] > uint48(block.timestamp);
    }

    /****** ERC-7984 Transfer ******/

    /**
     * @notice Transfer using an existing encrypted handle — handle-only overload.
     *         msg.sender must be an approved operator for `from`.
     *         Caller must have ACL on the `amount` handle (granted via FHE.allowTransient).
     * @param from    Source address
     * @param to      Destination address
     * @param amount  Encrypted amount handle (caller must have ACL on this handle)
     * @return        The transferred amount handle
     */
    function confidentialTransferFrom(
        address from,
        address to,
        euint64 amount
    ) external returns (euint64) {
        require(
            _operators[from][msg.sender] > uint48(block.timestamp),
            "MockERC7984: not approved operator"
        );

        euint64 fromBal = _balances[from];
        require(euint64.unwrap(fromBal) != bytes32(0), "MockERC7984: zero balance handle");

        /* Subtract from sender */
        euint64 newFromBal = FHE.sub(fromBal, amount);
        FHE.allowThis(newFromBal);
        FHE.allow(newFromBal, from);
        _balances[from] = newFromBal;

        /* Add to receiver */
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

    /**
     * @notice confidentialTransfer with external proof (required by IERC7984, not used in registry).
     */
    function confidentialTransfer(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (euint64) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 fromBal = _balances[msg.sender];
        require(euint64.unwrap(fromBal) != bytes32(0), "MockERC7984: zero balance handle");

        euint64 newFromBal = FHE.sub(fromBal, amount);
        FHE.allowThis(newFromBal);
        FHE.allow(newFromBal, msg.sender);
        _balances[msg.sender] = newFromBal;

        euint64 toBal = _balances[to];
        euint64 newToBal = euint64.unwrap(toBal) == bytes32(0)
            ? amount
            : FHE.add(toBal, amount);
        FHE.allowThis(newToBal);
        FHE.allow(newToBal, to);
        _balances[to] = newToBal;

        emit ConfidentialTransfer(msg.sender, to, amount);
        return amount;
    }

    /** @notice Handle-only self-transfer (required by IERC7984) */
    function confidentialTransfer(address to, euint64 amount) external returns (euint64) {
        euint64 fromBal = _balances[msg.sender];
        euint64 newFromBal = FHE.sub(fromBal, amount);
        FHE.allowThis(newFromBal);
        _balances[msg.sender] = newFromBal;

        euint64 newToBal = FHE.add(_balances[to], amount);
        FHE.allowThis(newToBal);
        FHE.allow(newToBal, to);
        _balances[to] = newToBal;

        emit ConfidentialTransfer(msg.sender, to, amount);
        return amount;
    }

    /**
     * @notice confidentialTransferFrom with external proof (required by IERC7984).
     */
    function confidentialTransferFrom(
        address from,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (euint64) {
        require(_operators[from][msg.sender] > uint48(block.timestamp), "MockERC7984: not operator");
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        return this.confidentialTransferFrom(from, to, amount);
    }

    /****** ERC-7984 Read ******/

    /**
     * @notice Get encrypted balance handle.
     * @param account  The account
     * @return         Encrypted balance handle
     */
    function confidentialBalanceOf(address account) external view returns (euint64) {
        return _balances[account];
    }

    /** @notice Encrypted total supply (not tracked in mock, returns zero handle) */
    function confidentialTotalSupply() external pure returns (euint64) {
        return euint64.wrap(bytes32(0));
    }

    /** @notice contractURI (stub) */
    function contractURI() external pure returns (string memory) {
        return "";
    }
}
