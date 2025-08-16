const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// In-memory storage (replace with database in production)
let markets = new Map();
let orders = new Map();
let trades = new Map();

// Initialize default market
const initializeMarket = (marketId) => {
  if (!markets.has(marketId)) {
    markets.set(marketId, {
      id: marketId,
      yesOrderBook: { bids: new Map(), asks: new Map() },
      noOrderBook: { bids: new Map(), asks: new Map() },
      createdAt: new Date().toISOString()
    });
  }
};

// Helper function to add order to order book
const addOrderToBook = (orderBook, order) => {
  const price = order.price;
  if (!orderBook.has(price)) {
    orderBook.set(price, []);
  }
  orderBook.get(price).push(order);
  
  // Sort orders by timestamp (FIFO)
  orderBook.get(price).sort((a, b) => a.timestamp - b.timestamp);
};

// Helper function to remove order from order book
const removeOrderFromBook = (orderBook, orderId) => {
  for (const [price, orders] of orderBook) {
    const index = orders.findIndex(o => o.id === orderId);
    if (index !== -1) {
      orders.splice(index, 1);
      if (orders.length === 0) {
        orderBook.delete(price);
      }
      return true;
    }
  }
  return false;
};

// Match orders for a specific market and side
const matchOrders = (marketId, marketType) => {
  const market = markets.get(marketId);
  if (!market) return [];

  const orderBook = market[`${marketType.toLowerCase()}OrderBook`];
  const bids = orderBook.bids;
  const asks = orderBook.asks;
  
  const newTrades = [];
  
  // Sort bids (descending) and asks (ascending)
  const sortedBids = Array.from(bids.entries()).sort((a, b) => b[0] - a[0]);
  const sortedAsks = Array.from(asks.entries()).sort((a, b) => a[0] - b[0]);
  
  while (sortedBids.length > 0 && sortedAsks.length > 0) {
    const [bidPrice, bidOrders] = sortedBids[0];
    const [askPrice, askOrders] = sortedAsks[0];
    
    if (bidPrice < askPrice) break; // No more matches
    
    const bidOrder = bidOrders[0];
    const askOrder = askOrders[0];
    
    const tradeQty = Math.min(bidOrder.qty, askOrder.qty);
    const tradePrice = askPrice; // Price improvement for buyer
    
    // Create trade
    const trade = {
      id: Date.now() + Math.random(),
      buyer: bidOrder.user,
      seller: askOrder.user,
      qty: tradeQty,
      price: tradePrice,
      market: marketType,
      marketId: marketId,
      timestamp: Math.floor(Date.now() / 1000)
    };
    
    newTrades.push(trade);
    
    // Update order quantities
    bidOrder.qty -= tradeQty;
    askOrder.qty -= tradeQty;
    
    // Remove fully filled orders
    if (bidOrder.qty <= 0) {
      bidOrders.shift();
      if (bidOrders.length === 0) {
        bids.delete(bidPrice);
        sortedBids.shift();
      }
    }
    
    if (askOrder.qty <= 0) {
      askOrders.shift();
      if (askOrders.length === 0) {
        asks.delete(askPrice);
        sortedAsks.shift();
      }
    }
  }
  
  return newTrades;
};

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get all markets
app.get('/api/markets', (req, res) => {
  const marketList = Array.from(markets.values()).map(market => ({
    id: market.id,
    createdAt: market.createdAt,
    yesOrders: Array.from(market.yesOrderBook.bids.values()).flat().length + 
               Array.from(market.yesOrderBook.asks.values()).flat().length,
    noOrders: Array.from(market.noOrderBook.bids.values()).flat().length + 
              Array.from(market.noOrderBook.asks.values()).flat().length
  }));
  
  res.json(marketList);
});

// Create market
app.post('/api/markets', (req, res) => {
  const { marketId } = req.body;
  
  if (!marketId) {
    return res.status(400).json({ error: 'Market ID is required' });
  }
  
  initializeMarket(marketId);
  res.json({ message: 'Market created successfully', marketId });
});

// Get market order book
app.get('/api/markets/:marketId/orderbook', (req, res) => {
  const { marketId } = req.params;
  const { market } = req.query; // 'YES' or 'NO'
  
  if (!markets.has(marketId)) {
    return res.status(404).json({ error: 'Market not found' });
  }
  
  const marketData = markets.get(marketId);
  const orderBook = marketData[`${market.toLowerCase()}OrderBook`];
  
  // Convert Map to sorted arrays
  const bids = Array.from(orderBook.bids.entries())
    .sort((a, b) => b[0] - a[0]) // Descending price
    .map(([price, orders]) => ({
      price,
      totalQty: orders.reduce((sum, order) => sum + order.qty, 0),
      orders: orders.map(o => ({
        id: o.id,
        user: o.user,
        qty: o.qty,
        timestamp: o.timestamp
      }))
    }));
    
  const asks = Array.from(orderBook.asks.entries())
    .sort((a, b) => a[0] - b[0]) // Ascending price
    .map(([price, orders]) => ({
      price,
      totalQty: orders.reduce((sum, order) => sum + order.qty, 0),
      orders: orders.map(o => ({
        id: o.id,
        user: o.user,
        qty: o.qty,
        timestamp: o.timestamp
      }))
    }));
  
  res.json({
    marketId,
    market,
    bids,
    asks,
    timestamp: new Date().toISOString()
  });
});

// Place order
app.post('/api/orders', (req, res) => {
  const { marketId, market, side, price, qty, user } = req.body;
  
  if (!marketId || !market || !side || price === undefined || !qty || !user) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (price < 0 || price > 1 || qty <= 0) {
    return res.status(400).json({ error: 'Invalid price or quantity' });
  }
  
  if (!['YES', 'NO'].includes(market)) {
    return res.status(400).json({ error: 'Market must be YES or NO' });
  }
  
  if (!['Buy', 'Sell'].includes(side)) {
    return res.status(400).json({ error: 'Side must be Buy or Sell' });
  }
  
  // Initialize market if it doesn't exist
  initializeMarket(marketId);
  
  // Create order
  const order = {
    id: Date.now() + Math.random(),
    marketId,
    market,
    side,
    price,
    qty,
    user,
    timestamp: Math.floor(Date.now() / 1000),
    status: 'active'
  };
  
  // Add to orders map
  orders.set(order.id, order);
  
  // Add to appropriate order book
  const marketData = markets.get(marketId);
  const orderBook = marketData[`${market.toLowerCase()}OrderBook`];
  
  if (side === 'Buy') {
    addOrderToBook(orderBook.bids, order);
  } else {
    addOrderToBook(orderBook.asks, order);
  }
  
  // Try to match orders
  const newTrades = matchOrders(marketId, market);
  
  // Add trades to trades map
  newTrades.forEach(trade => {
    trades.set(trade.id, trade);
  });
  
  res.json({
    message: 'Order placed successfully',
    orderId: order.id,
    trades: newTrades
  });
});

// Cancel order
app.delete('/api/orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  
  const order = orders.get(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  // Remove from order book
  const marketData = markets.get(order.marketId);
  const orderBook = marketData[`${order.market.toLowerCase()}OrderBook`];
  
  if (order.side === 'Buy') {
    removeOrderFromBook(orderBook.bids, orderId);
  } else {
    removeOrderFromBook(orderBook.asks, orderId);
  }
  
  // Remove from orders map
  orders.delete(orderId);
  
  res.json({ message: 'Order cancelled successfully' });
});

// Get user orders
app.get('/api/users/:user/orders', (req, res) => {
  const { user } = req.params;
  const userOrders = Array.from(orders.values()).filter(o => o.user === user);
  
  res.json(userOrders);
});

// Get recent trades
app.get('/api/trades', (req, res) => {
  const { marketId, market, limit = 100 } = req.query;
  
  let filteredTrades = Array.from(trades.values());
  
  if (marketId) {
    filteredTrades = filteredTrades.filter(t => t.marketId === marketId);
  }
  
  if (market) {
    filteredTrades = filteredTrades.filter(t => t.market === market);
  }
  
  // Sort by timestamp (newest first) and limit
  filteredTrades.sort((a, b) => b.timestamp - a.timestamp);
  filteredTrades = filteredTrades.slice(0, parseInt(limit));
  
  res.json(filteredTrades);
});

// Get arbitrage opportunities
app.get('/api/arbitrage/:marketId', (req, res) => {
  const { marketId } = req.params;
  
  if (!markets.has(marketId)) {
    return res.status(404).json({ error: 'Market not found' });
  }
  
  const marketData = markets.get(marketId);
  
  // Get best bid/ask for YES market
  const yesBids = Array.from(marketData.yesOrderBook.bids.keys()).sort((a, b) => b - a);
  const yesAsks = Array.from(marketData.yesOrderBook.asks.keys()).sort((a, b) => a - b);
  
  // Get best bid/ask for NO market
  const noBids = Array.from(marketData.noOrderBook.bids.keys()).sort((a, b) => b - a);
  const noAsks = Array.from(marketData.noOrderBook.asks.keys()).sort((a, b) => a - b);
  
  const bestYesBid = yesBids.length > 0 ? yesBids[0] : 0;
  const bestYesAsk = yesAsks.length > 0 ? yesAsks[0] : 1;
  const bestNoBid = noBids.length > 0 ? noBids[0] : 0;
  const bestNoAsk = noAsks.length > 0 ? noAsks[0] : 1;
  
  const yesNoSum = bestYesBid + bestNoBid;
  const arbitrageOpportunity = yesNoSum < 1.0;
  
  res.json({
    marketId,
    yesMarket: {
      bestBid: bestYesBid,
      bestAsk: bestYesAsk
    },
    noMarket: {
      bestBid: bestNoBid,
      bestAsk: bestNoAsk
    },
    arbitrage: {
      yesNoSum,
      opportunity: arbitrageOpportunity,
      potentialProfit: arbitrageOpportunity ? 1.0 - yesNoSum : 0
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`CLOB Backend API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API docs: http://localhost:${PORT}/api/markets`);
});

module.exports = app; 