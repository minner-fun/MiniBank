const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 开始部署 MiniBank 合约...");

  // 获取部署者账户
  const [deployer] = await ethers.getSigners();
  console.log("📝 部署账户:", deployer.address);
  
  // 获取账户余额
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 账户余额:", ethers.formatEther(balance), "ETH");

  // 获取合约工厂
  const MiniBank = await ethers.getContractFactory("MiniBank");
  
  // 部署合约
  console.log("⏳ 正在部署合约...");
  const miniBank = await MiniBank.deploy();
  
  // 等待部署完成
  await miniBank.waitForDeployment();
  const contractAddress = await miniBank.getAddress();
  
  console.log("✅ MiniBank 合约部署成功!");
  console.log("📍 合约地址:", contractAddress);
  
  // 验证合约初始状态
  console.log("\n📊 合约初始状态:");
  console.log("- 利率:", await miniBank.INTEREST_RATE(), "%");
  console.log("- 最小存款:", ethers.formatEther(await miniBank.MIN_DEPOSIT()), "ETH");
  console.log("- 总用户数:", await miniBank.totalUsers());
  console.log("- 总存款:", ethers.formatEther(await miniBank.totalSupply()), "ETH");

  // 保存部署信息
  const deploymentInfo = {
    contractAddress: contractAddress,
    deployer: deployer.address,
    network: hardhat.network.name,
    blockNumber: await ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString()
  };
  
  console.log("\n📋 部署信息:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  
  return contractAddress;
}

// 如果直接运行此脚本，则执行main函数
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ 部署失败:", error);
      process.exit(1);
    });
}

module.exports = { main }; 