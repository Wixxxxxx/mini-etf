// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

library Decs {
    function to1e18(int256 p, uint8 d) internal pure returns (int256) {
        if (d == 18) return p;
        return d < 18 ? p * int256(10 ** (18 - d)) : p / int256(10 ** (d - 18));
    }
}

interface IEtfFeedAggregator {
    function getPrices(string[] calldata symbols)
        external view
        returns (int256[] memory prices, uint8[] memory decimals, uint256[] memory updatedAts);
}

// add requirement for weights to be positive
// what to do with last updated timestamps?
contract BasketCreator {
    using Decs for int256;
    IEtfFeedAggregator public immutable agg;
    constructor(address _a) { agg = IEtfFeedAggregator(_a); }

    function calculateWeightedBasketPrice(string[] calldata symbols, int256[] calldata w1e18)
        external view
        returns (int256 etfPrice)
    {
        require(symbols.length == w1e18.length, "len mismatch");
        (int256[] memory p, uint8[] memory d, uint256[] memory _u) = agg.getPrices(symbols);

        for (uint256 i; i < p.length; ++i) {
            int256 pi = p[i].to1e18(d[i]);
            etfPrice += (pi * w1e18[i]) / 1e18;
        }

        
    }
}