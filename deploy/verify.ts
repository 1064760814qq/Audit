const {verify} = require("../utils/verify");
import { ConfigLoader } from "./utils/configurator-loader";
import hre, { ethers } from "hardhat";

const network = hre.network.name;
let fileName = network
if (fileName == "localhost") {
  fileName = "local"
}

//import trustlistConf from `../../echooo_trustlists/scripts/config/goerli.json`
const trustlistConf = require(`../../echooo_trustlists/scripts/config/${fileName}.json`)

const main = async () => {
    //console.log(1)
    const configLoader = new ConfigLoader(network);
    const config = configLoader.load();
    if (network == "localhost" || network == "hardhat") {
        console.log("localhost or hardhat network, does't need verify, exit...")
        return
    }

    //base
    await verify("GuardianStorage", config["GuardianStorage"].address)
    await verify("TransferStorage", config["TransferStorage"].address)
    await verify("ModuleRegistry", config["ModuleRegistry"].address)

    let args
    //multiCallHelper
    args = [config["TransferStorage"].address, trustlistConf["dappRegistry"].address]
    await verify("MultiCallHelper", config["MultiCallHelper"].address, args)

    //baseWallet
    await verify("BaseWallet", config["BaseWallet"].address)

    //proxy
    args = [config["BaseWallet"].address]
    await verify("Proxy", config["Proxy"].address, args)

    //walletFactory
    args = [config["BaseWallet"].address, config["GuardianStorage"].address, process.env.ACCOUNT3, config["ModuleRegistry"].address]
    await verify("WalletFactory", config["WalletFactory"].address, args)

    //echoooModule
    args = [config["ModuleRegistry"].address, config["GuardianStorage"].address, 
        config["TransferStorage"].address, trustlistConf["dappRegistry"].address, config["Uni2"].address,
        process.env.SECURITY_PERIOD, process.env.SECURITY_WINDOW, 
        process.env.RECOVERY_PERIOD, process.env.LOCK_PERIOD]

    await verify("EchoooModule", config["EchoooModule"].address, args)
}

main()