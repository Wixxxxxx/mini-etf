const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

class CLOBApi {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  // Helper method for making HTTP requests
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Market endpoints
  async getMarkets() {
    return this.request('/markets');
  }

  async createMarket(marketId) {
    return this.request('/markets', {
      method: 'POST',
      body: JSON.stringify({ marketId }),
    });
  }

  async getOrderBook(marketId, market) {
    return this.request(`/markets/${marketId}/orderbook?market=${market}`);
  }

  // Order endpoints
  async placeOrder(orderData) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async cancelOrder(orderId) {
    return this.request(`/orders/${orderId}`, {
      method: 'DELETE',
    });
  }

  async getUserOrders(user) {
    return this.request(`/users/${user}/orders`);
  }

  // Trade endpoints
  async getTrades(marketId, market, limit = 100) {
    const params = new URLSearchParams();
    if (marketId) params.append('marketId', marketId);
    if (market) params.append('market', market);
    if (limit) params.append('limit', limit);
    
    return this.request(`/trades?${params.toString()}`);
  }

  // Arbitrage endpoints
  async getArbitrageOpportunities(marketId) {
    return this.request(`/arbitrage/${marketId}`);
  }

  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl.replace('/api', '')}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

// Create and export a singleton instance
const clobApi = new CLOBApi();
export default clobApi; 