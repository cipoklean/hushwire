// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockFAsset
 * @notice ⚠️ TESTNET / DEMO ONLY — DO NOT DEPLOY TO MAINNET ⚠️
 *         Mock FXRP token for Coston2. The public `faucet()` mints unlimited
 *         tokens and has NO monetary value. On mainnet, replace this entirely
 *         with the real FAsset ERC20 minted by Flare's FAssetManager system.
 */
contract MockFAsset is ERC20 {
    /// @notice Explicit flag so tooling/tests can assert this is not a real asset.
    bool public constant IS_TEST_TOKEN = true;

    uint8 private immutable _dec;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _dec = decimals_;
        // Mint 1M tokens to deployer for demo
        _mint(msg.sender, 1_000_000 * 10 ** decimals_);
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    /// @notice Permissionless mint for testnet demos. NEVER ship to mainnet.
    function faucet(uint256 amount) external {
        _mint(msg.sender, amount * 10 ** _dec);
    }
}
