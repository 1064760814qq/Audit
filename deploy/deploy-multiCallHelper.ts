import { ConfigLoader } from "./utils/configurator-loader";
import hre, { ethers } from "hardhat";
import clonedeep from "lodash.clonedeep";

const network = hre.network.name;
let fileName = network
if (fileName == "localhost") {
  fileName = "local"
}

//import trustlistConf from `../../echooo_trustlists/scripts/config/goerli.json`
const trustlistConf = require(`../../echooo_trustlists/scripts/config/${fileName}.json`)

export async function main() {
    const configLoader = new ConfigLoader(network);
    const config = configLoader.load();
    const configUpdate = clonedeep(config);

    const contractFactory = await ethers.getContractFactory("MultiCallHelper");
    const contract = await contractFactory.deploy(
      configUpdate["TransferStorage"].address, trustlistConf["dappRegistry"].address);
    
    //console.log("dapp address:", trustlistConf["dappRegistry"].address)
    console.log(`deploy MultiCallHelper in ${contract.address}`);

    configUpdate["MultiCallHelper"].address = contract.address;

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