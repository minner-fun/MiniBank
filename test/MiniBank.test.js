const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MiniBank", function () {
  let miniBank;
  let owner, user1, user2;
  
  // 常量
  const MIN_DEPOSIT = ethers.parseEther("0.001");
  const DEPOSIT_AMOUNT = ethers.parseEther("1.0");
  const LARGE_DEPOSIT = ethers.parseEther("10.0");

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const MiniBank = await ethers.getContractFactory("MiniBank");
    miniBank = await MiniBank.deploy();
    await miniBank.waitForDeployment();
  });

  describe("部署", function () {
    it("应该正确设置初始值", async function () {
      expect(await miniBank.INTEREST_RATE()).to.equal(5);
      expect(await miniBank.RATE_PRECISION()).to.equal(10000);
      expect(await miniBank.MIN_DEPOSIT()).to.equal(MIN_DEPOSIT);
      expect(await miniBank.totalUsers()).to.equal(0);
      expect(await miniBank.totalSupply()).to.equal(0);
    });
  });

  describe("存款功能", function () {
    it("应该允许用户存款", async function () {
      await expect(miniBank.connect(user1).deposit({ value: DEPOSIT_AMOUNT }))
        .to.emit(miniBank, "Deposited")
        .withArgs(user1.address, DEPOSIT_AMOUNT, DEPOSIT_AMOUNT);

      const balance = await miniBank.connect(user1).getMyBalance();
      expect(balance).to.equal(DEPOSIT_AMOUNT);
    });

    it("应该拒绝过小的存款", async function () {
      const tooSmall = ethers.parseEther("0.0001");
      await expect(
        miniBank.connect(user1).deposit({ value: tooSmall })
      ).to.be.revertedWith("Deposit too small");
    });

    it("应该拒绝零金额存款", async function () {
      await expect(
        miniBank.connect(user1).deposit({ value: 0 })
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("应该正确统计新用户", async function () {
      expect(await miniBank.totalUsers()).to.equal(0);
      
      await miniBank.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
      expect(await miniBank.totalUsers()).to.equal(1);
      
      await miniBank.connect(user2).deposit({ value: DEPOSIT_AMOUNT });
      expect(await miniBank.totalUsers()).to.equal(2);
      
      // 同一用户再次存款不应增加用户数
      await miniBank.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
      expect(await miniBank.totalUsers()).to.equal(2);
    });

    it("应该正确更新合约总存款", async function () {
      await miniBank.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
      await miniBank.connect(user2).deposit({ value: LARGE_DEPOSIT });
      
      const expectedTotal = DEPOSIT_AMOUNT + LARGE_DEPOSIT;
      expect(await miniBank.totalSupply()).to.equal(expectedTotal);
    });
  });

  describe("取款功能", function () {
    beforeEach(async function () {
      await miniBank.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
    });

    it("应该允许用户取款", async function () {
      const withdrawAmount = ethers.parseEther("0.5");
      const initialBalance = await ethers.provider.getBalance(user1.address);
      
      const tx = await miniBank.connect(user1).withdraw(withdrawAmount);
      await expect(tx)
        .to.emit(miniBank, "Withdrawn")
        .withArgs(user1.address, withdrawAmount, DEPOSIT_AMOUNT - withdrawAmount);

      const finalBalance = await ethers.provider.getBalance(user1.address);
      // 注意：需要考虑gas费用，所以余额变化应该小于但接近取款金额
      expect(finalBalance - initialBalance).to.be.closeTo(withdrawAmount, ethers.parseEther("0.01"));
    });

    it("应该拒绝余额不足的取款", async function () {
      const excessiveAmount = ethers.parseEther("2.0");
      await expect(
        miniBank.connect(user1).withdraw(excessiveAmount)
      ).to.be.revertedWith("Insufficient balance");
    });

    it("应该拒绝零金额取款", async function () {
      await expect(
        miniBank.connect(user1).withdraw(0)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("应该拒绝无存款用户取款", async function () {
      await expect(
        miniBank.connect(user2).withdraw(ethers.parseEther("0.1"))
      ).to.be.revertedWith("No deposit found");
    });

    it("withdrawAll应该取出所有余额", async function () {
      const tx = await miniBank.connect(user1).withdrawAll();
      await expect(tx)
        .to.emit(miniBank, "Withdrawn")
        .withArgs(user1.address, DEPOSIT_AMOUNT, 0);

      const balance = await miniBank.connect(user1).getMyBalance();
      expect(balance).to.equal(0);
    });
  });

  describe("利息计算", function () {
    beforeEach(async function () {
      await miniBank.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
    });

    it("应该在时间推移后计算利息", async function () {
      // 模拟时间推移：前进1年
      await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      const interest = await miniBank.calculateInterest(user1.address);
      const expectedInterest = (DEPOSIT_AMOUNT * 5n) / 10000n; // 5% 年利率
      
      expect(interest).to.be.closeTo(expectedInterest, ethers.parseEther("0.001"));
    });

    it("新用户应该没有利息", async function () {
      const interest = await miniBank.calculateInterest(user2.address);
      expect(interest).to.equal(0);
    });

    it("存款后立即查询利息应该为0", async function () {
      const interest = await miniBank.calculateInterest(user1.address);
      expect(interest).to.equal(0);
    });

    it("取款时应该自动添加利息", async function () {
      // 前进30天
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      const interestBefore = await miniBank.calculateInterest(user1.address);
      expect(interestBefore).to.be.gt(0);

      // 部分取款
      const withdrawAmount = ethers.parseEther("0.1");
      await expect(miniBank.connect(user1).withdraw(withdrawAmount))
        .to.emit(miniBank, "InterestAccrued")
        .withArgs(user1.address, interestBefore);

      // 取款后利息应该被添加到余额中
      const expectedBalance = DEPOSIT_AMOUNT + interestBefore - withdrawAmount;
      const actualBalance = await miniBank.connect(user1).getMyBalance();
      expect(actualBalance).to.be.closeTo(expectedBalance, ethers.parseEther("0.001"));
    });
  });

  describe("查询功能", function () {
    beforeEach(async function () {
      await miniBank.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
      await miniBank.connect(user2).deposit({ value: LARGE_DEPOSIT });
    });

    it("getMyDepositInfo应该返回正确信息", async function () {
      const [balance, pendingInterest, totalDeposited, totalWithdrawn, lastDepositTime] = 
        await miniBank.connect(user1).getMyDepositInfo();
      
      expect(balance).to.equal(DEPOSIT_AMOUNT);
      expect(pendingInterest).to.equal(0); // 刚存款，没有利息
      expect(totalDeposited).to.equal(DEPOSIT_AMOUNT);
      expect(totalWithdrawn).to.equal(0);
      expect(lastDepositTime).to.be.gt(0);
    });

    it("getContractStats应该返回正确统计", async function () {
      const [contractBalance, totalUsersCount, totalSupplyAmount] = 
        await miniBank.getContractStats();
      
      expect(contractBalance).to.equal(DEPOSIT_AMOUNT + LARGE_DEPOSIT);
      expect(totalUsersCount).to.equal(2);
      expect(totalSupplyAmount).to.equal(DEPOSIT_AMOUNT + LARGE_DEPOSIT);
    });

    it("getInterestRate应该返回利率信息", async function () {
      const [rate, precision] = await miniBank.getInterestRate();
      expect(rate).to.equal(5);
      expect(precision).to.equal(10000);
    });
  });

  describe("边界情况", function () {
    it("应该处理最小存款金额", async function () {
      await expect(miniBank.connect(user1).deposit({ value: MIN_DEPOSIT }))
        .to.emit(miniBank, "Deposited");
      
      const balance = await miniBank.connect(user1).getMyBalance();
      expect(balance).to.equal(MIN_DEPOSIT);
    });

    it("应该正确处理多次存款和取款", async function () {
      // 多次存款
      await miniBank.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
      await miniBank.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
      
      let balance = await miniBank.connect(user1).getMyBalance();
      expect(balance).to.equal(DEPOSIT_AMOUNT * 2n);
      
      // 部分取款
      await miniBank.connect(user1).withdraw(DEPOSIT_AMOUNT);
      balance = await miniBank.connect(user1).getMyBalance();
      expect(balance).to.equal(DEPOSIT_AMOUNT);
      
      // 再次存款
      await miniBank.connect(user1).deposit({ value: DEPOSIT_AMOUNT });
      balance = await miniBank.connect(user1).getMyBalance();
      expect(balance).to.equal(DEPOSIT_AMOUNT * 2n);
    });
  });
}); 