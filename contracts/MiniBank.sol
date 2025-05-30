// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MiniBank - 一个用于学习的小型银行合约
 * @dev 实现了存款、取款和利息计算功能，包含安全性改进
 */
contract MiniBank {
    // ============ 状态变量 ============
    
    struct DepositInfo {
        uint256 balance;           // 用户余额
        uint256 lastDepositTime;   // 最后一次操作时间
        uint256 totalDeposited;    // 累计存款金额（用于统计）
        uint256 totalWithdrawn;    // 累计取款金额（用于统计）
    }

    mapping(address => DepositInfo) public deposits;
    
    uint256 public constant INTEREST_RATE = 5;           // 年利率 5%
    uint256 public constant RATE_PRECISION = 10000;     // 利率精度（避免小数）
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant MIN_DEPOSIT = 0.001 ether;  // 最小存款金额
    
    uint256 public totalSupply;      // 合约总存款
    uint256 public totalUsers;       // 总用户数
    
    // 重入保护
    bool private locked;
    
    // ============ 事件 ============
    
    event Deposited(address indexed user, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed user, uint256 amount, uint256 newBalance);
    event InterestAccrued(address indexed user, uint256 interestAmount);
    
    // ============ 修饰符 ============
    
    modifier nonReentrant() {
        require(!locked, "ReentrancyGuard: reentrant call");
        locked = true;
        _;
        locked = false;
    }
    
    modifier validAmount(uint256 amount) {
        require(amount > 0, "Amount must be greater than 0");
        _;
    }
    
    modifier hasDeposit() {
        require(deposits[msg.sender].balance > 0, "No deposit found");
        _;
    }
    
    // ============ 核心功能 ============
    
    /**
     * @dev 存款函数
     */
    function deposit() external payable nonReentrant validAmount(msg.value) {
        require(msg.value >= MIN_DEPOSIT, "Deposit too small");
        
        DepositInfo storage user = deposits[msg.sender];
        
        // 如果是新用户，增加用户计数
        if (user.balance == 0 && user.totalDeposited == 0) {
            totalUsers++;
        }
        
        // 计算并添加利息
        uint256 interest = _calculateInterest(msg.sender);
        if (interest > 0) {
            user.balance += interest;
            emit InterestAccrued(msg.sender, interest);
        }
        
        // 更新用户信息
        user.balance += msg.value;
        user.totalDeposited += msg.value;
        user.lastDepositTime = block.timestamp;
        
        // 更新合约总量
        totalSupply += msg.value;
        
        emit Deposited(msg.sender, msg.value, user.balance);
    }
    
    /**
     * @dev 取款函数
     */
    function withdraw(uint256 amount) external nonReentrant validAmount(amount) hasDeposit {
        DepositInfo storage user = deposits[msg.sender];
        
        // 计算包含利息的总余额
        uint256 interest = _calculateInterest(msg.sender);
        uint256 totalAvailable = user.balance + interest;
        
        require(totalAvailable >= amount, "Insufficient balance");
        require(address(this).balance >= amount, "Contract insufficient funds");
        
        // 先添加利息到余额
        if (interest > 0) {
            user.balance += interest;
            emit InterestAccrued(msg.sender, interest);
        }
        
        // 更新余额和时间
        user.balance -= amount;
        user.totalWithdrawn += amount;
        user.lastDepositTime = block.timestamp;
        
        // 更新合约总量
        totalSupply -= amount;
        
        // 执行转账（重入保护已在modifier中处理）
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawn(msg.sender, amount, user.balance);
    }
    
    /**
     * @dev 紧急取款 - 取出所有余额
     */
    function withdrawAll() external nonReentrant hasDeposit {
        uint256 totalBalance = getMyBalance();
        withdraw(totalBalance);
    }
    
    // ============ 查询功能 ============
    
    /**
     * @dev 获取用户当前总余额（包含利息）
     */
    function getMyBalance() public view returns (uint256) {
        uint256 base = deposits[msg.sender].balance;
        uint256 interest = _calculateInterest(msg.sender);
        return base + interest;
    }
    
    /**
     * @dev 获取用户详细信息
     */
    function getMyDepositInfo() external view returns (
        uint256 balance,
        uint256 pendingInterest,
        uint256 totalDeposited,
        uint256 totalWithdrawn,
        uint256 lastDepositTime
    ) {
        DepositInfo storage user = deposits[msg.sender];
        return (
            user.balance,
            _calculateInterest(msg.sender),
            user.totalDeposited,
            user.totalWithdrawn,
            user.lastDepositTime
        );
    }
    
    /**
     * @dev 获取合约统计信息
     */
    function getContractStats() external view returns (
        uint256 contractBalance,
        uint256 totalUsersCount,
        uint256 totalSupplyAmount
    ) {
        return (address(this).balance, totalUsers, totalSupply);
    }
    
    // ============ 内部函数 ============
    
    /**
     * @dev 计算用户利息（内部函数）
     */
    function _calculateInterest(address userAddr) internal view returns (uint256) {
        DepositInfo storage user = deposits[userAddr];
        
        if (user.balance == 0 || user.lastDepositTime == 0) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp - user.lastDepositTime;
        
        // 使用更精确的计算，避免除法精度损失
        // interest = balance * rate * time / (precision * seconds_per_year)
        uint256 interest = (user.balance * INTEREST_RATE * timeElapsed) / 
                          (RATE_PRECISION * SECONDS_PER_YEAR);
        
        return interest;
    }
    
    // ============ 公开查询函数 ============
    
    /**
     * @dev 计算指定地址的利息（公开函数）
     */
    function calculateInterest(address userAddr) external view returns (uint256) {
        return _calculateInterest(userAddr);
    }
    
    /**
     * @dev 获取利率信息
     */
    function getInterestRate() external pure returns (uint256 rate, uint256 precision) {
        return (INTEREST_RATE, RATE_PRECISION);
    }
} 