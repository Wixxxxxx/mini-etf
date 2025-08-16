# Mini ETF CLOB Trading System

A Central Limit Order Book (CLOB) trading system for binary markets with separate YES and NO order books.

## Project Structure

- `clob/` - Rust backend with the CLOB implementation
- `src/` - Solidity smart contracts
- `frontend/` - React-based trading interface with wallet integration
- `backend/` - Node.js API service

## Backend (Rust CLOB)

The Rust implementation provides:

- Separate order books for YES and NO markets
- Order matching engine
- Price-time priority matching
- Support for binary market arbitrage

### Running the Backend

```bash
cd clob
cargo test  # Run tests
cargo build # Build the library
```

## Frontend

A modern React-based trading interface with:

- MetaMask wallet integration
- Real-time order book display
- Order placement and cancellation
- Trade history
- Arbitrage opportunity monitoring

### Running the Frontend

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Start the development server:

```bash
npm start
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

4. Connect your MetaMask wallet to interact with the trading interface

## Backend API

A Node.js/Express API service that:

- Provides RESTful endpoints for the trading system
- Manages orders, markets, and trades
- Integrates with the Rust CLOB engine
- Handles wallet authentication and order validation

### Running the Backend API

1. Install dependencies:

```bash
cd backend
npm install
```

2. Start the API server:

```bash
npm start
```

The API will be available at `http://localhost:3001`

## Quick Start

Use the automated startup script:

```bash
./start.sh
```

This will start both the frontend and backend services automatically.

### Features

- **Wallet Integration**: Connect MetaMask or other Web3 wallets
- **Dual Markets**: Separate trading interfaces for YES and NO markets
- **Order Management**: Place, view, and cancel orders
- **Real-time Updates**: Live order book and trade updates
- **Arbitrage Monitoring**: Automatic detection of arbitrage opportunities
- **Responsive Design**: Works on desktop and mobile devices

### Trading Interface

The interface displays:

- **YES Market**: Buy and sell YES shares
- **NO Market**: Buy and sell NO shares
- **Order Books**: Real-time bid/ask prices and quantities
- **Recent Trades**: History of executed trades
- **Arbitrage Monitor**: YES + NO price relationship tracking

### Arbitrage

The system automatically monitors for arbitrage opportunities where:

- YES price + NO price < 1.0 (arbitrage opportunity)
- YES price + NO price = 1.0 (efficient pricing)
- YES price + NO price > 1.0 (inefficient pricing)

## Smart Contracts

The Solidity contracts provide:

- Market creation and management
- Order execution and settlement
- Collateral management
- Oracle price feeds

## Development

### Prerequisites

- Rust (for backend)
- Node.js 16+ (for frontend and API)
- MetaMask browser extension
- Foundry (for smart contract development)

### Testing

```bash
# Backend tests
cd clob && cargo test

# Frontend tests
cd frontend && npm test

# Backend API tests
cd backend && npm test

# Smart contract tests
forge test
```

## Architecture

The system uses a microservices architecture:

- **Frontend**: React SPA with Web3 integration
- **Backend API**: Node.js/Express service layer
- **Backend**: Rust CLOB engine
- **Smart Contracts**: Ethereum-based settlement layer
- **Order Books**: Separate YES/NO markets with price-time priority

This design ensures:

- High performance order matching
- Clear separation of concerns
- Scalable market structure
- Efficient arbitrage detection
