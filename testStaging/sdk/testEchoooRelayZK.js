require("dotenv").config();

let zkProvider;
let ethProvider;
let ownerWallet;
let ethWallet;
let echoooInfraWallet;
let echoooManagerWallet;
let echoooRDWallet;
let guardianWallet;
let zkWallet;
let zkif;
let relayerif;
let echooo;
let echoooif;
let zkL1MainContract;
let zkContracts;
let UniswapV3_QuoterContract;
let UniswapV3_FactoryContract;
let UniswapV3_PoolContract;
let tokenIn;
let tokenIn_Contract;
let tokenOut;
let token0;
let token1;
let zeroForOne;
let pool_address
let REFUND_ADDRESS;
let RECIPIENT;

let l1_eoa_mn;
let l1safe_owner_mn;
let l1safe_address;
let l2zk_wallet_address;
let l2zk_pubkey;
let create2Data;
let prefix = "";
let default_log;

const names = {};
const symbols = {};
const decimals = {};
const signer_wallets = {};

const AWS = require('aws-sdk');
const kms = new AWS.KMS({
  //endpoint: 'kms.ap-southeast-1.amazonaws.com',
});
const { getEthAddressFromKMS, KMSSigner } = require('@rumblefishdev/eth-signer-kms');


const echooo_eth_contracts = "../..";
const echooo_trustlists = "../../../echooo_trustlists";

const ethers = require("ethers");
const fs = require("fs");
const utils = require("../utils/utilities.js");
const zksync = require("zksync");
const Echooo = require(`${echooo_eth_contracts}/artifacts/contracts/modules/EchoooModule.sol/EchoooModule.json`);
const IZKSync = require("zksync/abi/SyncMain.json");
const IERC20ABI = require("@openzeppelin/contracts/build/contracts/IERC20Metadata.json").abi;
const IERC20If = new ethers.utils.Interface(IERC20ABI);
const UniswapV3_FactoryABI = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json").abi;
const UniswapV3_FactoryIf = new ethers.utils.Interface(UniswapV3_FactoryABI);
const UniswapV3_QuoterABI = require("@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json").abi;
const UniswapV3_RouterABI = require("@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json").abi;
const UniswapV3_RouterIf = new ethers.utils.Interface(UniswapV3_RouterABI);
const UniswapV3_PoolABI = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json').abi;
const UniswapV3_PoolIf = new ethers.utils.Interface(UniswapV3_PoolABI);
const RelayerManager = require(`${echooo_eth_contracts}/artifacts/contracts/modules/RelayerManager.sol/RelayerManager.json`);
const BaseWallet = require(`${echooo_eth_contracts}/artifacts/contracts/wallet/BaseWallet.sol/BaseWallet.json`);
const ModuleRegistry = require(`${echooo_eth_contracts}/artifacts/contracts/infrastructure_0.5/ModuleRegistry.sol/ModuleRegistry.json`);
const ZERO_ADDRESS = ethers.constants.AddressZero;
let ERC20_ASSET_COIN = process.env.USDC_ERC20;  //if use zk, erc20 address == zk usdc erc20
let WETH_COIN = process.env.WETH_ERC20;

const initial_transfer_amount = "0.1";
const initial_transfer_erc20_amount = "1.0";
const deposit_amount = "0.0152";
const withdraw_amount = "0.00151";
const transfer_amount = "0.00152"
const lido_staking_amount = "0.00153";
const l1_transfer_eth_amount = "0.00513";
const l1_swap_amount = "0.002";
const uniswap_fee = 3000;
let useZk = true

const network = process.env.NETWORK;
const deployConfig = require(`${echooo_eth_contracts}/deploy/config/${network}.json`)
const echooo_module_address = deployConfig["EchoooModule"].address
//const echooo_module_address = Echooo.networks[process.env.CHAINID].address;

const TrustList = require(`${echooo_trustlists}/scripts/config/${network}.json`);
const lido_contract = TrustList.lido.contract;

function encodeTransaction(to, value, data){ return ({ to, value, data });}

function mylog() {
   arguments['0'] = prefix + arguments['0'];
   default_log.apply(this, arguments);
}

function getProvider() {
   return new ethers.providers.JsonRpcProvider(process.env.RPCURL)
}

function init_account_info() {
   console.log("load/init the account info!");

   if (fs.existsSync(`${__dirname}/${process.env.ACCOUNT_INFO_FILE}`)) {
      const account_info = require(`./${process.env.ACCOUNT_INFO_FILE}`);
      l1_eoa_mn = account_info.eth_eoa_mnemonic;
      l1safe_owner_mn = account_info.owner_mnemonic;
      l1safe_address = account_info.l1_safe;
      l2zk_wallet_address = account_info.l2_address;
      l2zk_pubkey = account_info.l2_pubkey;
      create2Data = {
         creatorAddress: account_info.creator,
         saltArg: account_info.salt_hash,
         codeHash: account_info.code_hash
      };
      //console.log("account info",account_info)
      console.log("Using accounts generated from account file");
   } else {
      l1safe_address = process.env.ETH_WALLET_ADDRESS;
      l2zk_wallet_address = process.env.ZK_WALLET_ADDRESS;
      create2Data = {
         creatorAddress: process.env.CREATE2_CREATOR,
         saltArg: process.env.CREATE2_SALT,
         codeHash: process.env.CREATE2_CODE_HASH
      };
      console.log("Using accounts generated from dotenv file");
   }
 
   console.log("L1 Echooo Safe address:", l1safe_address);
   console.log("L2 ZK Wallet address:", l2zk_wallet_address);
}

async function initZKWallet() {
   const syncSigner = await zksync.Signer.fromETHSignature(ownerWallet);
   //const create2Signer = new zksync.Create2WalletSigner(l2zk_pubkey, create2Data, ethProvider)
   //zkWallet = await zksync.Wallet.fromEthSigner(ownerEIP1271Wallet, zkProvider, syncSigner.signer, undefined, {
   //         verificationMethod: 'ERC-1271',
   //         isSignedMsgPrefixed: true
   //     });
   zkWallet = await zksync.Wallet.fromCreate2Data(syncSigner.signer, zkProvider, create2Data);
   console.log("", zkWallet);
   return;
   const onchainAuthTransaction = await zkWallet.onchainAuthSigningKey();
   await onchainAuthTransaction.wait();
   const changePubkey = await zkWallet.setSigningKey({
     feeToken: "ETH",
     ethAuthType: "ECDSA"
   });
   const receipt = await changePubkey.awaitReceipt();
   //console.log("", zkWallet);
   console.log("zkSync account address:", zkWallet.address());
}

// printing the ERC20 token allowance
async function printTokenAllowance(token, account, spender) {
   // Check allowance
   const call_data = {
      to: token,
      data: IERC20If.encodeFunctionData("allowance", [account, spender])
   };

   const allowance = IERC20If.decodeFunctionResult("allowance", await echoooRDWallet.call(call_data))[0];
   console.log("allowance is:", ethers.utils.formatUnits(allowance, decimals[token]));
}

// Submit relay transaction
async function submitRelayTx(wallets, safe_address, mc_tx_data, fee_data, gas_limit, refund_token) {
   const block = await ethProvider.getBlockNumber();
   const timestamp = new Date().getTime();
   const nounce = `0x${ethers.utils.hexZeroPad(ethers.utils.hexlify(block), 16)
      .slice(2)}${ethers.utils.hexZeroPad(ethers.utils.hexlify(timestamp), 16).slice(2)}`;
   const relay_extra_gas = 21000;
   const relay_call_gas_limit = gas_limit - relay_extra_gas;
   const msg_hash = utils.getMessageHash(echooo.address,
      0,
      mc_tx_data,
      Number(process.env.CHAINID),
      nounce,
      fee_data.gasPrice,
      relay_call_gas_limit,
      refund_token,
      REFUND_ADDRESS);
   const signatures = await Promise.all(
      wallets.map(async (wallet) => {
         const sig = await wallet.signMessage(ethers.utils.arrayify(msg_hash));
         return sig.slice(2);
     })
   );
   const msg_sig = `0x${signatures.join("")}`;

   return await echooo.execute(safe_address, mc_tx_data, nounce, msg_sig, fee_data.gasPrice,
      relay_call_gas_limit, refund_token, REFUND_ADDRESS, await utils.getFeeSettings(ethProvider, gas_limit, fee_data));
}

// test L1toL2 Deposit ETH
async function testDeposit(wait, use_relay = false) {
   let balance = await ethProvider.getBalance(l1safe_address);
   let tx;
   const gas_limit = 205607;
   const fee_data = await ethProvider.getFeeData();

   console.log(`testDeposit L1toL2 Deposit ETH use_relay=${use_relay} with refund token ${symbols[ERC20_REFUND_COIN.toLowerCase()]}`);
   prefix = "\t";
   console.log("Echooo L1 Safe ETH balance before deposit: ", ethers.utils.formatEther(balance));

   // encode data for multi call
   const tx_data = encodeTransaction(zkContracts.mainContract,
                 ethers.utils.parseEther(deposit_amount),
                 zkif.encodeFunctionData("depositETH", [l2zk_wallet_address]));

   if (use_relay) {
      // Issue relay call to deposit
      console.log("Issue relay call to deposit into the L2 wallet");
      const mc_tx_data = echoooif.encodeFunctionData("multiCall", [l1safe_address, [tx_data]]);
      tx = await submitRelayTx([ownerWallet], l1safe_address, mc_tx_data, fee_data, gas_limit, ERC20_REFUND_COIN);
   } else {
      // Issue multicall to deposit
      console.log("Issue multi call to deposit into the L2 wallet");
      tx = await echooo.multiCall(l1safe_address, [tx_data], await utils.getFeeSettings(ethProvider, gas_limit, fee_data));
   }

   const tx_receipt = await tx.wait();
   utils.printGasData(relayerif, tx_receipt, gas_limit, fee_data);
   const pri_id = await utils.getPriorityOpId(zkif, tx_receipt);

   console.log(`Depositing Priority OP id: ${pri_id}`);

   let pri_status = await zkProvider.getPriorityOpStatus(pri_id);
   console.log("Priority OP status: ", pri_status);

   // Wait for the L2 status to change
   if (wait)
      await utils.waitForL2Status((pri_id)=>zkProvider.getPriorityOpStatus(pri_id), pri_id, 'VERIFY');

   await printL2Balance("Deposit ");
   balance = await ethProvider.getBalance(l1safe_address);
   console.log("Echooo L1 Safe ETH balance after deposit: ", ethers.utils.formatEther(balance));
   prefix = "";
}

// test L1toL2 Deposit ERC20
async function testDepositERC20(wait, token = ERC20_ASSET_COIN, use_relay = false) {
   const gas_limit = 265000;
   const fee_data = await ethProvider.getFeeData();
   const tx_data =  [];
   let balance = await getERC20Balance(l1safe_address, token);

   console.log(`testDepositERC20 L1toL2 Deposit ERC20 token=${symbols[token]} use_relay=${use_relay} with refund token ${symbols[ERC20_REFUND_COIN.toLowerCase()]}`);
   prefix = "\t";

   console.log(`Echooo Safe L1 balance of ${symbols[token]} before deposit: `, ethers.utils.formatEther(balance));

   await printL2Balance("DepositERC20 Before ", l2zk_wallet_address, token);
   await printTokenAllowance(token, l1safe_address, zkContracts.mainContract);

   // For Deposit to work, we need to approve the allowance for ZKSync main contract
   tx_data.push(encodeTransaction(token,
               0,
               IERC20If.encodeFunctionData("approve", [zkContracts.mainContract, ethers.utils.parseUnits(deposit_amount, decimals[token])])));

   // encode data for ERC20 depositing call
   tx_data.push(encodeTransaction(zkContracts.mainContract,
               0,
               zkif.encodeFunctionData("depositERC20", [token, ethers.utils.parseUnits(deposit_amount, decimals[token]), l2zk_wallet_address])));

   if (use_relay) {
      // Issue multicall to deposit
      console.log("Issue relay to approve and deposit ERC20 into zksync contract");
      const mc_tx_data = echoooif.encodeFunctionData("multiCall", [l1safe_address, tx_data]);
      tx = await submitRelayTx([ownerWallet], l1safe_address, mc_tx_data, fee_data, gas_limit, ERC20_REFUND_COIN);
   } else {
      // Issue multicall to deposit
      console.log("Issue multicall to approve and deposit ERC20 into zksync contract");
      tx = await echooo.multiCall(l1safe_address, tx_data, await utils.getFeeSettings(ethProvider, gas_limit, fee_data));
   }
   const tx_receipt = await tx.wait();
   utils.printGasData(relayerif, tx_receipt, gas_limit, fee_data);
   const pri_id = await utils.getPriorityOpId(zkif, tx_receipt);

   console.log(`Depositing Priority OP id: ${pri_id}`);

   // Wait for the L2 status to change
   if (wait)
      await utils.waitForL2Status((pri_id)=>zkProvider.getPriorityOpStatus(pri_id), pri_id, 'VERIFY');

   await printTokenAllowance(token, l1safe_address, zkContracts.mainContract);

   await printL2Balance("DepositERC20 After ", l2zk_wallet_address, token);

   balance = await getERC20Balance(l1safe_address, token);
   console.log(`Echooo Safe L1 balance of ${symbols[token]} after deposit: `, ethers.utils.formatEther(balance));
   prefix = "";
}

// test Withdraw
async function testWithdraw(token = ZERO_ADDRESS, use_relay = false, fee_token = ZERO_ADDRESS) {
   const l1address = l1safe_address;
   //const l1address = process.env.ACCOUNT1;
   const token_symbol = symbols[token];
   const token_decimal = decimals[token];
   token = token.toLowerCase();
   fee_token = fee_token.toLowerCase();

   let balance;

   console.log(`testWithdraw L2toL1 Withdraw ETH/ERC20 token=${symbols[token]} use_relay=${use_relay} fee_token=${symbols[fee_token]}`);
   prefix = "\t";
   if (token === ZERO_ADDRESS)
      balance = await ethProvider.getBalance(l1address);
   else
      balance = await getERC20Balance(l1address, token);

   console.log(`Echooo account balance of ${token_symbol} before L2 withdraw: `, ethers.utils.formatEther(balance));

   balance = await zkL1MainContract.getPendingBalance(l1address, token);
   console.log("ZK L1 Pending balance before withdraw ", ethers.utils.formatUnits(balance, token_decimal));

   await printL2Balance("Withdraw ", l2zk_wallet_address, token);
   const batchBuilder = zkWallet.batchBuilder();
   batchBuilder.addWithdraw({ethAddress: l1address, token: token, amount: ethers.utils.parseUnits(withdraw_amount, token_decimal)});
   const {txs, sigs} = await batchBuilder.build(fee_token);
   const hashes = await zkProvider.submitTxsBatch(txs, sigs);

   // Wait for the receipt status of commit
   await utils.waitForL2Status((hash)=>zkProvider.getTxReceipt(hash), hashes[0], 'COMMIT');
   // Wait for the receipt status of verify
   await utils.waitForL2Status((hash)=>zkProvider.getTxReceipt(hash), hashes[0], 'VERIFY');

   balance = await zkL1MainContract.getPendingBalance(l1address, token);
   console.log("ZK L1 Pending balance after L2 withdraw", ethers.utils.formatUnits(balance, token_decimal));

   if (!balance.isZero()) {
      const fee_data = await ethProvider.getFeeData();
      const gas_limit = 200000;
      let tx;
      console.log("Withdrawing from L1 pending balance to Echooo contract");
      // encode data for multi call
      let data = encodeTransaction(zkContracts.mainContract,
                  0,
                  zkif.encodeFunctionData("withdrawPendingBalance",
                     [l1address, token, balance.toString()]));

      if (use_relay) {
         // Issue relay call to withdraw
         console.log("Issue relay call to withdraw from L1 pending balance into the Echooo wallet");
         const mc_tx_data = echoooif.encodeFunctionData("multiCall", [l1safe_address, [data]]);
         tx = await submitRelayTx([ownerWallet], l1safe_address, mc_tx_data, fee_data, gas_limit, ERC20_REFUND_COIN);
      } else {
         // Issue multicall to withdraw
         console.log("Issue multicall to withdraw from L1 pending balance into the Echooo wallet");
         tx = await echooo.multiCall(l1address, [data], await utils.getFeeSettings(ethProvider, gas_limit, fee_data));
      }
      const tx_receipt = await tx.wait();

      utils.printGasData(relayerif, tx_receipt, gas_limit, fee_data);

      balance = await zkL1MainContract.getPendingBalance(l1address, token);
      console.log("Pending balance after withdraw", ethers.utils.formatUnits(balance, token_decimal));
   }

   //check the echooo account balance
   if (token === ZERO_ADDRESS)
      balance = await ethProvider.getBalance(l1address);
   else
      balance = await getERC20Balance(l1address, token);
   console.log("Echooo account after L2/L1-Pending withdraw: ", ethers.utils.formatEther(balance));
   prefix = "";
}

// Printing the given account's L2 token balance
async function printL2Balance(prefix, l2_address = l2zk_wallet_address, token = ZERO_ADDRESS, ) {
   const account_state = await zkProvider.getState(l2_address);
   const token_symbol = await zkProvider.tokenSet.resolveTokenSymbol(token);
   let balance = account_state.committed.balances[token_symbol] || '0';
   console.log(prefix + `Committed ${symbols[token]} balance`, ethers.utils.formatUnits(balance, decimals[token]));
   balance = account_state.verified.balances[token_symbol] || '0';
   console.log(prefix + `Verified ${symbols[token]} balance`, ethers.utils.formatUnits(balance, decimals[token]));
}

// test L2 Transfer
async function testL2Transfer(token, fee_token = 'ETH') {
   const sender = l2zk_wallet_address;
   //const recipient_zk_wallet_address = `${network.toUpperCase()}_ZK_WALLET_ADDRESS`;
   //const receiver = process.env[recipient_zk_wallet_address];
   const receiver = l2zk_wallet_address;

   console.log(`testL2Transfer token='${token}' fee_token='${fee_token}' for gas, from '${sender}' to '${receiver}'`);
   prefix = "\t";

   await printL2Balance("Before L2Transfer Sender ", sender, token);
   await printL2Balance("Before L2Transfer Receiver ", receiver, token);

   const batchBuilder = zkWallet.batchBuilder();
   batchBuilder.addTransfer({to: receiver, token: token, amount: ethers.utils.parseUnits(transfer_amount, decimals[token.toLowerCase()])});
   const {txs, sigs} = await batchBuilder.build(fee_token);
   const hashes = await zkProvider.submitTxsBatch(txs, sigs);

   // Wait for the receipt status of commit
   await utils.waitForL2Status((hash)=> zkProvider.getTxReceipt(hash), hashes[0], 'COMMIT');
   // Wait for the receipt status of verify
   await utils.waitForL2Status((hash)=> zkProvider.getTxReceipt(hash), hashes[0], 'VERIFY');

   await printL2Balance("After L2Transfer Sender ", sender, token);
   await printL2Balance("After L2Transfer Receiver ", receiver, token);
   prefix = "";
}

// test L1Transfer of Ethers (note, the receiving account address must have been whitelisted already)
async function testL1TransferEth(recipient = REFUND_ADDRESS, amount = transfer_amount, use_relay = false) {
   const fee_data = await ethProvider.getFeeData();
   const gas_limit = 222000;
   let tx;
   let balance = await ethProvider.getBalance(l1safe_address);
   console.log(`testL1TransferEth reciever=${recipient}, amount=${amount}, use_relay=${use_relay} `);
   prefix = "\t";
   console.log(`The recipient ${recipient} is whitelisted: `, await echooo.isWhitelisted(l1safe_address, recipient));
   console.log("Echooo Safe balance before transferring: ", ethers.utils.formatEther(balance));
   //balance = await ethProvider.getBalance(process.env.ETH_WALLET_ADDRESS2);
   balance = await ethProvider.getBalance(recipient);
   console.log("Receiving address balance before transferring: ", ethers.utils.formatEther(balance));

   // encode data for multi call
   let data = encodeTransaction(ethers.utils.getAddress(recipient),
               ethers.utils.parseEther(amount).toString(),
               "0x"); // Transfer has no abi data to encode

   if (use_relay) {
      // Issue relay call to transfer
      console.log("Issue relaycall to transfer assets to a L1 address");
      const mc_tx_data = echoooif.encodeFunctionData("multiCall", [l1safe_address, [data]]);
      tx = await submitRelayTx([ownerWallet], l1safe_address, mc_tx_data, fee_data, gas_limit, ERC20_REFUND_COIN);
   } else {
      // Issue multicall to transfer
      console.log("Issue multicall to transfer assets to a L1 address");
      tx = await echooo.multiCall(l1safe_address, [data], await utils.getFeeSettings(ethProvider, gas_limit, fee_data));
   }

   const tx_receipt = await tx.wait();
   utils.printGasData(relayerif, tx_receipt, gas_limit, fee_data);

   balance = await ethProvider.getBalance(l1safe_address);
   console.log("Echooo Safe balance after transferring: ", ethers.utils.formatEther(balance));
   //balance = await ethProvider.getBalance(process.env.ETH_WALLET_ADDRESS2);
   balance = await ethProvider.getBalance(recipient);
   console.log("Receiving address balance after transferring: ", ethers.utils.formatEther(balance));
   prefix = "";
}

// Retrieve the token balance for a given account of ERC20 token and convert the balance to standard WEI (10**18) units
async function getERC20Balance(address, token = ERC20_ASSET_COIN) {
   const call_data = {
      to: token,
      data: IERC20If.encodeFunctionData("balanceOf", [address])
   };

   // Returnv value converts to decimal 18 (WEI), so we can use FromWei utility function
   let balance = IERC20If.decodeFunctionResult("balanceOf", await echoooRDWallet.call(call_data))[0];
   balance = ethers.utils.formatUnits(balance, decimals[token]);
   return ethers.utils.parseEther(balance);
}

// Call a given ERC20 coin's method
async function callERC20Interface(token, func) {
   const call_data = {
      to: token,
      data: IERC20If.encodeFunctionData(func, [])
   };

   return IERC20If.decodeFunctionResult(func, await echoooRDWallet.call(call_data));
}

// Acquire the given ERC20 token meta data
async function getERC20Meta(token = ERC20_ASSET_COIN) {
   names[token] = await callERC20Interface(token, "name");
   symbols[token] = await callERC20Interface(token, "symbol");
   decimals[token] = Number(await callERC20Interface(token, "decimals"));

   console.log(`ERC20 \"${names[token]}\" has symbol ${symbols[token]} of decimal ${decimals[token]}`);
}

// test L1Transfer of ERC20 (note, the receiving account address must have been whitelisted already)
async function testL1TransferERC20(token = ERC20_ASSET_COIN, use_relay = false) {
   const fee_data = await ethProvider.getFeeData();
   const gas_limit = 180000;
   let balance = await getERC20Balance(l1safe_address);
   let tx;
   const token_symbol = symbols[token];

   console.log(`testL1TransferERC20 reciever=${REFUND_ADDRESS}, token=${token_symbol}, amount=${transfer_amount}, use_relay=${use_relay} `);
   prefix = "\t";
   console.log(`Echooo Safe ${token_symbol} balance before transferring: `, ethers.utils.formatEther(balance));

   balance = await getERC20Balance(REFUND_ADDRESS);
   console.log(`Receiving address ${token_symbol} balance before transferring: `, ethers.utils.formatEther(balance));

   // encode data for multi call
   let data = encodeTransaction(token,
               0,
               IERC20If.encodeFunctionData("transfer", [REFUND_ADDRESS, ethers.utils.parseUnits(transfer_amount, decimals[token])]));

   if (use_relay) {
      // Issue relay call to transfer
      console.log("Issue relaycall to transfer ERC20 assets to a L1 address");
      const mc_tx_data = echoooif.encodeFunctionData("multiCall", [l1safe_address, [data]]);
      tx = await submitRelayTx([ownerWallet], l1safe_address, mc_tx_data, fee_data, gas_limit, ERC20_REFUND_COIN);
   } else {
      // Issue multicall to transfer
      console.log("Issue multicall to transfer ERC20 assets to a L1 address");
      tx = await echooo.multiCall(l1safe_address, [data], await utils.getFeeSettings(ethProvider, gas_limit, fee_data));
   }
   const tx_receipt = await tx.wait();
   utils.printGasData(relayerif, tx_receipt, gas_limit, fee_data);

   balance = await getERC20Balance(l1safe_address);
   console.log(`Echooo Safe ${token_symbol} balance after tranfer: `, ethers.utils.formatEther(balance));
   balance = await getERC20Balance(REFUND_ADDRESS);
   console.log(`Receiving address ${token_symbol} balance after deposit: `, ethers.utils.formatEther(balance));
   prefix = "";
}

// test L1 investment into Lido Staking
async function testL1LidoStaking(use_relay = false) {
   let balance = await getERC20Balance(l1safe_address, token = lido_contract);
   console.log(`testL1LidoStaking amount=${lido_staking_amount}, use_relay=${use_relay} `);
   prefix = "\t";
   console.log("Echooo Safe LIDO BETH token balance before investment:", ethers.utils.formatEther(balance));

   await testL1TransferEth(lido_contract, lido_staking_amount, use_relay);
   prefix = "\t";

   balance = await getERC20Balance(l1safe_address, token = lido_contract);
   console.log("Echooo Safe LIDO BETH token balance after investment:", ethers.utils.formatEther(balance));
   prefix = "";
}

// Check the funding wallet having sufficient balance for ERC20 coin
async function checkERC20Balance(token) {
   let balance = token == ethers.constants.AddressZero ?
      await ethProvider.getBalance(ethWallet.address) :
      await getERC20Balance(ethWallet.address, token);
   let min_amount = token == ethers.constants.AddressZero || token == WETH_COIN ?
      initial_transfer_amount : initial_transfer_erc20_amount;
   const min_balance = ethers.utils.parseUnits(min_amount, decimals[token]);
   const balance_amount = ethers.utils.formatUnits(balance, decimals[token]);
   if (balance.lt(min_balance)) {
      console.log(`ethWallet ${ethWallet.address} doesn't have sufficient balance (${balance_amount}) for token ${names[token]} ${token}`);
      return false;
   }

   return true;
}

// initial transfer to L1 wallet
async function initialTransfer() {
   const fee_data = await ethProvider.getFeeData();
   let gas_limit = 30000;
   let tx_receipt;

   console.log("Despositing initial assets into eth echooo wallet");
   prefix = "\t";

   // Check funding wallet balance before doing anything
   if (!await checkERC20Balance(ethers.constants.AddressZero) ||
       !await checkERC20Balance(ERC20_ASSET_COIN) ||
       !await checkERC20Balance(WETH_COIN)) {
      console.log("For testing purpose, there is no sufficient ERC20/ETH balance for the funding wallet");
      process.exit();
   }

   await InitialTransferERC20(ERC20_ASSET_COIN, initial_transfer_erc20_amount);
   await InitialTransferERC20(WETH_COIN, initial_transfer_amount);

   balance = await ethProvider.getBalance(l1safe_address);
   console.log("Initial ethers balance", ethers.utils.formatEther(balance));

   if (balance.lt(ethers.utils.parseEther(initial_transfer_amount))) {
      console.log(`Depositing ${initial_transfer_amount} into L1 Safe for testing!`);

      // Transfer ethers assets into echooo L1 wallet
      let tx_data = await utils.getFeeSettings(ethProvider, gas_limit);
      tx_data.to = l1safe_address;
      tx_data.value = ethers.utils.parseEther(initial_transfer_amount);

      let tx = await echoooRDWallet.sendTransaction(tx_data);

      console.log("Waiting for depositing into L1 wallet to be confirmed");
      tx_receipt = await tx.wait();
      utils.printGasData(relayerif, tx_receipt, gas_limit, fee_data);

      balance = await ethProvider.getBalance(l1safe_address);
      console.log("After depositing ethers balance", ethers.utils.formatEther(balance));
   } else {
      console.log("There are sufficient ETH in the wallet for the testing!");
   }

   prefix = "";
}

// Perform some initial depositing of asssets into our L1 safe for testing/refund payment
async function InitialTransferERC20(token, amount) {
   const gas_limit = 65000;
   const fee_data = await ethProvider.getFeeData();
   const tx_data = await utils.getFeeSettings(ethProvider, gas_limit, fee_data);
   const pre_prefix = prefix;

   // Transfer ERC20 assets into created L1 Safe
   console.log(`Transfer some ${names[token]} coins into created L1 Safe!`);
   prefix += "\t";

   balance = await getERC20Balance(ethWallet.address, token);
   console.log(`Funding wallet total balance of ${symbols[token]} is:`, ethers.utils.formatEther(balance));

   balance = await getERC20Balance(l1safe_address, token);
   console.log(`Initial ${symbols[token]} balance`, ethers.utils.formatEther(balance));

   if (balance.lt(ethers.utils.parseEther(amount))) {
      tx_data.to = token;
      tx_data.value = 0;
      tx_data.data = IERC20If.encodeFunctionData("transfer", [l1safe_address, ethers.utils.parseUnits(amount, decimals[token])]);

      const tx = await ethWallet.sendTransaction(tx_data);
      const tx_receipt = await tx.wait();
      utils.printGasData(relayerif, tx_receipt, gas_limit, fee_data);

      balance = await getERC20Balance(l1safe_address, token);
      console.log(`After transfering ${symbols[token]} balance`, ethers.utils.formatEther(balance));
   } else {
      console.log("There are sufficient ERC20 balance in the wallet!");
   }

   prefix = pre_prefix;
}

// Adding the specified address to L1 Safe whitelist
async function whitelist(safe_address, address, wait = false) {
   // Whitelist the target address
   const gas_limit = 200000;
   const tx_data = echoooif.encodeFunctionData("addToWhitelist", [safe_address, address]);
 
   const tx = await submitRelayTx([ownerWallet], safe_address, tx_data, await ethProvider.getFeeData(), gas_limit, ethers.constants.AddressZero);
   await tx.wait();

   if (!wait) return;

   const security_period = parseInt(process.env.SECURITY_PERIOD) + 30;
   console.log(`Whitelist request submitted, waiting for ${security_period} seconds!`);
   console.log(await new Promise(resolve => {
          setTimeout(() => resolve('Adding whitelist done!'), (security_period) * 1000)
        }));
}

// Check and change the owner of l1 safe if necessary
async function setupOwner(l1safe_address, newOwnerWallet, refund_token = ERC20_REFUND_COIN) {
   const fee_data = await ethProvider.getFeeData();
   const gas_limit = 180000;
   const token_symbol = symbols[refund_token];
   // Create BaseWallet contrac from proxy contract address and ABI interface
   const basewallet = new ethers.Contract(l1safe_address, BaseWallet.abi, ethWallet);
   let cur_owner_address = await basewallet.owner();

   console.log(`setupOwner from ${cur_owner_address} to ${newOwnerWallet.address} refund_token=${token_symbol}`);
   prefix = "\t";

   if (cur_owner_address.toLowerCase() != newOwnerWallet.address.toLowerCase()) {
      let tx;

      // Issue relay call to transfer
      console.log("Issue relaycall to change L1 Safe ownership");
      const transfer_owner_tx_data = echoooif.encodeFunctionData("transferOwnership", [l1safe_address, newOwnerWallet.address]);
      // Needs signer of guardian and owner
      tx = await submitRelayTx([ownerWallet, guardianWallet], basewallet.address, transfer_owner_tx_data, fee_data, gas_limit, refund_token);

      const tx_receipt = await tx.wait();
      utils.printGasData(relayerif, tx_receipt, gas_limit, fee_data);
      cur_owner_address = await basewallet.owner();

      ownerWallet = newOwnerWallet;
   }

   // ZKWallet
//   await initZKWallet();
// 
//   if (false) {
//      console.log("key set:", await zkWallet.isSigningKeySet());
//
//      //const onchainAuthTransaction = await zkWallet.onchainAuthSigningKey();
//      //await onchainAuthTransaction.wait();
//
//      const changePubkey = await zkWallet.setSigningKey({
//        feeToken: "ETH",
//        ethAuthType: "CREATE2"
//      });
//
//      const receipt = await changePubkey.awaitReceipt();
//      console.log("", receipt);
//
//      await changePubkey.awaitVerifyReceipt();
//
//      console.log("key set:", await zkWallet.isSigningKeySet());
//      //await receipt.wait();
//      process.exit();
//   }

   console.log(`After tx Current owner ${cur_owner_address}`);
   prefix = "";
}

async function setupKmsSignerWallet(kmsid, name) {
   const kmsSigner = new KMSSigner(ethProvider, kmsid);
   const address = await getEthAddressFromKMS({kmsInstance: kms, keyId: kmsid});

   signer_wallets[address.toLowerCase()] = kmsSigner;

   console.log(`${name} address: ${address}`);

   return kmsSigner;
}

async function setupKmsSignerWallets() {
   // Create ethereum signer wallets using kms
   echoooManagerWallet = await setupKmsSignerWallet(process.env.MANAGER_KMSID, "Echooo Manager");
   guardianWallet = await setupKmsSignerWallet(process.env.GUARDIAN_KMSID, "Echooo Guardian");
   echoooRDWallet = await setupKmsSignerWallet(process.env.RD_KMSID, "Echooo R&D");
   echoooInfraWallet = await setupKmsSignerWallet(process.env.INFRASTRUCTURE_KMSID, "Echooo Infrastructure");
}

// Check Echooo module authorization and L1 ownership, this should be running in the backend
async function checkL1SafeModuleAuth(echooo_add) {
   const base_wallet = new ethers.Contract(l1safe_address, BaseWallet.abi, echoooRDWallet);
   // Check to see if we need to authorise the module
   // If we want to use a new Echooo module without the whole deployment process, then we
   // have to ask already deployed module to register and authorize this new module.
   if (!(await base_wallet.authorised(echooo_add))) {
      console.log("New module to register!");
      const mr = new ethers.Contract(
         ModuleRegistry.networks[process.env.CHAINID].address, ModuleRegistry.abi, echoooInfraWallet);
      const echooo_org = new ethers.Contract(echooo_module_address, Echooo.abi, echoooRDWallet);
      let tx;
      // Check if this module has been registered
      if (!(await mr["isRegisteredModule(address)"](echooo_add))) {
         tx = await mr.registerModule(echooo_add,
            ethers.utils.formatBytes32String("EchoooModule_2"));
         await tx.wait();
      }
      tx = await echooo_org.addModule(l1safe_address, echooo_add);
      await tx.wait();
      console.log(`Adding new module ${echooo_add}`);
   }
}

// Prepare swapping token ERC20 contract
async function prepareTokens(_tokenIn, _tokenOut) {
   console.log(_tokenIn, _tokenOut);
   tokenIn_Contract = new ethers.Contract(_tokenIn, IERC20ABI, ethWallet);
   const TokenOut_Contract = new ethers.Contract(_tokenOut, IERC20ABI, ethWallet);
   tokenIn = {address: _tokenIn, contract: tokenIn_Contract, decimals: await tokenIn_Contract.decimals(), name: await tokenIn_Contract.name()};
   tokenOut = {address: _tokenOut, contract: TokenOut_Contract, decimals: await TokenOut_Contract.decimals(), name: await TokenOut_Contract.name()};
   pool_address = await UniswapV3_FactoryContract.getPool(tokenIn.address, tokenOut.address, uniswap_fee);

   // Adding white list for uniswap V3 pool so we can transfer crypto assets to it when swapping
   //if (!(await echooo.isWhitelisted(l1safe_address, pool_address))) {
   //   console.log("Adding the uniswap v3 pool to the whitelist!");
   //   await whitelist(l1safe_address, pool_address, true);
   //}
   console.log(`${_tokenIn} to ${_tokenOut} pool: ${pool_address}`);
}

// perform swapping
async function testUniswap(use_relay) {
   const tx_data = [];
   const fee_data = await ethProvider.getFeeData();
   const gas_limit = 385607;

   console.log(`Start swaping from ${tokenIn.name} to ${tokenOut.name}`);

   console.log("TokenIn amount:", l1_swap_amount);
   const amountOut = await UniswapV3_QuoterContract.callStatic.quoteExactInputSingle(tokenIn.address,
      tokenOut.address, uniswap_fee, ethers.utils.parseUnits(l1_swap_amount, tokenIn.decimals), 0);
   console.log("TokenOut amount:", ethers.utils.formatUnits(amountOut, tokenOut.decimals));

   tx_data.push(encodeTransaction(tokenIn.address,
      0,
      IERC20If.encodeFunctionData("approve", [process.env.UNISWAPV3_ROUTER, ethers.utils.parseUnits(l1_swap_amount, tokenIn.decimals)])));

   // Check to see if we have enough balance to do the swap
   const cur_balance = await tokenIn_Contract.balanceOf(l1safe_address);
   if (cur_balance.lt(ethers.utils.parseUnits(l1_swap_amount, tokenIn.decimals))) {
      const dep = ethers.utils.parseUnits(l1_swap_amount, tokenIn.decimals).sub(cur_balance);
      console.log("Not enough balance for swapping, deposit:", ethers.utils.formatUnits(dep, tokenIn.decimals));
      tx_data.push(encodeTransaction(tokenIn.address,
         dep,
         "0x"));  // Transfer has no abi data to encode
   }

   // Construct the swap data
   const params = {
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      fee: uniswap_fee,
      recipient: l1safe_address,
      deadline: Math.floor(Date.now() / 1000 + 1800),
      amountIn: ethers.utils.parseUnits(l1_swap_amount, tokenIn.decimals),
      amountOutMinimum: amountOut,
      sqrtPriceLimitX96: 0
   };
   const swap_data = UniswapV3_RouterIf.encodeFunctionData("exactInputSingle", [params]);
   tx_data.push(encodeTransaction(process.env.UNISWAPV3_ROUTER, 0, swap_data));
   if (use_relay) {
      // Issue relaycall to make a swap
      console.log("Issue relay to deposit, approve and make swap in L1");
      const mc_tx_data = echoooif.encodeFunctionData("multiCall", [l1safe_address, tx_data]);
      tx = await submitRelayTx([ownerWallet], l1safe_address, mc_tx_data, fee_data, gas_limit, ERC20_REFUND_COIN);
   } else {
      // Issue multicall to make a swap
      console.log("Issue multicall to approve and make swap in L1");
      tx = await echooo.multiCall(l1safe_address, tx_data, await utils.getFeeSettings(ethProvider, gas_limit, fee_data));
   }
   const tx_receipt = await tx.wait();
   utils.printGasData(relayerif, tx_receipt, gas_limit, fee_data);
   console.log("   Done swapping");
   console.log("TokenIn balance of", ethers.utils.formatUnits(await tokenIn.contract.balanceOf(l1safe_address), tokenIn.decimals));
   console.log("TokenOut balance of", ethers.utils.formatUnits(await tokenOut.contract.balanceOf(l1safe_address), tokenOut.decimals));
}

// Test owner ship transferring
async function testOwnershipTransferring(l1safe_address) {
   // Create a random EOA owner account
   const newOwnerWallet = ethers.Wallet.createRandom().connect(ethProvider);
   const curOwnerWallet = ownerWallet;

   console.log(`The random generated wallet private key is ${newOwnerWallet.privatekey}`);

   // Transfer to the random owner
   await setupOwner(l1safe_address, newOwnerWallet);
   // Transfer from random owner back to the original owner
   await setupOwner(l1safe_address, curOwnerWallet);
}

/* global artifacts */
async function main() {
   //TODO: refund erc20 token

   require('log-timestamp');
   // bytes4(keccak256("isValidSignature(bytes32,bytes)"));"
   default_log = console.log;
   console.log = mylog;

   // Init symbols
   names[ZERO_ADDRESS] = 'ETH';
   symbols[ZERO_ADDRESS] = 'ETH';
   decimals[ZERO_ADDRESS] = 18;

   // Load accounts info
   init_account_info();

   // L1 Eth provider
   ethProvider = getProvider();

   // L2 provider
   try {
      console.log("Acquire zk default provider");
      zkProvider = await zksync.getDefaultProvider(network, 'HTTP', 1000);
      console.log("zk default provider acquired!");
      console.log(zkProvider.tokenSet())

      const state = await zkProvider.getState(l2zk_wallet_address);

      console.log("L2 account info: ", state);
   } catch (e) {
      console.log("zk err:", e)
      useZk = false
   }
   useZk = false
   
 
   // Setup signer wallets
   await setupKmsSignerWallets();

   // Setup testing receipt and refund address
   REFUND_ADDRESS = await getEthAddressFromKMS({kmsInstance: kms, keyId: process.env.REFUND_KMSID});
   //RECIPIENT = await getEthAddressFromKMS({kmsInstance: kms, keyId: process.env.RECIPIENT_KMSID});
 
   // Setup the owner wallet
   ownerWallet = ethers.Wallet.fromMnemonic(l1safe_owner_mn).connect(ethProvider);
 
   console.log("L1Safe owner address:", ownerWallet.address);

   // Create Uniswap V3 Quoter contract
   // If this quote happens in the client side, use clients owner wallet
   // If this is in the service side, use the R&D kms wallet
   UniswapV3_QuoterContract = new ethers.Contract(process.env.UNISWAPV3_QUOTER, UniswapV3_QuoterABI, echoooRDWallet);
 
   // Create Uniswap V3 Factory contract
   UniswapV3_FactoryContract = new ethers.Contract(process.env.UNISWAPV3_FACTORY, UniswapV3_FactoryABI, echoooRDWallet);
 
   let balance = await ethProvider.getBalance(l1safe_address);
   console.log("Echooo L1 account ethers balance: ", ethers.utils.formatEther(balance));

   // Create echooo contract
   const echooo_add = echooo_module_address;

   // Check to see if needs to authorize the new Module
   ///await checkL1SafeModuleAuth(echooo_add);

   // Setup the Echooo Module interaction contract
   // For testing purpose, we use R&D kms wallet,
   // but in the real case, realyer KMS wallet should be used
   echooo = new ethers.Contract(echooo_add, Echooo.abi, echoooRDWallet);

   // Setup customer's payment account Wallet
   // We use Echooo's R&D wallet for this
   ethWallet = echoooRDWallet;

   // Create echooo module interface
   echoooif = new ethers.utils.Interface(Echooo.abi);

   // Create RelayerManager L1 contract ABI interface
   relayerif = new ethers.utils.Interface(RelayerManager.abi);

   // Query the ZKSync contract address from provider
   if (useZk) {
      zkContracts = (await zkProvider.getContractAddress());
      console.log("ZKSync Contracts: ", zkContracts);

      // Create ZKSync L1 contract ABI interface
      zkif = new ethers.utils.Interface(IZKSync.abi);

      ERC20_ASSET_COIN = zkProvider.tokenSet.tokensBySymbol.USDC.address;

      // Create ZKSync L1 contract, this depends on the owner signer/wallet setup, we should NOT directly
      // send any transaction from this contract
      zkL1MainContract = new ethers.Contract(zkContracts.mainContract, IZKSync.abi, ethWallet);
   
      // ZKWallet
      await initZKWallet();
   }

   // Set the ERC20 we will be using for assets
   ERC20_REFUND_COIN = ethers.constants.AddressZero;

   // Retrieve ERC20 coin meta data
   await getERC20Meta(ERC20_ASSET_COIN);
   await getERC20Meta(WETH_COIN);

   // Adding Router white list
   //await whitelist(l1safe_address, process.env.UNISWAPV3_ROUTER, true);

   // Adding white list for testing purpose so we can transfer crypto assets
   // if (!(await echooo.isWhitelisted(l1safe_address, RECIPIENT))) {
   //    console.log(`Adding the testing receipient ${RECIPIENT} to the whitelist!`);
   //    await whitelist(l1safe_address, RECIPIENT, true);
   // }
   
   // Prepare the swapping coins
   console.log("Before prepareTokens");
   await prepareTokens(WETH_COIN, ERC20_ASSET_COIN);
   console.log("After prepareTokens")
   // Perform tests
   
   await initialTransfer();

   // Test ownership transferring
   await testOwnershipTransferring(l1safe_address);

   if (useZk) {
      //await testDeposit(false, );
      await testDeposit(false, true);
      //await testDepositERC20(false, ERC20_ASSET_COIN);
      await testDepositERC20(true, ERC20_ASSET_COIN, true);
      //await testWithdraw(ZERO_ADDRESS, false); // ETH
      await testWithdraw(ZERO_ADDRESS, true); // ETH
      //await testWithdraw(ERC20_ASSET_COIN); // ERC20
      await testWithdraw(ERC20_ASSET_COIN, true); // ERC20
      //await testL2Transfer(ZERO_ADDRESS);
      await testL2Transfer(ERC20_ASSET_COIN);
   }
   
   //await testL1TransferEth();
   await testL1TransferEth(undefined, undefined, true);
   //await testL1TransferERC20();
   await testL1TransferERC20(undefined, true);
   //await testL1LidoStaking();
   await testL1LidoStaking(true);

   //await testUniswap(false);
   await testUniswap(true);

   balance = await ethProvider.getBalance(l1safe_address);
   console.log("Echooo L1 account ethers balance after: ", ethers.utils.formatEther(balance));
}

main();
