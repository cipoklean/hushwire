// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title FAssetSettlement
 * @notice Helper contract that wraps Flare FAsset operations for HushWire.
 *         Handles minting FXRP (or other FAssets) and routing them into
 *         the HushWireVault for settlement.
 * @dev On Coston2, FAsset minting goes through the FAssetManager system contract.
 *      This contract provides a simplified interface for the hackathon demo.
 *      In production, integrate with the full FAssetManager + AgentBot system.
 */
contract FAssetSettlement {
    // FAssetManager system contract address (Coston2 / Mainnet)
    address public fassetManager;
    address public vault; // HushWireVault address
    address public owner;

    // Mock FAsset token for demo (on mainnet this is the real FXRP ERC20)
    address public fassetToken;

    event FAssetDeposited(address indexed agent, uint256 amount, uint256 settlementId);
    event CrossChainSettlement(uint256 indexed settlementId, string sourceChain, uint256 amount);

    error NotOwner();
    error InvalidAddress();

    constructor(address _fassetManager, address _vault, address _fassetToken) {
        owner = msg.sender;
        fassetManager = _fassetManager;
        vault = _vault;
        fassetToken = _fassetToken;
    }

    /**
     * @notice Deposit FAssets and create a settlement in the vault
     * @param _payee The counterparty agent address
     * @param _amount Amount of FAsset tokens to escrow
     * @param _duration Escrow duration in seconds
     * @param _sourceChain Label for the source chain (e.g. "XRP-Ledger", "Bitcoin")
     */
    function depositAndSettle(
        address _payee,
        uint256 _amount,
        uint64 _duration,
        string calldata _sourceChain
    ) external returns (uint256 settlementId) {
        // Pull FAssets from the agent
        bool success = IERC20(fassetToken).transferFrom(msg.sender, address(this), _amount);
        require(success, "FAsset transfer failed");

        // Approve vault to pull from this contract
        IERC20(fassetToken).approve(vault, _amount);

        // Create settlement in vault (vault pulls tokens)
        // In production: call HushWireVault.createSettlement via interface
        settlementId = _createVaultSettlement(_payee, _amount, _duration);

        emit FAssetDeposited(msg.sender, _amount, settlementId);
        emit CrossChainSettlement(settlementId, _sourceChain, _amount);
    }

    /// @dev Internal call to vault — in production use proper interface
    function _createVaultSettlement(
        address _payee,
        uint256 _amount,
        uint64 _duration
    ) internal returns (uint256) {
        // Simplified: in production, call IHushWireVault(vault).createSettlement(...)
        // For the demo, we track it via events
        return block.number; // placeholder settlement ID
    }

    /// @notice Update vault address
    function setVault(address _vault) external {
        require(msg.sender == owner, "Not owner");
        vault = _vault;
    }

    /// @notice Update FAsset token address
    function setFAssetToken(address _token) external {
        require(msg.sender == owner, "Not owner");
        fassetToken = _token;
    }
}
