const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Load the Rust CLOB binding
let clobBinding;
try {
  clobBinding = require('./build/Release/clob_binding');
  console.log('✅ Rust CLOB binding loaded successfully');
} catch (error) {
  console.error('❌ Failed to load Rust CLOB binding:', error.message);
  console.log('⚠️  Falling back to JavaScript implementation');
  clobBinding = null;
}

// Initialize CLOB if available
if (clobBinding) {
  try {
    const clob = new clobBinding.CLOBBinding();
    const initResult = clob.init();
    if (initResult) {
      console.log('✅ Rust CLOB engine initialized');
    } else {
      console.error('❌ Failed to initialize Rust CLOB engine');
      clobBinding = null;
    }
  } catch (error) {
    console.error('❌ Error initializing Rust CLOB:', error);
    clobBinding = null;
  }
}

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// In-memory storage (fallback when Rust CLOB is not available)
let markets = new Map();
let orders = new Map();
let trades = new Map();
let userOrders = new Map(); // Track orders by user

// Helper function to process trades and update order statuses
const processTrade = (trade, order) => {
  // Find the orders involved in this trade
  const buyOrder = Array.from(userOrders.values()).find(o => 
    o.user === trade.buyer && o.side === 'Buy' && o.market === trade.market
  );
  const sellOrder = Array.from(userOrders.values()).find(o => 
    o.user === trade.seller && o.side === 'Sell' && o.market === trade.market
  );
  
  // Update remaining quantities
  if (buyOrder) {
    buyOrder.remainingQty -= trade.qty;
    if (buyOrder.remainingQty <= 0) {
      buyOrder.status = 'filled';
      userOrders.delete(buyOrder.id);
    }
  }
  
  if (sellOrder) {
    sellOrder.remainingQty -= trade.qty;
    if (sellOrder.remainingQty <= 0) {
      sellOrder.status = 'filled';
      userOrders.delete(sellOrder.id);
    }
  }
};

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

// Helper function to add order to order book (fallback)
const addOrderToBook = (orderBook, order) => {
  const price = order.price;
  if (!orderBook.has(price)) {
    orderBook.set(price, []);
  }
  orderBook.get(price).push(order);
  
  // Sort orders by timestamp (FIFO)
  orderBook.get(price).sort((a, b) => a.timestamp - b.timestamp);
};

// Helper function to remove order from order book (fallback)
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

// Match orders for a specific market and side (fallback)
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
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    clobEngine: clobBinding ? 'Rust' : 'JavaScript (Fallback)'
  });
});

// Get all markets
app.get('/api/markets', (req, res) => {
  if (clobBinding) {
    // Use Rust CLOB to get markets
    try {
      const clob = new clobBinding.CLOBBinding();
      // For now, return a simple response - in a real implementation,
      // you'd query the Rust CLOB for market information
      res.json([{ id: 'default_market', createdAt: new Date().toISOString() }]);
    } catch (error) {
      console.error('Error getting markets from Rust CLOB:', error);
      res.status(500).json({ error: 'Failed to get markets from CLOB engine' });
    }
  } else {
    // Fallback to JavaScript implementation
    const marketList = Array.from(markets.values()).map(market => ({
      id: market.id,
      createdAt: market.createdAt,
      yesOrders: Array.from(market.yesOrderBook.bids.values()).flat().length + 
                 Array.from(market.yesOrderBook.asks.values()).flat().length,
      noOrders: Array.from(market.noOrderBook.bids.values()).flat().length + 
                Array.from(market.noOrderBook.asks.values()).flat().length
    }));
    
    res.json(marketList);
  }
});

// Create market
app.post('/api/markets', (req, res) => {
  const { marketId } = req.body;
  
  if (!marketId) {
    return res.status(400).json({ error: 'Market ID is required' });
  }
  
  if (clobBinding) {
    // Use Rust CLOB to create market
    try {
      const clob = new clobBinding.CLOBBinding();
      const result = clob.createMarket(marketId);
      if (result) {
        res.json({ message: 'Market created successfully', marketId });
      } else {
        res.status(500).json({ error: 'Failed to create market in CLOB engine' });
      }
    } catch (error) {
      console.error('Error creating market in Rust CLOB:', error);
      res.status(500).json({ error: 'Failed to create market in CLOB engine' });
    }
  } else {
    // Fallback to JavaScript implementation
    initializeMarket(marketId);
    res.json({ message: 'Market created successfully', marketId });
  }
});

// Get market order book
app.get('/api/markets/:marketId/orderbook', (req, res) => {
  const { marketId } = req.params;
  const { market } = req.query; // 'YES' or 'NO'
  
  if (clobBinding) {
    // Use Rust CLOB to get order book
    try {
      const clob = new clobBinding.CLOBBinding();
      const orderBook = clob.getOrderBookDepth(marketId, market);
      
      if (orderBook) {
        res.json({
          marketId,
          market,
          bids: [{ price: orderBook.bestBid, totalQty: orderBook.bidCount }],
          asks: [{ price: orderBook.bestAsk, totalQty: orderBook.askCount }],
          timestamp: new Date().toISOString()
        });
      } else {
        res.json({
          marketId,
          market,
          bids: [],
          asks: [],
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error getting order book from Rust CLOB:', error);
      res.status(500).json({ error: 'Failed to get order book from CLOB engine' });
    }
  } else {
    // Fallback to JavaScript implementation
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
  }
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
  
  if (clobBinding) {
    // Use Rust CLOB to place order
    try {
      const clob = new clobBinding.CLOBBinding();
      
      const order = {
        id: Date.now() + Math.random(),
        user,
        side,
        price,
        qty,
        timestamp: Math.floor(Date.now() / 1000),
        market,
        marketId
      };
      
      // Store order in userOrders for tracking
      userOrders.set(order.id, {
        ...order,
        status: 'active',
        remainingQty: order.qty
      });
      
      const trade = clob.placeOrder(order);
      
      if (trade) {
        // Convert trade to the expected format
        const tradeObj = {
          id: trade.id,
          buyer: trade.buyer,
          seller: trade.seller,
          qty: trade.qty,
          price: trade.price,
          market: trade.market,
          marketId: trade.marketId,
          timestamp: trade.timestamp
        };
        
        // Process the trade to update order statuses
        processTrade(tradeObj, order);
        
        res.json({
          message: 'Order placed successfully',
          orderId: order.id,
          trades: [tradeObj]
        });
      } else {
        res.json({
          message: 'Order placed successfully',
          orderId: order.id,
          trades: []
        });
      }
    } catch (error) {
      console.error('Error placing order in Rust CLOB:', error);
      res.status(500).json({ error: 'Failed to place order in CLOB engine' });
    }
  } else {
    // Fallback to JavaScript implementation
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
      status: 'active',
      remainingQty: qty
    };
    
    // Add to orders map
    orders.set(order.id, order);
    userOrders.set(order.id, order); // Add to userOrders map
    
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
    
    // Process trades to update order statuses
    newTrades.forEach(trade => {
      processTrade(trade, order);
    });
    
    // Add trades to trades map
    newTrades.forEach(trade => {
      trades.set(trade.id, trade);
    });
    
    res.json({
      message: 'Order placed successfully',
      orderId: order.id,
      trades: newTrades
    });
  }
});

// Cancel order
app.delete('/api/orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  
  // First, find the order in userOrders to get its details
  // Convert orderId to string for proper lookup since order IDs are floating-point
  const orderIdStr = orderId.toString();
  const order = Array.from(userOrders.values()).find(o => o.id.toString() === orderIdStr);
  
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  if (clobBinding) {
    // Use Rust CLOB to cancel order
    try {
      const clob = new clobBinding.CLOBBinding();
      
      // Cancel order in the specific market
      const marketId = order.marketId;
      const market = order.market;
      
      // For Rust CLOB, we need to cancel in the specific YES/NO market
      const fullMarketId = `${marketId}_${market}`;
      const result = clob.cancelOrder(fullMarketId, order.id);
      
      if (result) {
        // Remove from userOrders tracking
        userOrders.delete(order.id);
        res.json({ message: 'Order cancelled successfully' });
      } else {
        res.status(500).json({ error: 'Failed to cancel order in CLOB engine' });
      }
    } catch (error) {
      console.error('Error cancelling order in Rust CLOB:', error);
      res.status(500).json({ error: 'Failed to cancel order in CLOB engine' });
    }
  } else {
    // Fallback to JavaScript implementation
    const jsOrder = orders.get(orderId);
    if (!jsOrder) {
      return res.status(404).json({ error: 'Order not found in JavaScript fallback' });
    }
    
    // Remove from order book
    const marketData = markets.get(jsOrder.marketId);
    const orderBook = marketData[`${jsOrder.market.toLowerCase()}OrderBook`];
    
    if (jsOrder.side === 'Buy') {
      removeOrderFromBook(orderBook.bids, orderId);
    } else {
      removeOrderFromBook(orderBook.asks, orderId);
    }
    
    // Remove from orders map
    orders.delete(orderId);
    // Remove from userOrders tracking
    userOrders.delete(parseInt(orderId));
    
    res.json({ message: 'Order cancelled successfully' });
  }
});

// Get user orders
app.get('/api/users/:user/orders', (req, res) => {
  const { user } = req.params;
  
  if (clobBinding) {
    // Return tracked user orders from userOrders map
    const userOrdersList = Array.from(userOrders.values()).filter(o => o.user === user);
    res.json(userOrdersList);
  } else {
    // Fallback to JavaScript implementation
    const userOrdersList = Array.from(userOrders.values()).filter(o => o.user === user);
    res.json(userOrdersList);
  }
});

// Get recent trades
app.get('/api/trades', (req, res) => {
  const { marketId, market, limit = 100 } = req.query;
  
  if (clobBinding) {
    // Rust CLOB doesn't have trade history yet
    // Return empty array for now
    res.json([]);
  } else {
    // Fallback to JavaScript implementation
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
  }
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
  console.log(`CLOB Engine: ${clobBinding ? 'Rust' : 'JavaScript (Fallback)'}`);
});

module.exports = app;