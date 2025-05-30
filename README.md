# MiniBank


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

## 📦 技术点覆盖

| 功能 | Solidity 技术点 |
|------|------------------|
| 存款记录 | `mapping`, `payable`, `msg.sender` |
| 利息计算 | `block.timestamp`, `struct`, `math` |
| 提现功能 | `transfer`, `require`, `reentrancy` |
| 状态管理 | `modifiers`, `events`, `view`, `pure` |
| 安全性 | 防重入、权限控制、零地址检查等 |

---

## 🧰 Solidity 合约设计

### ✅ 1. 状态变量设计

```solidity
struct DepositInfo {
    uint256 balance;
    uint256 lastDepositTime;
}

mapping(address => DepositInfo) public deposits;
uint256 public interestRate = 5; // 年利率 5%，简化为每秒利息
```

---

### ✅ 2. 存款函数

```solidity
function deposit() external payable {
    require(msg.value > 0, "Must deposit ETH");

    DepositInfo storage user = deposits[msg.sender];

    // 计算上一次到现在的利息
    uint256 interest = calculateInterest(msg.sender);
    user.balance += interest;

    user.balance += msg.value;
    user.lastDepositTime = block.timestamp;

    emit Deposited(msg.sender, msg.value);
}
```

---

### ✅ 3. 取款函数

```solidity
function withdraw(uint256 amount) external {
    DepositInfo storage user = deposits[msg.sender];

    require(user.balance >= amount, "Insufficient balance");

    // 计算利息并更新余额
    uint256 interest = calculateInterest(msg.sender);
    user.balance += interest;

    user.balance -= amount;
    user.lastDepositTime = block.timestamp;

    payable(msg.sender).transfer(amount);

    emit Withdrawn(msg.sender, amount);
}
```

---

### ✅ 4. 利息计算函数

```solidity
function calculateInterest(address userAddr) public view returns (uint256) {
    DepositInfo storage user = deposits[userAddr];

    uint256 timeElapsed = block.timestamp - user.lastDepositTime;
    uint256 interest = (user.balance * interestRate * timeElapsed) / (100 * 365 days);

    return interest;
}
```

---

### ✅ 5. 查询余额函数

```solidity
function getMyBalance() external view returns (uint256) {
    uint256 base = deposits[msg.sender].balance;
    uint256 interest = calculateInterest(msg.sender);
    return base + interest;
}
```

---

### ✅ 6. 事件声明

```solidity
event Deposited(address indexed user, uint256 amount);
event Withdrawn(address indexed user, uint256 amount);
```

---

### ✅ 合约完整结构（简化版）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MiniBank {
    struct DepositInfo {
        uint256 balance;
        uint256 lastDepositTime;
    }

    mapping(address => DepositInfo) public deposits;
    uint256 public interestRate = 5;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    function deposit() external payable {
        require(msg.value > 0, "Must deposit ETH");

        DepositInfo storage user = deposits[msg.sender];

        uint256 interest = calculateInterest(msg.sender);
        user.balance += interest;

        user.balance += msg.value;
        user.lastDepositTime = block.timestamp;

        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        DepositInfo storage user = deposits[msg.sender];
        require(user.balance >= amount, "Insufficient balance");

        uint256 interest = calculateInterest(msg.sender);
        user.balance += interest;

        user.balance -= amount;
        user.lastDepositTime = block.timestamp;

        payable(msg.sender).transfer(amount);

        emit Withdrawn(msg.sender, amount);
    }

    function calculateInterest(address userAddr) public view returns (uint256) {
        DepositInfo storage user = deposits[userAddr];
        uint256 timeElapsed = block.timestamp - user.lastDepositTime;
        uint256 interest = (user.balance * interestRate * timeElapsed) / (100 * 365 days);
        return interest;
    }

    function getMyBalance() external view returns (uint256) {
        uint256 base = deposits[msg.sender].balance;
        uint256 interest = calculateInterest(msg.sender);
        return base + interest;
    }
}
```

---

## 🧪 项目测试建议（Hardhat + ethers.js）

- 测试存款功能是否记录正确
- 模拟时间推移，验证利息计算
- 测试取款时余额是否正确扣除
- 测试提现后无法再重复领取利息
- 测试用户只能操作自己的账户

---

## 💡 可以扩展的功能（进阶）

| 扩展功能 | 技术点 |
|----------|--------|
| 多种币种存款 | 接入 ERC20 |
| 固定存款计划 | 时间锁（TimeLock） |
| 管理员权限 | Ownable / AccessControl |
| 利息来源 | 合约收益、质押、外部收益等 |
| 存款 NFT 凭证 | ERC721 表示存款 |

---

## 🖥️ 前端页面功能建议（ethers.js）

- ✅ 显示当前连接的钱包地址
- ✅ 显示当前余额和累计利息
- ✅ 输入金额进行存款
- ✅ 输入金额进行取款
- ✅ 实时提示交易状态（等待中 / 成功 / 失败）

---

## ✅ 工具建议

| 工具 | 用处 |
|------|------|
| Hardhat | 合约开发与测试 |
| Ethers.js | 前端合约交互 |
| MetaMask | 钱包连接 |
| React | 前端 UI |
| Tailwind CSS | 快速布局样式 |
