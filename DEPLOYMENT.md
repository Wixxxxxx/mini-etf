# CLOB Trading System Deployment Guide

This guide will help you deploy the complete CLOB trading system with frontend, backend API, and Rust CLOB engine.

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js 16+** - [Download here](https://nodejs.org/)
- **Rust** - [Install here](https://rustup.rs/)
- **MetaMask** browser extension
- **Git** (for cloning the repository)

## Quick Start

### Option 1: Automated Startup (Recommended)

1. **Clone and navigate to the project:**

   ```bash
   git clone <your-repo-url>
   cd mini-etf
   ```

2. **Run the startup script:**

   ```bash
   ./start.sh
   ```

   This script will:

   - Check prerequisites
   - Install dependencies
   - Build the Rust backend
   - Start the backend API server
   - Start the frontend application
   - Open both services in your browser

### Option 2: Manual Setup

#### Step 1: Install Dependencies

```bash
# Frontend dependencies
npm install

# Backend dependencies
cd backend
npm install
cd ..

# Build Rust backend
cd clob
cargo build
cd ..
```

#### Step 2: Start Backend API Server

```bash
cd backend
npm start
```

The backend will start on `http://localhost:3001`

#### Step 3: Start Frontend Application

In a new terminal:

```bash
npm start
```

The frontend will start on `http://localhost:3000`

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Rust CLOB     │
│   (React)       │◄──►│   (Node.js)     │◄──►│   Engine        │
│   Port 3000     │    │   Port 3001     │    │   (Library)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```bash
# Backend Configuration
PORT=3001

# Ethereum Configuration
ETHEREUM_RPC_URL=http://localhost:8545
CHAIN_ID=31337

# Security
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=your-secret-key-here

# Logging
LOG_LEVEL=info
```

### Frontend Configuration

Create a `.env` file in the root directory:

```bash
REACT_APP_API_URL=http://localhost:3001/api
```

## API Endpoints

### Health Check

- `GET /health` - Service health status

### Markets

- `GET /api/markets` - List all markets
- `POST /api/markets` - Create a new market
- `GET /api/markets/:id/orderbook` - Get market order book

### Orders

- `POST /api/orders` - Place a new order
- `DELETE /api/orders/:id` - Cancel an order
- `GET /api/users/:user/orders` - Get user orders

### Trades

- `GET /api/trades` - Get recent trades
- `GET /api/arbitrage/:marketId` - Get arbitrage opportunities

## Testing

### Backend Tests

```bash
cd backend
npm test
```

### Frontend Tests

```bash
npm test
```

### Rust CLOB Tests

```bash
cd clob
cargo test
```

## Production Deployment

### Backend Deployment

1. **Set environment variables:**

   ```bash
   export NODE_ENV=production
   export PORT=3001
   export DATABASE_URL=your-database-url
   ```

2. **Use PM2 for process management:**
   ```bash
   npm install -g pm2
   pm2 start server.js --name "clob-backend"
   pm2 startup
   pm2 save
   ```

### Frontend Deployment

1. **Build for production:**

   ```bash
   npm run build
   ```

2. **Deploy to your hosting service:**
   - Netlify
   - Vercel
   - AWS S3 + CloudFront
   - Your own server

### Database Setup

For production, replace the in-memory storage with a proper database:

1. **PostgreSQL (Recommended):**

   ```bash
   # Install PostgreSQL
   sudo apt-get install postgresql postgresql-contrib

   # Create database
   createdb clob_trading

   # Set environment variable
   export DATABASE_URL=postgresql://user:password@localhost:5432/clob_trading
   ```

2. **Redis (for caching):**

   ```bash
   # Install Redis
   sudo apt-get install redis-server

   # Set environment variable
   export REDIS_URL=redis://localhost:6379
   ```

## Monitoring and Logging

### Logs

- Backend logs: `backend/logs/`
- Frontend logs: Browser console
- System logs: `/var/log/`

### Health Monitoring

- Health check endpoint: `http://localhost:3001/health`
- Set up monitoring with tools like:
  - Prometheus + Grafana
  - DataDog
  - New Relic

## Security Considerations

1. **HTTPS in Production:**

   ```bash
   # Use a reverse proxy like Nginx
   # Configure SSL certificates
   # Set up HSTS headers
   ```

2. **Rate Limiting:**

   ```bash
   # Install rate limiting middleware
   npm install express-rate-limit
   ```

3. **Input Validation:**

   - All API inputs are validated
   - SQL injection protection
   - XSS protection

4. **Authentication:**
   - JWT tokens for API access
   - MetaMask wallet integration
   - Session management

## Troubleshooting

### Common Issues

1. **Port already in use:**

   ```bash
   # Find process using port
   lsof -i :3001

   # Kill process
   kill -9 <PID>
   ```

2. **CORS errors:**

   - Check CORS_ORIGIN in backend config
   - Ensure frontend URL matches

3. **MetaMask connection issues:**

   - Check if MetaMask is installed
   - Ensure correct network is selected
   - Check browser console for errors

4. **Backend not starting:**
   - Check Node.js version (16+ required)
   - Verify all dependencies are installed
   - Check port availability

### Debug Mode

Enable debug logging:

```bash
# Backend
export LOG_LEVEL=debug
npm start

# Frontend
export REACT_APP_DEBUG=true
npm start
```

## Support

For issues and questions:

1. Check the logs for error messages
2. Review the troubleshooting section
3. Check GitHub issues
4. Contact the development team

## Updates and Maintenance

### Updating Dependencies

```bash
# Frontend
npm update

# Backend
cd backend && npm update

# Rust
cd clob && cargo update
```

### Database Migrations

When updating the database schema:

1. Backup current data
2. Run migration scripts
3. Verify data integrity
4. Update application version

---

**Happy Trading! 🚀**
