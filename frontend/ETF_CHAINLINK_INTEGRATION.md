# ETF Prediction Market + Chainlink Integration

This enhanced Chainlink feeds page is specifically designed to work with your ETF prediction market smart contract system.

## 🏗️ **System Architecture Overview**

### **Smart Contract Stack**

```
┌─────────────────────────────────────┐
│        Frontend (React)             │
├─────────────────────────────────────┤
│     Chainlink Feeds Browser        │ ← You are here
├─────────────────────────────────────┤
│    EtfFeedAggregator.sol           │ ← Manages price feeds
├─────────────────────────────────────┤
│      BasketPricer.sol              │ ← Calculates ETF NAV
├─────────────────────────────────────┤
│   EtfPredictionMarket.sol          │ ← Creates prediction markets
├─────────────────────────────────────┤
│  PredictionMarketVault.sol         │ ← Manages collateral
└─────────────────────────────────────┘
```

## 🔗 **Chainlink Integration Points**

### **1. EtfFeedAggregator Contract**

- **Purpose**: Centralized management of multiple Chainlink price feeds
- **Key Features**:
  - Staleness checks (`maxDelay` parameter)
  - Batch price fetching for multiple symbols
  - Owner-controlled feed configuration
  - Error handling for unknown/stale feeds

```solidity
// Add feeds to the aggregator
function addFeedMapping(
    string memory symbol,      // e.g., "ETH"
    address aggregator,        // Chainlink contract address
    uint48 maxDelay           // Max staleness in seconds
) external isOwner

// Get prices for multiple symbols
function getPrices(string[] calldata symbols)
    external view returns (
        int256[] memory prices,
        uint8[] memory decimals,
        uint256[] memory updatedAts
    )
```

### **2. BasketPricer Contract**

- **Purpose**: Calculate weighted ETF basket prices and prediction bands
- **Key Features**:
  - Weighted average price calculations
  - Price band calculations for prediction markets
  - Decimal normalization (converts all prices to 1e18 precision)

```solidity
// Calculate weighted basket price
function calculateWeightedBasketPrice(
    string[] calldata symbols,    // Asset symbols
    int256[] calldata w1e18      // Weights in 1e18 precision
) public view returns (int256 etfPrice)

// Calculate price bands for prediction markets
function boundsForBand(
    int256 etfPrice,              // Current basket price
    uint16 bandBps                // Band width in basis points
) public pure returns (int256 lower1e18, int256 upper1e18)
```

## 📊 **Frontend Integration Features**

### **ETF Basket Calculator**

The enhanced feeds page now includes:

1. **Weighted Price Calculation**

   - Automatically calculates ETF NAV using selected feeds
   - Supports custom weights or equal weighting
   - Real-time updates when prices change

2. **Price Band Generation**

   - 5% and 10% bands for prediction markets
   - Matches the `bandBps` parameter in your contracts
   - Visual representation of upper/lower bounds

3. **Smart Contract Parameters**
   - Ready-to-use arrays for contract deployment
   - Properly formatted weights in 1e18 precision
   - Feed addresses for `addFeedMapping` calls

### **Example Usage Flow**

#### **Step 1: Select Price Feeds**

```
✅ ETH/USD (25% weight)
✅ BTC/USD (30% weight)
✅ LINK/USD (15% weight)
✅ USDC/USD (20% weight)
✅ DAI/USD (10% weight)
```

#### **Step 2: Calculate Basket Price**

```
Basket NAV: $2,847.63

5% Band: $2,705.25 - $2,990.01
10% Band: $2,562.87 - $3,132.39
```

#### **Step 3: Get Contract Parameters**

```json
{
  "symbols": ["ETH", "BTC", "LINK", "USDC", "DAI"],
  "weights": [
    250000000000000000, 300000000000000000, 150000000000000000,
    200000000000000000, 100000000000000000
  ],
  "addresses": [
    "0x694AA176...",
    "0x1b44F351...",
    "0xc59E3633...",
    "0x7aFcF7B5...",
    "0x7aFcF7B5..."
  ]
}
```

## 🚀 **Deployment Workflow**

### **1. Deploy Core Contracts**

```bash
# Deploy in order
forge create EtfFeedAggregator
forge create BasketPricer --args <aggregator_address>
forge create ClaimTokens
forge create PredictionMarketVault --args <collateral_token> <factory_address>
forge create EtfPredictionMarketFactory --args <pricer_address> <claims_address> <collateral_address>
```

### **2. Configure Price Feeds**

```solidity
// Add feeds to aggregator
aggregator.addFeedMapping("ETH", 0x694AA176..., 300);  // 5 min staleness
aggregator.addFeedMapping("BTC", 0x1b44F351..., 300);
aggregator.addFeedMapping("LINK", 0xc59E3633..., 300);
// ... etc
```

### **3. Create Prediction Market**

```solidity
// Use factory to create market
factory.create(
    ["ETH", "BTC", "LINK", "USDC", "DAI"],           // symbols
    [250, 300, 150, 200, 100],                       // weights (1e18)
    500,                                              // 5% band
    block.timestamp + 86400                           // settle in 24h
);
```

## 🔍 **Key Features for Your Use Case**

### **Staleness Protection**

- Each feed has configurable `maxDelay`
- Prevents using outdated prices
- Critical for prediction market integrity

### **Weighted Calculations**

- Supports any weight distribution
- Automatically normalizes to 1e18 precision
- Matches your `BasketPricer` logic exactly

### **Price Band Generation**

- Configurable band widths (basis points)
- Perfect for "within/outside" prediction markets
- Real-time band updates as prices change

### **Contract Integration**

- Copy-paste parameters for deployment
- Properly formatted arrays and weights
- Includes all necessary metadata

## 🎯 **Prediction Market Scenarios**

### **Scenario 1: Crypto ETF**

```
Assets: ETH (40%), BTC (35%), LINK (25%)
Current NAV: $3,245.67
5% Band: $3,083.39 - $3,407.95

Market Question: Will this crypto ETF stay within 5% of current price?
```

### **Scenario 2: Stablecoin Basket**

```
Assets: USDC (60%), DAI (40%)
Current NAV: $1.0000
2% Band: $0.9800 - $1.0200

Market Question: Will this stablecoin basket maintain peg within 2%?
```

### **Scenario 3: DeFi Index**

```
Assets: UNI (30%), AAVE (25%), LINK (25%), ETH (20%)
Current NAV: $156.78
10% Band: $141.10 - $172.46

Market Question: Will this DeFi index stay within 10% of current price?
```

## 🛡️ **Safety Features**

### **Network Validation**

- Only testnet feeds displayed
- Automatic network detection
- Prevents mainnet deployment accidents

### **Price Verification**

- Real-time price fetching
- Staleness warnings
- Feed health monitoring

### **Parameter Validation**

- Weight normalization
- Address format checking
- Array length validation

## 🔮 **Future Enhancements**

### **Planned Features**

- [ ] Historical price data integration
- [ ] Feed health monitoring dashboard
- [ ] Automated feed discovery
- [ ] Cross-chain feed support
- [ ] Price alert notifications
- [ ] Backtesting simulation tools

### **Integration Opportunities**

- [ ] DeFi protocol price feeds
- [ ] Commodity and forex feeds
- [ ] Real-world asset feeds
- [ ] Custom feed aggregation

## 📚 **Additional Resources**

### **Smart Contract Documentation**

- `EtfFeedAggregator.sol`: Price feed management
- `BasketPricer.sol`: ETF pricing calculations
- `EtfPredictionMarket.sol`: Market creation and settlement
- `PredictionMarketVault.sol`: Collateral management

### **Chainlink Resources**

- [Chainlink Price Feeds](https://docs.chain.link/data-feeds/price-feeds)
- [Feed Addresses](https://docs.chain.link/data-feeds/price-feeds/addresses)
- [Staleness Checks](https://docs.chain.link/data-feeds/best-practices#check-the-timestamp-of-the-latest-answer)

### **Testing & Development**

- Use testnet feeds for development
- Test with small amounts first
- Monitor feed staleness in production
- Implement proper error handling

This enhanced Chainlink feeds page provides everything you need to build, test, and deploy your ETF prediction market system with confidence!
