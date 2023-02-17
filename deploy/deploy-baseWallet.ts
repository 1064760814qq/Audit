import { ConfigLoader } from "./utils/configurator-loader";
import hre, { ethers } from "hardhat";
import clonedeep from "lodash.clonedeep";

export async function main() {
    //console.log("1")
    const configLoader = new ConfigLoader(hre.network.name);
    const config = configLoader.load();
    const configUpdate = clonedeep(config);

    const walletFactoryPrivakeKey = process.env.WALLETFACTORY_PRIKEY || "";

    const walletFactorySinger = new ethers.Wallet(walletFactoryPrivakeKey, hre.ethers.provider);

    const contractFactory = await ethers.getContractFactory("BaseWallet");
    const contract = await contractFactory.connect(walletFactorySinger).deploy();

    console.log(`deploy BaseWallet in ${contract.address}`);

    configUpdate["BaseWallet"].address = contract.address;

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