import { ConfigLoader } from "./utils/configurator-loader";
import hre, { ethers } from "hardhat";
import clonedeep from "lodash.clonedeep";
import { getEthAddressFromKMS, KMSSigner } from '@rumblefishdev/eth-signer-kms';
import dotenv from "dotenv";
dotenv.config();

export async function main() {
    const aws = require("aws-sdk");
    const kms = new aws.KMS();
    const configLoader = new ConfigLoader(hre.network.name);
    const config = configLoader.load();
    const configUpdate = clonedeep(config);

    const REFUND_ADDRESS = await getEthAddressFromKMS({kmsInstance: kms, keyId: process.env.REFUND_KMSID || ''});
    const MANAGER_ADDRESS = await getEthAddressFromKMS({kmsInstance: kms, keyId: process.env.MANAGER_KMSID || ''});

    console.log("Refund address:", REFUND_ADDRESS);
    console.log("Manager address", MANAGER_ADDRESS);

    const walletFactoryPrivakeKey = process.env.WALLETFACTORY_PRIKEY || "";

    const walletFactorySinger = new ethers.Wallet(walletFactoryPrivakeKey, hre.ethers.provider);

    const contractFactory = await ethers.getContractFactory("WalletFactory");
    const contract = await contractFactory.connect(walletFactorySinger).deploy(configUpdate["BaseWallet"].address,
        configUpdate["GuardianStorage"].address, REFUND_ADDRESS, configUpdate["ModuleRegistry"].address);

    console.log(`deploy WalletFactory in ${contract.address}`);
    await contract.deployed()

    const tx = await contract.addManager(MANAGER_ADDRESS);
    await tx.wait();


    configUpdate["WalletFactory"].address = contract.address;
    configUpdate["WalletFactory"].manage = MANAGER_ADDRESS;

    configLoader.save(configUpdate);
 }

 if (require.main === module) {
   main()
   .then(() => process.exit(0))
   .catch((error) => {
     console.error(error);
     process.exit(1);
   });
 }
