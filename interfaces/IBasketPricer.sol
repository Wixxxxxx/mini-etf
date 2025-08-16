// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

interface IBasketPricer {
    function quoteAndBounds(string[] calldata symbols, int256[] calldata w1e18, uint16 bandBps)
        external view
        returns (int256 etfPrice, int256 lower, int256 upper);
        
    function calculateWeightedBasketPrice(
        string[] calldata symbols, int256[] calldata w1e18
    ) external view returns (int256 nav1e18, uint256 asOfMin, uint256 asOfMax);
}