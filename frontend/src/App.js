import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';

function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showWalletOptions, setShowWalletOptions] = useState(false);
  const [orders, setOrders] = useState([]);
  const [trades, setTrades] = useState([]);
  const [activeMarket, setActiveMarket] = useState('YES'); // Track active market tab
  const [availableWallets, setAvailableWallets] = useState([]);
  const [orderForm, setOrderForm] = useState({
    market: 'YES',
    side: 'Buy',
    price: '',
    quantity: '',
    marketId: 'test_market'
  });

  // Detect available wallets on component mount
  useEffect(() => {
    detectAvailableWallets();
  }, []);

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
      if (typeof window.ethereum !== 'undefined') {
        // Check if it's actually MetaMask, not Coinbase Wallet
        if (window.ethereum.isMetaMask && !window.ethereum.isCoinbaseWallet) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.send("eth_requestAccounts", []);
          const signer = await provider.getSigner();
          
          setProvider(provider);
          setSigner(signer);
          setAccount(accounts[0]);
          setIsConnected(true);
          setShowWalletOptions(false);
          
          // Listen for account changes
          window.ethereum.on('accountsChanged', (accounts) => {
            setAccount(accounts[0]);
          });
        } else if (window.ethereum.isCoinbaseWallet) {
          alert('Coinbase Wallet detected instead of MetaMask. Please use the Coinbase Wallet option or disable Coinbase Wallet extension.');
        } else {
          alert('MetaMask not detected. Please install MetaMask or ensure it\'s enabled.');
        }
      } else {
        alert('MetaMask is not installed. Please install MetaMask first!');
      }
    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
      alert('Failed to connect to MetaMask');
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
      if (typeof window.ethereum !== 'undefined') {
        // Determine which wallet is actually injected
        let walletName = 'Unknown Wallet';
        if (window.ethereum.isMetaMask) walletName = 'MetaMask';
        else if (window.ethereum.isCoinbaseWallet) walletName = 'Coinbase Wallet';
        else if (window.ethereum.isTrust) walletName = 'Trust Wallet';
        else if (window.ethereum.isTokenPocket) walletName = 'TokenPocket';
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        
        setProvider(provider);
        setSigner(signer);
        setAccount(accounts[0]);
        setIsConnected(true);
        setShowWalletOptions(false);
        
        // Listen for account changes
        window.ethereum.on('accountsChanged', (accounts) => {
          setAccount(accounts[0]);
        });
        
        console.log(`Connected to ${walletName}`);
      } else {
        alert('No injected wallet found. Please install a Web3 wallet first!');
      }
    } catch (error) {
      console.error('Error connecting to injected wallet:', error);
      alert('Failed to connect to wallet');
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
    
    if (!isConnected) {
      alert('Please connect your wallet first');
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
      // Create order object
      const order = {
        id: Date.now(),
        user: account,
        side: orderForm.side,
        price: price,
        qty: quantity,
        timestamp: Math.floor(Date.now() / 1000),
        market: orderForm.market,
        marketId: orderForm.marketId
      };

      // Add to orders list
      setOrders(prev => [...prev, order]);

      // Simulate order matching (in a real app, this would call your CLOB backend)
      setTimeout(() => {
        // Simulate a trade if there's a matching order
        const matchingOrder = orders.find(o => 
          o.market === order.market &&
          o.side !== order.side &&
          ((order.side === 'Buy' && o.price <= order.price) ||
           (order.side === 'Sell' && o.price >= order.price))
        );

        if (matchingOrder) {
          const trade = {
            id: Date.now(),
            buyer: order.side === 'Buy' ? order.user : matchingOrder.user,
            seller: order.side === 'Sell' ? order.user : matchingOrder.user,
            qty: Math.min(order.qty, matchingOrder.qty),
            price: order.side === 'Buy' ? order.price : matchingOrder.price,
            market: order.market,
            marketId: order.marketId,
            timestamp: Math.floor(Date.now() / 1000)
          };

          setTrades(prev => [trade, ...prev]);
          
          // Remove matched orders
          setOrders(prev => prev.filter(o => o.id !== order.id && o.id !== matchingOrder.id));
        }
      }, 1000);

      // Reset form
      setOrderForm({
        market: activeMarket,
        side: 'Buy',
        price: '',
        quantity: '',
        marketId: 'test_market'
      });

      alert('Order placed successfully!');
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order');
    }
  };

  // Cancel order
  const cancelOrder = (orderId) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
    alert('Order cancelled');
  };

  // Get order book for a specific market
  const getOrderBook = (market) => {
    return orders.filter(o => o.market === market);
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

  return (
    <div className="App">
      <div className="container">
        <div className="header">
          <h1>CLOB Trading Interface</h1>
        </div>

        {/* Wallet Section */}
        <div className="wallet-section">
          <h2>Wallet Connection</h2>
          {!isConnected ? (
            <div>
              <button className="wallet-button" onClick={() => setShowWalletOptions(!showWalletOptions)}>
                Connect Wallet
              </button>
              
              {showWalletOptions && (
                <div className="wallet-options">
                  {availableWallets.length > 0 ? (
                    availableWallets.map(wallet => (
                      <button 
                        key={wallet.id} 
                        className="wallet-option" 
                        onClick={wallet.connect}
                      >
                        <span className="wallet-icon">{wallet.icon}</span>
                        {wallet.name}
                      </button>
                    ))
                  ) : (
                    <div className="no-wallets-message">
                      <p>No wallets detected. Please install a Web3 wallet extension.</p>
                      <div className="wallet-install-links">
                        <a href="https://metamask.io/" target="_blank" rel="noopener noreferrer" className="wallet-link">
                          🦊 Install MetaMask
                        </a>
                        <a href="https://wallet.coinbase.com/" target="_blank" rel="noopener noreferrer" className="wallet-link">
                          🪙 Install Coinbase Wallet
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <button className="wallet-button" onClick={disconnectWallet}>
                Disconnect Wallet
              </button>
              <div className="wallet-info">
                <strong>Connected Account:</strong> {account}
              </div>
            </div>
          )}
        </div>

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
          <div className="market-card">
            <h3>{activeMarket} Market</h3>
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
              <h4>Order Book</h4>
              {(() => {
                const marketOrders = getOrderBook(activeMarket);
                const { bestBid, bestAsk } = getBestPrices(activeMarket);
                return (
                  <div>
                    <div className="order-row">
                      <span>Best Bid: <span className="bid">{bestBid.toFixed(3)}</span></span>
                      <span>Best Ask: <span className="ask">{bestAsk.toFixed(3)}</span></span>
                    </div>
                    {marketOrders.slice(0, 10).map(order => (
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
                    {marketOrders.length === 0 && (
                      <p style={{textAlign: 'center', color: '#888', fontStyle: 'italic'}}>
                        No orders in this market yet
                      </p>
                    )}
                  </div>
                );
              })()}
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
      </div>
    </div>
  );
}

export default App; 