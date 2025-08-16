// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";


contract PredictionMarketVault is Ownable, ReentrancyGuard, ERC1155Holder {
    using SafeERC20 for IERC20;

    IERC20   public immutable collateral;   // e.g. USDC
    IERC1155 public claims;                 // set once; ERC-1155 (ClaimTokens)
    address  public market;                 // set once; the EtfPredictionMarket

    // --- accounting ---
    mapping(address => uint256) public balances;                  // user -> ERC-20 balance
    mapping(address => mapping(uint256 => uint256)) public claimBal; // user -> (claimId -> qty)

    event MarketSet(address indexed market);
    event ClaimsSet(address indexed claims);
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event ClaimsDeposited(address indexed user, uint256 indexed id, uint256 amount);
    event ClaimsWithdrawn(address indexed user, uint256 indexed id, uint256 amount);
    event ClaimsCredited(address indexed user, uint256 indexed id, uint256 amount);
    event ClaimsDebited(address indexed user, uint256 indexed id, uint256 amount);

    modifier onlyMarket() {
        require(msg.sender == market, "not market");
        _;
    }

    constructor(address _collateral, address initialOwner) Ownable(initialOwner) {
        require(_collateral != address(0) && initialOwner != address(0), "zero addr");
        collateral = IERC20(_collateral);
    }

    /// @notice One-time wiring from the factory.
    function setMarket(address m) external onlyOwner {
        require(market == address(0) && m != address(0), "market set");
        market = m;
        emit MarketSet(m);
    }

    /// @notice One-time wiring from the factory (or owner).
    function setClaims(address c) external onlyOwner {
        require(address(claims) == address(0) && c != address(0), "claims set");
        claims = IERC1155(c);
        emit ClaimsSet(c);
    }

    // ----------------- ERC-20 cash I/O -----------------

    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        collateral.safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        require(balances[msg.sender] >= amount, "insufficient");
        balances[msg.sender] -= amount;
        collateral.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // ----------------- ERC-1155 claims (custodial) -----------------

    /// @notice User moves claim tokens into the vault. Requires setApprovalForAll(vault, true).
    function depositClaims(uint256 id, uint256 amount) external nonReentrant {
        require(address(claims) != address(0), "claims unset");
        require(amount > 0, "amount=0");
        claims.safeTransferFrom(msg.sender, address(this), id, amount, "");
        claimBal[msg.sender][id] += amount;
        emit ClaimsDeposited(msg.sender, id, amount);
    }

    /// @notice User withdraws claim tokens out of the vault.
    function withdrawClaims(uint256 id, uint256 amount) external nonReentrant {
        require(address(claims) != address(0), "claims unset");
        require(amount > 0, "amount=0");
        require(claimBal[msg.sender][id] >= amount, "insufficient");
        claimBal[msg.sender][id] -= amount;
        // vault is the token holder; can transfer out without approval
        claims.safeTransferFrom(address(this), msg.sender, id, amount, "");
        emit ClaimsWithdrawn(msg.sender, id, amount);
    }

    /// @notice Market credits claims to a user (e.g., after a CLOB fill). Tokens must already be at the vault.
    function creditClaims(address user, uint256 id, uint256 amount) external onlyMarket {
        require(user != address(0) && amount > 0, "bad args");
        claimBal[user][id] += amount;
        emit ClaimsCredited(user, id, amount);
    }

    /// @notice Market debits claims from a user (e.g., transfer to another user via CLOB fill).
    function debitClaims(address user, uint256 id, uint256 amount) external onlyMarket {
        require(user != address(0) && amount > 0, "bad args");
        uint256 bal = claimBal[user][id];
        require(bal >= amount, "insufficient");
        unchecked { claimBal[user][id] = bal - amount; }
        emit ClaimsDebited(user, id, amount);
    }

    // -------------- views --------------

    function claimBalanceOf(address user, uint256 id) external view returns (uint256) {
        return claimBal[user][id];
    }

    function collateralBalanceOf(address user) external view returns (uint256) {
        return balances[user];
    }
}
