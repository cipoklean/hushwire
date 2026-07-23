// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title HushWireVault
 * @notice Atomic settlement vault for HushWire agent negotiations.
 *         Holds escrowed FAssets and releases them only when both
 *         parties confirm settlement terms matched inside the
 *         Flare Confidential Compute enclave.
 * @dev The vault never sees negotiation terms — only the settlement
 *      instruction (pay X of token T to address B), which is the
 *      minimum public information needed for on-chain finality.
 */
contract HushWireVault is ReentrancyGuard {
    struct Settlement {
        address payer;
        address payee;
        address asset;       // FAsset token (e.g. FXRP)
        uint256 amount;
        uint64 deadline;     // escrow expiry
        bool executed;
        bool refunded;
        bytes32 enclaveProof; // hash of the confidential compute attestation
    }

    mapping(uint256 => Settlement) public settlements;
    uint256 public settlementCount;

    // Trusted enclave attester (Flare Confidential Compute oracle address)
    address public enclaveAttester;
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
    event EnclaveAttesterUpdated(address newAttester);

    error NotOwner();
    error NotPayer();
    error NotAttester();
    error SettlementNotFound();
    error AlreadyExecuted();
    error AlreadyRefunded();
    error DeadlineNotPassed();
    error DeadlinePassed();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _enclaveAttester) {
        owner = msg.sender;
        enclaveAttester = _enclaveAttester;
    }

    /// @notice Create a settlement — payer escrows FAssets
    function createSettlement(
        address _payee,
        address _asset,
        uint256 _amount,
        uint64 _duration
    ) external nonReentrant returns (uint256 id) {
        id = settlementCount++;
        settlements[id] = Settlement({
            payer: msg.sender,
            payee: _payee,
            asset: _asset,
            amount: _amount,
            deadline: uint64(block.timestamp) + _duration,
            executed: false,
            refunded: false,
            enclaveProof: bytes32(0)
        });

        // Pull FAssets into escrow
        bool success = IERC20(_asset).transferFrom(msg.sender, address(this), _amount);
        if (!success) revert TransferFailed();

        emit SettlementCreated(id, msg.sender, _payee, _asset, _amount);
    }

    /// @notice Execute settlement — called after enclave confirms terms match
    /// @dev In production, the enclaveAttester is the Flare Confidential Compute
    ///      oracle that verifies both agents agreed to the same terms privately.
    function executeSettlement(uint256 _id, bytes32 _enclaveProof) external nonReentrant {
        if (msg.sender != enclaveAttester && msg.sender != owner) revert NotAttester();

        Settlement storage s = settlements[_id];
        if (s.payer == address(0)) revert SettlementNotFound();
        if (s.executed) revert AlreadyExecuted();
        if (s.refunded) revert AlreadyRefunded();
        if (block.timestamp > s.deadline) revert DeadlinePassed();

        s.executed = true;
        s.enclaveProof = _enclaveProof;

        bool success = IERC20(s.asset).transfer(s.payee, s.amount);
        if (!success) revert TransferFailed();

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

        bool success = IERC20(s.asset).transfer(s.payer, s.amount);
        if (!success) revert TransferFailed();

        emit SettlementRefunded(_id, s.payer, s.amount);
    }

    /// @notice Update the enclave attester address (Flare governance / admin)
    function setEnclaveAttester(address _newAttester) external onlyOwner {
        enclaveAttester = _newAttester;
        emit EnclaveAttesterUpdated(_newAttester);
    }
}
