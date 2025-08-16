import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';

function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [orders, setOrders] = useState([]);
  const [trades, setTrades] = useState([]);
  const [orderForm, setOrderForm] = useState({
    market: 'YES',
    side: 'Buy',
    price: '',
    quantity: '',
    marketId: 'test_market'
  });

  // Connect wallet
  const connectWallet = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        
        setProvider(provider);
        setSigner(signer);
        setAccount(accounts[0]);
        setIsConnected(true);
        
        // Listen for account changes
        window.ethereum.on('accountsChanged', (accounts) => {
          setAccount(accounts[0]);
        });
      } else {
        alert('Please install MetaMask!');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet');
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setIsConnected(false);
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
    const quantity = parseFloat(orderForm.quantity);

    if (price < 0 || price > 1 || quantity <= 0) {
      alert('Invalid price or quantity');
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
        market: 'YES',
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
            <button className="wallet-button" onClick={connectWallet}>
              Connect Wallet
            </button>
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

        {/* Trading Section */}
        <div className="trading-section">
          {/* YES Market */}
          <div className="market-card">
            <h3>YES Market</h3>
            <form className="order-form" onSubmit={placeOrder}>
              <input type="hidden" name="market" value="YES" />
              
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
                <label>Quantity:</label>
                <input
                  type="number"
                  name="quantity"
                  value={orderForm.quantity}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0.01"
                  required
                />
              </div>

              <button type="submit" className="submit-button" disabled={!isConnected}>
                Place Order
              </button>
            </form>

            {/* YES Market Order Book */}
            <div className="order-book">
              <h4>Order Book</h4>
              {(() => {
                const yesOrders = getOrderBook('YES');
                const { bestBid, bestAsk } = getBestPrices('YES');
                return (
                  <div>
                    <div className="order-row">
                      <span>Best Bid: <span className="bid">{bestBid.toFixed(3)}</span></span>
                      <span>Best Ask: <span className="ask">{bestAsk.toFixed(3)}</span></span>
                    </div>
                    {yesOrders.slice(0, 5).map(order => (
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
                  </div>
                );
              })()}
            </div>
          </div>

          {/* NO Market */}
          <div className="market-card">
            <h3>NO Market</h3>
            <form className="order-form" onSubmit={placeOrder}>
              <input type="hidden" name="market" value="NO" />
              
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
                <label>Quantity:</label>
                <input
                  type="number"
                  name="quantity"
                  value={orderForm.quantity}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0.01"
                  required
                />
              </div>

              <button type="submit" className="submit-button" disabled={!isConnected}>
                Place Order
              </button>
            </form>

            {/* NO Market Order Book */}
            <div className="order-book">
              <h4>Order Book</h4>
              {(() => {
                const noOrders = getOrderBook('NO');
                const { bestBid, bestAsk } = getBestPrices('NO');
                return (
                  <div>
                    <div className="order-row">
                      <span>Best Bid: <span className="bid">{bestBid.toFixed(3)}</span></span>
                      <span>Best Ask: <span className="ask">{bestAsk.toFixed(3)}</span></span>
                    </div>
                    {noOrders.slice(0, 5).map(order => (
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

        {/* Arbitrage Opportunity */}
        <div className="trades-section">
          <h3>Arbitrage Monitor</h3>
          {(() => {
            const yesPrices = getBestPrices('YES');
            const noPrices = getBestPrices('NO');
            const yesNoSum = yesPrices.bestBid + noPrices.bestBid;
            const arbitrageOpportunity = yesNoSum < 1.0;
            
            return (
              <div>
                <p><strong>YES + NO = {yesNoSum.toFixed(3)}</strong></p>
                {arbitrageOpportunity ? (
                  <p style={{color: '#4CAF50', fontWeight: 'bold'}}>
                    🎯 Arbitrage Opportunity! Buy YES at {yesPrices.bestBid.toFixed(3)} and NO at {noPrices.bestBid.toFixed(3)} 
                    for a total of {yesNoSum.toFixed(3)} (guaranteed profit of {(1.0 - yesNoSum).toFixed(3)})
                  </p>
                ) : (
                  <p>No arbitrage opportunity currently</p>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

export default App; 