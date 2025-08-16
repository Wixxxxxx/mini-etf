# Chainlink Feeds Page

This page allows users to browse and select Chainlink price feeds for different networks.

## Features

### 🔗 **Price Feed Browsing**

- View available Chainlink price feeds for supported testnets
- Filter feeds by category (Cryptocurrencies, Stablecoins, Forex, Commodities)
- Search feeds by name or description
- Real-time price updates when wallet is connected

### 🌐 **Network Support**

- **Goerli Testnet**: ETH/USD, LINK/USD, BTC/USD, USDC/USD, DAI/USD, AAVE/USD
- **Sepolia Testnet**: ETH/USD, LINK/USD, BTC/USD, USDC/USD, DAI/USD, UNI/USD
- **Mumbai Testnet**: ETH/USD, LINK/USD, BTC/USD, USDC/USD, DAI/USD, MATIC/USD

### 📊 **Feed Information**

Each feed displays:

- **Name**: Trading pair (e.g., ETH/USD)
- **Description**: Human-readable description
- **Contract Address**: Chainlink oracle contract address
- **Decimals**: Price precision
- **Current Price**: Live price from the blockchain (when connected)
- **Category**: Feed classification

### 🎯 **Selection & Management**

- Click on feed cards to select/deselect
- Visual indicators for selected feeds
- Copy contract addresses to clipboard
- Export selected feeds as JSON
- Clear all selections

## How to Use

### 1. **Connect Wallet**

- Connect your Web3 wallet (MetaMask, Coinbase Wallet, etc.)
- Ensure you're on a supported testnet (Goerli, Sepolia, or Mumbai)

### 2. **Browse Feeds**

- Use the search bar to find specific feeds
- Filter by category using the dropdown
- Click "Refresh Prices" to get latest prices

### 3. **Select Feeds**

- Click on any feed card to select it
- Selected feeds are highlighted with a green border and checkmark
- Use the copy button to get contract addresses

### 4. **Export Selection**

- Selected feeds appear in the summary section
- Click "Export Selected Feeds" to download as JSON
- Use "Clear All" to reset your selection

## Technical Details

### **Smart Contract Integration**

- Uses Chainlink's `latestRoundData()` function
- Automatically handles price decimals
- Real-time price fetching from blockchain

### **Supported Networks**

- **Goerli**: `0x5`
- **Sepolia**: `0xaa36a7`
- **Mumbai**: `0x13881`

### **Feed Categories**

- **Cryptocurrencies**: ETH, BTC, LINK, AAVE, UNI, MATIC
- **Stablecoins**: USDC, DAI
- **Forex**: (Future expansion)
- **Commodities**: (Future expansion)

## Use Cases

### **Developers**

- Find Chainlink oracle addresses for smart contracts
- Test price feed integration on testnets
- Export feed configurations for development

### **Traders**

- Monitor real-time prices across assets
- Compare prices across different networks
- Research available trading pairs

### **Researchers**

- Analyze price feed availability
- Study oracle decentralization
- Understand cross-chain price data

## Safety Features

- **Testnet Only**: Only displays feeds for testnet networks
- **Network Validation**: Automatically detects and validates network connections
- **Price Verification**: Fetches prices directly from blockchain contracts
- **Address Validation**: Ensures contract addresses are properly formatted

## Future Enhancements

- [ ] Add more networks (Arbitrum, Optimism, etc.)
- [ ] Include historical price data
- [ ] Add price alerts and notifications
- [ ] Support for custom feed addresses
- [ ] Integration with DeFi protocols
- [ ] Price feed health monitoring

## Troubleshooting

### **No Feeds Displayed**

- Ensure you're connected to a supported testnet
- Check wallet connection status
- Refresh the page

### **Prices Not Loading**

- Verify wallet connection
- Check network connection
- Ensure you have some testnet ETH for gas

### **Feed Selection Issues**

- Clear browser cache
- Disconnect and reconnect wallet
- Check browser console for errors

## API Integration

The feeds page can be integrated with other applications:

```javascript
// Example: Get selected feeds data
const selectedFeeds = [
  {
    name: "ETH/USD",
    address: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
    description: "Ethereum to USD Price Feed",
    decimals: 8,
    category: "crypto",
  },
];

// Export to JSON
const feedData = JSON.stringify(selectedFeeds, null, 2);
```

## Support

For issues or questions:

1. Check the browser console for error messages
2. Verify network connectivity
3. Ensure wallet is properly connected
4. Check that you're on a supported testnet
