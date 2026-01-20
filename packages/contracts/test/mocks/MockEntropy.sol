// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IEntropyV2} from "../../src/pyth/IEntropyV2.sol";

/**
 * @title MockEntropy
 * @notice Mock Pyth Entropy contract for testing
 */
contract MockEntropy is IEntropyV2 {
    uint64 public sequenceCounter;
    uint256 public fee = 0.001 ether; // Mock fee

    // Store the consumer address for each sequence number
    mapping(uint64 => address) public consumers;

    event RandomnessRequested(uint64 sequenceNumber, address consumer);

    function getFeeV2() external view override returns (uint256) {
        return fee;
    }

    function requestV2() external payable override returns (uint64 sequenceNumber) {
        require(msg.value >= fee, "Insufficient fee");
        sequenceNumber = sequenceCounter++;
        consumers[sequenceNumber] = msg.sender;
        emit RandomnessRequested(sequenceNumber, msg.sender);
    }

    function getDefaultProvider() external pure override returns (address) {
        return address(0x52DeaA1c84233F7bb8C8A45baeDE41091c616506);
    }

    /**
     * @notice Simulate fulfilling randomness (for testing)
     * @param sequenceNumber The sequence number to fulfill
     * @param randomNumber The random bytes32 value
     */
    function fulfillRandomness(uint64 sequenceNumber, bytes32 randomNumber) external {
        address consumer = consumers[sequenceNumber];
        require(consumer != address(0), "Invalid sequence");

        // Call the consumer's callback
        (bool success, ) = consumer.call(
            abi.encodeWithSignature(
                "_entropyCallback(uint64,address,bytes32)",
                sequenceNumber,
                address(0x52DeaA1c84233F7bb8C8A45baeDE41091c616506), // default provider
                randomNumber
            )
        );
        require(success, "Callback failed");
    }

    /**
     * @notice Set the fee for testing
     */
    function setFee(uint256 _fee) external {
        fee = _fee;
    }

    // Allow receiving ETH
    receive() external payable {}
}
