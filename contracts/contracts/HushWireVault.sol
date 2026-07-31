// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IEnclaveVerifier.sol";

/**
 * @title HushWireVault
 * @notice Atomic settlement vault for HushWire agent negotiations.
 *         Holds escrowed FAssets and releases them only when the enclave
 *         verifier attests both parties agreed to identical terms.
 * @dev The vault never sees negotiation terms — only the settlement
 *      instruction (pay X of token T to address B), which is the
 *      minimum public information needed for on-chain finality.
 *
 *      Security model:
 *      - Execution is gated by IEnclaveVerifier.verify(), NOT by a trusted
 *        caller. Whoever can produce a valid attestation for the exact
 *        settlement terms can trigger release. On mainnet the verifier is
 *        Flare Confidential Compute's on-chain attestation contract.
 *      - The owner can only rotate the verifier / transfer ownership; the
 *        owner CANNOT execute or drain settlements.
 *      - SafeERC20 handles non-standard ERC20 return values.
 */
contract HushWireVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Settlement {
        address payer;
        address payee;
        address asset;       // FAsset token (e.g. FXRP)
        uint256 amount;
        uint64 deadline;     // escrow expiry
        bool executed;
        bool refunded;
        bytes enclaveProof; // attestation (e.g. 65-byte signature) for these exact terms
    }

    mapping(uint256 => Settlement) public settlements;
    uint256 public settlementCount;

    IEnclaveVerifier public verifier;
    address public owner;

    event SettlementCreated(
        uint256 indexed id,
        address payer,
        address payee,
        address asset,
        uint256 amount
    );
    event SettlementExecuted(uint256 indexed id, address payee, uint256 amount);
    event SettlementRefunded(uint256 indexed id, address payer, uint256 amount);
    event VerifierUpdated(address newVerifier);
    event OwnershipTransferred(address newOwner);

    error NotOwner();
    error NotPayer();
    error SettlementNotFound();
    error AlreadyExecuted();
    error AlreadyRefunded();
    error DeadlineNotPassed();
    error DeadlinePassed();
    error AttestationFailed();
    error ZeroAddress();
    error ZeroAmount();
    error ZeroDuration();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _verifier) {
        if (_verifier == address(0)) revert ZeroAddress();
        owner = msg.sender;
        verifier = IEnclaveVerifier(_verifier);
    }

    /// @notice Create a settlement — payer escrows FAssets
    function createSettlement(
        address _payee,
        address _asset,
        uint256 _amount,
        uint64 _duration
    ) external nonReentrant returns (uint256 id) {
        if (_payee == address(0) || _asset == address(0)) revert ZeroAddress();
        if (_amount == 0) revert ZeroAmount();
        if (_duration == 0) revert ZeroDuration();

        id = settlementCount++;
        settlements[id] = Settlement({
            payer: msg.sender,
            payee: _payee,
            asset: _asset,
            amount: _amount,
            deadline: uint64(block.timestamp) + _duration,
            executed: false,
            refunded: false,
            enclaveProof: ""
        });

        // Pull FAssets into escrow
        IERC20(_asset).safeTransferFrom(msg.sender, address(this), _amount);

        emit SettlementCreated(id, msg.sender, _payee, _asset, _amount);
    }

    /// @notice Execute settlement — gated by a valid enclave attestation.
    /// @dev Permissionless by design: the verifier is the trust root. Anyone
    ///      may submit the attestation; release happens only if verify() passes
    ///      for these exact terms.
    function executeSettlement(uint256 _id, bytes calldata _enclaveProof) external nonReentrant {
        Settlement storage s = settlements[_id];
        if (s.payer == address(0)) revert SettlementNotFound();
        if (s.executed) revert AlreadyExecuted();
        if (s.refunded) revert AlreadyRefunded();
        if (block.timestamp > s.deadline) revert DeadlinePassed();

        if (!verifier.verify(_id, s.payer, s.payee, s.asset, s.amount, _enclaveProof)) {
            revert AttestationFailed();
        }

        s.executed = true;
        s.enclaveProof = _enclaveProof;

        IERC20(s.asset).safeTransfer(s.payee, s.amount);

        emit SettlementExecuted(_id, s.payee, s.amount);
    }

    /// @notice Refund escrow if deadline passes without execution
    function refund(uint256 _id) external nonReentrant {
        Settlement storage s = settlements[_id];
        if (s.payer == address(0)) revert SettlementNotFound();
        if (msg.sender != s.payer) revert NotPayer();
        if (s.executed) revert AlreadyExecuted();
        if (s.refunded) revert AlreadyRefunded();
        if (block.timestamp <= s.deadline) revert DeadlineNotPassed();

        s.refunded = true;

        IERC20(s.asset).safeTransfer(s.payer, s.amount);

        emit SettlementRefunded(_id, s.payer, s.amount);
    }

    /// @notice Rotate the enclave verifier (e.g. mock → Flare production verifier)
    function setVerifier(address _newVerifier) external onlyOwner {
        if (_newVerifier == address(0)) revert ZeroAddress();
        verifier = IEnclaveVerifier(_newVerifier);
        emit VerifierUpdated(_newVerifier);
    }

    /// @notice Transfer contract ownership
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        owner = _newOwner;
        emit OwnershipTransferred(_newOwner);
    }
}
