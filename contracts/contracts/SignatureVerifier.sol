// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IEnclaveVerifier.sol";

/**
 * @title SignatureVerifier
 * @notice Real on-chain verification: checks an ECDSA signature over the exact
 *         settlement terms against a designated attestation `authority`.
 *
 *         Pattern from Flare's `fce-shielded-transfers` ShieldedVault.sol:
 *         domain-separated EIP-191 personal_sign over abi.encodePacked, then ecrecover.
 *
 *         The attested payload binds vault + chain + terms so a signature cannot be
 *         replayed across vaults, networks, or other settlements:
 *           digest = keccak256("\x19Ethereum Signed Message:\n32",
 *                              keccak256(abi.encodePacked(vault, chainId, settlementId,
 *                                                         payer, payee, asset, amount)))
 *
 *         Today `authority` is the HushWire operator signing key, which performs the
 *         confidential term-matching off-chain (the "enclave" role). When Flare
 *         Confidential Compute reaches production, a new IEnclaveVerifier that checks
 *         the identical payload against the FCE's registered TEE identity is swapped in
 *         via HushWireVault.setVerifier() — the vault and this interface do not change.
 */
contract SignatureVerifier is IEnclaveVerifier {
    /// @notice The address expected to have signed valid attestations (the "teeAuthority" role).
    address public immutable authority;

    error ZeroAddress();

    constructor(address _authority) {
        if (_authority == address(0)) revert ZeroAddress();
        authority = _authority;
    }

    /// @notice The terms hash for a settlement as seen by the vault (msg.sender == vault).
    /// @dev Used off-chain by the authority to know exactly what to sign.
    function payload(
        address vault,
        uint256 chainId,
        uint256 settlementId,
        address payer,
        address payee,
        address asset,
        uint256 amount
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(vault, chainId, settlementId, payer, payee, asset, amount)
        );
    }

    /// @inheritdoc IEnclaveVerifier
    function verify(
        uint256 settlementId,
        address payer,
        address payee,
        address asset,
        uint256 amount,
        bytes calldata proof
    ) external view override returns (bool ok) {
        if (proof.length != 65) return false;

        bytes32 terms = payload(
            msg.sender, // the calling vault — binds the signature to this vault
            block.chainid,
            settlementId,
            payer,
            payee,
            asset,
            amount
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", terms));

        bytes32 r;
        bytes32 s;
        uint8 v;
        // proof = r(32) | s(32) | v(1)
        assembly {
            r := calldataload(proof.offset)
            s := calldataload(add(proof.offset, 32))
            v := byte(0, calldataload(add(proof.offset, 64)))
        }

        // Plausibility guards (cheap; mirrors OpenZeppelin ECDSA: reject bad v and malleable s)
        if (v != 27 && v != 28) return false;
        if (uint256(s) >
            0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) return false;

        address recovered = ecrecover(digest, v, r, s);
        return recovered != address(0) && recovered == authority;
    }
}
