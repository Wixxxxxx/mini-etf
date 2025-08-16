// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract EtfFeedAggregator {
    struct Feed {
        AggregatorV3Interface agg;
        uint48 maxDelay;  // seconds; staleness guard per feed
        bool exists;
    }

    address public owner;
    mapping(bytes32 => Feed) public feeds;  // symbol -> feed config

    event FeedInserted(string indexed symbol, address indexed aggregator, uint48 maxDelay);
    error UnknownFeed(string symbol);
    error StalePrice(string symbol, uint256 updatedAt, uint256 nowTs, uint256 maxDelay);

    modifier isOwner() {
        require(msg.sender == owner, "Caller is not owner");
        _;
    }

    constructor() { owner = msg.sender; }

    function addFeedMapping(string memory symbol, address aggregator, uint48 maxDelay) external isOwner {
        feeds[_toBytes32(symbol)] = Feed({
            agg: AggregatorV3Interface(aggregator),
            maxDelay: maxDelay,
            exists: true
        });
        emit FeedInserted(symbol, aggregator, maxDelay);
    }

    function _getPrice(string memory symbol)
        internal
        view
        returns (int256 answer, uint8 decimals, uint256 updatedAt)
    {
        Feed memory f = feeds[_toBytes32(symbol)];
        if (!f.exists) revert UnknownFeed(symbol);

        (, answer, , updatedAt, ) = f.agg.latestRoundData();
        decimals = f.agg.decimals();

        if (block.timestamp - updatedAt > f.maxDelay) {
            revert StalePrice(symbol, updatedAt, block.timestamp, f.maxDelay);
        }
    }

    function getPrices(string[] calldata symbols)
    external
    view
    returns (
        int256[] memory prices,
        uint8[] memory decimals,
        uint256[] memory updatedAts
    )
        {
            uint256 n = symbols.length;

            prices = new int256[](n);
            decimals = new uint8[](n);
            updatedAts = new uint256[](n);

            for (uint256 i = 0; i < n; ) {
                (int256 p, uint8 d, uint256 u) = _getPrice(symbols[i]);
                prices[i] = p;
                decimals[i] = d;
                updatedAts[i] = u;
                unchecked { ++i; }
            }
        }

        function _toBytes32(string memory s) internal pure returns (bytes32) {
            return keccak256(bytes(s));
        }


}
