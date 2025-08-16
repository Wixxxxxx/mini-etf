# 🛡️ CLOB Trading System - Safety Guide

## ⚠️ **CRITICAL SAFETY WARNINGS**

**NEVER CONNECT A MAINNET WALLET WITH REAL FUNDS TO THIS SYSTEM!**

This is a **development and testing system** that should only be used with **testnet wallets** containing **fake/test tokens**.

---

## 🚨 **Why It's Unsafe to Connect Mainnet Wallets**

1. **Local Development Environment** - Running on localhost without production security
2. **No Smart Contract Integration** - Orders are stored in memory, not on blockchain
3. **Testing Purposes Only** - Designed for development, not real trading
4. **No Fund Protection** - No insurance or security measures for real assets

---

## ✅ **How to Test Safely**

### **1. Use Testnet Wallets Only**

**Recommended Testnets:**

- **Sepolia** (Ethereum) - Chain ID: `0xaa36a7`
- **Goerli** (Ethereum) - Chain ID: `0x5`
- **Mumbai** (Polygon) - Chain ID: `0x13881`

### **2. Get Testnet Tokens**

**Sepolia Faucet:** https://sepoliafaucet.com/
**Goerli Faucet:** https://goerlifaucet.com/
**Mumbai Faucet:** https://faucet.polygon.technology/

### **3. Create Testnet MetaMask Account**

1. Install MetaMask extension
2. Create new account or import existing
3. Switch to testnet network
4. Get testnet ETH from faucet
5. **Verify you're on testnet before connecting**

---

## 🔧 **Safety Features Built Into the System**

### **Automatic Network Detection**

- System automatically detects your current network
- Shows clear warnings for mainnet connections
- Blocks connections to unauthorized networks

### **Network Switching**

- Easy buttons to switch between testnets
- Automatic validation of network safety
- Real-time network change monitoring

### **Visual Warnings**

- ⚠️ Safety banner at top of application
- Network status indicators
- Clear warnings for unsafe networks

---

## 🧪 **Testing Scenarios**

### **Safe Testing (Testnet Only)**

✅ Connect MetaMask on Sepolia testnet  
✅ Place buy/sell orders with testnet ETH  
✅ Test order matching and execution  
✅ Switch between YES/NO markets  
✅ Test wallet disconnection

### **What NOT to Test**

❌ Never connect mainnet MetaMask  
❌ Never use wallets with real funds  
❌ Never attempt real transactions  
❌ Never use production networks

---

## 🚀 **Quick Start for Safe Testing**

### **Step 1: Prepare Testnet Wallet**

```bash
# 1. Install MetaMask
# 2. Create new account
# 3. Switch to Sepolia testnet
# 4. Get testnet ETH from faucet
```

### **Step 2: Start the System**

```bash
./start.sh
```

### **Step 3: Connect Safely**

1. Open http://localhost:3000
2. Verify you're on testnet (Sepolia/Goerli/Mumbai)
3. Click "Connect Wallet"
4. **Verify network is testnet before proceeding**

### **Step 4: Test Trading**

1. Switch between YES/NO market tabs
2. Place test orders with small quantities
3. Watch order matching in real-time
4. Test wallet disconnection

---

## 🔍 **How to Verify You're Safe**

### **Check Network Status**

- Look for testnet name (Sepolia, Goerli, Mumbai)
- Verify chain ID is in allowed list
- No warning messages displayed

### **Check Wallet Balance**

- Should show testnet ETH (not real ETH)
- Balance should be from faucet
- Network should be testnet

### **Check System Status**

- Backend shows "Rust CLOB engine"
- No error messages
- All endpoints responding

---

## 🆘 **Emergency Procedures**

### **If You Accidentally Connect Mainnet**

1. **IMMEDIATELY disconnect wallet**
2. **Close browser tab**
3. **Verify no transactions were sent**
4. **Check wallet balance**
5. **Contact support if funds were affected**

### **If System Shows Mainnet Warning**

1. **DO NOT proceed with connection**
2. **Switch to testnet in MetaMask**
3. **Refresh page**
4. **Verify testnet connection**

---

## 📋 **Safety Checklist**

Before connecting wallet:

- [ ] MetaMask is on testnet network
- [ ] Wallet has only testnet tokens
- [ ] No real funds in wallet
- [ ] System shows testnet validation
- [ ] Safety warnings are understood

After connecting:

- [ ] Network shows as testnet
- [ ] No mainnet warnings
- [ ] Balance shows testnet tokens
- [ ] All safety checks passed

---

## 🎯 **Configuration Options**

### **Force Testnet Only (Default)**

```javascript
// In frontend/src/config.js
SAFETY: {
  FORCE_TESTNET_ONLY: true,  // Blocks mainnet
  BLOCK_MAINNET: true,       // Additional protection
  SHOW_SAFETY_WARNINGS: true // Visual alerts
}
```

### **Allow Mainnet (NOT RECOMMENDED)**

```javascript
SAFETY: {
  FORCE_TESTNET_ONLY: false, // Allows mainnet
  BLOCK_MAINNET: false,      // Removes protection
  SHOW_SAFETY_WARNINGS: true // Keep warnings
}
```

---

## 📞 **Support & Questions**

**If you have safety concerns:**

1. **Stop using the system immediately**
2. **Disconnect wallet**
3. **Check for any unauthorized transactions**
4. **Contact development team**

**Remember:** When in doubt, **don't connect**. It's better to be safe than sorry!

---

## 🏆 **Best Practices Summary**

1. **Always use testnets for development**
2. **Never connect wallets with real funds**
3. **Verify network before connecting**
4. **Use separate testnet accounts**
5. **Regularly check network status**
6. **Understand the risks involved**
7. **Test with small amounts first**
8. **Keep mainnet wallets completely separate**

**Stay safe and happy testing! 🚀**
