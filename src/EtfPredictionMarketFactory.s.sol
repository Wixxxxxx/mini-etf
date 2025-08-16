// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {EtfPredictionMarket}   from "./EtfPredictionMarket.s.sol";
import {IBasketPricer}        from "../interfaces/IBasketPricer.sol";
import {ClaimTokens}          from "./ClaimTokens.s.sol";
import {PredictionMarketVault} from "./PredictionMarketVault.s.sol";

// Deterministic ERC-1155 IDs from (market address, outcomeCode)
library ClaimIds {
    // outcome: 1 = WITHIN, 2 = OUTSIDE
    function id(address market, uint8 outcomeCode) internal pure returns (uint256) {
        return (uint256(uint160(market)) << 8) | outcomeCode;
    }
}

contract EtfPredictionMarketFactory {
    using ClaimIds for address;

    IBasketPricer public immutable pricer;      // pricing helper
    ClaimTokens   public immutable claims;      // global ERC-1155
    address       public immutable collateral;  // ERC-20 (e.g., USDC) used by vaults

    mapping(address => address[]) public marketsByCreator;
    address[] public allMarkets;

    event MarketCreated(
        address indexed market,
        address indexed creator,
        address vault,
        uint256 withinId,
        uint256 outsideId,
        int256 strike1e18,
        int256 lower1e18,
        int256 upper1e18,
        uint16 bandBps,
        uint64 settleTs
    );

    constructor(address _pricer, address _claims, address _collateral) {
        require(_pricer != address(0) && _claims != address(0) && _collateral != address(0), "zero addr");
        pricer     = IBasketPricer(_pricer);
        claims     = ClaimTokens(_claims);
        collateral = _collateral;
    }

    /// Create a prediction market + its dedicated vault, and authorize mint/burn.
    /// @return mkt   Address of the deployed market
    /// @return vault Address of the deployed per-market vault
    function create(
        string[] calldata symbols,
        int256[] calldata w1e18,
        uint16 bandBps,
        uint64 settleTs
    ) external returns (address mkt, address vault) {
        require(bandBps > 0 && bandBps <= 10_000, "bad band");
        require(settleTs > block.timestamp, "settle in past");
        require(symbols.length == w1e18.length, "len mismatch");

        // 1) On-chain quote + bounds (locks what the UI previewed)
        (int256 strike, int256 lower, int256 upper) = pricer.quoteAndBounds(symbols, w1e18, bandBps);
        require(strike > 0, "bad strike");
        require(lower < strike && strike < upper, "bad bounds");

        // 2) Deploy a dedicated vault for this market; factory is initial owner
        PredictionMarketVault vaultContract = new PredictionMarketVault(collateral, address(this));
        vault = address(vaultContract);

        // 3) Deploy the market with references + locked params
        EtfPredictionMarket market = new EtfPredictionMarket(
            pricer,
            claims,
            vaultContract,
            symbols,
            w1e18,
            strike,
            lower,
            upper,
            bandBps,
            settleTs
        );
        mkt = address(market);

        // 4) Wire permissions
        // NOTE: Factory must own ClaimTokens (OZ v5) or this will revert.
        claims.setMinter(mkt, true);     // allow market to mint/burn its ERC-1155 outcomes
        vaultContract.setMarket(mkt);    // allow market to move funds in its vault
        // Optional: hand vault ownership to the market for tighter control:
        // vaultContract.transferOwnership(mkt);

        // 5) Bookkeeping + emit IDs for the UI/indexers
        marketsByCreator[msg.sender].push(mkt);
        allMarkets.push(mkt);

        uint256 withinId  = mkt.id(1);
        uint256 outsideId = mkt.id(2);

        emit MarketCreated(
            mkt,
            msg.sender,
            vault,
            withinId,
            outsideId,
            strike,
            lower,
            upper,
            bandBps,
            settleTs
        );
    }
}