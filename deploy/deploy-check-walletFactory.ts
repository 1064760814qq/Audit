import hre, { ethers } from "hardhat";
import dotenv from "dotenv";
import { BigNumber } from "ethers";
import { getEthAddressFromKMS, KMSSigner } from '@rumblefishdev/eth-signer-kms';

dotenv.config();

const baseBalance = ethers.BigNumber.from("1000000000000000000");
const minBalance:BigNumber = ethers.BigNumber.from(2).mul(baseBalance).div(10);

export async function main() {
    //must check proxy bytecode not change
    const ethProxyBytecode = "0x60a060405234801561001057600080fd5b506040516101c03803806101c083398101604081905261002f91610044565b60601b6001600160601b031916608052610072565b600060208284031215610055578081fd5b81516001600160a01b038116811461006b578182fd5b9392505050565b60805160601c61012b610095600039600081816065015260b7015261012b6000f3fe608060405260043610601f5760003560e01c80635c60da1b1460a7576063565b36606357604080516020808252600090820152339134917f606834f57405380c4fb88d1f4850326ad3885f014bab3b568dfbf7a041eef738910160405180910390a3005b7f00000000000000000000000000000000000000000000000000000000000000003660008037600080366000845af43d6000803e80801560a2573d6000f35b3d6000fd5b34801560b257600080fd5b5060d97f000000000000000000000000000000000000000000000000000000000000000081565b6040516001600160a01b03909116815260200160405180910390f3fea26469706673582212202a2b27fb7f556278b3ed553bc0a189a964e6be6fed4c5a51108ad428effe041164736f6c63430008030033";
    const Proxy = require(`../artifacts/contracts/wallet/Proxy.sol/Proxy.json`);
    if (Proxy.bytecode != ethProxyBytecode) {
      console.log("bytecode not match eth");
      throw new Error("bytecode not match eth")
    }
   //check wallet factory address is true and have enough balance
   const walletFactoryPrivakeKey = process.env.WALLETFACTORY_PRIKEY || "";

    const walletFactorySinger = new ethers.Wallet(walletFactoryPrivakeKey, hre.ethers.provider);

    if (walletFactorySinger.address != process.env.ACCOUNT_WALLETFACTORY) {
        console.log("walletFactorySinger address:", walletFactorySinger.address, " not match ", process.env.ACCOUNT_WALLETFACTORY)
        throw new Error("wallet_factory address not match")
    }

    const walletFactoryBalance = await hre.ethers.provider.getBalance(walletFactorySinger.address)
    if (walletFactoryBalance.lt(minBalance)) {
        console.log(" not enough balance ");
        console.log("walletFactoryBalance:", ethers.utils.formatEther(walletFactoryBalance));
        console.log("minBalance:", ethers.utils.formatEther(minBalance));
        throw new Error("not enough balance");
    }
 }
 
 if (require.main === module) {
   main()
   .then(() => process.exit(0))
   .catch((error) => {
     console.error(error);
     process.exit(1);
   });
 }