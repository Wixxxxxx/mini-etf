// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

// Minimal interface for EtfFeedAggregator to avoid compilation issues
interface IEtfFeedAggregator {
    function addFeedMapping(
        string memory symbol,
        address aggregator,
        uint48 maxDelay
    ) external;

    function owner() external view returns (address);
}

contract SetupFeedMappings is Script {
    function run() external {
        // Your deployed contract addresses
        address feedAggregator = 0x3BE15977b7653eC1EBa462bdB1ef30Bdc3267E74;

        // Chainlink price feed addresses for different networks
        // These are the actual Chainlink aggregator addresses
        address[3] memory aggregators;
        uint48[3] memory maxDelays;

        // Check which network we're on and set appropriate addresses
        uint256 chainId = block.chainid;

        if (chainId == 11155111) {
            // Sepolia
            aggregators[0] = 0x694AA1769357215DE4FAC081bf1f309aDC325306; // ETH/USD
            aggregators[1] = 0x1b44f3514812d835EB1bdB2aCe6093A1f3E060a9; // BTC/USD
            aggregators[2] = 0xC59E3633bAaC79493d08E8Bd3F9731Fd61b3c326; // LINK/USD
        } else if (chainId == 5) {
            // Goerli
            aggregators[0] = 0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e; // ETH/USD
            aggregators[1] = 0xa39434A63a52E749f02807Ae27335515Ba9B2f6F; // BTC/USD
            aggregators[2] = 0x779877A7B0D9E8603169DdbD7836e478b4624789; // LINK/USD
        } else if (chainId == 80001) {
            // Mumbai
            aggregators[0] = 0x0715A7794a1dc8e42615F059dD6e406A6594651A; // ETH/USD
            aggregators[1] = 0x007A22900A3b98143368Bd7874bC93C557e4E408; // BTC/USD
            aggregators[2] = 0x12162c3E810393DecEc62Aa165F3Df2c08fBf4e8; // LINK/USD
        } else {
            revert("Unsupported network");
        }

        // Set max delay to 1 hour (3600 seconds) for all feeds
        maxDelays[0] = 3600;
        maxDelays[1] = 3600;
        maxDelays[2] = 3600;

        // Symbols to map
        string[3] memory symbols = ["ETH/USD", "BTC/USD", "LINK/USD"];

        vm.startBroadcast();

        IEtfFeedAggregator aggregator = IEtfFeedAggregator(feedAggregator);

        // Add feed mappings
        for (uint256 i = 0; i < symbols.length; i++) {
            console.log(
                "Adding feed mapping for",
                symbols[i],
                "at",
                aggregators[i]
            );
            aggregator.addFeedMapping(symbols[i], aggregators[i], maxDelays[i]);
        }

        vm.stopBroadcast();

        console.log("Feed mappings setup complete!");
        console.log("Network:", chainId);
        console.log("Feeds mapped:", symbols.length);
    }
}
