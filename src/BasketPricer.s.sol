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
contract BasketPricer {
    using Decs for int256;
    IEtfFeedAggregator public immutable agg;
    constructor(address _a) { agg = IEtfFeedAggregator(_a); }

    function calculateWeightedBasketPrice(string[] calldata symbols, int256[] calldata w1e18)
        public view
        returns (int256 etfPrice)
    {
        require(symbols.length == w1e18.length, "len mismatch");
        (int256[] memory p, uint8[] memory d, ) = agg.getPrices(symbols);
 
        for (uint256 i; i < p.length; ++i) {
            require(w1e18[i] >= 0, "weight<0");
            int256 pi = p[i].to1e18(d[i]);
            etfPrice += (pi * w1e18[i]) / 1e18;
        }


    }

    function boundsForBand(int256 etfPrice, uint16 bandBps)
        public pure
        returns (int256 lower1e18, int256 upper1e18)
    {
        require(etfPrice > 0, "nav<=0");
        require(bandBps <= 10_000, "band>100%");
        int256 b = int256(uint256(bandBps));
        lower1e18 = (etfPrice * (10_000 - b)) / 10_000;
        upper1e18 = (etfPrice * (10_000 + b)) / 10_000;
    }

    function quoteAndBounds(
        string[] calldata symbols,
        int256[] calldata w1e18,
        uint16 bandBps
    )
        external view
        returns (
            int256 etfPrice,
            int256 lower,
            int256 upper
        )
    {
        etfPrice  = calculateWeightedBasketPrice(symbols, w1e18);
        (lower, upper) = boundsForBand(etfPrice, bandBps);
    }
}