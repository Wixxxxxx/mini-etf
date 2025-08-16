// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface AggregatorV3Interface {
  function latestRoundData() external view returns (
    uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
  );
  function getRoundData(uint80 _roundId) external view returns (
    uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
  );
}

interface IERC20 {
  function transferFrom(address, address, uint256) external returns (bool);
  function transfer(address, uint256) external returns (bool);
}

contract StockIndexBinary {
  IERC20 public immutable USDC;
  AggregatorV3Interface public immutable FEED;

  uint256 public immutable resolveTime;   // e.g., 2025-09-30 20:05:00 UTC
  int256  public immutable strike;        // scaled to feed decimals
  bool    public immutable isGreaterEqual; // comparator
  uint8   public immutable decimals;      // feed decimals

  uint256 public yesSupply;
  uint256 public noSupply;
  mapping(address => uint256) public yesBalance;
  mapping(address => uint256) public noBalance;

  bool public resolved;
  bool public yesWon;
  int256 public resolvedPrice;
  uint80 public resolvedRound;

  constructor(
    address usdc,
    address feed,
    uint8 feedDecimals,
    uint256 _resolveTime,
    int256 _strike,
    bool _isGreaterEqual
  ) {
    USDC = IERC20(usdc);
    FEED = AggregatorV3Interface(feed);
    decimals = feedDecimals;
    resolveTime = _resolveTime;
    strike = _strike;
    isGreaterEqual = _isGreaterEqual;
  }

  // --- very naive AMM: 1 USDC mints 1 YES + 1 NO (you can then trade one side OTC or list asks/bids off-chain).
  // Replace with CPMM for real pricing.
  function mintPair(uint256 usdcAmount) external {
    require(!resolved, "resolved");
    require(USDC.transferFrom(msg.sender, address(this), usdcAmount), "xfer");
    yesBalance[msg.sender] += usdcAmount;
    noBalance[msg.sender]  += usdcAmount;
    yesSupply += usdcAmount;
    noSupply  += usdcAmount;
  }

  function redeemBefore() external {
    require(!resolved, "resolved");
    uint256 y = yesBalance[msg.sender];
    uint256 n = noBalance[msg.sender];
    uint256 redeemable = y < n ? y : n;
    require(redeemable > 0, "none");
    yesBalance[msg.sender] -= redeemable;
    noBalance[msg.sender]  -= redeemable;
    yesSupply -= redeemable;
    noSupply  -= redeemable;
    require(USDC.transfer(msg.sender, redeemable), "xfer");
  }

  // Called by Automation right after resolveTime.
  function resolve(uint80 roundHint) external {
    require(!resolved, "done");
    require(block.timestamp >= resolveTime, "too early");

    // If you know the first round >= resolveTime, pass it as hint; otherwise walk forward from hint until updatedAt >= resolveTime.
    (uint80 rid, int256 px, , uint256 upd, ) = FEED.getRoundData(roundHint);
    while (upd < resolveTime) {
      rid += 1;
      (, px, , upd, ) = FEED.getRoundData(rid);
    }

    resolved = true;
    resolvedPrice = px;
    resolvedRound = rid;

    yesWon = isGreaterEqual ? (px >= strike) : (px < strike);
  }

  function claim() external {
    require(resolved, "not resolved");
    uint256 payout;
    if (yesWon) {
      payout = yesBalance[msg.sender];
      yesBalance[msg.sender] = 0;
    } else {
      payout = noBalance[msg.sender];
      noBalance[msg.sender] = 0;
    }
    require(payout > 0, "no win");
    require(USDC.transfer(msg.sender, payout), "xfer");
  }
}
