import { ConfigLoader } from "./utils/configurator-loader";
import dotenv from "dotenv";
import hre, { ethers } from "hardhat";
dotenv.config();
import echoooModule from "../artifacts/contracts/modules/EchoooModule.sol/EchoooModule.json"
import proxy from "../artifacts/contracts/wallet/Proxy.sol/Proxy.json"
import walletFactory from "../artifacts/contracts/infrastructure/WalletFactory.sol/WalletFactory.json"
import baseWallet from "../artifacts/contracts/wallet/BaseWallet.sol/BaseWallet.json"
import utils from "../utils/utilities.js";
import web3 from "web3";
import {assert} from "chai";
import fs from "fs";

// const { ConfigLoader } = require("./utils/configurator-loader");
// const dotenv = require("dotenv");
// const hre = require("hardhat");
// const {ethers} = require("hardhat");
// dotenv.config();
// const echoooModule = require("../artifacts/contracts/modules/EchoooModule.sol/EchoooModule.json");
// const proxy = require("../artifacts/contracts/wallet/Proxy.sol/Proxy.json");
// const walletFactory = require("../artifacts/contracts/infrastructure/WalletFactory.sol/WalletFactory.json");
// const baseWallet = require("../artifacts/contracts/wallet/BaseWallet.sol/BaseWallet.json");
// const utils = require("../utils/utilities.js");
// const web3 = require("web3");
// const {assert} = require("chai");

//export async function main()
export async function main() {
    const configLoader = new ConfigLoader(hre.network.name);
    const config = configLoader.load();

    const [deployer, guardianer] = await ethers.getSigners()

    const echoooModuleContract = new ethers.Contract(config["EchoooModule"].address, echoooModule.abi, deployer)
    await echoooModuleContract.deployed()

    const proxyContract = new ethers.Contract(config["Proxy"].address, proxy.abi, deployer)
    await proxyContract.deployed()

    const walletFactoryContract = new ethers.Contract(config["WalletFactory"].address, walletFactory.abi, deployer)
    await walletFactoryContract.deployed()

    const baseWalletContract = new ethers.Contract(config["BaseWallet"].address, baseWallet.abi, deployer)

    //may need account1 ?
    let manager_address = deployer.address
    const modules = [echoooModuleContract.address]
    
    const tx = await walletFactoryContract.addManager(manager_address)
    await tx.wait()

    let trustlist_config_file
    if (hre.network.name == "mainnet") {
        trustlist_config_file = "echooo_prod.json"
        console.log("skipping testing and finish directly on mainnet!");
    } else {
        trustlist_config_file = `echooo_${hre.network.name}.json`
        console.log("skipping testing and finish directly on test!");
        // Create counterfeil wallet
    //   const salt = utils.generateSaltValue();
    //   const walletAddress = await utils.createWallet(walletFactoryContract.address, process.env.ACCOUNT1, modules, guardianer.address, salt);
      
    //   // Generate CREATE2 DAT for ZKSync wallet creation from Echooo wallet creation solidity code
    //   const cat = web3.utils.encodePacked({v: deployer.address, t: 'address'}, {v: modules, t: 'address[]'}, {v: process.env.ACCOUNT2, t: 'address'});
    //   const cat_hash = web3.utils.keccak256(cat);
    //   const cat_hash_cat_salt = web3.utils.encodePacked(cat_hash, salt);
    //   const wallet_salt = await web3.utils.keccak256(cat_hash_cat_salt);
    //   const wallet_code_hash = await web3.utils.keccak256(web3.utils.encodePacked(Proxy.bytecode, web3.eth.abi.encodeParameter('address', BaseWallet.address)));
    //   let trustlist_config_file
    //   if (hre.network.name == "development")
    //      trustlist_config_file = `echooo_goerli.json`
    //   else
    //      trustlist_config_file = `echooo_${hre.network.name}.json`
    //   console.log("CREATE2 Data: creatorAddress = " + walletFactoryContract.address + "\nsaltArg = " + wallet_salt + "\ncodeHash: " + wallet_code_hash);

    //   // We need to calculate the address here to make sure we will be getting the same address back
    //   let calculate_address = await web3.utils.encodePacked({v: "0xff", t: 'bytes1'}, {v: WalletFactory.address, t: 'address'}, {v: wallet_salt, t: 'bytes32'}, {v: wallet_code_hash, t: 'bytes32'});
    //   calculate_address = await web3.utils.keccak256(calculate_address);
    //   calculate_address = await web3.utils.toChecksumAddress("0x" + calculate_address.slice(26));
    //   console.log(`New wallet address ${walletAddress}`);
    //   console.log(`Caculated address ${calculate_address}`);
    //   assert.equal(calculate_address, walletAddress, "Address is not calculated correctly");

    //   // Deploy the wallet to the proxy address
    //   const wallet = await baseWalletContract.at(walletAddress);
    //   // Fund the L1 wallet
    //   const before = await utils.getBalance(walletAddress);
    //   console.log(`Balance before funding ${before}`);
    //   wallet.send(ethers.utils.parseEther("0.035"));
    //   const after = await utils.getBalance(walletAddress);
    //   console.log(`Balance after funding ${after}`);
    }

    // Writing all configs out
    //let config
   const trustlist_config_path = "../echooo_trustlists/scripts/config";
   let totalConfig = require(`${trustlist_config_path}/${trustlist_config_file}`);
   totalConfig.echooo.echooo_module = echoooModuleContract.address;
   totalConfig.echooo.echooo_module_registry = config["ModuleRegistry"].address;
   totalConfig.echooo.echooo_basewallet = baseWalletContract.address;
   totalConfig.echooo.echooo_walletfactory = walletFactoryContract.address;

   fs.writeFileSync(`./deploy/config/echooo_${hre.network.name}.json`, JSON.stringify(totalConfig, null, 2));
}

if (require.main === module) {
main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});
}