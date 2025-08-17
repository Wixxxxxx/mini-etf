import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import './ChainlinkFeeds.css';

function ChainlinkFeeds({ account, provider, signer, isConnected, currentNetwork }) {
  const [feeds, setFeeds] = useState([]);
  const [selectedFeeds, setSelectedFeeds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false); // Prevent multiple simultaneous fetches
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [basketPrice, setBasketPrice] = useState(null);
  const [basketCalculation, setBasketCalculation] = useState(null);
  const [showBasketCalculator, setShowBasketCalculator] = useState(false);

  // Common Chainlink price feeds for different networks - Optimized for ETF Basket Trading
  const availableFeeds = {
    '0x5': [ // Goerli
      { address: '0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e', name: 'ETH', description: 'Ethereum to USD Price Feed', decimals: 8, category: 'crypto', weight: 0.40 },
      { address: '0x779877A7B0D9E8603169DdbD7836e478b4624789', name: 'LINK', description: 'Chainlink to USD Price Feed', decimals: 8, category: 'crypto', weight: 0.20 },
      { address: '0xA39434A63A52E749F02807ae27335515BA9b2F6F', name: 'BTC', description: 'Bitcoin to USD Price Feed', decimals: 8, category: 'crypto', weight: 0.40 }
    ], 
    '0xaa36a7': [ // Sepolia
      { address: '0x694AA1769357215DE4FAC081bf1f309aDC325306', name: 'ETH', description: 'Ethereum to USD Price Feed', decimals: 8, category: 'crypto', weight: 0.40 },
      { address: '0xc59E3633BAAC79493d08e8bD3f9731fD61B3C326', name: 'LINK', description: 'Chainlink to USD Price Feed', decimals: 8, category: 'crypto', weight: 0.20 },
      { address: '0x1b44F3514812d835EB1BDB2acE6093a1F3e060A9', name: 'BTC', description: 'Bitcoin to USD Price Feed', decimals: 8, category: 'crypto', weight: 0.40 }
    ],
    '0x13881': [ // Mumbai
      { address: '0x0715A7794a1dc8e42615F059dD6e406A6594651A', name: 'ETH', description: 'Ethereum to USD Price Feed', decimals: 8, category: 'crypto', weight: 0.40 },
      { address: '0x12162c3E810393dECEc62aA165f3Df2c08FbF4E8', name: 'LINK', description: 'Chainlink to USD Price Feed', decimals: 8, category: 'crypto', weight: 0.20 },
      { address: '0x007A22900a3B98143368Bd7874Bc93c557e4e408', name: 'BTC', description: 'Bitcoin to USD Price Feed', decimals: 8, category: 'crypto', weight: 0.40 }
    ]
  };

  // Chainlink ABI for price feeds
  const chainlinkABI = [
    "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
    "function decimals() external view returns (uint8)",
    "function description() external view returns (string memory)"
  ];

  // Your deployed contract addresses
  const CONTRACT_ADDRESSES = {
    basketPricer: '0xFfc7B12479ab107Ce0D7A3efbd505D18A5001FF1',
    feedAggregator: '0x3BE15977b7653eC1EBa462bdB1ef30Bdc3267E74',
    predictionMarketFactory: '0x29d1eBDa71C3d2B62CA2b6F275B1658077bB09DD',
    claimTokens: '0x31d1e2d63169cC9e9910DDe53c62097bB5eE01Da',
    collateral: '0x0000000000000000000000000000000000000000' // TODO: Add your USDC/collateral address
  };
  
  // NOTE: These contracts are deployed on the network you're currently connected to
  // Make sure you're on the correct network (Sepolia, Goerli, or Mumbai) to interact with them

  // Contract ABIs
  const basketPricerABI = [
    "function calculateWeightedBasketPrice(string[] calldata symbols, int256[] calldata w1e18) external view returns (int256 etfPrice)",
    "function boundsForBand(int256 etfPrice, uint16 bandBps) external pure returns (int256 lower1e18, int256 upper1e18)",
    "function quoteAndBounds(string[] calldata symbols, int256[] calldata w1e18, uint16 bandBps) external view returns (int256 etfPrice, int256 lower, int256 upper)",
    "function agg() external view returns (address)"
  ];

  const feedAggregatorABI = [
    "function getPrices(string[] calldata symbols) external view returns (int256[] memory prices, uint8[] memory decimals, uint256[] memory updatedAts)",
    "function addFeedMapping(string memory symbol, address aggregator, uint48 maxDelay) external",
    "function owner() external view returns (address)",
    "error UnknownFeed(string symbol)",
    "error StalePrice(string symbol, uint256 updatedAt, uint256 nowTs, uint256 maxDelay)"
  ];

  const predictionMarketFactoryABI = [
    "function create(string[] calldata symbols, int256[] calldata w1e18, uint16 bandBps, uint64 settleTs) external returns (address mkt, address vault)",
    "function marketsByCreator(address creator) external view returns (address[] memory)",
    "function allMarkets() external view returns (address[] memory)",
    "event MarketCreated(address indexed market, address indexed creator, address vault, uint256 withinId, uint256 outsideId, int256 strike1e18, int256 lower1e18, int256 upper1e18, uint16 bandBps, uint64 settleTs)"
  ];

  const predictionMarketABI = [
    "function symbols() external view returns (string[] memory)",
    "function w1e18() external view returns (int256[] memory)",
    "function strike() external view returns (int256)",
    "function lower() external view returns (int256)",
    "function upper() external view returns (int256)",
    "function bandBps() external view returns (uint16)",
    "function settleTs() external view returns (uint64)",
    "function outcome() external view returns (uint8)",
    "function finalPrice() external view returns (int256)",
    "function settle() external"
  ];

  useEffect(() => {
    if (currentNetwork && currentNetwork.chainId) {
      console.log('Network changed, loading feeds for chain ID:', currentNetwork.chainId);
      const networkFeeds = availableFeeds[currentNetwork.chainId] || [];
      console.log('Available feeds for this network:', networkFeeds);
      
      // Validate that all addresses are unique and properly formatted
      const validFeeds = networkFeeds.filter(feed => {
        try {
          if (ethers) {
            const checksummedAddress = ethers.getAddress(feed.address);
            console.log(`✓ Valid address for ${feed.name}: ${feed.address} -> ${checksummedAddress}`);
            return true;
          }
          console.log(`✗ No ethers available for ${feed.name}`);
          return false;
        } catch (error) {
          console.error(`✗ Invalid address for feed ${feed.name}:`, feed.address, error);
          return false;
        }
      });
      
      console.log('Valid feeds after address validation:', validFeeds);
      
      // Debug: Check feed properties
      validFeeds.forEach(feed => {
        console.log(`Feed ${feed.name}:`, {
          address: feed.address,
          weight: feed.weight,
          weightType: typeof feed.weight,
          decimals: feed.decimals,
          category: feed.category
        });
      });
      
      // Remove duplicates
      const addresses = validFeeds.map(f => f.address);
      const uniqueAddresses = new Set(addresses);
      
      if (addresses.length !== uniqueAddresses.size) {
        console.error('Duplicate addresses found in feeds:', addresses);
        // Remove duplicates by keeping only the first occurrence
        const uniqueFeeds = validFeeds.filter((feed, index) => 
          addresses.indexOf(feed.address) === index
        );
        console.log('Setting feeds with duplicates removed:', uniqueFeeds);
        setFeeds(uniqueFeeds);
      } else {
        console.log('Setting feeds (all addresses valid and unique):', validFeeds);
        setFeeds(validFeeds);
      }
    }
  }, [currentNetwork, ethers]);

  // Utility function to safely convert any value to a number
  const safeNumberConversion = (value) => {
    if (typeof value === 'bigint') {
      return Number(value);
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    }
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }
    return null;
  };

  // Utility function to safely format BigInt or string values for display
  const safeFormatUnits = (value, decimals = 18) => {
    try {
      if (typeof value === 'string') {
        // If it's already a string, try to parse it using ethers
        const bigIntValue = ethers.parseUnits(value, 0); // Parse as whole number
        return ethers.formatUnits(bigIntValue, decimals);
      } else if (typeof value === 'bigint') {
        return ethers.formatUnits(value, decimals);
      } else {
        return value.toString();
      }
    } catch (error) {
      console.warn('Error formatting value:', value, error);
      return value.toString();
    }
  };

  // Get live price from Chainlink feed
  const getLivePrice = async (feedAddress) => {
    if (!provider || !isConnected || !ethers) {
      console.log('Cannot fetch price:', { provider: !!provider, isConnected, ethers: !!ethers });
      return null;
    }
    
    try {
      // Validate and checksum the address
      let validAddress;
      try {
        validAddress = ethers.getAddress(feedAddress);
        console.log(`Original address: ${feedAddress}`);
        console.log(`Checksummed address: ${validAddress}`);
      } catch (addressError) {
        console.error('Invalid address format:', addressError);
        return null;
      }
      
      console.log(`Fetching price for feed: ${validAddress}`);
      const contract = new ethers.Contract(validAddress, chainlinkABI, provider);
      
      console.log('Contract created, fetching latestRoundData...');
      const roundData = await contract.latestRoundData();
      console.log('Round data received:', roundData);
      
      console.log('Fetching decimals...');
      const decimals = await contract.decimals();
      console.log('Decimals:', decimals);
      
      // Convert both answer and decimals to numbers - handle BigInt values
      const answerNumber = safeNumberConversion(roundData.answer);
      const decimalsNumber = safeNumberConversion(decimals);
      
      if (answerNumber === null) {
        console.error('Could not convert answer to number:', roundData.answer);
        return null;
      }
      
      if (decimalsNumber === null) {
        console.error('Could not convert decimals to number:', decimals);
        return null;
      }
      
      const price = answerNumber / Math.pow(10, decimalsNumber);
      console.log(`Converted answer: ${answerNumber}, decimals: ${decimalsNumber}, calculated price: ${price}`);
      
      return price;
    } catch (error) {
      console.error('Error fetching price from feed:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        data: error.data
      });
      return null;
    }
  };

  // Refresh all feed prices
  const refreshPrices = useCallback(async () => {
    if (!isConnected || !ethers) {
      console.error('Cannot refresh prices: not connected or ethers not available');
      return;
    }
    
    if (isFetching) {
      console.log('Price fetch already in progress, skipping...');
      return;
    }
    
    setIsFetching(true);
    setLoading(true);
    
    try {
      console.log(`Starting price fetch for ${feeds.length} feeds...`);
      const updatedFeeds = await Promise.all(
        feeds.map(async (feed) => {
          try {
            console.log(`Fetching price for ${feed.name} (${feed.address})`);
            const price = await getLivePrice(feed.address);
            console.log(`Got price for ${feed.name}:`, price);
            return { ...feed, currentPrice: price };
          } catch (feedError) {
            console.error(`Error fetching price for ${feed.name}:`, feedError);
            return { ...feed, currentPrice: null };
          }
        })
      );
      console.log('All price fetches completed, updating feeds...');
      setFeeds(updatedFeeds);
    } catch (error) {
      console.error('Error refreshing prices:', error);
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  }, [feeds, isConnected, ethers, isFetching]);

  // Toggle feed selection
  const toggleFeedSelection = (feed) => {
    console.log('Toggling feed selection:', {
      feed,
      weight: feed.weight,
      weightType: typeof feed.weight
    });
    
    setSelectedFeeds(prev => {
      const isSelected = prev.some(f => f.address === feed.address);
      if (isSelected) {
        return prev.filter(f => f.address !== feed.address);
      } else {
        // Ensure the feed object has all necessary properties
        const feedWithWeight = {
          ...feed,
          weight: feed.weight || (1 / (prev.length + 1)) // Fallback weight if not set
        };
        console.log('Adding feed with weight:', feedWithWeight);
        return [...prev, feedWithWeight];
      }
    });
  };

  // Filter feeds based on search and category
  const filteredFeeds = feeds.filter(feed => {
    if (!feed || !feed.name || !feed.description) return false;
    
    const matchesSearch = feed.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         feed.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || feed.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Get category display name
  const getCategoryDisplayName = (category) => {
    const categories = {
      'crypto': 'Cryptocurrencies',
      'stablecoin': 'Stablecoins',
      'forex': 'Forex',
      'commodities': 'Commodities'
    };
    return categories[category] || category;
  };

  // Check what feeds are registered in your FeedAggregator contract
  const getRegisteredFeeds = async () => {
    if (!provider || !isConnected) {
      console.log('Cannot check registered feeds: not connected');
      return null;
    }
    
    try {
      console.log('Checking registered feeds in FeedAggregator contract...');
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.feedAggregator, feedAggregatorABI, provider);
      
      // Try to get the owner to verify contract is accessible
      const owner = await contract.owner();
      console.log('Contract owner:', owner);
      
      // Use the symbol format that matches your contract mappings
      const testSymbols = ['ETH', 'BTC', 'LINK'];
      console.log('Testing with symbol format:', testSymbols);
      
      return { owner, testSymbols };
    } catch (error) {
      console.error('Error checking registered feeds:', error);
      return null;
    }
  };

  // Get prices from your deployed FeedAggregator contract
  const getContractPrices = async (symbols) => {
    if (!provider || !isConnected) {
      console.log('Cannot fetch contract prices: not connected');
      return null;
    }
    
    try {
      console.log('Fetching prices from FeedAggregator contract for symbols:', symbols);
      console.log('Symbols type:', typeof symbols, 'Length:', symbols.length);
      console.log('Symbols content:', JSON.stringify(symbols));
      
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.feedAggregator, feedAggregatorABI, provider);
      
      const result = await contract.getPrices(symbols);
      console.log('Contract prices result:', result);
      console.log('Result type:', typeof result);
      console.log('Result keys:', Object.keys(result));
      console.log('Prices type:', typeof result.prices);
      console.log('Decimals type:', typeof result.decimals);
      console.log('UpdatedAts type:', typeof result.updatedAts);
      
      // Convert BigInt values to strings to avoid mixing types
      return {
        prices: result.prices.map(p => p.toString()),
        decimals: result.decimals.map(d => d.toString()),
        updatedAts: result.updatedAts.map(t => t.toString())
      };
    } catch (error) {
      console.error('Error fetching contract prices:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        data: error.data,
        reason: error.reason
      });
      
      // Try to decode the revert reason if available
      if (error.data && error.data !== '0x') {
        try {
          const iface = new ethers.Interface(feedAggregatorABI);
          const decodedError = iface.parseError(error.data);
          console.error('Decoded FeedAggregator error:', decodedError);
          
          // Show user-friendly error message
          if (decodedError && decodedError.name === 'UnknownFeed') {
            console.error('This means the feed mapping for one or more symbols is not set up in your FeedAggregator contract');
            console.error('You need to run the SetupFeedMappings script to add the feed mappings');
          }
        } catch (decodeError) {
          console.error('Could not decode error data:', decodeError);
        }
      }
      
      return null;
    }
  };

  // Create a prediction market for the selected ETF basket (ONLINE CONTRACT VERSION)
  const createPredictionMarket = async (symbols, weights, bandBps = 500, settleDays = 7) => {
    console.log('=== createPredictionMarket FUNCTION STARTED (ONLINE MODE) ===');
    console.log('Parameters received:', { symbols, weights, bandBps, settleDays });
    
    try {
      console.log('Creating prediction market with:', { symbols, weights, bandBps, settleDays });
      
      // Input validation
      if (!Array.isArray(symbols) || symbols.length === 0) {
        throw new Error(`Invalid symbols: ${JSON.stringify(symbols)}. Must be a non-empty array.`);
      }
      if (!Array.isArray(weights) || weights.length === 0) {
        throw new Error(`Invalid weights: ${JSON.stringify(weights)}. Must be a non-empty array.`);
      }
      if (symbols.length !== weights.length) {
        throw new Error(`Mismatch: symbols length (${symbols.length}) != weights length (${weights.length})`);
      }
      
      // Debug: Log the exact data being processed
      console.log('createPredictionMarket input validation passed:');
      console.log('- Symbols:', symbols);
      console.log('- Weights:', weights);
      console.log('- Symbols types:', symbols.map(s => typeof s));
      console.log('- Weights types:', weights.map(w => typeof w));
      console.log('- Weights values:', weights.map(w => w));
      
      // Calculate settlement timestamp (current time + settleDays)
      const settleTs = Math.floor(Date.now() / 1000) + (settleDays * 24 * 60 * 60);
      
      // Check if we have the required contracts and wallet connection
      if (!provider || !isConnected || !signer) {
        throw new Error('Wallet not connected or provider not available');
      }
      
      if (CONTRACT_ADDRESSES.predictionMarketFactory === '0x0000000000000000000000000000000000000000') {
        throw new Error('PredictionMarketFactory address not set');
      }
      
      // Convert weights to 1e18 format for contract call
      const weights1e18 = weights.map(w => ethers.parseUnits(w.toString(), 18));
      
      console.log('Contract call parameters:', {
        symbols,
        weights1e18: weights1e18.map(w => w.toString()),
        bandBps,
        settleTs
      });
      
      // Create contract instances
      const factory = new ethers.Contract(CONTRACT_ADDRESSES.predictionMarketFactory, predictionMarketFactoryABI, signer);
      
      // Call the factory to create the market
      console.log('Calling EtfPredictionMarketFactory.create...');
      const tx = await factory.create(symbols, weights1e18, bandBps, settleTs);
      console.log('Transaction sent:', tx.hash);
      
      // Wait for transaction confirmation
      console.log('Waiting for transaction confirmation...');
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt.hash);
      
      // Parse the MarketCreated event
      console.log('Looking for MarketCreated event in receipt logs...');
      console.log('Receipt logs:', receipt.logs);
      
      const event = receipt.logs.find(log => {
        try {
          const parsed = factory.interface.parseLog(log);
          console.log('Parsed log:', parsed);
          return parsed.name === 'MarketCreated';
        } catch (parseError) {
          console.log('Could not parse log:', parseError);
          return false;
        }
      });
      
      if (!event) {
        console.error('MarketCreated event not found in transaction receipt');
        console.error('Available logs:', receipt.logs.map(log => {
          try {
            return factory.interface.parseLog(log);
          } catch {
            return 'Unparseable log';
          }
        }));
        throw new Error('MarketCreated event not found in transaction receipt');
      }
      
      console.log('Found MarketCreated event:', event);
      const parsedEvent = factory.interface.parseLog(event);
      console.log('Parsed event args:', parsedEvent.args);
      
      // Access args by index since they're not named properties
      const market = parsedEvent.args[0];
      const creator = parsedEvent.args[1];
      const vault = parsedEvent.args[2];
      const withinId = parsedEvent.args[3];
      const outsideId = parsedEvent.args[4];
      const strike = parsedEvent.args[5];
      const lower = parsedEvent.args[6];
      const upper = parsedEvent.args[7];
      const eventBandBps = parsedEvent.args[8];
      const eventSettleTs = parsedEvent.args[9];
      
      console.log('Market created successfully:', {
        market: market.toString(),
        creator: creator.toString(),
        vault: vault.toString(),
        withinId: withinId.toString(),
        outsideId: outsideId.toString(),
        strike: strike.toString(),
        lower: lower.toString(),
        upper: upper.toString(),
        bandBps: eventBandBps.toString(),
        settleTs: eventSettleTs.toString()
      });
      
      // Return the real market data
      return {
        market: market.toString(),
        creator: creator.toString(),
        vault: vault.toString(),
        withinId: withinId.toString(),
        outsideId: outsideId.toString(),
        strike: strike.toString(),
        lower: lower.toString(),
        upper: upper.toString(),
        bandBps: eventBandBps.toString(),
        settleTs: eventSettleTs.toString()
      };
    } catch (error) {
      console.error('=== ERROR IN createPredictionMarket ===');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Error type:', error.constructor.name);
      console.error('Full error object:', error);
      return null;
    }
  };

  // Calculate ETF basket price using your deployed BasketPricer contract
  const calculateContractBasketPrice = async (symbols, weights) => {
    if (!provider || !isConnected) {
      console.log('Cannot calculate contract basket price: not connected');
      return null;
    }
    
    try {
      console.log('Calculating basket price using BasketPricer contract');
      console.log('Symbols:', symbols);
      console.log('Weights (1e18):', weights);
      console.log('Symbols type:', typeof symbols, 'Length:', symbols.length);
      console.log('Weights type:', typeof weights, 'Length:', weights.length);
      
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.basketPricer, basketPricerABI, provider);
      
      // Convert weights to 1e18 format (using ethers.parseUnits for compatibility)
      const weights1e18 = weights.map(w => ethers.parseUnits(w.toString(), 18));
      console.log('Converted weights1e18:', weights1e18);
      console.log('Weights1e18 type:', typeof weights1e18, 'Length:', weights1e18.length);
      
      // Validate inputs before calling contract
      if (symbols.length === 0) {
        throw new Error('Symbols array is empty');
      }
      if (weights1e18.length === 0) {
        throw new Error('Weights array is empty');
      }
      if (symbols.length !== weights1e18.length) {
        throw new Error(`Symbols length (${symbols.length}) != weights length (${weights1e18.length})`);
      }
      
      console.log('Calling contract.quoteAndBounds with:', {
        symbols,
        weights1e18: weights1e18.map(w => w.toString()),
        bandBps: 500
      });
      
      const result = await contract.quoteAndBounds(symbols, weights1e18, 500); // 5% band
      console.log('Contract basket calculation result:', result);
      
      return {
        etfPrice: result.etfPrice,
        lower: result.lower,
        upper: result.upper
      };
    } catch (error) {
      console.error('Error calculating contract basket price:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        data: error.data,
        reason: error.reason
      });
      
      // Try to decode the revert reason if available
      if (error.data && error.data !== '0x') {
        try {
          const iface = new ethers.Interface(basketPricerABI);
          const decodedError = iface.parseError(error.data);
          console.error('Decoded BasketPricer error:', decodedError);
        } catch (decodeError) {
          console.error('Could not decode BasketPricer error data:', decodeError);
        }
      }
      
      // Also try to decode using FeedAggregator ABI since the error might come from there
      if (error.data && error.data !== '0x') {
        try {
          const iface = new ethers.Interface(feedAggregatorABI);
          const decodedError = iface.parseError(error.data);
          console.error('Decoded FeedAggregator error:', decodedError);
        } catch (decodeError) {
          console.error('Could not decode FeedAggregator error data:', decodeError);
        }
      }
      
      return null;
    }
  };

  // Calculate ETF basket price using selected feeds and weights (Frontend calculation)
  const calculateBasketPrice = useCallback(() => {
    console.log('calculateBasketPrice called with selectedFeeds:', selectedFeeds);
    
    if (selectedFeeds.length === 0) {
      console.log('No selected feeds, returning null');
      setBasketPrice(null);
      setBasketCalculation(null);
      return null;
    }
    
    let totalWeight = 0;
    let weightedPrice = 0;
    const calculations = [];
    
    // Filter feeds that have valid prices
    const validFeeds = selectedFeeds.filter(feed => 
      feed.currentPrice !== undefined && 
      feed.currentPrice !== null && 
      !isNaN(feed.currentPrice) &&
      feed.currentPrice > 0 &&
      typeof feed.currentPrice === 'number'
    );
    
    console.log('Valid feeds with prices:', validFeeds.length, 'out of', selectedFeeds.length);
    
    if (validFeeds.length === 0) {
      console.log('No valid feeds with prices, returning null');
      setBasketPrice(null);
      setBasketCalculation(null);
      return null;
    }
    
    validFeeds.forEach(feed => {
      const weight = Number(feed.weight) || (1 / validFeeds.length); // Ensure weight is a number
      const price = Number(feed.currentPrice); // Ensure it's a number
      
      console.log(`Processing feed ${feed.name}:`, { weight, price, currentPrice: feed.currentPrice });
      
      // Additional safety check for BigInt or other non-number types
      if (typeof price !== 'number' || isNaN(price)) {
        console.warn(`Skipping feed ${feed.name} with invalid price:`, feed.currentPrice);
        return;
      }
      
      if (typeof weight !== 'number' || isNaN(weight)) {
        console.warn(`Skipping feed ${feed.name} with invalid weight:`, feed.weight);
        return;
      }
      
      const contribution = price * weight;
      
      calculations.push({
        symbol: feed.name.split('/')[0],
        price: price,
        weight: weight,
        contribution: contribution,
        decimals: feed.decimals
      });
      
      weightedPrice += contribution;
      totalWeight += weight;
    });
    
    if (totalWeight > 0 && calculations.length > 0) {
      const basketPrice = weightedPrice / totalWeight;
      console.log('Basket calculation successful:', {
        validFeeds: validFeeds.length,
        totalWeight,
        weightedPrice,
        basketPrice,
        calculations
      });
      setBasketPrice(basketPrice);
      setBasketCalculation(calculations);
      return basketPrice; // Return the calculated price
    } else {
      console.log('Basket calculation failed - no valid calculations');
      setBasketPrice(null);
      setBasketCalculation(null);
      return null;
    }
  }, [selectedFeeds]);

  // Calculate price bands for prediction markets
  const calculatePriceBands = (price, bandBps = 500) => { // Default 5% band
    if (!price) return null;
    
    const band = bandBps / 10000; // Convert basis points to decimal
    const lower = price * (1 - band);
    const upper = price * (1 + band);
    
    return { lower, upper, bandBps };
  };

  // Auto-fetch prices when feeds are loaded and wallet is connected
  useEffect(() => {
    if (feeds.length > 0 && isConnected && provider && !loading && !isFetching) {
      console.log('Auto-fetching prices for feeds:', feeds.length);
      console.log('Provider available:', !!provider);
      console.log('Wallet connected:', isConnected);
      console.log('Current loading state:', loading);
      console.log('Current fetching state:', isFetching);
      refreshPrices();
    } else {
      console.log('Auto-fetch conditions not met:', {
        feedsLength: feeds.length,
        isConnected,
        hasProvider: !!provider,
        isLoading: loading,
        isFetching: isFetching
      });
    }
  }, [feeds, isConnected, provider, refreshPrices, loading, isFetching]);

  // Auto-calculate basket price when selected feeds or prices change
  useEffect(() => {
    if (selectedFeeds.length > 0) {
      // Check if we have prices for all selected feeds
      const feedsWithPrices = selectedFeeds.filter(feed => 
        feed.currentPrice !== undefined && feed.currentPrice !== null
      );
      
      if (feedsWithPrices.length === selectedFeeds.length) {
        calculateBasketPrice();
      }
    }
  }, [selectedFeeds, calculateBasketPrice]);

  // Error boundary for the component
  if (!ethers) {
    return (
      <div className="chainlink-feeds">
        <div className="error-message">
          <h2>⚠️ Error Loading Chainlink Feeds</h2>
          <p>Ethers library is not available. Please check your dependencies.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chainlink-feeds">
      <div className="feeds-header">
        <h2>🔗 Chainlink Price Feeds</h2>
        <p>Select and monitor real-time price feeds from Chainlink oracles</p>
      </div>

      {/* Network Info */}
      {currentNetwork && (
        <div className="network-info-banner">
          <span className="network-badge">
            🌐 {currentNetwork.name}
          </span>
          <span className="chain-id-badge">
            Chain ID: {currentNetwork.chainId}
          </span>
          {!isConnected && (
            <span className="warning-badge">
              ⚠️ Connect wallet to view live prices
            </span>
          )}
          {isConnected && (
            <span className="status-badge">
              ✅ Wallet Connected
            </span>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="feeds-controls">
        <div className="search-filter">
          <input
            type="text"
            placeholder="Search feeds..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="category-filter"
          >
            <option value="all">All Categories</option>
            <option value="crypto">Cryptocurrencies</option>
            <option value="stablecoin">Stablecoins</option>
            <option value="forex">Forex</option>
            <option value="commodities">Commodities</option>
          </select>
        </div>

        <div className="refresh-section">
          {!isConnected ? (
            <div className="connect-prompt">
              <span className="warning-text">⚠️ Connect your wallet to view live prices</span>
            </div>
          ) : (
            <>
              <button
                onClick={refreshPrices}
                disabled={loading}
                className="refresh-button primary"
              >
                {loading ? '🔄 Refreshing...' : '🔄 Refresh Prices'}
              </button>
              
              <div className="refresh-status">
                {loading ? (
                  <span className="loading-indicator">⏳ Fetching prices for {feeds.length} feeds...</span>
                ) : (
                  <span className="status-indicator">
                    {feeds.filter(f => f.currentPrice !== undefined && f.currentPrice !== null).length} of {feeds.length} feeds have prices
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        
        {/* Debug Panel */}
        <div className="debug-panel">
          <details>
            <summary>🐛 Debug Info</summary>
            <div className="debug-content">
              <div><strong>Provider:</strong> {provider ? 'Available' : 'Not Available'}</div>
              <div><strong>Signer:</strong> {signer ? 'Available' : 'Not Available'}</div>
              <div><strong>Connected:</strong> {isConnected ? 'Yes' : 'No'}</div>
              <div><strong>Account:</strong> {account || 'None'}</div>
              <div><strong>Network:</strong> {currentNetwork ? `${currentNetwork.name} (${currentNetwork.chainId})` : 'None'}</div>
              <div><strong>Feeds Count:</strong> {feeds.length}</div>
              <div><strong>Selected Feeds:</strong> {selectedFeeds.length}</div>
              <div><strong>Ethers Version:</strong> {ethers ? ethers.version || 'Unknown' : 'Not Available'}</div>
              <div><strong>Loading State:</strong> {loading ? 'Yes' : 'No'}</div>
              <div><strong>Fetching State:</strong> {isFetching ? 'Yes' : 'No'}</div>
              <div><strong>Available Feeds for Network:</strong> {currentNetwork ? availableFeeds[currentNetwork.chainId]?.length || 0 : 0}</div>
            </div>
          </details>
        </div>
        
        {/* Contract Integration Panel */}
        <div className="contract-panel">
          <details>
            <summary>📋 Contract Integration</summary>
            <div className="contract-content">
              <div><strong>BasketPricer:</strong> {CONTRACT_ADDRESSES.basketPricer}</div>
              <div><strong>FeedAggregator:</strong> {CONTRACT_ADDRESSES.feedAggregator}</div>
              <div><strong>Network:</strong> {currentNetwork ? currentNetwork.name : 'Unknown'}</div>
              <div><strong>Integration Status:</strong> {isConnected ? '🟢 Ready' : '🔴 Connect Wallet'}</div>
            </div>
          </details>
        </div>
      </div>

      {/* Feeds Grid */}
      <div className="feeds-grid">
        {filteredFeeds.length === 0 ? (
          <div className="no-feeds">
            <p>No feeds available for the current network</p>
            <p>Switch to a supported testnet (Goerli, Sepolia, or Mumbai)</p>
            {ethers && (
              <div className="address-validation-info">
                <p><strong>Note:</strong> Some feeds may have been filtered out due to invalid addresses.</p>
                <p>Check the console for specific address validation errors.</p>
              </div>
            )}
          </div>
        ) : (
          filteredFeeds.map((feed, index) => {
            if (!feed || !feed.address || !feed.name) return null;
            
            return (
              <div
                key={`${feed.address}-${index}`}
                className={`feed-card ${selectedFeeds.some(f => f.address === feed.address) ? 'selected' : ''}`}
                onClick={() => toggleFeedSelection(feed)}
              >
                <div className="feed-header">
                  <h3>{feed.name || 'Unknown Feed'}</h3>
                  <span className="category-tag">{getCategoryDisplayName(feed.category || 'unknown')}</span>
                </div>
                
                <p className="feed-description">{feed.description || 'No description available'}</p>
                
                <div className="feed-details">
                  <div className="detail-row">
                    <span className="label">Address:</span>
                    <span className="value address">
                      {feed.address ? `${feed.address.slice(0, 6)}...${feed.address.slice(-4)}` : 'Invalid Address'}
                    </span>
                  </div>
                  
                  <div className="detail-row">
                    <span className="label">Decimals:</span>
                    <span className="value">{feed.decimals || 8}</span>
                  </div>
                  
                  <div className="detail-row">
                    <span className="label">Weight:</span>
                    <span className="value weight">
                      {((feed.weight || (1 / (feeds.length || 1))) * 100).toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className="detail-row">
                    <span className="label">Current Price:</span>
                    <span className="value price">
                      {feed.currentPrice !== undefined && feed.currentPrice !== null && !isNaN(feed.currentPrice) && typeof feed.currentPrice === 'number' ? (
                        `$${feed.currentPrice.toFixed(4)}`
                      ) : (
                        isConnected ? (
                          <span className="loading-status">
                            {loading ? '⏳ Fetching...' : 'Loading...'} 
                            <button 
                              className="retry-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                getLivePrice(feed.address).then(price => {
                                  const updatedFeeds = feeds.map(f => 
                                    f.address === feed.address ? { ...f, currentPrice: price } : f
                                  );
                                  setFeeds(updatedFeeds);
                                });
                              }}
                            >
                              🔄 Retry
                            </button>
                          </span>
                        ) : 'Connect wallet'
                      )}
                    </span>
                  </div>
                </div>
                
                <div className="feed-actions">
                  <button
                    className="select-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFeedSelection(feed);
                    }}
                  >
                    {selectedFeeds.some(f => f.address === feed.address) ? '✓ Selected' : 'Select'}
                  </button>
                  
                  <button
                    className="copy-address-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(feed.address);
                      alert('Address copied to clipboard!');
                    }}
                  >
                    📋 Copy
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Selected Feeds Summary */}
      {selectedFeeds.length > 0 && (
        <div className="selected-feeds-summary">
          <h3>Selected Feeds ({selectedFeeds.length})</h3>
          <div className="selected-feeds-list">
            {selectedFeeds.map((feed, index) => {
              if (!feed || !feed.address) return null;
              
              return (
                <div key={`selected-${feed.address}-${index}`} className="selected-feed-item">
                  <span className="feed-name">{feed.name || 'Unknown Feed'}</span>
                  <span className="feed-price">
                    {feed.currentPrice !== undefined && feed.currentPrice !== null && !isNaN(feed.currentPrice) && typeof feed.currentPrice === 'number' ? 
                      `$${feed.currentPrice.toFixed(4)}` : 'N/A'}
                  </span>
                  <button
                    onClick={() => toggleFeedSelection(feed)}
                    className="remove-button"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
          
          <div className="summary-actions">
            <button
              className="export-button"
              onClick={() => {
                const feedData = selectedFeeds.map(f => ({
                  name: f.name,
                  address: f.address,
                  description: f.description,
                  decimals: f.decimals,
                  category: f.category
                }));
                const blob = new Blob([JSON.stringify(feedData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'selected-chainlink-feeds.json';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              📥 Export Selected Feeds
            </button>
            
            <button
              className="clear-button"
              onClick={() => setSelectedFeeds([])}
            >
              🗑️ Clear All
            </button>
            
            <button
              className="check-feeds-button"
              onClick={async () => {
                try {
                  const registeredFeeds = await getRegisteredFeeds();
                  if (registeredFeeds) {
                    alert(`Contract Status:\n\nOwner: ${registeredFeeds.owner}\nTest Symbols: ${registeredFeeds.testSymbols.join(', ')}\n\nNote: These are test symbols. Your contract may not have these feeds registered yet.`);
                  } else {
                    alert('Could not check contract status. Check console for details.');
                  }
                } catch (error) {
                  console.error('Check feeds failed:', error);
                  alert(`Check feeds failed: ${error.message}`);
                }
              }}
            >
              🔍 Check Contract Status
            </button>
            
            <button
              className="test-weights-button"
              onClick={() => {
                if (selectedFeeds.length === 0) {
                  alert('Please select some feeds first');
                  return;
                }
                
                const symbols = selectedFeeds.map(f => f.name);
                let weights = selectedFeeds.map(f => f.weight || (1 / selectedFeeds.length));
                
                // Normalize weights to sum to 1
                const totalWeight = weights.reduce((sum, w) => sum + w, 0);
                weights = weights.map(w => w / totalWeight);
                
                console.log('Weight test:', {
                  selectedFeeds: selectedFeeds.map(f => ({ name: f.name, weight: f.weight })),
                  symbols,
                  weights,
                  totalWeight: weights.reduce((sum, w) => sum + w, 0)
                });
                
                // Test weight conversion
                try {
                  const weights1e18 = weights.map(w => ethers.parseUnits(w.toString(), 18));
                  console.log('Weight conversion test:', {
                    original: weights,
                    converted: weights1e18.map(w => w.toString()),
                    allValid: weights1e18.every(w => w.gt(0))
                  });
                  alert('Weight test successful! Check console for details.');
                } catch (error) {
                  console.error('Weight conversion failed:', error);
                  alert(`Weight conversion failed: ${error.message}`);
                }
              }}
            >
              🧪 Test Weights
            </button>
            
            <button
              className="create-market-button"
              onClick={async () => {
                if (selectedFeeds.length === 0) {
                  alert('Please select some feeds first to create a prediction market');
                  return;
                }
                
                const symbols = selectedFeeds.map(f => f.name);
                let weights = selectedFeeds.map(f => {
                  const weight = f.weight || (1 / selectedFeeds.length);
                  console.log(`Create Market - Feed ${f.name}: weight=${f.weight}, fallback=${1 / selectedFeeds.length}, final=${weight}`);
                  return weight;
                });
                
                // Validate inputs before creating market
                if (symbols.length === 0) {
                  alert('No symbols selected. Please select some feeds first.');
                  return;
                }
                
                if (weights.some(w => w === null || w === undefined || isNaN(w) || w <= 0)) {
                  alert('Invalid weights detected. All weights must be positive numbers.');
                  return;
                }
                
                // Normalize weights to sum to 1
                const totalWeight = weights.reduce((sum, w) => sum + w, 0);
                weights = weights.map(w => w / totalWeight);
                
                console.log('Creating prediction market for:', { symbols, weights });
                console.log('Weight validation:', weights.map((w, i) => ({ index: i, weight: w, valid: w > 0 && !isNaN(w) })));
                console.log('Normalized weights sum:', weights.reduce((sum, w) => sum + w, 0));
                
                // Debug: Check the exact data being passed
                console.log('DEBUG - Symbols array:', symbols);
                console.log('DEBUG - Symbols type:', typeof symbols, 'Length:', symbols.length);
                console.log('DEBUG - Weights array:', weights);
                console.log('DEBUG - Weights type:', typeof weights, 'Length:', weights.length);
                console.log('DEBUG - Selected feeds:', selectedFeeds);
                
                try {
                  // Test if function exists
                  if (typeof createPredictionMarket !== 'function') {
                    throw new Error(`createPredictionMarket is not a function! Type: ${typeof createPredictionMarket}`);
                  }
                  
                  console.log('Function exists, calling createPredictionMarket...');
                  console.log('About to call with:', { symbols, weights, bandBps: 500, settleDays: 7 });
                  
                  // Test the function call step by step
                  let result;
                  try {
                    console.log('Step 1: Function call starting...');
                    result = await createPredictionMarket(symbols, weights, 500, 7); // 5% band, 7 days
                    console.log('Step 2: Function call completed, result:', result);
                  } catch (callError) {
                    console.error('Step 2: Function call failed:', callError);
                    throw callError;
                  }
                  
                  if (result) {
                    alert(`🎯 Prediction Market Created! (OFFLINE MODE)\n\nMarket: ${result.market}\nVault: ${result.vault}\nWithin ID: ${result.withinId}\nOutside ID: ${result.outsideId}\nStrike: ${ethers.formatUnits(result.strike, 18)}\nLower: ${ethers.formatUnits(result.lower, 18)}\nUpper: ${ethers.formatUnits(result.upper, 18)}\nBand: ${result.bandBps/100}%\nSettle: ${new Date(result.settleTs * 1000).toLocaleString()}\n\nNote: This is a mock market for testing. No actual blockchain transaction occurred.`);
                    
                    // Store the created market for later use
                    const newMarket = {
                      id: Date.now(),
                      market: result.market,
                      vault: result.vault,
                      symbols,
                      weights,
                      strike: result.strike.toString(), // Convert BigInt to string
                      lower: result.lower.toString(), // Convert BigInt to string
                      upper: result.upper.toString(), // Convert BigInt to string
                      bandBps: result.bandBps,
                      settleTs: result.settleTs,
                      createdAt: Date.now(),
                      isMock: true // Mark as mock market
                    };
                    
                    // Store in localStorage for the CLOB page
                    localStorage.setItem('createdMarkets', JSON.stringify([
                      ...JSON.parse(localStorage.getItem('createdMarkets') || '[]'),
                      newMarket
                    ]));
                    
                    console.log('Mock market created and stored:', newMarket);
                  } else {
                    alert('Failed to create prediction market. Check console for details.');
                  }
                } catch (error) {
                  console.error('=== BUTTON CLICK ERROR ===');
                  console.error('Error message:', error.message);
                  console.error('Error stack:', error.stack);
                  console.error('Error type:', error.constructor.name);
                  console.error('Full error object:', error);
                  alert(`Create market failed: ${error.message}\n\nCheck console for detailed error information.`);
                }
              }}
            >
              🎯 Create Prediction Market (OFFLINE)
            </button>
            
            <button
              className="contract-test-button"
              onClick={() => {
                console.log('=== FUNCTION ACCESSIBILITY TEST ===');
                console.log('createPredictionMarket:', typeof createPredictionMarket);
                console.log('calculateContractBasketPrice:', typeof calculateContractBasketPrice);
                console.log('getRegisteredFeeds:', typeof getRegisteredFeeds);
                console.log('toggleFeedSelection:', typeof toggleFeedSelection);
                alert('Check console for function accessibility test results');
              }}
            >
              🔍 Test Function Access
            </button>
            
            <button
              className="contract-test-button"
              onClick={async () => {
                try {
                  // First, check what feeds are registered in your contract
                  console.log('Checking registered feeds...');
                  const registeredFeeds = await getRegisteredFeeds();
                  console.log('Registered feeds info:', registeredFeeds);
                  
                  if (!registeredFeeds) {
                    alert('Could not check registered feeds. Check console for details.');
                    return;
                  }
                  
                  // Use selected feeds if available, otherwise fall back to test symbols
                  let symbols, weights;
                  if (selectedFeeds.length > 0) {
                    symbols = selectedFeeds.map(f => f.name); // Use symbol names like "ETH"
                    weights = selectedFeeds.map(f => f.weight || (1 / selectedFeeds.length));
                    console.log('Using selected feeds with symbols:', symbols);
                  } else {
                    // Use the symbols that are actually in your FeedAggregator contract
                    symbols = ['ETH', 'BTC', 'LINK'];
                    weights = [0.4, 0.4, 0.2]; // Match the weights defined above
                    console.log('Using fallback test symbols from your contract:', symbols);
                  }
                  
                  console.log('Final symbols:', symbols);
                  console.log('Final weights:', weights);
                  
                  console.log('Testing contract integration with:', { symbols, weights });
                  
                  // First, test if contracts are accessible
                  console.log('Testing contract accessibility...');
                  const basketContract = new ethers.Contract(CONTRACT_ADDRESSES.basketPricer, basketPricerABI, provider);
                  const aggregatorContract = new ethers.Contract(CONTRACT_ADDRESSES.feedAggregator, feedAggregatorABI, provider);
                  
                  console.log('Contracts created successfully');
                  
                  // Test FeedAggregator
                  console.log('Testing FeedAggregator...');
                  const contractPrices = await getContractPrices(symbols);
                  console.log('FeedAggregator prices:', contractPrices);
                  
                  // Test BasketPricer
                  console.log('Testing BasketPricer...');
                  const contractBasket = await calculateContractBasketPrice(symbols, weights);
                  console.log('BasketPricer result:', contractBasket);
                  
                  if (contractBasket) {
                    // Convert ethers BigNumber to readable format
                    const etfPrice = ethers.formatUnits(contractBasket.etfPrice, 18);
                    const lowerBand = ethers.formatUnits(contractBasket.lower, 18);
                    const upperBand = ethers.formatUnits(contractBasket.upper, 18);
                    
                    alert(`Contract Integration Test:\n\nSymbols Tested: ${symbols.join(', ')}\nFeedAggregator: ${contractPrices ? '✅ Working' : '❌ Failed'}\nBasketPricer: ✅ Working\n\nETF Price: ${etfPrice}\nLower Band: ${lowerBand}\nUpper Band: ${upperBand}`);
                  } else {
                    alert('Contract integration test failed. Check console for details.');
                  }
                } catch (error) {
                  console.error('Contract test failed:', error);
                  alert(`Contract test failed: ${error.message}\n\nCheck console for detailed error information.`);
                }
              }}
            >
              🧪 Test Contracts
            </button>
            
            <button 
              className="test-button"
              onClick={async () => {
                if (!provider || !isConnected) {
                  alert('Please connect your wallet first');
                  return;
                }
                
                try {
                  console.log('Testing FeedAggregator only...');
                  
                  // Test just the FeedAggregator with a single symbol
                  const symbols = ['ETH'];
                  console.log('Testing with single symbol:', symbols);
                  console.log('Symbols array:', symbols);
                  console.log('Symbols type:', typeof symbols);
                  console.log('Symbols length:', symbols.length);
                  console.log('First symbol:', symbols[0]);
                  console.log('First symbol type:', typeof symbols[0]);
                  
                  const contractPrices = await getContractPrices(symbols);
                  console.log('FeedAggregator single symbol test result:', contractPrices);
                  
                  if (contractPrices) {
                    // Convert string values back to numbers for formatting
                    const price = ethers.formatUnits(contractPrices.prices[0], parseInt(contractPrices.decimals[0]));
                    const updatedAt = new Date(parseInt(contractPrices.updatedAts[0]) * 1000).toLocaleString();
                    
                    alert(`FeedAggregator Test:\n\nSymbol: ${symbols[0]}\nPrice: ${price}\nDecimals: ${contractPrices.decimals[0]}\nUpdated: ${updatedAt}`);
                  } else {
                    alert('FeedAggregator test failed. Check console for details.');
                  }
                } catch (error) {
                  console.error('FeedAggregator test failed:', error);
                  console.error('Full error object:', error);
                  console.error('Error message:', error.message);
                  console.error('Error code:', error.code);
                  console.error('Error data:', error.data);
                  console.error('Error reason:', error.reason);
                  alert(`FeedAggregator test failed: ${error.message}\n\nCheck console for detailed error information.`);
                }
              }}
            >
              🔍 Test FeedAggregator Only
            </button>
            
            <button 
              className="test-button"
              onClick={async () => {
                if (!provider || !isConnected) {
                  alert('Please connect your wallet first');
                  return;
                }
                
                try {
                  console.log('Testing FeedAggregator with new symbol format...');
                  
                  // Test the FeedAggregator directly with the original symbol format
                  const symbols = ['ETH', 'BTC', 'LINK'];
                  console.log('Testing with symbols:', symbols);
                  
                  const contractPrices = await getContractPrices(symbols);
                  console.log('FeedAggregator test result:', contractPrices);
                  
                  if (contractPrices) {
                    // Convert string values back to numbers for formatting
                    const prices = contractPrices.prices.map((p, i) => {
                      const price = ethers.formatUnits(p, parseInt(contractPrices.decimals[i]));
                      const updatedAt = new Date(parseInt(contractPrices.updatedAts[i]) * 1000).toLocaleString();
                      return { symbol: symbols[i], price, updatedAt };
                    });
                    
                    const resultText = prices.map(p => `${p.symbol}: ${p.price} (${p.updatedAt})`).join('\n');
                    alert(`FeedAggregator Test (New Format):\n\n${resultText}`);
                  } else {
                    alert('FeedAggregator test failed. Check console for details.');
                  }
                } catch (error) {
                  console.error('FeedAggregator test failed:', error);
                  alert(`FeedAggregator test failed: ${error.message}\n\nCheck console for detailed error information.`);
                }
              }}
            >
              🧪 Test FeedAggregator (Original Format)
            </button>
            
            <button 
              className="test-button"
              onClick={async () => {
                if (!provider || !isConnected) {
                  alert('Please connect your wallet first');
                  return;
                }
                
                try {
                  console.log('Checking registered feeds in FeedAggregator...');
                  console.log('Contract address:', CONTRACT_ADDRESSES.feedAggregator);
                  console.log('Provider network:', await provider.getNetwork());
                  
                  // Test if we can call the contract at all
                  const contract = new ethers.Contract(CONTRACT_ADDRESSES.feedAggregator, feedAggregatorABI, provider);
                  console.log('Contract instance created');
                  
                  // Try to get the owner to see if contract is accessible
                  console.log('Attempting to call contract.owner()...');
                  const owner = await contract.owner();
                  console.log('FeedAggregator owner:', owner);
                  
                  // Test with a symbol that's definitely not registered
                  const testSymbols = ['NOT_REGISTERED'];
                  console.log('Testing with intentionally invalid symbol:', testSymbols);
                  try {
                    const result = await contract.getPrices(testSymbols);
                    console.log('Unexpected success with unregistered symbol:', result);
                  } catch (error) {
                    console.log('Expected error with unregistered symbol:', error.message);
                    console.log('Full error object:', error);
                    console.log('Error data:', error.data);
                    
                    // Try to decode the error
                    if (error.data && error.data !== '0x') {
                      try {
                        const iface = new ethers.Interface(feedAggregatorABI);
                        const decodedError = iface.parseError(error.data);
                        console.log('Decoded error:', decodedError);
                        
                        if (decodedError && decodedError.name === 'UnknownFeed') {
                          alert(`FeedAggregator is working but has no feed mappings set up.\n\nYou need to run the SetupFeedMappings script to add the feed mappings for ETH, BTC, and LINK.\n\nError: ${decodedError.args[0]}`);
                        }
                      } catch (decodeError) {
                        console.error('Could not decode error:', decodeError);
                      }
                    }
                  }
                  
                } catch (error) {
                  console.error('FeedAggregator check failed:', error);
                  console.error('Full error details:', {
                    message: error.message,
                    code: error.code,
                    data: error.data,
                    reason: error.reason
                  });
                  alert(`FeedAggregator check failed: ${error.message}\n\nCheck console for detailed error information.`);
                }
              }}
            >
              📋 Check Feed Status
            </button>
            <button 
              className="test-button"
              onClick={async () => {
                if (!provider || !isConnected) {
                  alert('Please connect your wallet first');
                  return;
                }
                
                try {
                  console.log('Checking what FeedAggregator BasketPricer is using...');
                  
                  // Check what FeedAggregator the BasketPricer is configured to use
                  const basketPricerContract = new ethers.Contract(CONTRACT_ADDRESSES.basketPricer, basketPricerABI, provider);
                  
                  // Try to get the agg address
                  console.log('BasketPricer address:', CONTRACT_ADDRESSES.basketPricer);
                  
                  try {
                    const aggAddress = await basketPricerContract.agg();
                    console.log('BasketPricer is configured to use FeedAggregator at:', aggAddress);
                    console.log('This is different from the one in CONTRACT_ADDRESSES.feedAggregator:', CONTRACT_ADDRESSES.feedAggregator);
                    
                    if (aggAddress.toLowerCase() !== CONTRACT_ADDRESSES.feedAggregator.toLowerCase()) {
                      alert(`Found the issue! BasketPricer is configured to use FeedAggregator at:\n\n${aggAddress}\n\nBut your frontend is trying to use:\n\n${CONTRACT_ADDRESSES.feedAggregator}\n\nYou need to either:\n1. Set up feed mappings in ${aggAddress}, OR\n2. Update CONTRACT_ADDRESSES.feedAggregator to ${aggAddress}`);
                      return;
                    }
                  } catch (error) {
                    console.log('Could not read agg address:', error.message);
                  }
                  
                  // Test with a simple call to see what happens
                  const testSymbols = ['ETH'];
                  const testWeights = [ethers.parseUnits('1', 18)];
                  
                  console.log('Testing BasketPricer with:', { testSymbols, testWeights: testWeights.map(w => w.toString()) });
                  
                  try {
                    const result = await basketPricerContract.quoteAndBounds(testSymbols, testWeights, 500);
                    console.log('BasketPricer call succeeded:', result);
                    alert('BasketPricer is working! It can successfully call its configured FeedAggregator.');
                  } catch (error) {
                    console.log('BasketPricer call failed:', error.message);
                    
                    // Try to decode the error to see if it's from FeedAggregator
                    if (error.data && error.data !== '0x') {
                      try {
                        const iface = new ethers.Interface(feedAggregatorABI);
                        const decodedError = iface.parseError(error.data);
                        console.log('Decoded error from BasketPricer:', decodedError);
                        
                        if (decodedError && decodedError.name === 'UnknownFeed') {
                          alert(`BasketPricer is calling a FeedAggregator that doesn't have the feed mappings set up.\n\nYou need to either:\n1. Set up feed mappings in the FeedAggregator that BasketPricer is using, OR\n2. Deploy a new BasketPricer that points to the FeedAggregator where you already have mappings.\n\nError: ${decodedError.args[0]}`);
                        }
                      } catch (decodeError) {
                        console.error('Could not decode error:', decodeError);
                      }
                    }
                  }
                  
                } catch (error) {
                  console.error('BasketPricer check failed:', error);
                  alert(`BasketPricer check failed: ${error.message}\n\nCheck console for detailed error information.`);
                }
              }}
            >
              🔍 Check BasketPricer's FeedAggregator
            </button>
          </div>
        </div>
      )}

      {/* Created Prediction Markets */}
      <div className="created-markets-section">
        <div className="section-header">
          <h3>🎯 Created Prediction Markets</h3>
          <button 
            className="view-clob-button"
            onClick={() => {
              // Navigate to CLOB trading page
              window.location.href = '/trading';
            }}
          >
            📊 Go to CLOB Trading
          </button>
        </div>
        
        <div className="markets-list">
          {(() => {
            const createdMarkets = JSON.parse(localStorage.getItem('createdMarkets') || '[]');
            if (createdMarkets.length === 0) {
              return (
                <div className="no-markets">
                  <p>No prediction markets created yet.</p>
                  <p>Select feeds above and click "🎯 Create Prediction Market (OFFLINE)" to create a mock prediction market for testing. No blockchain transaction will occur.</p>
                  <p className="warning-text">⚠️ This is currently in offline mode for testing. Markets created are stored locally and can be used to test the CLOB trading interface.</p>
                </div>
              );
            }
            
            return createdMarkets.map((market, index) => (
              <div key={market.id} className="market-card">
                <div className="market-header">
                  <h4>Market #{index + 1}</h4>
                  <span className="market-status">
                    {new Date(market.settleTs * 1000) > new Date() ? '🟡 Active' : '🔴 Settled'}
                  </span>
                </div>
                
                <div className="market-details">
                  <div className="detail-row">
                    <span className="label">Symbols:</span>
                    <span className="value">{market.symbols.join(', ')}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Strike Price:</span>
                    <span className="value">${safeFormatUnits(market.strike, 18)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Price Band:</span>
                    <span className="value">
                      ${safeFormatUnits(market.lower, 18)} - ${safeFormatUnits(market.upper, 18)}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Band Width:</span>
                    <span className="value">{market.bandBps/100}%</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Settlement:</span>
                    <span className="value">{new Date(market.settleTs * 1000).toLocaleString()}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Market Address:</span>
                    <span className="value address">
                      {market.market.slice(0, 6)}...{market.market.slice(-4)}
                    </span>
                  </div>
                </div>
                
                <div className="market-actions">
                  <button
                    className="trade-button"
                    onClick={() => {
                      // Navigate to CLOB trading with this market
                      localStorage.setItem('selectedMarket', JSON.stringify(market));
                      window.location.href = '/trading';
                    }}
                  >
                    🚀 Trade This Market
                  </button>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* ETF Basket Calculator */}
      {selectedFeeds.length > 0 && (
        <div className="basket-calculator">
          <div className="calculator-header">
            <h3>📊 ETF Basket Calculator</h3>
            <div className="calculator-controls">
              <button 
                className="refresh-basket-button"
                onClick={calculateBasketPrice}
                disabled={selectedFeeds.length === 0}
              >
                🔄 Refresh Basket
              </button>
              <button 
                className="toggle-calculator-button"
                onClick={() => setShowBasketCalculator(!showBasketCalculator)}
              >
                {showBasketCalculator ? '🔽 Hide' : '🔼 Show'} Calculator
              </button>
            </div>
          </div>
          
          {showBasketCalculator && (
            <div className="calculator-content">
              {/* Basket Price Display */}
              <div className="basket-price-display">
                <div className="price-main">
                  <span className="label">Basket NAV:</span>
                  <span className="value">
                    {basketPrice ? `$${basketPrice.toFixed(4)}` : (
                      selectedFeeds.some(f => f.currentPrice === undefined) ? 
                      'Loading prices...' : 'No valid prices'
                    )}
                  </span>
                </div>
                
                {/* Debug Info */}
                <div className="debug-info">
                  <small>
                    Selected feeds: {selectedFeeds.length} | 
                    Feeds with prices: {selectedFeeds.filter(f => f.currentPrice !== undefined && f.currentPrice !== null).length} |
                    Status: {basketPrice ? 'Calculated' : 'Waiting for prices'}
                  </small>
                </div>
                
                {basketPrice && (
                  <div className="price-bands">
                    <div className="band-info">
                      <span className="band-label">5% Band:</span>
                      <span className="band-range">
                        ${calculatePriceBands(basketPrice, 500)?.lower.toFixed(4)} - ${calculatePriceBands(basketPrice, 500)?.upper.toFixed(4)}
                      </span>
                    </div>
                    <div className="band-info">
                      <span className="band-label">10% Band:</span>
                      <span className="band-range">
                        ${calculatePriceBands(basketPrice, 1000)?.lower.toFixed(4)} - ${calculatePriceBands(basketPrice, 1000)?.upper.toFixed(4)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Basket Composition */}
              {basketCalculation && (
                <div className="basket-composition">
                  <h4>Basket Composition</h4>
                  <div className="composition-table">
                    <div className="table-header">
                      <span>Asset</span>
                      <span>Price</span>
                      <span>Weight</span>
                      <span>Contribution</span>
                    </div>
                    {basketCalculation.map((item, index) => (
                      <div key={`basket-${item.symbol}-${index}`} className="composition-row">
                        <span className="asset-symbol">{item.symbol}</span>
                        <span className="asset-price">${item.price.toFixed(4)}</span>
                        <span className="asset-weight">{(item.weight * 100).toFixed(1)}%</span>
                        <span className="asset-contribution">${item.contribution.toFixed(4)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Smart Contract Integration */}
              <div className="contract-integration">
                <h4>🔗 Smart Contract Integration</h4>
                <div className="integration-info">
                  <p>Use these parameters with your <code>EtfFeedAggregator</code> and <code>BasketPricer</code> contracts:</p>
                  
                  <div className="contract-params">
                    <div className="param-group">
                      <label>Symbols Array:</label>
                      <code className="param-value">
                        {JSON.stringify(selectedFeeds.map(f => f.name))}
                      </code>
                    </div>
                    
                    <div className="param-group">
                      <label>Weights (1e18):</label>
                      <code className="param-value">
                        {JSON.stringify(selectedFeeds.map(f => Math.floor((f.weight || (1 / selectedFeeds.length)) * 1e18)))}
                      </code>
                    </div>
                    
                    <div className="param-group">
                      <label>Feed Addresses:</label>
                      <code className="param-value">
                        {JSON.stringify(selectedFeeds.map(f => f.address))}
                      </code>
                    </div>
                  </div>
                  
                  <div className="contract-actions">
                    <button 
                      className="copy-params-button"
                      onClick={() => {
                        const params = {
                          symbols: selectedFeeds.map(f => f.name),
                          weights: selectedFeeds.map(f => Math.floor((f.weight || (1 / selectedFeeds.length)) * 1e18)),
                          addresses: selectedFeeds.map(f => f.address),
                          basketPrice: basketPrice,
                          timestamp: new Date().toISOString()
                        };
                        navigator.clipboard.writeText(JSON.stringify(params, null, 2));
                        alert('Contract parameters copied to clipboard!');
                      }}
                    >
                      📋 Copy Contract Params
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Help Section */}
      <div className="help-section">
        <h3>💡 How to Use</h3>
        <div className="help-content">
          <div className="help-item">
            <strong>1. Connect Wallet:</strong> Connect your Web3 wallet to view live prices
          </div>
          <div className="help-item">
            <strong>2. Select Feeds:</strong> Click on feeds to select them for your project
          </div>
          <div className="help-item">
            <strong>3. Copy Addresses:</strong> Use the copy button to get the contract address
          </div>
          <div className="help-item">
            <strong>4. Export Selection:</strong> Download your selected feeds as JSON
          </div>
          <div className="help-item">
            <strong>5. ETF Basket Calculator:</strong> Calculate weighted basket prices and price bands
          </div>
          <div className="help-item">
            <strong>6. Smart Contract Integration:</strong> Get ready-to-use parameters for your contracts
          </div>
        </div>
        
        <h3>🏗️ ETF Prediction Market Architecture</h3>
        <div className="help-content">
          <div className="help-item">
            <strong>EtfFeedAggregator:</strong> Manages multiple Chainlink price feeds with staleness checks
          </div>
          <div className="help-item">
            <strong>BasketPricer:</strong> Calculates weighted basket prices and price bands for prediction markets
          </div>
          <div className="help-item">
            <strong>EtfPredictionMarket:</strong> Creates markets on whether ETF prices stay within specified bands
          </div>
          <div className="help-item">
            <strong>PredictionMarketVault:</strong> Manages collateral and payouts for prediction markets
          </div>
        </div>
      </div>
    </div>
  );
  }
  
  export default ChainlinkFeeds; 