require("dotenv").config();
let echooo;
let ownerWallet;
let factory;
let ethProvider;
let zkif;
let rdKMSSigner;
let managerKMSSigner;
let REFUND_ADDRESS;
let GUARDIAN_ADDRESS;
let gas_cost;

const AWS = require('aws-sdk');
const kms = new AWS.KMS({
  //endpoint: 'kms.ap-southeast-1.amazonaws.com',
});
const { getEthAddressFromKMS, KMSSigner } = require('@rumblefishdev/eth-signer-kms');

const echooo_eth_contracts = "../..";
const ethers = require("ethers");
const web3 = require("web3");
const assert = require("assert");
const fs = require("fs");
const zksync = require("zksync");
const utils = require("../utils/utilities.js");
const Echooo = require(`${echooo_eth_contracts}/artifacts/contracts/modules/EchoooModule.sol/EchoooModule.json`);
const EchoooIf = new ethers.utils.Interface(Echooo.abi);
const SafeFactory = require(`${echooo_eth_contracts}/artifacts/contracts/infrastructure/WalletFactory.sol/WalletFactory.json`);
const BaseSafe = require(`${echooo_eth_contracts}/artifacts/contracts/wallet/BaseWallet.sol/BaseWallet.json`);
const RelayerManager = require(`${echooo_eth_contracts}/artifacts/contracts/modules/RelayerManager.sol/RelayerManager.json`);
const relayerif = new ethers.utils.Interface(RelayerManager.abi);
const Proxy = require(`${echooo_eth_contracts}/artifacts/contracts/wallet/Proxy.sol/Proxy.json`);
const IZKSync = require("zksync/abi/SyncMain.json");
const ZERO_ADDRESS = ethers.constants.AddressZero;

const network = process.env.NETWORK;
const deployConfig = require(`${echooo_eth_contracts}/deploy/config/${network}.json`)
const echooo_module_address = deployConfig["EchoooModule"].address 
const echooo_factory_address = deployConfig["WalletFactory"].address 
const echooo_base_wallet_address = deployConfig["BaseWallet"].address 

const l1_fund_amount = "0.005";
const l2_deposit = "0.00095";

let useZk = true;

function encodeTransaction(to, value, data){ return ({ to, value, data });}

function getProvider() {
   return new ethers.providers.JsonRpcProvider(process.env.RPCURL)
}

// Parse log
function decodeLogs(logs, abi, eventName) {
   let address = null;

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
   const [log] = logs.filter((log) => log.topics.length > 0 && log.topics[0] === eventTopic && (!address || log.address === address));

   return log;
}

// Utility function to generate 20bytes salt
function randomSalt(){
   const random = ethers.utils.randomBytes(20);
   return ethers.utils.hexZeroPad(ethers.BigNumber.from(random).toHexString(), 20);
}

// Adding the specified address to L1 Safe whitelist
async function whitelist(l1safe_info, address, wait = false) {
   // Whitelist the zksync
   const gas_limit = 200000;
   //const tx = await echooo.addToWhitelist(l1safe_info.address, address, {gasLimit: gas_limit});
   const tx_data = EchoooIf.encodeFunctionData("addToWhitelist", [l1safe_info.l1_safe, address]);
   const tx = await submitRelayTx([ownerWallet], l1safe_info.l1_safe, tx_data, await ethProvider.getFeeData(), gas_limit, ethers.constants.AddressZero);
   await tx.wait();

   if (!wait) return;

   const security_period = parseInt(process.env.SECURITY_PERIOD) + 30;
   console.log(`Whitelist request submitted, waiting for ${security_period} seconds!`);
   console.log(await new Promise(resolve => {
          setTimeout(() => resolve('Adding whitelist done!'), (security_period) * 1000)
        }));
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
      relay_call_gas_limit, refund_token, REFUND_ADDRESS);
}

// Utility function to precompute the L1 Safe address
async function getL1SafeAddress(_owner, _modules, _guardian, _salt) {
   // Generate CREATE2 DAT for ZKSync wallet creation from Echooo wallet creation solidity code
   const cat = web3.utils.encodePacked(
      {v:  _owner.address, t: 'address'},
      {v: _guardian, t: 'address'});
   const cat_hash = web3.utils.keccak256(cat);
   const cat_hash_cat_salt = web3.utils.encodePacked(cat_hash, _salt);
   const _salt_hash = await web3.utils.keccak256(cat_hash_cat_salt);
   const _code_hash = await web3.utils.keccak256(
      web3.utils.encodePacked(Proxy.bytecode, ethers.utils.hexZeroPad(ethers.BigNumber.from(echooo_base_wallet_address).toHexString(), 32)));

   // We need to calculate the address here to make sure we will be getting the same address back
   let calculate_address = await web3.utils.encodePacked(
      {v: "0xff", t: 'bytes1'},
      {v: echooo_factory_address, t: 'address'},
      {v: _salt_hash, t: 'bytes32'},
      {v: _code_hash, t: 'bytes32'});
   calculate_address = await web3.utils.keccak256(calculate_address);
   calculate_address = await web3.utils.toChecksumAddress("0x" + calculate_address.slice(26));
   console.log(`Caculated address ${calculate_address}`);

   let safe_info = {
      owner_mnemonic: _owner._mnemonic().phrase,      // The customer's VIP owner eoa
      org_salt: _salt,                                // The original salt used for VIP creation
      modules: _modules,                              // The modudles (EchoooModule)
      base_safe: echooo_base_wallet_address,          // Base wallet address (BaseWallet)
      guardian: _guardian,                            // Guardians
      creator: echooo_factory_address,                // VIP safe creator address (WalletFactory)
      salt_hash: _salt_hash,                          // The hash of the original salt
      code_hash: _code_hash,                          // Code hash of Proxy Wallet
      l1_safe: calculate_address,                     // The created L1 safe
      owner: _owner.address,                          // The owner public address
   };

   console.log(safe_info);

   return safe_info;
}

// Create a Echooo Safe and return Safe contract address
async function createL1Safe(owner, modules, guardian){
   const salt = randomSalt();
   //const salt = "0x81fe39e46bb81ca2c941c4d450bebcb536801cef";
   const gas_limit = 400000;
   const fee_data = await ethProvider.getFeeData();

   console.log("Prepare to create L1 Safe");

   // 1. Precompute the L1 safe address
   const create_add = await factory.getAddressForCounterfactualWallet(owner.address, modules, guardian, salt);

   // Acquire the Create2Data that is used to calculate address
   const safe_info = await getL1SafeAddress(owner, modules, guardian, salt);

   console.log("The pre-computed the address for L1Safe is :", safe_info.l1_safe);

   // Make sure the Create2Data calculated address is the same as the address by contract calculated
   assert.equal(safe_info.l1_safe, create_add, "Address is not calculated correctly");

   // 2. Prefund the VIP address with ETH to fund the later creation.
   // note: we use the R&D wallet to pre fund the L1 safe
   await fundWallet(rdKMSSigner, safe_info.l1_safe, l1_fund_amount);

   // 3. Get the manager's signature
   const managerSig = await managerKMSSigner.signMessage(ethers.utils.arrayify(ethers.utils.hexZeroPad(safe_info.l1_safe, 32)));

   // 4. Get the owner's signature for refund
   const refund_token = ZERO_ADDRESS;
   const message = `0x${[
      create_add,
      ethers.utils.hexZeroPad(ethers.utils.parseEther(l1_fund_amount), 32),
      refund_token,
    ].map((hex) => hex.slice(2)).join("")}`;
   const digest = ethers.utils.keccak256(ethers.utils.arrayify(message));
   const ownerSig = await ownerWallet.signMessage(ethers.utils.arrayify(digest));

   // 5. Start creating the L1 Safe Wallet
   const tx = await factory.createCounterfactualWallet(
   owner.address, modules, guardian, safe_info.org_salt, ethers.utils.parseEther(l1_fund_amount), refund_token, ownerSig, managerSig);//, await utils.getFeeSettings(ethProvider, gas_limit, fee_data));

   // Wait for transaction to finish
   //console.log("Transaction submitted, waiting..");
   console.log("TX Hash", tx.hash);
   const tx_receipt = await tx.wait();

   // Parse logs to find event and get the safe address
   const event_log = decodeLogs(tx_receipt.logs, SafeFactory.abi, "WalletCreated");
   const tx_event = factory.interface.parseLog(event_log);
   const safe = tx_event.args.wallet;
   gas_cost = gas_cost.add(tx_receipt.effectiveGasPrice.mul(tx_receipt.gasUsed));

   assert.equal(create_add, safe, "Address of created wallet is not calculated correctly");

   console.log("ETH L1 Safe created", safe);

   return safe_info;
}

// Deposit some initial assets from one wallets to another wallets
async function fundWallet(fromWallet, toWallet, amount) {
   console.log("funding the L1 safe");
   // Transfer some assets into echooo L1 wallet
   const tx_data = {
      to: toWallet,
      value: ethers.utils.parseEther(amount)
   };

   console.log(`Despositing initial assets into L1 address: ${toWallet}`);
   let tx = await fromWallet.sendTransaction(tx_data);
   const tx_receipt = await tx.wait();

   gas_cost = gas_cost.add(tx_receipt.effectiveGasPrice.mul(tx_receipt.gasUsed));

   const balance = await ethProvider.getBalance(toWallet);
   console.log(`Funding wallet ${toWallet} with ${web3.utils.fromWei(balance.toString())}`);
}

// test Transfer
async function printL2Balance(prefix) {
   let balance = await zkWallet.getBalance(ZERO_ADDRESS, "committed");
   console.log(prefix + "Committed balance", web3.utils.fromWei(balance.toString()));
   balance = await zkWallet.getBalance(ZERO_ADDRESS, "verified");
   console.log(prefix + "Verified balance", web3.utils.fromWei(balance.toString()));
}

// Deposit
async function initialDeposit(l1safe_address, l2_address) {
   let balance = await ethProvider.getBalance(l1safe_address);
   let tx;
   const gas_limit = 255607;
   const fee_data = await ethProvider.getFeeData();
   const zkContractIf = new ethers.utils.Interface(IZKSync.abi);

   console.log(`initialDeposit L1toL2 Deposit ETH with refund token ETH`);
   console.log("Echooo L1 Safe ETH balance before deposit: ", ethers.utils.formatEther(balance));

   // encode data for multi call
   const tx_data = encodeTransaction((await zkProvider.getContractAddress()).mainContract,
                 ethers.utils.parseEther(l2_deposit),
                 zkif.encodeFunctionData("depositETH", [l2_address]));

   // Issue relay call to deposit
   console.log("Issue relay call to deposit into the L2 wallet");
   const mc_tx_data = EchoooIf.encodeFunctionData("multiCall", [l1safe_address, [tx_data]]);
   tx = await submitRelayTx([ownerWallet], l1safe_address, mc_tx_data, fee_data, gas_limit, ethers.constants.AddressZero);
   //console.log("tx:", tx)

   const tx_receipt = await tx.wait();
   gas_cost = gas_cost.add(tx_receipt.effectiveGasPrice.mul(tx_receipt.gasUsed));
   utils.printGasData(relayerif, tx_receipt, gas_limit, fee_data);
   const pri_id = await utils.getPriorityOpId(zkif, tx_receipt);

   console.log(`Depositing Priority OP id: ${pri_id}`);

   let pri_status = await zkProvider.getPriorityOpStatus(pri_id);
   console.log("Priority OP status: ", pri_status);

   await utils.waitForL2Status((pri_id)=>zkProvider.getPriorityOpStatus(pri_id), pri_id, 'VERIFY');

   await printL2Balance("Deposit ");
  
   ethProvider = getProvider();
   balance = await ethProvider.getBalance(l1safe_address);
   
   console.log("Echooo L1 Safe ETH balance after deposit: ", ethers.utils.formatEther(balance));
}

// Create ZKSync L2 Wallet
async function createL2Wallet(l1safe_info) {
   const create2Data = {
      creatorAddress: l1safe_info.creator,
      saltArg: l1safe_info.salt_hash,
      codeHash: l1safe_info.code_hash
   };

   zkSigner = await zksync.Signer.fromETHSignature(ownerWallet);
   zkWallet = await zksync.Wallet.fromCreate2Data(zkSigner.signer, zkProvider, create2Data);
   zkif = new ethers.utils.Interface(IZKSync.abi);

   console.log("ZK Signer:", zkSigner);
   console.log("ZK Wallet", zkWallet);

   // ZK L2 wallet initiated
   l1safe_info.l2_address = zkWallet.address();
   console.log("ZK L2 wallet initiated, L2 address:", l1safe_info.l2_address);

   // Fund the L1 VIP account
   await fundWallet(rdKMSSigner, l1safe_info.l1_safe, l1_fund_amount);

   // Deposit some initial assets to activate the L2 wallet
   console.log("Deposit ETH into zksync wallet");
   await initialDeposit(l1safe_info.l1_safe, l1safe_info.l2_address);

   // Get the L2 wallet information
   l1safe_info.l2_accountid = await zkWallet.getAccountId();
   console.log(`ZK L2 wallet accountid: ${l1safe_info.l2_accountid}`);

   // Set the signing key
   console.log("Start setting the L2 signing key");
   const changePubkey = await zkWallet.setSigningKey({
              feeToken: "ETH",
              ethAuthType: "CREATE2",
          });
   console.log("Waiting for commit receipt");
   await changePubkey.awaitReceipt();
   console.log("Waiting for verify receipt");
   await changePubkey.awaitVerifyReceipt();

   l1safe_info.l2_pubkey = await zkWallet.getCurrentPubKeyHash();
   console.log(`ZK L2 wallet pub key ${l1safe_info.l2_pubkey}`);

   // output the l2 account state
   const state =  await zkWallet.getAccountState();
   console.log("ZK L2 account state:\n", state);

   await printL2Balance("Creating L2 wallet ");
}

async function whitelist_all(l1safe_info) {
   // Whitelist ZKSync for L1 safe (This should be moved to Dapp Registry)
   let whitelist_address = process.env.ZKPROXY_ADDRESS;
   //console.log("Adding ZKSync Proxy contract to L1 Safe's white list");
   //await whitelist(l1safe_info, whitelist_address);
   console.log("ZKSync is white listed for L1 Safe: " + await echooo.isWhitelisted(l1safe_info.l1_safe, whitelist_address));

   // Whitelist Lido investment for L1 safe (This should be moved to Dapp Registry)
   whitelist_address = process.env.LIDO_L1_ROPSTEN;
   //console.log("Adding LIDO staking Proxy contract to L1 Safe's white list");
   //await whitelist(l1safe_info, whitelist_address);
   console.log("LIDO staking is white listed for L1 Safe: " + await echooo.isWhitelisted(l1safe_info.l1_safe, whitelist_address));

   // Whitelist L1 asset transfer recipient
   whitelist_address = process.env.ETH_WALLET_ADDRESS2;
   console.log("Adding recipient to L1 Safe's transfer white list");
   ///await whitelist(l1safe_info, whitelist_address);
   console.log(whitelist_address, "is white listed for L1 Safe: " + await echooo.isWhitelisted(l1safe_info.l1_safe, whitelist_address));

   // Whitelist L1 asset transfer recipient
   whitelist_address = process.env.ACCOUNT2;
   console.log("Adding EOA recipient to L1 Safe's transfer white list");
   ///await whitelist(l1safe_info, whitelist_address, true);
   console.log(whitelist_address, "is white listed for L1 Safe: " + await echooo.isWhitelisted(l1safe_info.l1_safe, whitelist_address));

   // Whitelist Relay refund address
   whitelist_address = process.env.ACCOUNT3;
   console.log("Adding RelayerManager refund recipient to L1 Safe's transfer white list");
   //await whitelist(l1safe_info, whitelist_address, true);
   console.log(whitelist_address, "is white listed for L1 Safe: " + await echooo.isWhitelisted(l1safe_info.l1_safe, whitelist_address));
}

async function main() {
   gas_cost = ethers.BigNumber.from(0);
   extra_gas_price = ethers.utils.parseUnits("4.0", "gwei");
   require('log-timestamp');

   console.log(`Start creating accounts on the ${network} chain!`);
   console.log("Refund KMS ID: ", process.env.REFUND_KMSID);
   console.log("Guardian KMS ID:", process.env.GUARDIAN_KMSID);
   console.log("Manager KMS ID:", process.env.MANAGER_KMSID);
   console.log("R&D KMS ID:", process.env.RD_KMSID);

   REFUND_ADDRESS = await getEthAddressFromKMS({kmsInstance: kms, keyId: process.env.REFUND_KMSID});
   GUARDIAN_ADDRESS = await getEthAddressFromKMS({kmsInstance: kms, keyId: process.env.GUARDIAN_KMSID});
   MANAGER_ADDRESS = await getEthAddressFromKMS({kmsInstance: kms, keyId: process.env.MANAGER_KMSID});
   RD_ADDRESS = await getEthAddressFromKMS({kmsInstance: kms, keyId: process.env.RD_KMSID});

   console.log(`\nManager address ${MANAGER_ADDRESS}, \nGuardian address ${GUARDIAN_ADDRESS}, \nRefund address ${REFUND_ADDRESS}, \nRD address ${RD_ADDRESS}`);

   // L1 Eth provider
   ethProvider = getProvider();

   // L2 provider
   try {
      zkProvider = await zksync.getDefaultProvider(network);
   } catch(e) {
      console.log("zkProvider err:", e)
      useZk = false
   }
   
   // Create funding ethereum wallet using ethers.js, this wallet is only visible in to Echooo, not customer owned.
   rdKMSSigner = new KMSSigner(ethProvider, process.env.RD_KMSID);

   // Create manager signer
   managerKMSSigner = new KMSSigner(ethProvider, process.env.MANAGER_KMSID);

   // Connect to Echooo central module
   echooo = new ethers.Contract(echooo_module_address, Echooo.abi, rdKMSSigner);

   // The wallet factory
   factory = new ethers.Contract(echooo_factory_address, SafeFactory.abi, rdKMSSigner);

   // Create the customers' second EOA wallet, note:
   // 1. this is NOT visible to customer and only used to "Own" the VIP safe wallet
   // 2. No any funds or transaction will be initated from this wallet
   // 3. This wallet will be only used to sign message for any transaction initiated for VIP safe wallet
   ownerWallet = ethers.Wallet.createRandom().connect(ethProvider);
   //ownerWallet = ethers.Wallet.fromMnemonic("gown style table venture cricket tag harbor disorder hour emotion boring dance").connect(ethProvider);

   console.log(`Created the owner ETH wallet ${ownerWallet.address}`);

   // Now we are ready create the L1 Safe
   let l1safe_info = await createL1Safe(ownerWallet, [echooo_module_address], GUARDIAN_ADDRESS);

   // Whitelist all the necessary address so the transferring can happen
   //Do NOT add whitelist if necessary for testing, in the real scenario this requires the user authorization
   //await whitelist_all(l1safe_info);

   // // Create L2 wallet

   if (useZk) {
      await createL2Wallet(l1safe_info);

      console.log("L1 Safe and L2 Wallet creation details:\n", l1safe_info);

      console.log("Total gas cost for the L1 (VIP) and L2 account creation:", ethers.utils.formatEther(gas_cost));
   }

   fs.writeFileSync(`${__dirname}/${process.env.ACCOUNT_INFO_FILE}`, JSON.stringify(l1safe_info));
}

main();