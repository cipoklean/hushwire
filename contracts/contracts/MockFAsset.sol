// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockFAsset
 * @notice Mock FXRP token for Coston2 demo. On mainnet, replace with
 *         the real FAsset ERC20 minted by the FAssetManager system.
 */
contract MockFAsset is ERC20 {
    uint8 private _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
        // Mint 1M tokens to deployer for demo
        _mint(msg.sender, 1_000_000 * 10 ** decimals_);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Allow anyone to mint for testing
    function faucet(uint256 amount) external {
        _mint(msg.sender, amount * 10 ** _decimals);
    }
}
