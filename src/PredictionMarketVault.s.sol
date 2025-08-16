// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


contract PredictionMarketVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20  public immutable collateral; 
    address public market;             

    // user accounting
    mapping(address => uint256) public free;           // free collateral balance
    mapping(address => uint256) public lockedShorts;   // per-trader collateral locked for shorts
    uint256 public totalLockedShorts;                  // aggregate locked

    event MarketSet(address indexed market);
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Credited(address indexed to, uint256 amount);
    event Debited(address indexed from, uint256 amount);
    event Payout(address indexed to, uint256 amount);

    modifier onlyMarket() {
        require(msg.sender == market, "not market");
        _;
    }

    constructor(address _collateral, address initialOwner) Ownable(initialOwner) {
        require(_collateral != address(0) && initialOwner != address(0), "zero addr");
        collateral = IERC20(_collateral);
    }

    function setMarket(address m) external onlyOwner {
        require(market == address(0) && m != address(0), "market set");
        market = m;
        emit MarketSet(m);
    }

    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        collateral.safeTransferFrom(msg.sender, address(this), amount);
        free[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        require(free[msg.sender] >= amount, "insufficient");
        free[msg.sender] -= amount;
        collateral.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // /// @notice Lock 1:1 collateral to back a newly minted complete set (short sell).
    // function lockForShort(address trader, uint256 qty) external onlyMarket {
    //     require(qty > 0, "qty=0");
    //     require(free[trader] >= qty, "free<qty");
    //     free[trader]        -= qty;
    //     lockedShorts[trader] += qty;
    //     totalLockedShorts   += qty;
    //     emit LockedForShort(trader, qty);
    // }

    // /// @notice Optional: unlock if a short is canceled/closed pre-settlement.
    // function unlockForShort(address trader, uint256 qty) external onlyMarket {
    //     require(qty > 0, "qty=0");
    //     require(lockedShorts[trader] >= qty, "locked<trader");
    //     lockedShorts[trader] -= qty;
    //     totalLockedShorts    -= qty;
    //     free[trader]         += qty;
    //     emit UnlockedForShort(trader, qty);
    // }

    /// @notice Payout winners 1:1 after the Market burns their winning claims.
    function payoutWinner(address to, uint256 amount) external onlyMarket nonReentrant {
        require(amount > 0, "amount=0");
        require(totalLockedShorts >= amount, "insolvent");
        totalLockedShorts -= amount;
        collateral.safeTransfer(to, amount);
        emit Payout(to, amount);
    }

    function credit(address to, uint256 amount) external onlyMarket {
        require(amount > 0, "amount=0");
        free[to] += amount;
        emit Credited(to, amount);
    }

    function debit(address from, uint256 amount) external onlyMarket {
        require(amount > 0, "amount=0");
        require(free[from] >= amount, "insufficient");
        free[from] -= amount;
        emit Debited(from, amount);
    }

    function lockedForShorts(address trader) external view returns (uint256) {
        return lockedShorts[trader];
    }
}