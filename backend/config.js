require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3001,
  
  // Ethereum Configuration
  ethereum: {
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'http://localhost:8545',
    chainId: process.env.CHAIN_ID || 31337,
  },
  
  // Security
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-here',
    expiresIn: '24h',
  },
  
  // Database (for production)
  database: {
    url: process.env.DATABASE_URL,
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  
  // CLOB Configuration
  clob: {
    defaultMarketId: 'test_market',
    maxOrdersPerUser: 100,
    maxOrderQuantity: 1000000,
    pricePrecision: 6,
  }
}; 