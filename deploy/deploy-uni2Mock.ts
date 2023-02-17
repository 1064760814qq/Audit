import { ConfigLoader } from "./utils/configurator-loader";
import hre, { ethers } from "hardhat";
import clonedeep from "lodash.clonedeep";

export async function main() {
    //console.log("1")
    const configLoader = new ConfigLoader(hre.network.name);
    const config = configLoader.load();
    const configUpdate = clonedeep(config);

    if (hre.network.name == "localhost" || hre.network.name == "hardhat") {
      const contractFactory = await ethers.getContractFactory("Uni2Mock");
      const contract = await contractFactory.deploy();
      await contract.deployed();
      console.log(`deployed Uni2Mock in ${contract.address}`);

      configUpdate["Uni2"].address = contract.address;
    } else if (hre.network.name == "mumbai") {
      configUpdate["Uni2"].address = "0xbdd4e5660839a088573191A9889A262c0Efc0983";
    } else if (hre.network.name == "ropsten" ||
      hre.network.name == "rinkeby" || hre.network.name == "ropsten-fork" ||
      hre.network.name == "goerli" || hre.network.name == "mainnet" || hre.network.name == "forkEth") {
      configUpdate["Uni2"].address = process.env.UNISWAPV2_ROUTER02;
    } else if (hre.network.name == "bscTest") {
      configUpdate["Uni2"].address = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
    } else if (hre.network.name == "bsc") {
      configUpdate["Uni2"].address = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
    } else {
      console.warn("Uni2 address not change, please check!")
    }

    console.log(`uniswap v2 router address: ${configUpdate["Uni2"].address}`);
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
