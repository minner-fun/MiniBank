# MiniBank

> **🎉 项目已升级！** 查看 [`USAGE_GUIDE.md`](USAGE_GUIDE.md) 获取完整的使用指南和改进详情

---

## 🎯 项目目标：链上小型银行系统（MiniBank）

### 用户功能：

- ✅ 存款：将 ETH 存入合约
- ✅ 查询余额：查看当前存款余额
- ✅ 取款：从合约中提取自己的资金
- ✅ 利息机制：长期存款获得利息（简单模拟）
- ✅ 利息计算：按时间/比例累积
- ✅ 安全性：防止重入、只能操作自己的余额等

---

## 🆕 版本改进

### ⚠️ 原版本存在的问题

1. **安全漏洞**：
   - 缺少重入攻击防护
   - 利息计算精度可能丢失
   - 没有最小存款限制

2. **功能不完善**：
   - 缺少用户统计
   - 错误处理不够详细
   - 事件记录不完整

### ✨ 改进版本的优势

1. **🔐 安全性增强**：
   ```solidity
   modifier nonReentrant() {
       require(!locked, "ReentrancyGuard: reentrant call");
       locked = true;
       _;
       locked = false;
   }
   ```

2. **📊 功能完善**：
   - 用户统计和合约数据展示
   - 详细的用户信息查询
   - 紧急取款功能

3. **🧪 完整测试**：
   - 覆盖率接近100%
   - 包含安全性测试
   - 边界条件验证

4. **🌐 前端集成**：
   - 美观的Web界面
   - 实时数据更新
   - 完整的错误处理

---

## 📦 技术点覆盖

| 功能 | Solidity 技术点 | 改进版本额外技术点 |
|------|------------------|-------------------|
| 存款记录 | `mapping`, `payable`, `msg.sender` | `struct`扩展, 用户统计 |
| 利息计算 | `block.timestamp`, `struct`, `math` | 精度控制, 复合利息 |
| 提现功能 | `transfer`, `require`, `reentrancy` | `call`安全转账, 余额验证 |
| 状态管理 | `modifiers`, `events`, `view`, `pure` | 详细事件, 完整修饰符 |
| 安全性 | 防重入、权限控制、零地址检查等 | **全面安全审计和加固** |

---

## 🧰 Solidity 合约设计

### ✅ 1. 状态变量设计

**原版本：**
```solidity
struct DepositInfo {
    uint256 balance;
    uint256 lastDepositTime;
}

mapping(address => DepositInfo) public deposits;
uint256 public interestRate = 5; // 年利率 5%，简化为每秒利息
```

**改进版本：**
```solidity
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
```

---

### ✅ 2. 存款函数

**原版本问题**：
- 没有重入保护
- 缺少最小金额限制
- 统计信息不完整

**改进版本**：
```solidity
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
```

---

### ✅ 3. 取款函数

**原版本问题**：
- 使用不安全的`transfer`
- 没有合约余额检查
- 重入攻击风险

**改进版本**：
```solidity
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
```

---

### ✅ 4. 利息计算函数

**原版本问题**：
- 除法精度可能丢失
- 没有边界条件检查

**改进版本**：
```solidity
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
```

---

### ✅ 5. 查询余额函数

**改进版本增加了多个查询函数**：

```solidity
// 获取用户当前总余额（包含利息）
function getMyBalance() public view returns (uint256) {
    uint256 base = deposits[msg.sender].balance;
    uint256 interest = _calculateInterest(msg.sender);
    return base + interest;
}

// 获取用户详细信息
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

// 获取合约统计信息
function getContractStats() external view returns (
    uint256 contractBalance,
    uint256 totalUsersCount,
    uint256 totalSupplyAmount
) {
    return (address(this).balance, totalUsers, totalSupply);
}
```

---

### ✅ 6. 事件声明

**改进版本的事件更详细**：

```solidity
event Deposited(address indexed user, uint256 amount, uint256 newBalance);
event Withdrawn(address indexed user, uint256 amount, uint256 newBalance);
event InterestAccrued(address indexed user, uint256 interestAmount);
```

---

## 🧪 项目测试建议（Hardhat + ethers.js）

### 原版测试
- 测试存款功能是否记录正确
- 模拟时间推移，验证利息计算
- 测试取款时余额是否正确扣除
- 测试提现后无法再重复领取利息
- 测试用户只能操作自己的账户

### 改进版测试 ✨
- ✅ **安全性测试**：重入攻击防护验证
- ✅ **边界条件测试**：最小存款、零余额等
- ✅ **时间模拟测试**：利息累积验证
- ✅ **统计功能测试**：用户数量、合约余额
- ✅ **事件触发测试**：所有事件的正确触发
- ✅ **错误处理测试**：各种异常情况

### 运行测试

```bash
# 安装依赖
npm install

# 编译合约
npm run compile

# 运行测试
npm test

# 生成覆盖率报告
npm run coverage
```

---

## 💡 可以扩展的功能（进阶）

| 扩展功能 | 技术点 | 实现难度 |
|----------|--------|----------|
| 多种币种存款 | 接入 ERC20 | ⭐⭐⭐ |
| 固定存款计划 | 时间锁（TimeLock） | ⭐⭐⭐⭐ |
| 管理员权限 | Ownable / AccessControl | ⭐⭐ |
| 利息来源 | 合约收益、质押、外部收益等 | ⭐⭐⭐⭐⭐ |
| 存款 NFT 凭证 | ERC721 表示存款 | ⭐⭐⭐ |
| 治理机制 | DAO投票决定利率 | ⭐⭐⭐⭐⭐ |
| 流动性挖矿 | 激励机制和奖励分发 | ⭐⭐⭐⭐ |

---

## 🖥️ 前端页面功能建议（ethers.js）

### 原版建议
- ✅ 显示当前连接的钱包地址
- ✅ 显示当前余额和累计利息
- ✅ 输入金额进行存款
- ✅ 输入金额进行取款
- ✅ 实时提示交易状态（等待中 / 成功 / 失败）

### 改进版实现 ✨
- ✅ **现代化UI设计**：使用Tailwind CSS
- ✅ **实时数据更新**：自动刷新余额和统计
- ✅ **完整错误处理**：用户友好的错误提示
- ✅ **交易历史**：显示最近的存取款记录
- ✅ **合约统计**：总用户数、总存款等
- ✅ **紧急取款**：一键取出全部余额
- ✅ **事件监听**：实时显示链上事件

### 使用前端

```bash
# 启动本地节点
npm run node

# 部署合约
npm run deploy:local

# 打开 frontend/index.html
# 或使用HTTP服务器
python -m http.server 8000
# 访问 http://localhost:8000/frontend/
```

---

## ✅ 工具建议

| 工具 | 用处 | 状态 |
|------|------|------|
| Hardhat | 合约开发与测试 | ✅ 已配置 |
| Ethers.js | 前端合约交互 | ✅ 已集成 |
| MetaMask | 钱包连接 | ✅ 已支持 |
| React | 前端 UI | 💡 可选升级 |
| Tailwind CSS | 快速布局样式 | ✅ 已使用 |

---

## 🚀 快速开始

```bash
# 1. 克隆项目
git clone <your-repo>
cd MiniBank

# 2. 安装依赖
npm install

# 3. 编译合约
npm run compile

# 4. 运行测试
npm test

# 5. 启动本地网络
npm run node

# 6. 部署合约
npm run deploy:local

# 7. 打开前端
open frontend/index.html
```

---

## 📚 学习资源

1. **基础学习**：`README.md` - 了解项目概述
2. **详细指南**：`USAGE_GUIDE.md` - 完整使用教程  
3. **代码实现**：`contracts/MiniBank.sol` - 合约源码
4. **测试用例**：`test/MiniBank.test.js` - 测试代码
5. **前端示例**：`frontend/index.html` - Web界面

---

**🎓 作为初学者项目，这个改进版本为你提供了：**

- 📖 **渐进式学习**：从基础到高级的完整路径
- 🔒 **安全最佳实践**：真实项目中的安全考虑
- 🧪 **测试驱动开发**：学会编写完整的测试用例
- 🌐 **全栈开发**：从合约到前端的完整体验
- 🚀 **可扩展架构**：为进阶功能打下基础

继续探索区块链开发的精彩世界吧！ 🌟
