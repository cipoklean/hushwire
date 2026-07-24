// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IEnclaveVerifier.sol";

/**
 * @title MockEnclaveVerifier
 * @notice TESTNET/DEMO ONLY. Attests every settlement unconditionally.
 * @dev DO NOT deploy to mainnet. On mainnet, point HushWireVault.setVerifier()
 *      at Flare Confidential Compute's real on-chain attestation verifier, which
 *      validates a TEE proof that both agents agreed to the same terms privately.
 *      This mock exists so the full settlement flow is exercisable on Coston2.
 */
contract MockEnclaveVerifier is IEnclaveVerifier {
    /// @notice Flag so integrators/tests can assert they are NOT on the real verifier.
    bool public constant IS_MOCK = true;

    /// @inheritdoc IEnclaveVerifier
    function verify(
        uint256,
        address,
        address,
        address,
        uint256,
        bytes32
    ) external pure override returns (bool) {
        return true;
    }
}
