// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IEnclaveVerifier
 * @notice Interface for the Flare Confidential Compute attestation verifier.
 * @dev The vault calls `verify` before releasing escrowed funds. In production
 *      this is backed by Flare's on-chain verifier that validates a real TEE
 *      attestation proving both agents agreed to identical terms privately.
 *      For testnet/demo, `MockEnclaveVerifier` implements this and returns true.
 *      Swapping mock → production is a single address change via setVerifier().
 */
interface IEnclaveVerifier {
    /**
     * @notice Verify that a settlement's terms were mutually agreed / attested.
     * @param settlementId The vault settlement being executed.
     * @param payer        Escrowing party.
     * @param payee        Receiving party.
     * @param asset        FAsset token address.
     * @param amount       Settlement amount.
     * @param proof        Attestation proof. For SignatureVerifier: a 65-byte
     *                     EIP-191 signature (r‖s‖v) over the attested terms.
     * @return ok          True only if the attestation is valid for these exact terms.
     */
    function verify(
        uint256 settlementId,
        address payer,
        address payee,
        address asset,
        uint256 amount,
        bytes calldata proof
    ) external view returns (bool ok);
}
