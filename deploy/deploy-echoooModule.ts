import { ConfigLoader } from "./utils/configurator-loader";
import hre, { ethers } from "hardhat";
import clonedeep from "lodash.clonedeep";
import dotenv from "dotenv";
dotenv.config();

const SECURITY_PERIOD = process.env.SECURITY_PERIOD;
const SECURITY_WINDOW = process.env.SECURITY_WINDOW;
const RECOVERY_PERIOD = process.env.RECOVERY_PERIOD;
const LOCK_PERIOD = process.env.LOCK_PERIOD;

export async function main() {
    //console.log("1")
    const configLoader = new ConfigLoader(hre.network.name);
    const config = configLoader.load();
    const configUpdate = clonedeep(config);

    //get trust_list config
    const fs = require('fs');
   let config_file = `${hre.network.name}.json`;
   if (hre.network.name == "localhost" || hre.network.name == "hardhat") {
    config_file = "local.json"
   }
      
    const trust_list = JSON.parse(fs.readFileSync(`../echooo_trustlists/scripts/config/${config_file}`));
    //console.log(trust_list)
    const contractFactory = await ethers.getContractFactory("EchoooModule");
    const contract = await contractFactory.deploy(configUpdate["ModuleRegistry"].address,
      configUpdate["GuardianStorage"].address, configUpdate["TransferStorage"].address,
      trust_list.dappRegistry.address, configUpdate["Uni2"].address, SECURITY_PERIOD,
      SECURITY_WINDOW, RECOVERY_PERIOD, LOCK_PERIOD);
    
    const registry = (await ethers.getContractFactory("ModuleRegistry")).attach(configUpdate["ModuleRegistry"].address);
    await registry.registerModule(contract.address, ethers.utils.formatBytes32String("EchoooModule"));

    configUpdate["EchoooModule"].address = contract.address;
    configUpdate["EchoooModule"].refundAddress = process.env.ACCOUNT3;
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
