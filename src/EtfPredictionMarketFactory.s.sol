// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {EtfPredictionMarket}    from "./EtfPredictionMarket.s.sol";
import {IBasketPricer}         from "../interfaces/IBasketPricer.sol";
import {ClaimTokens}           from "./ClaimTokens.s.sol";
import {PredictionMarketVault} from "./PredictionMarketVault.s.sol";

library ClaimIds {
    function id(address market, uint8 outcomeCode) internal pure returns (uint256) {
        return (uint256(uint160(market)) << 8) | outcomeCode; // 1=WITHIN, 2=OUTSIDE
    }
}

contract EtfPredictionMarketFactory {
    using ClaimIds for address;

    IBasketPricer public immutable pricer;
    ClaimTokens   public immutable claims;
    address       public immutable collateral;

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

    // ------------------------------ PUBLIC ------------------------------

    function create(
        string[] calldata symbols,
        int256[] calldata w1e18,
        uint16 bandBps,
        uint64 settleTs
    ) external returns (address mkt, address vault) {
        require(bandBps > 0 && bandBps <= 10_000, "bad band");
        require(settleTs > block.timestamp, "settle in past");
        require(symbols.length == w1e18.length, "len mismatch");

        // Keep only 3 locals here
        (int256 strike, int256 lower, int256 upper) =
            pricer.quoteAndBounds(symbols, w1e18, bandBps);
        require(strike > 0, "bad strike");
        require(lower < strike && strike < upper, "bad bounds");

        vault = _deployVault();

        // Heavy constructor arg list happens in its own frame
        mkt = _deployMarket(
            vault,
            symbols,
            w1e18,
            strike,
            lower,
            upper,
            bandBps,
            settleTs
        );

        _wire(mkt, vault);
        _bookkeep(mkt);
        _emitCreated(mkt, vault, strike, lower, upper, bandBps, settleTs);
    }

    // ------------------------------ INTERNAL ------------------------------

    function _deployVault() internal returns (address vault) {
        PredictionMarketVault v = new PredictionMarketVault(collateral, address(this));
        vault = address(v);
    }

    function _deployMarket(
        address vault,
        string[] calldata symbols,
        int256[] calldata w1e18,
        int256 strike,
        int256 lower,
        int256 upper,
        uint16 bandBps,
        uint64 settleTs
    ) internal returns (address mkt) {
        // Cast once inside this frame; reduces types in caller
        PredictionMarketVault v = PredictionMarketVault(vault);
        EtfPredictionMarket market = new EtfPredictionMarket(
            pricer,
            claims,
            v,
            symbols,
            w1e18,
            strike,
            lower,
            upper,
            bandBps,
            settleTs
        );
        mkt = address(market);
    }

    function _wire(address mkt, address vault) internal {
        // All wiring in its own small frame
        claims.setMinter(mkt, true);
        PredictionMarketVault v = PredictionMarketVault(vault);
        v.setMarket(mkt);
        v.setClaims(address(claims));
    }

    function _bookkeep(address mkt) internal {
        marketsByCreator[msg.sender].push(mkt);
        allMarkets.push(mkt);
    }

    function _emitCreated(
        address mkt,
        address vault,
        int256 strike,
        int256 lower,
        int256 upper,
        uint16 bandBps,
        uint64 settleTs
    ) internal {
        emit MarketCreated(
            mkt,
            msg.sender,
            vault,
            mkt.id(1),
            mkt.id(2),
            strike,
            lower,
            upper,
            bandBps,
            settleTs
        );
    }
}
