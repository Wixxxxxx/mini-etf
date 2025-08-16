// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {EtfPredictionMarketFactory} from "../src/EtfPredictionMarketFactory.s.sol";

contract DeployPredictionMarketFactory is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy the factory
        EtfPredictionMarketFactory factory = new EtfPredictionMarketFactory();

        console.log(
            "EtfPredictionMarketFactory deployed at:",
            address(factory)
        );
        console.log("Deployer:", deployer);

        vm.stopBroadcast();
    }
}
