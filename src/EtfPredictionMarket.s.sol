// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

interface IBasketCreator {
    function calculateWeightedBasketPrice(
        string[] calldata symbols,
        int256[] calldata w1e18
    ) external view returns (int256 etfPrice);
}

contract EtfPredictionMarket {
    IBasketCreator public immutable basketPricer;
    event MarketCreated(address indexed market, address indexed creator);

    constructor(address _a) { basketPricer = IBasketCreator(_a); }

}