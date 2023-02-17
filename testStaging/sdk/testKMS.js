const AWS = require('aws-sdk');
const { getEthAddressFromKMS, KMSSigner } = require('@rumblefishdev/eth-signer-kms');
const { utils, providers, Wallet } = require('ethers');
require('dotenv').config();
const provider_url = `wss://goerli.infura.io/ws/v3/${process.env.INFURA_ID}`;
const provider = new providers.WebSocketProvider(provider_url);
const ethers = require("ethers");
const zksync = require("zksync");
const IERC20ABI = require("@openzeppelin/contracts/build/contracts/IERC20Metadata.json").abi;
const IERC20If = new ethers.utils.Interface(IERC20ABI);

const MIN_BALANCE_IN_NONPAYMENT_WALLET="0.0001";
const MIN_BALANCE_IN_INFRASTRUCTRURE_WALLET="2.0";

const test_string = process.env.CHAINID == 5 ? "Test" : "Main";
const kms_wallets = [
   {kmsid:process.env.INFRASTRUCTURE_KMSID, name: `Infrastructure-${test_string}`, address: "", signer: null},
   {kmsid:process.env.MANAGER_KMSID, name: `Manager-${test_string}`, address: "", signer: null},
   {kmsid:process.env.GUARDIAN_KMSID, name: `Guardian-${test_string}`, address: "", signer: null},
   {kmsid:process.env.RECIPIENT_KMSID, name: `Recipient-${test_string}`, address: "", signer: null},
   {kmsid:process.env.REFUND_KMSID, name: `Refund-${test_string}`, address: "", signer: null},
   {kmsid:process.env.RD_KMSID, name: `R&D-${test_string}`, address: "", signer: null},
];
const INFRA_INDEX = 0;
const MANAGER_INDEX = 1;
const GUARDIAN_INDEX = 2;
const RECIPIENT_INDEX = 3;
const REFUND_INDEX = 4;
const RD_INDEX = 5;
const erc20_metadata = {};

const no_balance_accounts = [
   MANAGER_INDEX,
   GUARDIAN_INDEX,
   RECIPIENT_INDEX];
let echoooRDWallet;
let goerli_erc20 = {};

// Obtain all the zksync supported ERC20 tokens
async function buildERC20ListFromZK() {
   // Obtain the ERC20 list from zksync sdk
   const zkp = await zksync.getDefaultProvider(process.env.NETWORK);
   const tokens = zkp.tokenSet.tokensBySymbol;
   for (t in tokens) {
      const address = ethers.utils.getAddress(tokens[t].address);
      if (address == ethers.constants.AddressZero) continue;
      if (!goerli_erc20[address])
         goerli_erc20[address] = true;
   }
}

// Build the meta data for all the ERC20 tokens
async function buildERC20TokenMetadata() {
   goerli_erc20[process.env.USDC_ERC20] = true;
   goerli_erc20[process.env.WETH_GOERLI_ERC20] = true;
   goerli_erc20[process.env.USDC_GOERLI_ERC20] = true;
   goerli_erc20[process.env.MCD_DAI] = true;
   await buildERC20ListFromZK();
   for (t in goerli_erc20) {
      await getERC20Meta(t);
   }
}

// Retrieve the token balance for a given account of ERC20 token and convert the balance to standard WEI (10**18) units
async function getERC20Balance(address, token) {
   const echoooRDWallet = kms_wallets[RD_INDEX].signer;
   const call_data = {
      to: token,
      data: IERC20If.encodeFunctionData("balanceOf", [address])
   };

   // Returnv value converts to decimal 18 (WEI), so we can use FromWei utility function
   let balance = IERC20If.decodeFunctionResult("balanceOf", await echoooRDWallet.call(call_data))[0];
   balance = ethers.utils.formatUnits(balance, erc20_metadata[token].decimal);
   return ethers.utils.parseEther(balance);
}

// Call a given ERC20 coin's method
async function callERC20Interface(token, func) {
   const echoooRDWallet = kms_wallets[RD_INDEX].signer;
   const call_data = {
      to: token,
      data: IERC20If.encodeFunctionData(func, [])
   };

   return IERC20If.decodeFunctionResult(func, await echoooRDWallet.call(call_data));
}

// Acquire the given ERC20 token meta data
async function getERC20Meta(token) {
   erc20_metadata[token] = {
      name: await callERC20Interface(token, "name"),
      symbol: await callERC20Interface(token, "symbol"),
      decimal: Number(await callERC20Interface(token, "decimals"))
   };

   console.log(`\tERC20 ${token} \"${erc20_metadata[token].name}\" symbol \"${erc20_metadata[token].symbol}\" of decimal ${erc20_metadata[token].decimal}`);
}

// Get the first key from KMS key lists
async function getKeyId(kms) {
   const resp = await kms.listKeys().promise();
   return resp.Keys[0].KeyId;
}

async function showAddress(kms, alias, name) {
   const walletAddress = await getEthAddressFromKMS({ kmsInstance: kms, keyId: alias})
   const balance = utils.formatEther(await provider.getBalance(walletAddress));

   console.log(`\tKMS ${name} Key Id: ${alias} ${walletAddress} ETH balance: ${balance}`);

   return walletAddress;
}

async function moveBalanceToRD(kms, src_kms_index) {
   const src_address = kms_wallets[src_kms_index].address;
   const src_kms_id = kms_wallets[src_kms_index].kmsid;
   const kmsSigner = kms_wallets[src_kms_index].signer;
   const dest_address = kms_wallets[RD_INDEX].address;
   let src_balance = await provider.getBalance(src_address);
   const min_balance = ethers.utils.parseEther(MIN_BALANCE_IN_NONPAYMENT_WALLET);
   if (src_balance.gt(min_balance)) {
      const amount = src_balance.sub(min_balance);
      let targetBalance = await provider.getBalance(dest_address);

      console.log(`Moving Balance from ${src_kms_id} to R&D Wallet ${dest_address}`);
      console.log(`${src_kms_id} balance before moving: ${ethers.utils.formatEther(src_balance)}`);
      console.log(`R&D wallet balance before moving: ${utils.formatEther(targetBalance)}`);

      let fee_data = await provider.getFeeData();

      tx = await kmsSigner.sendTransaction({
         to: dest_address,
         value: amount,
         type: 2,
         maxFeePerGas: fee_data.maxFeePerGas,
         maxPriorityFeePerGas: fee_data.maxPriorityFeePerGas
       });

      console.log("tx Hash:", tx.hash);

      await tx.wait();

      targetBalance = await provider.getBalance(dest_address);
      src_balance = await provider.getBalance(src_address);

      console.log(`${src_kms_id} balance after moving: ${ethers.utils.formatEther(src_balance)}`);
      console.log(`R&D wallet balance after moving: ${utils.formatEther(targetBalance)}`);
   }
}

async function refillInfraWallet(kms, src_kms_index = RD_INDEX) {
   const dest_address = kms_wallets[INFRA_INDEX].address;
   const src_kms_id = kms_wallets[src_kms_index].kmsid;
   const src_address = kms_wallets[src_kms_index].address;
   const kmsSigner = kms_wallets[src_kms_index].signer;
   let targetBalance = await provider.getBalance(dest_address);
   const min_balance = ethers.utils.parseEther(MIN_BALANCE_IN_INFRASTRUCTRURE_WALLET);

   if (targetBalance.lt(min_balance)) {
      let src_balance = await provider.getBalance(src_address);

      console.log(`Moving Balance from ${src_kms_id} to Infrastructure Wallet ${dest_address}`);
      console.log(`${src_kms_id} balance before moving: ${ethers.utils.formatEther(src_balance)}`);
      console.log(`Infrastructure wallet balance before moving: ${utils.formatEther(targetBalance)}`);

      let fee_data = await provider.getFeeData();

      tx = await kmsSigner.sendTransaction({
         to: dest_address,
         value: min_balance,
         type: 2,
         maxFeePerGas: fee_data.maxFeePerGas,
         maxPriorityFeePerGas: fee_data.maxPriorityFeePerGas
       });

      console.log("tx Hash:", tx.hash);

      await tx.wait();

      targetBalance = await provider.getBalance(dest_address);
      src_balance = await provider.getBalance(src_address);

      console.log(`${src_kms_id} balance after moving: ${ethers.utils.formatEther(src_balance)}`);
      console.log(`Infra wallet balance after moving: ${utils.formatEther(targetBalance)}`);
   }
}

async function main() {
   let kms = new AWS.KMS({
     //endpoint: 'kms.ap-southeast-1.amazonaws.com',
   });

   console.log(`${Date()} Start checking all the KMS wallets:`);
   for (kms_wallet of kms_wallets) {
      kms_wallet.signer = new KMSSigner(provider, kms_wallet.kmsid);
      kms_wallet.address = await showAddress(kms, kms_wallet.kmsid, kms_wallet.name);
   }

   console.log("Building meta data for all the ERC20");
   await buildERC20TokenMetadata();

   console.log("Checking ERC20 balance of all KMS ids");
   for (kms_wallet of kms_wallets) {
      console.log(`\tWallet: ${kms_wallet.name} ${kms_wallet.kmsid}`);
      for (t in goerli_erc20) {
         const balance = ethers.utils.formatEther(await getERC20Balance(kms_wallet.address, t));
         if (balance == '0.0') continue;
         console.log(`\t\tToken ${erc20_metadata[t].symbol} ${t} balance: ${balance}`);
      }
   }

   process.exit();

   // If there is remaining balance of no-balance accounts, move them to the R&D account
   for (kms_index of no_balance_accounts) {
      await moveBalanceToRD(kms, kms_index);
   }

   // If there isn't sufficient balance in deployer, move some funds from R&D to deployer
   await refillInfraWallet(kms);

   process.exit();
}

main();
