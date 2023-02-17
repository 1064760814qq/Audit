require("dotenv").config();

const ethers = require("ethers");
const utils = require("../utils/utilities.js");

const AWS = require('aws-sdk');
const kms = new AWS.KMS({
  //endpoint: 'kms.ap-southeast-1.amazonaws.com',
});
const { getEthAddressFromKMS, KMSSigner } = require('@rumblefishdev/eth-signer-kms');
const network = process.env.NETWORK;

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
   await tx.wait();

   const balance = await ethProvider.getBalance(toWallet);
   console.log(`Funding wallet ${toWallet} with ${web3.utils.fromWei(balance.toString())}`);
}

function getProvider() {
   return new ethers.providers.JsonRpcProvider(process.env.RPCURL)
}

// main
async function main() {
   const provider = getProvider();
   //const mn = "fog inform hockey victory submit render spoon practice fringe wood this primary";
   //const mywallet = ethers.Wallet.fromMnemonic(mn).connect(provider);
   const mywallet = new KMSSigner(provider, process.env.INFRASTRUCTURE_KMSID);
   const extra_gas_price = ethers.utils.parseUnits("4.0", "gwei");
   INFRASTRUCTURE_ADDRESS = await getEthAddressFromKMS({kmsInstance: kms, keyId: process.env.INFRASTRUCTURE_KMSID});

   console.log("The wallet address:", INFRASTRUCTURE_ADDRESS);
   let nonce = await mywallet.getTransactionCount();
   console.log("The nounce:", await mywallet.getTransactionCount());

   let tx_data = await utils.getFeeSettings(provider, 25000);
   console.log("maxPriorityFeePerGas: ", ethers.utils.formatUnits(tx_data.maxPriorityFeePerGas, "gwei"));
   console.log("maxFeePerGas: ", ethers.utils.formatUnits(tx_data.maxFeePerGas, 'gwei'));

   // Bump up the maxPriorityFeePerGas
   tx_data.maxPriorityFeePerGas = tx_data.maxPriorityFeePerGas.add(extra_gas_price);
   // Bump up the maxFeePerGas
   tx_data.maxFeePerGas = tx_data.maxFeePerGas.add(extra_gas_price);

   console.log("Bumped maxPriorityFeePerGas: ", ethers.utils.formatUnits(tx_data.maxPriorityFeePerGas, "gwei"));
   console.log("Bumped maxFeePerGas: ", ethers.utils.formatUnits(tx_data.maxFeePerGas, 'gwei'));
   tx_data.to = mywallet.address;
   tx_data.nonce = nonce;

   console.log("tx_data:", tx_data);
   let tx = await mywallet.sendTransaction(tx_data);

   console.log("new Transaction hash: ", tx.hash);

   console.log("waiting...");

   let tx_receipt = tx.wait();

   console.log("Done");
}

main();
