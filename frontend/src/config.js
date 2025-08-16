// Configuration for CLOB Trading System
export const CONFIG = {
  // Safety Settings
  SAFETY: {
    // Force testnet only (recommended for development)
    FORCE_TESTNET_ONLY: true,
    
    // Show safety warnings
    SHOW_SAFETY_WARNINGS: true,
    
    // Block mainnet connections
    BLOCK_MAINNET: true,
    
    // Allowed testnet chain IDs
    ALLOWED_TESTNETS: [
      '0x5',      // Goerli
      '0xaa36a7', // Sepolia
      '0x13881',  // Mumbai
      '0x1a4',    // Optimism Goerli
      '0x66eed'   // Arbitrum Goerli
    ]
  },
  
  // Network Configuration
  NETWORKS: {
    '0x1': {
      name: 'Ethereum Mainnet',
      isTestnet: false,
      rpcUrl: 'https://mainnet.infura.io/v3/',
      blockExplorer: 'https://etherscan.io',
      warning: '⚠️ MAINNET - REAL FUNDS AT RISK!'
    },
    '0x5': {
      name: 'Goerli Testnet',
      isTestnet: true,
      rpcUrl: 'https://goerli.infura.io/v3/',
      blockExplorer: 'https://goerli.etherscan.io',
      faucet: 'https://goerlifaucet.com/'
    },
    '0xaa36a7': {
      name: 'Sepolia Testnet',
      isTestnet: true,
      rpcUrl: 'https://sepolia.infura.io/v3/',
      blockExplorer: 'https://sepolia.etherscan.io',
      faucet: 'https://sepoliafaucet.com/'
    },
    '0x13881': {
      name: 'Mumbai Testnet',
      isTestnet: true,
      rpcUrl: 'https://polygon-mumbai.infura.io/v3/',
      blockExplorer: 'https://mumbai.polygonscan.com',
      faucet: 'https://faucet.polygon.technology/'
    }
  },
  
  // API Configuration
  API: {
    BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:3001',
    TIMEOUT: 10000
  },
  
  // UI Configuration
  UI: {
    REFRESH_INTERVAL: 5000, // 5 seconds
    MAX_ORDERS_DISPLAY: 50,
    PRICE_PRECISION: 4,
    QUANTITY_PRECISION: 2
  }
};

// Helper functions
export const isTestnet = (chainId) => {
  return CONFIG.SAFETY.ALLOWED_TESTNETS.includes(chainId);
};

export const getNetworkInfo = (chainId) => {
  return CONFIG.NETWORKS[chainId] || {
    name: `Unknown Network (${chainId})`,
    isTestnet: false,
    warning: '⚠️ UNKNOWN NETWORK - PROCEED WITH CAUTION!'
  };
};

export const isNetworkAllowed = (chainId) => {
  if (CONFIG.SAFETY.FORCE_TESTNET_ONLY) {
    return isTestnet(chainId);
  }
  return true;
}; 