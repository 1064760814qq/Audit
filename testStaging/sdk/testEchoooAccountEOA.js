require("dotenv").config();
let ownerWallet;
let ethProvider;
let rdKMSSigner;
let REFUND_ADDRESS;
let GUARDIAN_ADDRESS;
let gas_cost;

const l2_operator_eth = "0.0005";
const l2_operator_eth_fee = "0.0002";
const to_eoa_l1_usdc_amount = 1;
const l1_l2_usdc_amount = 0.5;
const l2_l2_usdc_amount = 0.1;
const l2_l2_usdc_amount_fee = 0.05;
const usdc_decimal = 10 ** 6;
const totalGas = 1000000;
const depositEth = "0.002";
const usdc_approve_amount = 2 * 10 ** 18;

const AWS = require('aws-sdk');
const kms = new AWS.KMS({
  //endpoint: 'kms.ap-southeast-1.amazonaws.com',
});
const { getEthAddressFromKMS, KMSSigner } = require('@rumblefishdev/eth-signer-kms');

const ethers = require("ethers");
const web3 = require("web3");
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const zksync = require("zksync");
const utils = require("../utils/utilities.js");
const IERC20ABI = require("@openzeppelin/contracts/build/contracts/IERC20Metadata.json").abi;
const { exit } = require("process");
const ZERO_ADDRESS = ethers.constants.AddressZero;

const network = process.env.NETWORK;

function encodeTransaction(to, value, data){ return ({ to, value, data });}

async function getProvider(useInfura = false) {
   if (useInfura) {
      return new ethers.providers.InfuraProvider.getWebSocketProvider(network, process.env.RPC_INFURA_PROJECTID);
   }
   return await ethers.getDefaultProvider(network);
}

// Get the fee setting according to EIP1559 status
async function getFeeSettings(gas_limit, fee_data = null) {
   fee_data = fee_data == null ? await ethProvider.getFeeData() : fee_data;
   const settings =
   {
      type: 2,
      gasPrice: (fee_data.maxFeePerGas == null ? fee_data.gasPrice : null),
      maxPriorityFeePerGas: fee_data.maxPriorityFeePerGas,
      maxFeePerGas: fee_data.maxFeePerGas,
      gasLimit: gas_limit
   };

   //console.log(settings);
   return settings;
}

// test Transfer
async function printL2Balance(prefix) {
   let balance = await zkWallet.getBalance(ZERO_ADDRESS, "committed");
   console.log(prefix + "Committed balance", web3.utils.fromWei(balance.toString()));
   balance = await zkWallet.getBalance(ZERO_ADDRESS, "verified");
   console.log(prefix + "Verified balance", web3.utils.fromWei(balance.toString()));
}

// Zk sdk for L1 to L2 ETH
async function depositFrom_L1_To_Zk_Sdk(ethWallet){

   const syncProvider = await zksync.getDefaultProvider('goerli');


   var syncWallet = await zksync.Wallet.fromEthSigner(ethWallet,syncProvider);
   
   var deposit = await syncWallet.depositToSyncFromEthereum({
       depositTo: syncWallet.address(),
       token: 'ETH',
       amount: ethers.utils.parseEther(depositEth),
     });
   
   var depositReceipt = await deposit.awaitReceipt();
   // console.log(deposit.hash)
   console.log("depositFrom_L1_To_Zk_Sdk:", depositReceipt)
   }


// L1 to L2 ERC20
async function depositFrom_L1_To_Zk_ERC20(ethWallet,tokenAddress,amount){

   const syncProvider = await zksync.getDefaultProvider('goerli');

   var syncWallet = await zksync.Wallet.fromEthSigner(ethWallet, syncProvider);
 
   var totalValue = ethers.BigNumber.from(amount.toString());

   var zkSyncContract = new ethers.Contract(tokenAddress,IERC20ABI,ethWallet);
   var approveAmout = ethers.BigNumber.from(usdc_approve_amount.toString());
   const info =  await zkSyncContract.approve('0x5c56FC5757259c52747AbB7608F8822e7cE51484',approveAmout);
   await waitForTx(ethProvider, info.hash);

   var deposit = await syncWallet.depositToSyncFromEthereum({
       depositTo: syncWallet.address(),  //Address accepted on L2
       token: tokenAddress,  //Token symbol of L1 or L1 ERC20 contract address
       amount: totalValue,  //amount of transferred erc20
     });
 
   //console.log("depositFrom_L1_To_Zk_ERC20 hash:", deposit.hash)
   var depositReceipt = await deposit.awaitReceipt();
   console.log(depositReceipt)
   }



// L2 to L2 ETH
async function From_L2_To_L2_ETH(ethWallet,recipient){
   const syncProvider = await zksync.getDefaultProvider('goerli');
 
   var syncWallet = await zksync.Wallet.fromEthSigner(ethWallet, syncProvider);
 
   const amount = zksync.utils.closestPackableTransactionAmount(ethers.utils.parseEther(l2_operator_eth));
   const fee = zksync.utils.closestPackableTransactionFee(ethers.utils.parseEther(l2_operator_eth_fee));
 
   const transfer = await syncWallet.syncTransfer({
     to: recipient,
     token: 'ETH',
     amount,
     fee
   });
   // console.log(transfer)

   var transferReceipt = await transfer.awaitReceipt();
   console.log(transferReceipt)
} 


// L2 to L2 ETH
async function From_L2_To_L2_ERC20(ethWallet,recipient,tokenAddress,ERC20Amount){

   const syncProvider = await zksync.getDefaultProvider('goerli');

   var syncWallet = await zksync.Wallet.fromEthSigner(ethWallet, syncProvider);
 
   var totalValue = ethers.BigNumber.from(ERC20Amount.toString())
   const fee = l2_l2_usdc_amount_fee * usdc_decimal
   var Fee = ethers.BigNumber.from(fee.toString())
 
   const transfer = await syncWallet.syncTransfer({
     to: recipient,
     token: tokenAddress,
     amount: totalValue,
     fee: Fee
   });
   console.log(transfer)
   }


// Withdraw fund
async function withdrawFrom_ZK_To_L1(ethWallet){

   const syncProvider = await zksync.getDefaultProvider('goerli');

   var syncWallet = await zksync.Wallet.fromEthSigner(ethWallet, syncProvider);  
 
   if (!(await syncWallet.isSigningKeySet())) {
     if ((await syncWallet.getAccountId()) == undefined) {
       throw new Error('Unknown account');
     }

     // As any other kind of transaction, `ChangePubKey` transaction requires fee.
     // User doesn't have (but can) to specify the fee amount. If omitted, library will query zkSync node for
     // the lowest possible amount.
     const changePubkey = await syncWallet.setSigningKey({
       feeToken: 'ETH',
       ethAuthType: 'ECDSA'
     });
 
     // Wait until the tx is committed
     await changePubkey.awaitReceipt();
   }

   const withdraw = await syncWallet.withdrawFromSyncToEthereum({
      ethAddress: syncWallet.address(),
      token: 'ETH',
      amount: ethers.utils.parseEther(l2_operator_eth)
    });
  
    //console.log("withdrawFrom_ZK_To_L1 withdraw:", withdraw.hash)
    var withdrawReceipt = await withdraw.awaitReceipt();
    console.log(withdrawReceipt)
    const committedETHBalance = await syncWallet.getBalance('ETH');
    console.log(committedETHBalance)
}


function genPrivateKey(keyPath,accountPath){
   var privateKey = ethers.utils.randomBytes(32);
   var wallet = new ethers.Wallet(privateKey);
   console.log("Address: " + wallet.address);
   let randomNumberKey = ethers.BigNumber.from(privateKey)._hex

   fs.appendFileSync(keyPath,randomNumberKey+os.EOL)
   fs.appendFileSync(accountPath,wallet.address+os.EOL)
   return (randomNumberKey);
}


function getAccountAndKey(keyPath,accountPath){
   var keyContent=fs.readFileSync(keyPath,"utf-8");
   var accountContent=fs.readFileSync(accountPath,"utf-8");

	var keyList =	keyContent.split(/\r?\n/);
   var accountList =	accountContent.split(/\r?\n/);
	var key =  keyList[(keyList.length - 2)]
   var account = accountList[(accountList.length - 2)]
   return [key,account]
}

function sleep(ms) {
   return new Promise((resolve) => setTimeout(resolve, ms));
 }

const waitForTx = async (provider, hash) => {
   console.log(`Waiting for tx: ${hash}`);
   while (!(await provider.getTransactionReceipt(hash))) {
     sleep(5000);
   }
 };

 //gasLimit 21000
async function L1_KMS_transfer_to_EOA_ETH(ethWallet,EOA_address){
   const feeInfo = await ethProvider.getFeeData();
   const totalDeposit = ethers.utils.parseEther(depositEth).add(feeInfo.gasPrice * totalGas);
   const totalDepositString = ethers.utils.formatEther(totalDeposit);
   //console.log(totalDepositString)

   var txvalue = ethers.utils.parseEther(totalDepositString);
   let res = await ethWallet.sendTransaction({
              to: EOA_address,
              value: txvalue
          });
  
   console.log("Transfer_to_EOA_ETH---hash:",res.hash)
   await waitForTx(ethProvider, res.hash);
}


async function L1_to_eoa_eth(managerKMSSigner,EOA_address){
   // create random EOA Address
   
   await L1_KMS_transfer_to_EOA_ETH(managerKMSSigner,EOA_address);

}

//gasLimit  51,549
async function L1_to_eoa_USDC(tokenAddress,ethWallet,EOA_address){
   var zkSyncContract = new ethers.Contract(tokenAddress,IERC20ABI,ethWallet);
   const amount1 =  to_eoa_l1_usdc_amount * usdc_decimal;
   var Amout = ethers.BigNumber.from(amount1.toString());
   const tranfer =  await zkSyncContract.transfer(EOA_address,Amout);
   console.log("L1_to_eoa_USDC hash:", tranfer.hash)
   await waitForTx(ethProvider, tranfer.hash);
}


async function EOA_L1_L2_All_Operation(managerKMSSigner,EOAWallet,EOA_Address){
      //L1 to L1 ETH
      await L1_to_eoa_eth(managerKMSSigner,EOAWallet.address);
      
      var main_ERC20_Wallet = new ethers.Wallet(
<<<<<<< HEAD
         '0x696349c11991707510ee787fa215a7399eb48942b41100fceb0a03ea58912da1', 
=======
         '0x3b3549cc8ad7ad40451301f6a55239a20a9c0e384587187d0d361f609b7d4f6f', 
>>>>>>> 0fa644b711566250bc2650b3f680ecb2b3e390b8
         ethProvider);
   
      var tokenAddress = "0xd35cceead182dcee0f148ebac9447da2c4d449c4"; //USDC
   
<<<<<<< HEAD
      //L1 to L1 ERC20
=======
      // L1 to L1 ERC20
>>>>>>> 0fa644b711566250bc2650b3f680ecb2b3e390b8
      await L1_to_eoa_USDC(tokenAddress,main_ERC20_Wallet,EOA_Address);
      
      // L1 to L2 ERC20
      var amount = l1_l2_usdc_amount * usdc_decimal;
      await depositFrom_L1_To_Zk_ERC20(EOAWallet,tokenAddress,amount);

      // L1 to L2 ETH
      await depositFrom_L1_To_Zk_Sdk(EOAWallet);
   
      // L2 to L1 ETH
      await withdrawFrom_ZK_To_L1(EOAWallet); //change publicKey and withdraw
   
      // L2 to L2 ETH
      var recipient = "0x592916d0D7fcaec0A0A0504134364721Aafd5e87";
      await From_L2_To_L2_ETH(EOAWallet,recipient)
   
      // L2 to L2 ERC20
      var ERC20Amount = l2_l2_usdc_amount * usdc_decimal;
      await From_L2_To_L2_ERC20(EOAWallet,recipient,tokenAddress,ERC20Amount);
}

//total l1 need 24w gas，gave 50wgas to use。 total：0.002eth + 50wgas
async function main() {
   const recovery = false;
   gas_cost = ethers.BigNumber.from(0);
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
   ethProvider = await getProvider(true);

   // L2 provider
   zkProvider = await zksync.getDefaultProvider(network);

   // Create funding ethereum wallet using ethers.js, this wallet is only visible in to Echooo, not customer owned.
   rdKMSSigner = new KMSSigner(ethProvider, process.env.RD_KMSID);

   // Create manager signer
   managerKMSSigner = new KMSSigner(ethProvider,process.env.MANAGER_KMSID);

   console.log( ethers.utils.formatEther((await rdKMSSigner.getBalance())._hex))

   // Connect to Echooo central module
   // echooo = new ethers.Contract(echooo_module_address, Echooo.abi, rdKMSSigner);

   // // The wallet factory
   // factory = new ethers.Contract(echooo_factory_address, SafeFactory.abi, rdKMSSigner);

   // Create the customers' second EOA wallet, note:
   // 1. this is NOT visible to customer and only used to "Own" the VIP safe wallet
   // 2. No any funds or transaction will be initated from this wallet
   // 3. This wallet will be only used to sign message for any transaction initiated for VIP safe wallet
   ownerWallet = ethers.Wallet.createRandom().connect(ethProvider);
   
   await EOA_L1_L2_All_Operation(rdKMSSigner,ownerWallet,ownerWallet.address);


   console.log(`Created the owner ETH wallet ${ownerWallet.address}`);


   // Now we are ready create the L1 Safe
   // let l1safe_info = await createL1Safe(ownerWallet, [echooo_module_address], GUARDIAN_ADDRESS);

   // Whitelist all the necessary address so the transferring can happen
   // Do NOT add whitelist if necessary for testing, in the real scenario this requires the user authorization
   // await whitelist_all(l1safe_info);

   // Create EIP1271 signer wallet
   // eip1271Wallet = ethWallet; //EIP1271Wallet.fromMnemonic(l1safe_info.l1_safe, process.env.MNEMONIC).connect(ethProvider);

   // Create L2 wallet
   // await createL2Wallet(l1safe_info);

   // console.log("L1 Safe and L2 Wallet creation details:\n", l1safe_info);

   // console.log("Total gas cost for the L1 (VIP) and L2 account creation:", ethers.utils.formatEther(gas_cost));


   fs.writeFileSync(process.env.ACCOUNT_INFO_EOA_FILE, JSON.stringify(ownerWallet._mnemonic().phrase));

   process.exit();
}

main();