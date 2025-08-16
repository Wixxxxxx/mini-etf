// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {EtfPredictionMarketFactory} from "../src/EtfPredictionMarketFactory.s.sol";
import {ClaimTokens} from "../src/ClaimTokens.s.sol";
import {Minter} from "../src/Minter.sol";

contract DeployAllContracts is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy ClaimTokens (ERC-1155 for market outcomes)
        ClaimTokens claimTokens = new ClaimTokens();
        console.log("ClaimTokens deployed at:", address(claimTokens));

        // Deploy Minter (for minting outcome tokens)
        Minter minter = new Minter(address(claimTokens));
        console.log("Minter deployed at:", address(minter));

        // Deploy the factory
        EtfPredictionMarketFactory factory = new EtfPredictionMarketFactory();
        console.log(
            "EtfPredictionMarketFactory deployed at:",
            address(factory)
        );

        console.log("=== DEPLOYMENT SUMMARY ===");
        console.log("Deployer:", deployer);
        console.log("ClaimTokens:", address(claimTokens));
        console.log("Minter:", address(minter));
        console.log("EtfPredictionMarketFactory:", address(factory));
        console.log("=== END DEPLOYMENT SUMMARY ===");

        vm.stopBroadcast();
    }
}
