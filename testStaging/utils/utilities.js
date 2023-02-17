/* global artifacts */

const readline = require("readline");
const ethers = require("ethers");
const BN = require("bn.js");
const { assert, expect } = require("chai");

//const WalletFactory = artifacts.require("WalletFactory");

const ETH_TOKEN = ethers.constants.AddressZero;
const ZERO_ADDRESS = ethers.constants.AddressZero;
const ZERO_BYTES = "0x";

let global_sig_count = 0;
let sig_count = 0;

// Signal handling function
process.on('SIGINT', function() {
   console.log("Caught interrupt signal, continuously press Ctrl+C can exit process");
   setTimeout(()=>{sig_count = 0}, 1000);
   ++global_sig_count;
   if (++sig_count > 1)
      process.exit();
});

const utilities = {
  ETH_TOKEN,
  ZERO_ADDRESS,

  namehash: (name) => ethers.utils.namehash(name),

  sha3: (input) => {
    if (ethers.utils.isHexString(input)) {
      return ethers.utils.keccak256(input);
    }
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(input));
  },

  asciiToBytes32: (input) => ethers.utils.formatBytes32String(input), // return ethers.utils.hexlify(ethers.utils.toUtf8Bytes(input));

  numberToBytes32: (input) => `0x${new BN(input).toString(16, 64)}`,

  waitForUserInput: (text) => new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(text, (answer) => {
      resolve(answer);
      rl.close();
    });
  }),

  signOffchain: async (signers, from, value, data, chainId, nonce, gasPrice, gasLimit, refundToken, refundAddress) => {
    const messageHash = utilities.getMessageHash(from, value, data, chainId, nonce, gasPrice, gasLimit, refundToken, refundAddress);
    const signatures = await Promise.all(
      signers.map(async (signer) => {
        const sig = await utilities.signMessage(messageHash, signer);
        return sig.slice(2);
      })
    );
    const joinedSignatures = `0x${signatures.join("")}`;

    return joinedSignatures;
  },

  getMessageHash: (from, value, data, chainId, nonce, gasPrice, gasLimit, refundToken, refundAddress) => {
    const message = `0x${[
      "0x19",
      "0x00",
      from,
      ethers.utils.hexZeroPad(ethers.utils.hexlify(value), 32),
      data,
      ethers.utils.hexZeroPad(ethers.utils.hexlify(chainId), 32),
      nonce,
      ethers.utils.hexZeroPad(ethers.utils.hexlify(gasPrice), 32),
      ethers.utils.hexZeroPad(ethers.utils.hexlify(gasLimit), 32),
      refundToken,
      refundAddress,
    ].map((hex) => hex.slice(2)).join("")}`;

    const messageHash = ethers.utils.keccak256(message);
    return messageHash;
  },

  signMessage: async (message, signer) => {
    const sig = await web3.eth.sign(message, signer);
    let v = parseInt(sig.substring(130, 132), 16);
    if (v < 27) v += 27;
    const normalizedSig = `${sig.substring(0, 130)}${v.toString(16)}`;
    return normalizedSig;
  },

  personalSign: async (signHash, signer) => ethers.utils.joinSignature(signer.signingKey.signDigest(signHash)),

  sortWalletByAddress: (wallets) => wallets.sort((s1, s2) => {
    const bn1 = ethers.BigNumber.from(s1);
    const bn2 = ethers.BigNumber.from(s2);
    if (bn1.lt(bn2)) return -1;
    if (bn1.gt(bn2)) return 1;
    return 0;
  }),

  // Parses the RelayerModule.execute receipt to decompose the success value of the transaction
  // and additionally if an error was raised in the sub-call to optionally return that
  parseRelayReceipt: (txReceipt) => {
    const { args } = txReceipt.logs.find((e) => e.event === "TransactionExecuted");

    let errorBytes;
    let error;
    if (!args.success && args.returnData) {
      if (args.returnData.startsWith("0x08c379a0")) {
        // Remove the encoded error signatures 08c379a0
        const noErrorSelector = `0x${args.returnData.slice(10)}`;
        const errorBytesArray = ethers.utils.defaultAbiCoder.decode(["bytes"], noErrorSelector);
        errorBytes = errorBytesArray[0]; // eslint-disable-line prefer-destructuring
      } else {
        errorBytes = args.returnData; console.log(errorBytes);
      }
      error = ethers.utils.toUtf8String(errorBytes);
    }
    return { success: args.success, error };
  },

  hasEvent: async (txReceipt, emitter, eventName) => {
    const event = await utilities.getEvent(txReceipt, emitter, eventName);
    return expect(event, "Event does not exist in receipt").to.exist;
  },

  getEvent: async (txReceipt, emitter, eventName) => {
    const receipt = await web3.eth.getTransactionReceipt(txReceipt.transactionHash);
    const logs = await utilities.decodeLogs(receipt.logs, emitter, eventName);
    const event = logs.find((e) => e.event === eventName);
    return event;
  },

  // Copied from https://github.com/OpenZeppelin/openzeppelin-test-helpers
  // This decodes longs for a single event type, and returns a decoded object in
  // the same form truffle-contract uses on its receipts
  decodeLogs: (logs, emitter, eventName) => {
    let address;

    const { abi } = emitter;
    try {
      address = emitter.address;
    } catch (e) {
      address = null;
    }

    const eventABIs = abi.filter((x) => x.type === "event" && x.name === eventName);
    if (eventABIs.length === 0) {
      throw new Error(`No ABI entry for event '${eventName}'`);
    } else if (eventABIs.length > 1) {
      throw new Error(`Multiple ABI entries for event '${eventName}', only uniquely named events are supported`);
    }

    const [eventABI] = eventABIs;

    // The first topic will equal the hash of the event signature
    const eventSignature = `${eventName}(${eventABI.inputs.map((input) => input.type).join(",")})`;
    const eventTopic = web3.utils.sha3(eventSignature);

    // Only decode events of type 'EventName'
    return logs
      .filter((log) => log.topics.length > 0 && log.topics[0] === eventTopic && (!address || log.address === address))
      .map((log) => web3.eth.abi.decodeLog(eventABI.inputs, log.data, log.topics.slice(1)))
      .map((decoded) => ({ event: eventName, args: decoded }));
  },

  versionFingerprint: (modules) => {
    const concat = modules.map((module) => module.address).sort((m1, m2) => {
      const bn1 = ethers.BigNumber.from(m1);
      const bn2 = ethers.BigNumber.from(m2);
      if (bn1.lt(bn2)) {
        return 1;
      }
      if (bn1.gt(bn2)) {
        return -1;
      }
      return 0;
    }).reduce((prevValue, currentValue) => prevValue + currentValue.slice(2), "0x");
    return ethers.utils.keccak256(concat).slice(0, 10);
  },

  getRandomAddress: () => ethers.Wallet.createRandom().address,

  getBalance: async (account) => {
    const balance = await web3.eth.getBalance(account);
    return new BN(balance);
  },

  getTimestamp: async (blockNumber) => {
    const blockN = !blockNumber ? "latest" : blockNumber;
    const { timestamp } = await web3.eth.getBlock(blockN);
    return timestamp;
  },

  // TODO: The web3 version packaged with truffle is 1.2.1 while the getChainId logic
  // we need here was introduced in 1.2.2
  // Uncomment when https://github.com/trufflesuite/truffle/issues/2688#issuecomment-709879003 is resolved
  // NOTE: Although the above issue is resolve this is still blocking the truffle upgrade
  // https://github.com/trufflesuite/ganache-cli/issues/702#issuecomment-723816610
  // const chainId = await web3.eth.getChainId();
  // console.log("chainId", chainId)
  // return chainId;
  getChainId: async () => 1895,

  web3GetClient: async () => new Promise((resolve, reject) => {
    web3.eth.getNodeInfo((err, res) => {
      if (err !== null) return reject(err);
      return resolve(res);
    });
  }),

  increaseTime: async (seconds) => {
    const client = await utilities.web3GetClient();
    if (!client.includes("TestRPC")) {
      console.warning("Client is not ganache-cli and cannot forward time");
    } else {
      await utilities.evmIncreaseTime(seconds);
      await utilities.evmMine();
    }
  },

  evmIncreaseTime: (seconds) => new Promise((resolve, reject) => web3.currentProvider.send(
    {
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [seconds],
      id: 0,
    },
    (err, res) => (err ? reject(err) : resolve(res)))
  ),

  evmMine: () => new Promise((resolve, reject) => web3.currentProvider.send(
    {
      jsonrpc: "2.0",
      method: "evm_mine",
      params: [],
      id: 0,
    },
    (err, res) => (err ? reject(err) : resolve(res))
  )),

  getNonceForRelay: async () => {
    const block = await web3.eth.getBlockNumber();
    const timestamp = new Date().getTime();
    return `0x${ethers.utils.hexZeroPad(ethers.utils.hexlify(block), 16)
      .slice(2)}${ethers.utils.hexZeroPad(ethers.utils.hexlify(timestamp), 16).slice(2)}`;
  },

  getNamedAccounts: async (accounts) => {
    const addresses = accounts || await web3.eth.getAccounts();
    const [infrastructure, owner, guardian1, relayer, tokenHolder, refundAddress, ...freeAccounts] = addresses;
    return { infrastructure, owner, guardian1, relayer, tokenHolder, refundAddress, freeAccounts };
  },

  encodeFunctionCall: (method, params) => {
    if (typeof method === "object") return web3.eth.abi.encodeFunctionCall(method, params);
    if (typeof method === "string") {
      const paramStart = method.indexOf("(");
      const name = method.substring(0, paramStart);
      const inputs = method
        .substring(paramStart + 1, method.length - 1)
        .split(",")
        .map((type, idx) => ({ type, name: `arg${idx}` }));
      return web3.eth.abi.encodeFunctionCall({ name, inputs, type: "function" }, params);
    }
    throw new Error(`Invalid method "${method}"`);
  },

  encodeTransaction: (to, value, data) => ({ to, value, data }),

  /**
   * @param {Array<Transaction | [TruffleContract, string, any[], NumberLike?]} calls
   * @returns {Array<Transaction>}
   */
  encodeCalls: (calls) => calls.map((call) => {
    if (!Array.isArray(call)) {
      return call;
    }
    const [instance, method, params = [], value = 0] = call;
    const data = instance.contract.methods[method](...params).encodeABI();
    return utilities.encodeTransaction(instance.address, value, data);
  }),

  addTrustedContact: async (wallet, target, module, securityPeriod) => {
    const owner = await wallet.owner();
    await module.addToWhitelist(wallet.address, target, { from: owner });
    await utilities.increaseTime(securityPeriod + 2);
    const isTrusted = await module.isWhitelisted(wallet.address, target);
    assert.isTrue(isTrusted, "should be trusted after the security period");
  },

  // set the relayer nonce to > 0
  initNonce: async (wallet, module, manager, securityPeriod) => {
    const nonceInitialiser = (await utilities.getNamedAccounts()).freeAccounts.slice(-1)[0];
    await utilities.addTrustedContact(wallet, nonceInitialiser, module, securityPeriod);
    const owner = await wallet.owner();
    const transaction = utilities.encodeTransaction(nonceInitialiser, 1, ZERO_BYTES);
    await manager.relay(
      module,
      "multiCall",
      [wallet.address, [transaction]],
      wallet,
      [owner]);
    const nonce = await module.getNonce(wallet.address);
    assert.isTrue(nonce.gt(0), "nonce init failed");
  },

  assertFailedWithError: (txReceipt, msg) => {
    const { success, error } = utilities.parseRelayReceipt(txReceipt);
    assert.isFalse(success);
    assert.equal(error, msg);
  },

  generateSaltValue: () => ethers.utils.hexZeroPad(ethers.BigNumber.from(ethers.utils.randomBytes(20)).toHexString(), 20),

//  createWallet: async (factoryAddress, owner, modules, guardian, _salt = null) => {
//    const salt = _salt != null ? _salt : utilities.generateSaltValue();
//    const managerSig = "0x";
//    const factory = await WalletFactory.at(factoryAddress);
//
//    const tx = await factory.createCounterfactualWallet(
//      owner, modules, guardian, salt, 0, ethers.constants.AddressZero, ZERO_BYTES, managerSig);
//
//    const event = await utilities.getEvent(tx.receipt, factory, "WalletCreated");
//    return event.args.wallet;
//  },

  swapAndCheckBalances: async ({ swap, bought, sold, wallet }) => {
    const balanceOf = (token) => (token === ETH_TOKEN ? utilities.getBalance : token.balanceOf)(wallet.address);
    const getBalances = async () => [await balanceOf(sold), await balanceOf(bought)];

    const [soldBefore, boughtBefore] = await getBalances();
    const result = await swap();
    const [soldAfter, boughtAfter] = await getBalances();

    assert.isTrue(result.success, `swap failed: "${result.error}"`);
    expect(soldBefore.sub(soldAfter)).to.be.gt.BN(0);
    expect(boughtAfter.sub(boughtBefore)).to.be.gt.BN(0);

    return result;
  },

  usdcToWei: (amount) => new BN(amount).mul(new BN(1e6)).toString(),

  set_web3: (_web3) => {
     web3 = _web3;
  },

   // Implement a sleep function
   sleep: async(ms) => {
       return new Promise((resolve) => setTimeout(()=>{resolve(null);}, ms));
   },

   // Parse log
   decodeLogs: (logs, intf, eventName, address = null) => {
      const eventABI = intf.getEvent(eventName);

      // The first topic will equal the hash of the event signature
      const eventSignature = `${eventName}(${eventABI.inputs.map((input) => input.type).join(",")})`;
      const eventTopic = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(eventSignature));
      const [log] = logs.filter((log) => log.topics.length > 0 && log.topics[0] === eventTopic && (!address || log.address === address));

      return log;
   },

   // Retrieve the Priority op id
   getPriorityOpId: async(zkif, tx_receipt) => {
      // Waiting on the ProiorityOp event to come in and extract the serial id
      let tx_log = utilities.decodeLogs(tx_receipt.logs, zkif, "NewPriorityRequest");
      let tx_event = zkif.parseLog(tx_log);
      return tx_event.args.serialId.toNumber();
   },

   // Retrieve the relay execution status
   getRelayExecutionStatus: async(relayerif, tx_receipt) => {
      let tx_log = utilities.decodeLogs(tx_receipt.logs, relayerif, "TransactionExecuted");
      if (tx_log == null)
         return false;
      let tx_event = relayerif.parseLog(tx_log);
      console.log("Execution status:", tx_event.args.success);
      return tx_event.args.success;
   },

   // printing the transaction gas data
   printGasData: (relayerif, tx_receipt, gas_limit, fd) => {
      const gas_price = ethers.utils.formatUnits(fd.gasPrice, "gwei");
      const max_priority_perGas = ethers.utils.formatUnits(fd.maxPriorityFeePerGas, "gwei");
      const max_perGas = ethers.utils.formatUnits(fd.maxFeePerGas, "gwei");
      const effective_gas_price = ethers.utils.formatUnits(tx_receipt.effectiveGasPrice, "gwei");
      const gas_usage = tx_receipt.gasUsed;

      console.log("Transaction hash: ", tx_receipt.transactionHash);
      utilities.getRelayExecutionStatus(relayerif, tx_receipt);
      console.log(`Fee Data: gasPrice ${gas_price} maxPriorityFeePerGas ${max_priority_perGas} maxFeePerGas ${max_perGas}`);
      console.log(`TX: gas limit ${gas_limit} gas used ${gas_usage} (${(gas_usage / gas_limit * 100).toFixed(2)}% usage) effective gas price(gwei) ${effective_gas_price}`);

      // Waiting on the ProiorityOp event to come in and extract the serial id
      try {
         const tx_log = utilities.decodeLogs(tx_receipt.logs, relayerif, "Refund");
         if (tx_log == null)
            return;
         const tx_event = relayerif.parseLog(tx_log);
         const token = tx_event.args.refundToken.toLowerCase();
         const refund_token_gas = ethers.utils.formatUnits(tx_event.args.refundAmount, 18);
         console.log(`TX: Refund gas ${token} of ${refund_token_gas}(ethers)`);
      } catch (e) {
         console.log("error occured, bug ignored!", e);
         // Ignore the error
      }
   },

   // Get the fee setting according to EIP1559 status
   getFeeSettings: async(ethProvider, gas_limit, fee_data = null) => {
      fee_data = fee_data == null ? await ethProvider.getFeeData() : fee_data;
      const settings =
      {
         type: 2,
         gasPrice: (fee_data.maxFeePerGas == null ? fee_data.gasPrice : null),
         maxPriorityFeePerGas: fee_data.maxPriorityFeePerGas,
         maxFeePerGas: fee_data.maxFeePerGas,
         gasLimit: gas_limit
      };

      return settings;
   },

   // Waiting for the L2 OP status change
   waitForL2Status: async(l2StatusQuery, tx_id, op_status = 'COMMIT') => {
      let l2_status;
      let pre_status = null;
      let ms = op_status == 'COMMIT' ? 1000 * 60 * 1 : 1000 * 60 * 2; // Initiallly wait for 2 min for VERIFY and 1 min for COMMIT
      let step = op_status == 'COMMIT' ? 1000 * 20 : 1000 * 10; // reduce waiting time 10s every time for VERIFY and 20s for COMMIT
      const min_ms = 1000; // min polling time 1s
      const max_wait = op_status == 'COMMIT' ? 1000 * 60 * 5 : 1000 * 60 * 20; // max waiting time is 20min for VERIFY and 5min for COMMIT
      console.log(`Waiting L2 Op #${tx_id} to be ${op_status} status, max waiting time ${max_wait / 1000}s`);
      try {
         let wait = 0;
         while (true) {
            let pre_sig_count = global_sig_count;
            l2_status = await l2StatusQuery(tx_id);
            const notifyDone =
                op_status === 'COMMIT'
                    ? l2_status.block && l2_status.block.committed
                    : l2_status.block && l2_status.block.verified;

            // Execution failed
            if (l2_status.executed && l2_status.success == false) {
               console.log("Execution failed:", l2_status.failReason);
               break;
            } else if (pre_status == null ||
                pre_status.executed != l2_status.executed ||
                pre_status.committed != (l2_status.block == null ? false : l2_status.block.committed) ||
                pre_status.verified != (l2_status.block == null ? false : l2_status.block.verified))
               console.log("L2 OpStatus:\n", l2_status);
            else
               console.log("L2 OpStatus: unchanged! (press Ctrl+C once to break out wait in next timeout check!)");

            pre_status = {
               executed: l2_status.executed,
               committed: l2_status.block == null ? false : l2_status.block.committed,
               verified: l2_status.block == null ? false : l2_status.block.verified
            };

            if (notifyDone) {
               console.log(`L2 OpStatus after ${wait / 1000}s reach ${op_status} status!`);
               break;
            } else {
               await utilities.sleep(ms); // sleep for 5000 ms
            }

            wait += ms;

            // After max waiting time exit anyway
            if (wait > max_wait || pre_sig_count != global_sig_count) {
               console.log(`After waiting time of ${max_wait / (1000 * 60)}min, still not reaching status ${op_status}!`);
               break;
            }

            // Reduce waiting time
            ms = ms - step < min_ms ? min_ms : ms - step;
         }
      } catch (e) {
         console.log("While waiting for L2 op, error occurs!");
         console.log(e);
      }
   }
};

module.exports = utilities;
