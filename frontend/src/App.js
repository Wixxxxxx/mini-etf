import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CONFIG, isTestnet, getNetworkInfo, isNetworkAllowed } from './config';
import ChainlinkFeeds from './ChainlinkFeeds';
import './App.css';

function App() {
  const [account, setAccount] = useState('');
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showWalletOptions, setShowWalletOptions] = useState(false);
  const [orders, setOrders] = useState([]);
  const [trades, setTrades] = useState([]);
  const [activeMarket, setActiveMarket] = useState('YES'); // Track active market tab
  const [availableWallets, setAvailableWallets] = useState([]);
  const [currentNetwork, setCurrentNetwork] = useState(null);
  const [orderBookData, setOrderBookData] = useState({ bids: [], asks: [] });
  const [createdMarkets, setCreatedMarkets] = useState([]); // Store created prediction markets
  const [selectedMarketId, setSelectedMarketId] = useState(null); // Currently selected market
  const [orderForm, setOrderForm] = useState({
    market: 'YES',
    side: 'Buy',
    price: '',
    quantity: '',
    marketId: null // Will be set to selected prediction market ID
  });
  const [currentPage, setCurrentPage] = useState('trading'); // 'trading' or 'feeds'

  // Detect available wallets on component mount
  useEffect(() => {
    detectAvailableWallets();
    // Load initial order book data
    if (orderForm.marketId) {
      refreshOrderBook();
    }
    // Load created prediction markets from localStorage
    loadCreatedMarkets();
  }, []);

  // Load order book data when active market changes
  useEffect(() => {
    if (orderForm.marketId) {
      refreshOrderBook();
    }
  }, [activeMarket, orderForm.marketId]);

  // Auto-refresh order book every 3 seconds
  useEffect(() => {
    if (orderForm.marketId) {
      const interval = setInterval(() => {
        refreshOrderBook();
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [orderForm.marketId]);

  // Auto-refresh user orders every 5 seconds
  useEffect(() => {
    if (isConnected && account) {
      const interval = setInterval(() => {
        loadUserOrders();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [isConnected, account]);

  // Debug effect to log state changes
  useEffect(() => {
    console.log('=== CLOB STATE UPDATE ===');
    console.log('createdMarkets:', createdMarkets);
    console.log('selectedMarketId:', selectedMarketId);
    console.log('currentPage:', currentPage);
    console.log('=======================');
  }, [createdMarkets, selectedMarketId, currentPage]);

  // Debug effect to monitor order book data changes
  useEffect(() => {
    console.log('=== ORDER BOOK STATE CHANGE ===');
    console.log('orderBookData:', orderBookData);
    console.log('bids count:', orderBookData.bids?.length);
    console.log('asks count:', orderBookData.asks?.length);
    console.log('bids data:', orderBookData.bids);
    console.log('asks data:', orderBookData.asks);
    console.log('==============================');
  }, [orderBookData]);

  // Function to load created prediction markets from localStorage
  const loadCreatedMarkets = () => {
    try {
      const stored = localStorage.getItem('createdMarkets');
      console.log('Raw localStorage data:', stored);
      
      if (stored) {
        const markets = JSON.parse(stored);
        console.log('Parsed markets:', markets);
        console.log('Markets array length:', markets.length);
        
        setCreatedMarkets(markets);
        
        // If we have markets and none selected, select the first one
        if (markets.length > 0 && !selectedMarketId) {
          console.log('Setting first market as selected:', markets[0]);
          setSelectedMarketId(markets[0].id);
          
          // Also set the order form market ID
          setOrderForm(prev => ({
            ...prev,
            marketId: markets[0].id.toString()
          }));
        }
      } else {
        console.log('No markets found in localStorage');
        setCreatedMarkets([]);
      }
    } catch (error) {
      console.error('Error loading created markets:', error);
      setCreatedMarkets([]);
    }
  };

  // Function to handle market selection
  const handleMarketSelection = (marketId) => {
    setSelectedMarketId(marketId);
    const selectedMarket = createdMarkets.find(m => m.id === marketId);
    if (selectedMarket) {
      console.log('Selected market:', selectedMarket);
      
      // Update order form with the selected market ID
      setOrderForm(prev => ({
        ...prev,
        marketId: marketId.toString()
      }));
      
      console.log('Updated order form:', orderForm);
      
      // Refresh order book for the new market
      refreshOrderBook();
    }
  };

  // Function to get currently selected market
  const getSelectedMarket = () => {
    return createdMarkets.find(m => m.id === selectedMarketId);
  };

  // Function to detect which wallets are available
  const detectAvailableWallets = () => {
    const wallets = [];
    
    if (typeof window.ethereum !== 'undefined') {
      if (window.ethereum.isMetaMask) {
        wallets.push({ id: 'metamask', name: 'MetaMask', icon: '🦊', connect: connectMetaMask });
      }
      if (window.ethereum.isCoinbaseWallet) {
        wallets.push({ id: 'coinbase', name: 'Coinbase Wallet', icon: '🪙', connect: connectCoinbaseWallet });
      }
      if (window.ethereum.isTrust) {
        wallets.push({ id: 'trust', name: 'Trust Wallet', icon: '🛡️', connect: connectInjectedWallet });
      }
      if (window.ethereum.isTokenPocket) {
        wallets.push({ id: 'tokenpocket', name: 'TokenPocket', icon: '💼', connect: connectInjectedWallet });
      }
      
      // If no specific wallet is detected but ethereum is available, add generic option
      if (wallets.length === 0) {
        wallets.push({ id: 'generic', name: 'Injected Wallet', icon: '💼', connect: connectInjectedWallet });
      }
    }
    
    setAvailableWallets(wallets);
  };

  // Connect to MetaMask
  const connectMetaMask = async () => {
    try {
      if (typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask) {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        // Check if we're on a testnet
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const networkName = getNetworkInfo(chainId).name;
        setCurrentNetwork({ chainId, name: networkName });
        
        if (!isTestnet(chainId)) {
          const networkInfo = getNetworkInfo(chainId);
          alert(`⚠️ SAFETY WARNING: You're connected to ${networkInfo.name} (${chainId})!\n\nThis is NOT a testnet and could use real funds.\n\nPlease switch to a testnet like Sepolia, Goerli, or Mumbai before trading.`);
          return;
        }
        
        if (!isNetworkAllowed(chainId)) {
          alert(`⚠️ NETWORK BLOCKED: ${getNetworkInfo(chainId).name} is not allowed in this environment.\n\nPlease switch to an allowed testnet.`);
          return;
        }
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        
        setAccount(accounts[0]);
        setProvider(provider);
        setSigner(signer);
        setIsConnected(true);
        setShowWalletOptions(false);
        
        console.log(`✅ Connected to ${networkName} testnet safely`);
        
        // Load user orders after connecting
        setTimeout(() => {
          loadUserOrders();
        }, 1000);
        
        // Listen for network changes
        window.ethereum.on('chainChanged', async (newChainId) => {
          const newNetworkInfo = getNetworkInfo(newChainId);
          setCurrentNetwork({ chainId: newChainId, name: newNetworkInfo.name });
          
          if (!isTestnet(newChainId)) {
            alert(`⚠️ NETWORK CHANGED: You're now on ${newNetworkInfo.name}!\n\nThis is NOT a testnet and could use real funds.\n\nPlease switch back to a testnet for safe testing.`);
          }
          
          if (!isNetworkAllowed(newChainId)) {
            alert(`⚠️ NETWORK BLOCKED: ${newNetworkInfo.name} is not allowed in this environment.\n\nPlease switch to an allowed testnet.`);
          }
        });
      } else {
        alert('MetaMask not found! Please install MetaMask extension.');
      }
    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
      alert('Failed to connect to MetaMask: ' + error.message);
    }
  };

  // Connect to Coinbase Wallet
  const connectCoinbaseWallet = async () => {
    try {
      if (typeof window.ethereum !== 'undefined' && window.ethereum.isCoinbaseWallet) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        
        setProvider(provider);
        setSigner(signer);
        setAccount(accounts[0]);
        setIsConnected(true);
        setShowWalletOptions(false);
      } else {
        alert('Coinbase Wallet is not installed. Please install Coinbase Wallet first!');
      }
    } catch (error) {
      console.error('Error connecting to Coinbase Wallet:', error);
      alert('Failed to connect to Coinbase Wallet');
    }
  };

  // Connect to any injected wallet
  const connectInjectedWallet = async () => {
    try {
      if (typeof window.ethereum !== 'undefined' && !window.ethereum.isMetaMask && !window.ethereum.isCoinbaseWallet) {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        // Check if we're on a testnet
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const networkName = getNetworkInfo(chainId).name;
        setCurrentNetwork({ chainId, name: networkName });
        
        if (!isTestnet(chainId)) {
          const networkInfo = getNetworkInfo(chainId);
          alert(`⚠️ SAFETY WARNING: You're connected to ${networkInfo.name} (${chainId})!\n\nThis is NOT a testnet and could use real funds.\n\nPlease switch to a testnet like Sepolia, Goerli, or Mumbai before trading.`);
          return;
        }
        
        if (!isNetworkAllowed(chainId)) {
          alert(`⚠️ NETWORK BLOCKED: ${getNetworkInfo(chainId).name} is not allowed in this environment.\n\nPlease switch to an allowed testnet.`);
          return;
        }
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        
        setAccount(accounts[0]);
        setProvider(provider);
        setSigner(signer);
        setIsConnected(true);
        setShowWalletOptions(false);
        
        console.log(`✅ Connected to ${networkName} testnet safely`);
        
        // Load user orders after connecting
        setTimeout(() => {
          loadUserOrders();
        }, 1000);
        
        // Listen for network changes
        window.ethereum.on('chainChanged', async (newChainId) => {
          const newNetworkInfo = getNetworkInfo(newChainId);
          setCurrentNetwork({ chainId: newChainId, name: newNetworkInfo.name });
          
          if (!isTestnet(newChainId)) {
            alert(`⚠️ NETWORK CHANGED: You're now on ${newNetworkInfo.name}!\n\nThis is NOT a testnet and could use real funds.\n\nPlease switch back to a testnet for safe testing.`);
          }
          
          if (!isNetworkAllowed(newChainId)) {
            alert(`⚠️ NETWORK BLOCKED: ${newNetworkInfo.name} is not allowed in this environment.\n\nPlease switch to an allowed testnet.`);
          }
        });
      } else {
        alert('No injected wallet found!');
      }
    } catch (error) {
      console.error('Error connecting to injected wallet:', error);
      alert('Failed to connect to wallet: ' + error.message);
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setIsConnected(false);
    setShowWalletOptions(false);
  };

  // Handle market tab change
  const handleMarketChange = (market) => {
    setActiveMarket(market);
    setOrderForm(prev => ({
      ...prev,
      market: market
    }));
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setOrderForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Place order
  const placeOrder = async (e) => {
    e.preventDefault();
    
    console.log('=== PLACING ORDER ===');
    console.log('Order form data:', orderForm);
    console.log('Selected market ID:', selectedMarketId);
    console.log('Active market:', activeMarket);
    console.log('=====================');
    
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    if (!orderForm.marketId) {
      alert('Please select a prediction market first');
      return;
    }

    if (!orderForm.price || !orderForm.quantity) {
      alert('Please fill in all fields');
      return;
    }

    const price = parseFloat(orderForm.price);
    const quantity = parseInt(orderForm.quantity);

    if (price < 0 || price > 1 || quantity <= 0 || !Number.isInteger(quantity)) {
      alert('Invalid price or quantity. Price must be between 0 and 1, quantity must be a positive integer.');
      return;
    }

    try {
      // Create order object for API
      const orderData = {
        marketId: orderForm.marketId,
        market: activeMarket, // Use activeMarket instead of orderForm.market
        side: orderForm.side,
        price: price,
        qty: quantity,
        user: account
      };

      // Call the actual CLOB backend API
      const response = await fetch('http://localhost:3001/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData)
      });

      const result = await response.json();

      if (response.ok) {
        // Add to orders list with backend order ID
        const order = {
          id: result.orderId,
          user: account,
          side: orderForm.side,
          price: price,
          qty: quantity,
          timestamp: Math.floor(Date.now() / 1000),
          market: activeMarket,
          marketId: orderForm.marketId
        };

        setOrders(prev => [...prev, order]);

        // Handle trades from the backend
        if (result.trades && result.trades.length > 0) {
          setTrades(prev => [...result.trades, ...prev]);
          
          // Remove matched orders
          setOrders(prev => prev.filter(o => o.id !== order.id));
        }

        // Reset form but keep the current market ID
        setOrderForm(prev => ({
          ...prev,
          price: '',
          quantity: ''
        }));

        alert('Order placed successfully!');
        
        // Refresh order book data immediately and after a short delay
        refreshOrderBook();
        setTimeout(() => {
          refreshOrderBook();
          // Also refresh user orders
          loadUserOrders();
        }, 500); // Refresh again after 500ms to ensure backend has processed
      } else {
        alert(`Failed to place order: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order. Please check your connection.');
    }
  };

  // Cancel order
  const cancelOrder = async (orderId) => {
    if (!account) return;
    
    try {
      console.log('Cancelling order:', orderId);
      const response = await fetch(`http://localhost:3001/api/orders/${orderId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        console.log('Order cancelled successfully');
        // Remove the order from local state immediately
        setOrders(prev => prev.filter(o => o.id !== orderId));
        // Refresh order book to reflect the cancellation
        refreshOrderBook();
        // Also refresh after a short delay to ensure backend has processed
        setTimeout(() => {
          refreshOrderBook();
          loadUserOrders(); // Reload user orders to ensure consistency
        }, 500);
        alert('Order cancelled successfully!');
      } else {
        const errorData = await response.json();
        console.error('Failed to cancel order:', errorData);
        alert(`Failed to cancel order: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Error cancelling order. Please try again.');
    }
  };

  // Get order book for a specific market
  const getOrderBook = (market) => {
    return orders.filter(o => o.market === market);
  };

  // Refresh order book data from backend
  const refreshOrderBook = async () => {
    try {
      console.log('Refreshing order book for market:', activeMarket);
      console.log('Using marketId:', orderForm.marketId);
      console.log('Selected prediction market ID:', selectedMarketId);
      
      if (!orderForm.marketId) {
        console.log('No market ID set, skipping order book refresh');
        return;
      }
      
      const response = await fetch(`http://localhost:3001/api/markets/${orderForm.marketId}/orderbook?market=${activeMarket}`);
      if (response.ok) {
        const orderBookData = await response.json();
        console.log('Received order book data:', orderBookData);
        console.log('Raw bids:', orderBookData.bids);
        console.log('Raw asks:', orderBookData.asks);
        console.log('Bids type:', typeof orderBookData.bids, 'Length:', orderBookData.bids?.length);
        console.log('Asks type:', typeof orderBookData.asks, 'Length:', orderBookData.asks?.length);
        
        const processedData = {
          bids: orderBookData.bids || [],
          asks: orderBookData.asks || []
        };
        
        console.log('Processed order book data:', processedData);
        console.log('Processed bids type:', typeof processedData.bids, 'Length:', processedData.bids.length);
        console.log('Processed asks type:', typeof processedData.asks, 'Length:', processedData.asks.length);
        console.log('Processed bids content:', JSON.stringify(processedData.bids));
        console.log('Processed asks content:', JSON.stringify(processedData.asks));
        
        setOrderBookData(processedData);
        console.log('Order book state updated');
        
        // Verify the state was set correctly
        setTimeout(() => {
          console.log('Order book state after update:', orderBookData);
        }, 100);
      } else {
        console.error('Failed to fetch order book:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error refreshing order book:', error);
    }
  };

  // Load user orders from backend
  const loadUserOrders = async () => {
    if (!account) return;
    
    try {
      console.log('Loading user orders for account:', account);
      const response = await fetch(`http://localhost:3001/api/users/${account}/orders`);
      if (response.ok) {
        const userOrders = await response.json();
        console.log('Received user orders:', userOrders);
        setOrders(userOrders || []);
      } else {
        console.error('Failed to fetch user orders:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error loading user orders:', error);
    }
  };

  // Get best bid and ask for a market
  const getBestPrices = (market) => {
    const marketOrders = getOrderBook(market);
    const bids = marketOrders.filter(o => o.side === 'Buy').sort((a, b) => b.price - a.price);
    const asks = marketOrders.filter(o => o.side === 'Sell').sort((a, b) => a.price - b.price);
    
    return {
      bestBid: bids.length > 0 ? bids[0].price : 0,
      bestAsk: asks.length > 0 ? asks[0].price : 1
    };
  };

  // Helper functions for network safety
  const switchToTestnet = async (testnetName) => {
    try {
      if (!window.ethereum) {
        alert('No wallet detected!');
        return;
      }
      
      let chainId;
      switch (testnetName) {
        case 'Sepolia':
          chainId = '0xaa36a7';
          break;
        case 'Goerli':
          chainId = '0x5';
          break;
        case 'Mumbai':
          chainId = '0x13881';
          break;
        default:
          chainId = '0xaa36a7'; // Default to Sepolia
      }
      
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      });
      
      console.log(`✅ Switched to ${testnetName} testnet`);
    } catch (error) {
      console.error('Error switching networks:', error);
      alert(`Failed to switch to ${testnetName}: ${error.message}`);
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>Mini-etf</h1>
        <p>Central Limit Order Book for Binary Markets of ETFs</p>
      </header>
      
      {/* Safety Banner */}
      <div className="safety-banner">
        <div className="safety-content">
          <span className="safety-icon">⚠️</span>
          <strong>SAFETY WARNING:</strong> This is a development/testing system. 
          Only connect wallets with testnet accounts. Never use mainnet wallets with real funds!
          <span className="safety-icon">⚠️</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="navigation">
        <button 
          className={`nav-button ${currentPage === 'trading' ? 'active' : ''}`}
          onClick={() => setCurrentPage('trading')}
        >
          📊 Trading
        </button>
        <button 
          className={`nav-button ${currentPage === 'feeds' ? 'active' : ''}`}
          onClick={() => setCurrentPage('feeds')}
        >
          🔗 Chainlink Feeds
        </button>
      </div>

      <div className="container">
        {/* Wallet Section */}
        <div className="wallet-section">
          <h2>🔐 Wallet Connection</h2>
          
          {!isConnected ? (
            <div className="wallet-controls">
              <button 
                className="connect-button"
                onClick={() => setShowWalletOptions(!showWalletOptions)}
              >
                Connect Wallet
              </button>
              
              {showWalletOptions && (
                <div className="wallet-options">
                  {availableWallets.map((wallet) => (
                    <button
                      key={wallet.name}
                      className="wallet-option"
                      onClick={wallet.connect}
                    >
                      <span className="wallet-icon">{wallet.icon}</span>
                      {wallet.name}
                    </button>
                  ))}
                  {availableWallets.length === 0 && (
                    <div className="no-wallets-message">
                      <p>No Web3 wallets detected</p>
                      <div className="wallet-install-links">
                        <a href="https://metamask.io/" target="_blank" rel="noopener noreferrer" className="wallet-link">
                          Install MetaMask
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="wallet-info">
              <div className="account-info">
                <strong>Account:</strong> {account.slice(0, 6)}...{account.slice(-4)}
              </div>
              
              {currentNetwork && (
                <div className="network-info">
                  <strong>Network:</strong> {currentNetwork.name}
                  {!isTestnet(currentNetwork.chainId) && (
                    <span className="warning">⚠️ MAINNET - UNSAFE!</span>
                  )}
                  {!isNetworkAllowed(currentNetwork.chainId) && (
                    <span className="warning">🚫 NETWORK BLOCKED!</span>
                  )}
                </div>
              )}
              
              <div className="network-controls">
                <button 
                  className="testnet-button"
                  onClick={() => switchToTestnet('Sepolia')}
                >
                  Switch to Sepolia
                </button>
                <button 
                  className="testnet-button"
                  onClick={() => switchToTestnet('Goerli')}
                >
                  Switch to Goerli
                </button>
                <button 
                  className="testnet-button"
                  onClick={() => switchToTestnet('Mumbai')}
                >
                  Switch to Mumbai
                </button>
              </div>
              
              <button className="disconnect-button" onClick={disconnectWallet}>
                Disconnect
              </button>
            </div>
          )}
        </div>

        {currentPage === 'trading' ? (
          <>
            {/* Prediction Market Selector */}
            {createdMarkets.length > 0 ? (
              <div className="prediction-market-selector">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3>🎯 Select Prediction Market</h3>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      onClick={loadCreatedMarkets}
                      style={{
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      🔄 Refresh Markets
                    </button>
                    <button 
                      onClick={() => {
                        console.log('=== MANUAL CHECK ===');
                        console.log('localStorage createdMarkets:', localStorage.getItem('createdMarkets'));
                        console.log('State createdMarkets:', createdMarkets);
                        console.log('State selectedMarketId:', selectedMarketId);
                        alert('Check console for market data');
                      }}
                      style={{
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      🔍 Check Data
                    </button>
                  </div>
                </div>
                
                {/* Debug Info */}
                <div style={{ background: '#f8f9fa', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontSize: '12px' }}>
                  <strong>Debug:</strong> {createdMarkets.length} markets loaded | Selected: {selectedMarketId || 'None'}
                </div>
                
                <div className="market-options">
                  {createdMarkets.map(market => (
                    <div 
                      key={market.id} 
                      className={`market-option ${selectedMarketId === market.id ? 'selected' : ''}`}
                      onClick={() => handleMarketSelection(market.id)}
                    >
                      <div className="market-header">
                        <span className="market-symbols">{market.symbols.join(', ')}</span>
                        <span className="market-status">{market.isMock ? '🔄 Mock' : '✅ Live'}</span>
                      </div>
                      <div className="market-details">
                        <span className="strike-price">Strike: ${Number(ethers.formatUnits(market.strike, 18)).toFixed(4)}</span>
                        <span className="price-band">Band: ${Number(ethers.formatUnits(market.lower, 18)).toFixed(4)} - ${Number(ethers.formatUnits(market.upper, 18)).toFixed(4)}</span>
                        <span className="settlement">Settle: {new Date(market.settleTs * 1000).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="no-markets-message">
                <h3>🎯 No Prediction Markets Available</h3>
                <p>Create prediction markets on the Chainlink Feeds page to start trading!</p>
                <button 
                  className="nav-button"
                  onClick={() => setCurrentPage('feeds')}
                  style={{ marginTop: '10px' }}
                >
                  🔗 Go to Chainlink Feeds
                </button>
              </div>
            )}

            {/* Market Selection Tabs */}
            <div className="market-tabs">
              <button 
                className={`market-tab ${activeMarket === 'YES' ? 'active' : ''}`}
                onClick={() => handleMarketChange('YES')}
              >
                YES Market
              </button>
              <button 
                className={`market-tab ${activeMarket === 'NO' ? 'active' : ''}`}
                onClick={() => handleMarketChange('NO')}
              >
                NO Market
              </button>
            </div>

            {/* Trading Section - Single Market */}
            <div className="trading-section-single">
              {/* Selected Market Info */}
              {selectedMarketId && getSelectedMarket() && (
                <div className="selected-market-info">
                  <h4>📊 Trading: {getSelectedMarket().symbols.join(', ')}</h4>
                  <div className="market-trading-details">
                    <span>Strike: ${Number(ethers.formatUnits(getSelectedMarket().strike, 18)).toFixed(4)}</span>
                    <span>Band: ${Number(ethers.formatUnits(getSelectedMarket().lower, 18)).toFixed(4)} - ${Number(ethers.formatUnits(getSelectedMarket().upper, 18)).toFixed(4)}</span>
                    <span>Settle: {new Date(getSelectedMarket().settleTs * 1000).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
              
              <div className="market-card">
                <h3>{activeMarket} Market</h3>
                {orderForm.marketId && (
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                    Trading on Market ID: {orderForm.marketId}
                  </div>
                )}
                
                {/* Debug: Show current order form state */}
                <div style={{ background: '#f0f0f0', padding: '8px', borderRadius: '4px', marginBottom: '15px', fontSize: '11px' }}>
                  <strong>Form Debug:</strong> marketId={orderForm.marketId || 'null'} | 
                  side={orderForm.side || 'null'} | 
                  price={orderForm.price || 'null'} | 
                  quantity={orderForm.quantity || 'null'}
                </div>
                <form className="order-form" onSubmit={placeOrder}>
                  <input type="hidden" name="market" value={activeMarket} />
                  
                  <div className="form-group">
                    <label>Side:</label>
                    <select name="side" value={orderForm.side} onChange={handleInputChange}>
                      <option value="Buy">Buy</option>
                      <option value="Sell">Sell</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Price (0.0 - 1.0):</label>
                    <input
                      type="number"
                      name="price"
                      value={orderForm.price}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      max="1"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Quantity (whole shares):</label>
                    <input
                      type="number"
                      name="quantity"
                      value={orderForm.quantity}
                      onChange={handleInputChange}
                      step="1"
                      min="1"
                      required
                    />
                  </div>

                  <button type="submit" className="submit-button" disabled={!isConnected}>
                    Place Order
                  </button>
                </form>

                {/* Order Book for Active Market */}
                <div className="order-book">
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <h4>Order Book</h4>
                    <button 
                      onClick={refreshOrderBook}
                      style={{
                        background: '#2196F3', 
                        color: 'white', 
                        border: 'none', 
                        padding: '8px 16px', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      🔄 Refresh
                    </button>
                  </div>
                  <div>
                    {/* Debug: Show raw order book data */}
                    <div style={{ background: '#f8f9fa', padding: '8px', borderRadius: '4px', marginBottom: '10px', fontSize: '11px' }}>
                      <strong>Order Book Debug:</strong> Bids: {orderBookData.bids.length} | Asks: {orderBookData.asks.length}
                    </div>
                    
                    <div className="order-row">
                      <span>Best Bid: <span className="bid">
                        {orderBookData.bids.length > 0 ? orderBookData.bids[0].price.toFixed(3) : '0.000'}
                      </span></span>
                      <span>Best Ask: <span className="ask">
                        {orderBookData.asks.length > 0 ? orderBookData.asks[0].price.toFixed(3) : '1.000'}
                      </span></span>
                    </div>
                    

                    {/* User's Orders */}
                    <div className="order-section">
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h5>Your Orders</h5>
                        <button 
                          onClick={loadUserOrders}
                          style={{
                            background: '#4CAF50', 
                            color: 'white', 
                            border: 'none', 
                            padding: '4px 8px', 
                            borderRadius: '4px', 
                            cursor: 'pointer',
                            fontSize: '10px'
                          }}
                        >
                          🔄
                        </button>
                      </div>
                      {orders.filter(o => o.market === activeMarket).slice(0, 5).map(order => (
                        <div key={order.id} className="order-row">
                          <span className={order.side === 'Buy' ? 'bid' : 'ask'}>
                            {order.side} {order.qty} @ {order.price.toFixed(3)}
                          </span>
                          <button 
                            onClick={() => cancelOrder(order.id)}
                            style={{background: '#f44336', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer'}}
                          >
                            Cancel
                          </button>
                        </div>
                      ))}
                      {orders.filter(o => o.market === activeMarket).length === 0 && (
                        <p style={{textAlign: 'center', color: '#888', fontStyle: 'italic'}}>
                          No orders in this market yet
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Trades */}
            <div className="trades-section">
              <h3>Recent Trades</h3>
              {trades.length === 0 ? (
                <p>No trades yet</p>
              ) : (
                trades.slice(0, 10).map(trade => (
                  <div key={trade.id} className="trade-row">
                    <span>{trade.market}</span>
                    <span>{trade.buyer.slice(0, 6)}...{trade.buyer.slice(-4)} → {trade.seller.slice(0, 6)}...{trade.seller.slice(-4)}</span>
                    <span>{trade.qty} @ {trade.price.toFixed(3)}</span>
                    <span>{new Date(trade.timestamp * 1000).toLocaleTimeString()}</span>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <ChainlinkFeeds
            account={account}
            provider={provider}
            signer={signer}
            isConnected={isConnected}
            currentNetwork={currentNetwork}
          />
        )}
      </div>
    </div>
  );
}

export default App; 