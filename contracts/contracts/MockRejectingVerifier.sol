// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IEnclaveVerifier.sol";

/**
 * @title MockRejectingVerifier
 * @notice TEST HELPER ONLY. Always rejects attestation. Used in tests to
 *         assert HushWireVault blocks execution when verification fails.
 */
contract MockRejectingVerifier is IEnclaveVerifier {
    bool public constant IS_MOCK = true;

    function verify(
        uint256,
        address,
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bool) {
        return false;
    }
}
