// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title IEntropyV2
 * @notice Interface for Pyth Entropy V2 random number generation
 * @dev See https://docs.pyth.network/entropy for full documentation
 */
interface IEntropyV2 {
    /**
     * @notice Get the fee required to request randomness
     * @return fee The fee in wei to be sent with requestV2
     */
    function getFeeV2() external view returns (uint256 fee);

    /**
     * @notice Request a random number from Pyth Entropy
     * @dev Must send the fee returned by getFeeV2() as msg.value
     * @return sequenceNumber A unique identifier for this request
     */
    function requestV2() external payable returns (uint64 sequenceNumber);

    /**
     * @notice Get the default entropy provider address
     * @return provider The default provider address
     */
    function getDefaultProvider() external view returns (address provider);
}
