/* global artifacts */

const ethers = require("ethers");
const truffleAssert = require("truffle-assertions");
const TruffleContract = require("@truffle/contract");
const chai = require("chai");
const BN = require("bn.js");
const bnChai = require("bn-chai");

const { assert } = chai;
chai.use(bnChai(BN));

const WalletFactory = artifacts.require("WalletFactory");
const Proxy = artifacts.require("Proxy");
const BaseWallet = artifacts.require("BaseWallet");

const Registry = artifacts.require("ModuleRegistry");
const TransferStorage = artifacts.require("TransferStorage");
const GuardianStorage = artifacts.require("GuardianStorage");
const EchoooModule = artifacts.require("EchoooModule");
const DappRegistry = artifacts.require("DappRegistry");
const ERC165Tester = artifacts.require("TestContract");
const UniswapV2Router01 = artifacts.require("DummyUniV2Router");

const utils = require("../utils/utilities.js");

const ZERO_ADDRESS = ethers.constants.AddressZero;
const SECURITY_PERIOD = 2;
const SECURITY_WINDOW = 2;
const LOCK_PERIOD = 4;
const RECOVERY_PERIOD = 4;

const RelayManager = require("../utils/relay-manager");

contract("Static Calls", (accounts) => {
  let manager;

  const infrastructure = accounts[0];
  const owner = accounts[1];
  const guardian1 = accounts[2];
  const refundAddress = accounts[7];
  const relayer = accounts[9];

  const msg = "0x1234";
  const messageHash = web3.eth.accounts.hashMessage(msg);
  let signature;

  let registry;
  let transferStorage;
  let guardianStorage;
  let module;
  let factory;
  let wallet;

  let dappRegistry;

  before(async () => {
    registry = await Registry.new();
    guardianStorage = await GuardianStorage.new();
    transferStorage = await TransferStorage.new();
    dappRegistry = await DappRegistry.new(0);

    const uniswapRouter = await UniswapV2Router01.new();

    module = await EchoooModule.new(
      registry.address,
      guardianStorage.address,
      transferStorage.address,
      dappRegistry.address,
      uniswapRouter.address,
      SECURITY_PERIOD,
      SECURITY_WINDOW,
      RECOVERY_PERIOD,
      LOCK_PERIOD);

    await registry.registerModule(module.address, ethers.utils.formatBytes32String("EchoooModule"));
    await dappRegistry.addDapp(0, relayer, ZERO_ADDRESS);

    const walletImplementation = await BaseWallet.new();
    factory = await WalletFactory.new(
      walletImplementation.address,
      guardianStorage.address,
      refundAddress,
      registry.address);
    await factory.addManager(infrastructure);

    manager = new RelayManager(guardianStorage.address, ZERO_ADDRESS);
    signature = await utils.signMessage(msg, owner);
  });

  beforeEach(async () => {
    // create wallet
    const walletAddress = await utils.createWallet(factory.address, owner, [module.address], guardian1);
    wallet = await BaseWallet.at(walletAddress);
  });

  async function checkStaticCalls({ _wallet, _supportERC1155 }) {
    const staticCalls = [
      { method: "isValidSignature(bytes32,bytes)", params: [messageHash, signature] },
      { method: "onERC721Received(address,address,uint256,bytes)", params: [infrastructure, infrastructure, 0, "0x"] },
    ];
    if (_supportERC1155) {
      staticCalls.push(
        { method: "onERC1155Received(address,address,uint256,uint256,bytes)", params: [infrastructure, infrastructure, 0, 0, "0x"] },
        { method: "onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)", params: [infrastructure, infrastructure, [0], [0], "0x"] },
        { method: "supportsInterface(bytes4)", params: ["0x01ffc9a7"], result: "0x0000000000000000000000000000000000000000000000000000000000000001" },
        { method: "supportsInterface(bytes4)", params: ["0x4e2312e0"], result: "0x0000000000000000000000000000000000000000000000000000000000000001" },
        { method: "supportsInterface(bytes4)", params: ["0xffffffff"], result: "0x0000000000000000000000000000000000000000000000000000000000000000" },
      );
    }

    for (const { method, params, result } of staticCalls) {
      const methodSig = utils.sha3(method).slice(0, 10);
      const delegate = await _wallet.enabled(methodSig);
      assert.equal(delegate, module.address, "wallet.enabled() is not module");
      const output = await web3.eth.call({
        to: _wallet.address,
        data: utils.encodeFunctionCall(method, params),
      });
      const expectedOutput = (result === undefined) ? web3.utils.padRight(methodSig, 64) : result;
      assert.equal(output, expectedOutput, `unexpected static call return value for ${method}`);
    }
  }

  describe("default static calls", () => {
    it("should have all static calls enabled by default (echooo wallet)", async () => {
      await checkStaticCalls({ _wallet: wallet, _supportERC1155: true });
    });
  });

  describe("isValidSignature", () => {
    it("should revert isValidSignature static call for invalid signature", async () => {
      const walletAsModule = await EchoooModule.at(wallet.address);
      await truffleAssert.reverts(
        walletAsModule.isValidSignature(messageHash, `${signature}a1`), "TM: invalid signature length",
      );
    });

    it("should revert isValidSignature static call for invalid signer", async () => {
      const walletAsModule = await EchoooModule.at(wallet.address);
      const badSig = await utils.signMessage(messageHash, infrastructure);
      await truffleAssert.reverts(
        walletAsModule.isValidSignature(messageHash, badSig), "TM: Invalid signer",
      );
    });
  });

  // describe("ERC1155 activation", () => {
  //   it("requires less than 12000 gas to call supportsInterface()", async () => {
  //     // this call will fail if supportsInterface() consumes more than 12000 gas
  //     const txReceipt = await (await ERC165Tester.new()).testERC165Gas(wallet.address, "0x4e2312e0");
  //     console.log(`supportsInterface() costs less than ${txReceipt.logs[0].args._gas.toString()} gas`);
  //   });
  // });
});
