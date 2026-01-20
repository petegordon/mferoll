// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title IEntropyConsumer
 * @notice Abstract contract for consuming Pyth Entropy randomness
 * @dev Inherit this contract and implement entropyCallback to receive random numbers
 *      See https://docs.pyth.network/entropy for full documentation
 */
abstract contract IEntropyConsumer {
    /**
     * @notice Callback function called by Pyth Entropy when randomness is ready
     * @dev This function MUST NOT revert, or the keeper cannot invoke it
     * @param sequenceNumber The sequence number from the original request
     * @param provider The entropy provider address
     * @param randomNumber The random bytes32 value
     */
    function entropyCallback(
        uint64 sequenceNumber,
        address provider,
        bytes32 randomNumber
    ) internal virtual;

    /**
     * @notice Returns the address of the Entropy contract
     * @dev Must be implemented by inheriting contracts
     * @return The Entropy contract address
     */
    function getEntropy() internal view virtual returns (address);

    /**
     * @notice External function that Pyth Entropy calls to deliver randomness
     * @dev Only callable by the Entropy contract returned by getEntropy()
     */
    function _entropyCallback(
        uint64 sequenceNumber,
        address provider,
        bytes32 randomNumber
    ) external {
        require(msg.sender == getEntropy(), "Only Entropy can call");
        entropyCallback(sequenceNumber, provider, randomNumber);
    }
}
