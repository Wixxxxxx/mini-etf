// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { IBasketPricer } from "../interfaces/IBasketPricer.sol";
import { ClaimTokens } from "./ClaimTokens.s.sol";
import {PredictionMarketVault} from "./PredictionMarketVault.s.sol";


contract EtfPredictionMarket {
    enum Outcome { Unset, Within, Outside }

    IBasketPricer public immutable pricer;
    ClaimTokens   public immutable claims;
    PredictionMarketVault   public immutable mktVault;

    string[] public symbols;
    int256[] public w1e18;

    int256  public immutable strike;
    int256  public immutable lower;
    int256  public immutable upper;
    uint16  public immutable bandBps;
    uint64  public immutable settleTs;

    Outcome public outcome;
    int256  public finalPrice;

    event Settled(Outcome o, int256 strike, int256 lower, int256 upper, int256 finalPrice);

    constructor(
        IBasketPricer _p,
        ClaimTokens _c,
        PredictionMarketVault _v,
        string[] memory _symbols,
        int256[] memory _w,
        int256 _strike,
        int256 _lower,
        int256 _upper,
        uint16 _bandBps,
        uint64 _settleTs
    ) {
        require(address(_p) != address(0), "pricer=0");
        require(_symbols.length == _w.length, "len");
        require(_bandBps > 0 && _bandBps <= 10_000, "band");
        require(_settleTs > block.timestamp, "settle in past");
        require(_lower <= _strike && _strike <= _upper, "bounds");

        pricer = _p;
        claims = _c;
        mktVault = _v;
        symbols = _symbols;
        w1e18  = _w;
        strike = _strike;
        lower  = _lower;
        upper  = _upper;
        bandBps    = _bandBps;
        settleTs   = _settleTs;
    }

    function settle() external {
        require(outcome == Outcome.Unset, "settled");
        require(block.timestamp >= settleTs, "early");

        (finalPrice, , ) = pricer.calculateWeightedBasketPrice(symbols, w1e18);

        outcome = (finalPrice < lower || finalPrice > upper) ? Outcome.Outside : Outcome.Within;
        emit Settled(outcome, strike, lower, upper, finalPrice);
    }
}
