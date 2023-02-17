import { ConfigLoader } from "./utils/configurator-loader";
import hre, { ethers } from "hardhat";
import clonedeep from "lodash.clonedeep";

export async function main() {
    //console.log("1")
    const configLoader = new ConfigLoader(hre.network.name);
    const config = configLoader.load();
    const configUpdate = clonedeep(config);

    const contractNames = ["GuardianStorage", "TransferStorage", "ModuleRegistry"];
    for (const contractName of contractNames) {
        const contractFactory = await ethers.getContractFactory(contractName);
        const contract = await contractFactory.deploy();
        console.log(`deploy ${contractName} in ${contract.address}`);

        configUpdate[contractName].address = contract.address;
    }

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