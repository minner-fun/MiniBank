# 🏦 MiniBank 使用指南

> 一个为Solidity初学者设计的完整银行系统项目

## 🎯 项目简介

MiniBank是一个教学用的链上银行系统，实现了基本的存取款功能和利息计算。相比原版本，改进版本具有更强的安全性和更完善的功能。

## ⭐ 主要改进点

### 🔐 安全性增强

1. **防重入攻击** - 使用`nonReentrant`修饰符
2. **精确利息计算** - 避免除法精度损失
3. **最小存款限制** - 防止微量攻击
4. **完整的错误处理** - 详细的错误信息
5. **资金安全检查** - 确保合约有足够资金

### 📊 功能完善

1. **用户统计** - 总用户数和存款统计
2. **详细查询** - 完整的用户信息查询
3. **紧急取款** - 一键取出全部余额
4. **事件记录** - 完整的操作日志
5. **利息累积** - 独立的利息添加事件

## 🚀 快速开始

### 1. 环境设置

```bash
# 克隆项目
git clone <your-repo-url>
cd MiniBank

# 安装依赖
npm install

# 编译合约
npm run compile
```

### 2. 运行测试

```bash
# 运行所有测试
npm test

# 详细测试输出
npm run test:verbose

# 生成覆盖率报告
npm run coverage
```

### 3. 本地部署

```bash
# 启动本地网络（新终端窗口）
npm run node

# 部署到本地网络
npm run deploy:local
```

## 🧪 测试用例说明

我们的测试覆盖了以下场景：

### 基础功能测试
- ✅ 合约部署和初始化
- ✅ 存款功能（正常/异常情况）
- ✅ 取款功能（正常/异常情况）
- ✅ 利息计算（时间推移模拟）

### 安全性测试
- ✅ 防重入攻击验证
- ✅ 权限控制检查
- ✅ 边界条件处理

### 业务逻辑测试
- ✅ 用户统计准确性
- ✅ 资金流转正确性
- ✅ 事件触发验证

## 💰 合约功能详解

### 存款 (`deposit`)

```solidity
function deposit() external payable nonReentrant validAmount(msg.value)
```

**功能**：
- 接收ETH存款
- 自动计算并添加之前的利息
- 更新用户余额和统计信息
- 触发`Deposited`事件

**安全检查**：
- 存款金额必须 ≥ 0.001 ETH
- 防重入保护
- 金额验证

### 取款 (`withdraw`)

```solidity
function withdraw(uint256 amount) external nonReentrant validAmount(amount) hasDeposit
```

**功能**：
- 提取指定金额的ETH
- 自动计算并添加利息
- 更新余额和统计
- 安全转账到用户地址

**安全检查**：
- 余额充足验证
- 合约资金充足验证
- 只能操作自己的资金

### 紧急取款 (`withdrawAll`)

```solidity
function withdrawAll() external nonReentrant hasDeposit
```

**功能**：
- 一键取出所有余额（包含利息）
- 适用于紧急情况

### 利息计算 (`calculateInterest`)

```solidity
function calculateInterest(address userAddr) external view returns (uint256)
```

**计算公式**：
```
利息 = 本金 × 年利率 × 时间（秒） / (精度 × 一年秒数)
利息 = balance × 5 × timeElapsed / (10000 × 365 days)
```

**特点**：
- 按秒计算，精度高
- 使用固定点数运算，避免小数
- 复合利息模式

## 📊 查询接口

### 获取我的余额
```javascript
const balance = await miniBank.getMyBalance();
console.log(`当前余额: ${ethers.formatEther(balance)} ETH`);
```

### 获取详细信息
```javascript
const [balance, interest, deposited, withdrawn, lastTime] = 
  await miniBank.getMyDepositInfo();

console.log({
  balance: ethers.formatEther(balance),
  pendingInterest: ethers.formatEther(interest),
  totalDeposited: ethers.formatEther(deposited),
  totalWithdrawn: ethers.formatEther(withdrawn),
  lastDepositTime: new Date(lastTime * 1000)
});
```

### 获取合约统计
```javascript
const [contractBalance, totalUsers, totalSupply] = 
  await miniBank.getContractStats();

console.log({
  contractBalance: ethers.formatEther(contractBalance),
  totalUsers: totalUsers.toString(),
  totalSupply: ethers.formatEther(totalSupply)
});
```

## 🌐 前端集成示例

### 连接钱包
```javascript
// 使用ethers.js v6
import { ethers } from 'ethers';

async function connectWallet() {
  if (typeof window.ethereum !== 'undefined') {
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    return { provider, signer };
  }
  throw new Error('请安装MetaMask');
}
```

### 合约交互
```javascript
// 合约ABI和地址
const contractAddress = "0x..."; // 部署后的合约地址
const contractABI = [ /* 从artifacts/contracts/MiniBank.sol/MiniBank.json获取 */ ];

// 创建合约实例
const { provider, signer } = await connectWallet();
const miniBank = new ethers.Contract(contractAddress, contractABI, signer);

// 存款
async function deposit(amount) {
  const tx = await miniBank.deposit({ value: ethers.parseEther(amount) });
  await tx.wait();
  console.log('存款成功!');
}

// 取款
async function withdraw(amount) {
  const tx = await miniBank.withdraw(ethers.parseEther(amount));
  await tx.wait();
  console.log('取款成功!');
}

// 查询余额
async function getBalance() {
  const balance = await miniBank.getMyBalance();
  return ethers.formatEther(balance);
}
```

### 监听事件
```javascript
// 监听存款事件
miniBank.on("Deposited", (user, amount, newBalance) => {
  console.log(`用户 ${user} 存款 ${ethers.formatEther(amount)} ETH`);
  console.log(`新余额: ${ethers.formatEther(newBalance)} ETH`);
});

// 监听取款事件
miniBank.on("Withdrawn", (user, amount, newBalance) => {
  console.log(`用户 ${user} 取款 ${ethers.formatEther(amount)} ETH`);
  console.log(`剩余余额: ${ethers.formatEther(newBalance)} ETH`);
});

// 监听利息事件
miniBank.on("InterestAccrued", (user, interestAmount) => {
  console.log(`用户 ${user} 获得利息 ${ethers.formatEther(interestAmount)} ETH`);
});
```

## 🔧 开发技巧

### 1. 调试Gas消耗
```bash
# 生成gas报告
npx hardhat test --reporter hardhat-gas-reporter
```

### 2. 时间模拟测试
```javascript
// 在测试中模拟时间推移
await ethers.provider.send("evm_increaseTime", [86400]); // 前进1天
await ethers.provider.send("evm_mine"); // 挖新块
```

### 3. 事件过滤查询
```javascript
// 查询特定用户的存款历史
const filter = miniBank.filters.Deposited(userAddress);
const events = await miniBank.queryFilter(filter, fromBlock, toBlock);
```

## ⚠️ 注意事项

### 安全提醒
1. **测试环境使用** - 此合约仅供学习，不要在主网使用真实资金
2. **私钥安全** - 永远不要在代码中硬编码私钥
3. **Gas费用** - 注意测试时的Gas费用设置

### 常见问题
1. **利息为0** - 需要等待时间推移才会产生利息
2. **取款失败** - 检查余额是否足够，包括Gas费
3. **重入错误** - 合约已有防护，这是正常的安全机制

### 最佳实践
1. **测试驱动开发** - 先写测试，再实现功能
2. **错误处理** - 合理处理前端的错误情况
3. **用户体验** - 提供清晰的操作反馈

## 🚀 进阶扩展

准备好挑战更高级的功能了吗？

### 1. ERC20代币支持
- 添加多种代币的存取功能
- 实现代币兑换功能

### 2. 治理机制
- 允许用户投票决定利率
- 实现DAO治理模式

### 3. 流动性挖矿
- 添加流动性激励机制
- 实现挖矿奖励分发

### 4. 时间锁定
- 实现定期存款功能
- 锁定期内不能提取

### 5. NFT凭证
- 将存款记录铸造为NFT
- 实现存款凭证交易

---

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进这个项目！

### 提交规范
- Issue: 描述问题或功能建议
- PR: 包含测试用例和文档更新
- 代码: 遵循现有的代码风格

---

**🎉 恭喜！你已经掌握了一个完整的DeFi项目开发流程！**

继续学习，探索区块链的无限可能性！ 🚀 