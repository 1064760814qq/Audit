import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@rumblefishdev/hardhat-kms-signer";
import "solidity-coverage";
import "@nomiclabs/hardhat-etherscan";
import dotenv from "dotenv";
import "hardhat-gas-reporter"
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-truffle5"
import "hardhat-contract-sizer";
import * as ethers from "ethers";


dotenv.config();

const deploy_base_scripts = [
  "deploy-check.ts",
  "deploy-base.ts",
  "deploy-multiCallHelper.ts",
  "deploy-uni2Mock.ts",
];

const deploy_walletFactory_scripts = [
  "deploy-check-walletFactory.ts",
  "deploy-baseWallet.ts",
  "deploy-proxy.ts",
  "deploy-walletFactory.ts"
];

const deploy_module_scripts = [
  "deploy-check.ts",
  "deploy-echoooModule.ts",
];

const provider = `https://${process.env.NETWORK}.infura.io/v3/${process.env.INFURA_ID}`;

//1
task("deploy-base", "Deploy base scripts", async (args, hre) => {
  for (const script of deploy_base_scripts) {
    console.log("\n", `/////////////     Executing [${script}] on [${hre.network.name}]     ///////////////`, "\n");
    const { main } = require(`./deploy/${script}`);
    await main();
  }
});

//2
task("deploy-walletFactory", "Deploy wallet factory scripts", async (args, hre) => {
  for (const script of deploy_walletFactory_scripts) {
    console.log("\n", `/////////////     Executing [${script}] on [${hre.network.name}]     ///////////////`, "\n");
    const { main } = require(`./deploy/${script}`);
    await main();
  }
});

//3
task("deploy-module", "Deploy module scripts", async (args, hre) => {
  for (const script of deploy_module_scripts) {
    console.log("\n", `/////////////     Executing [${script}] on [${hre.network.name}]     ///////////////`, "\n");
    const { main } = require(`./deploy/${script}`);
    await main();
  }
});

task("display-account", "Display deployment account", async (args, hre) => {
  const [signer] = await hre.ethers.getSigners();
  console.log(signer);
});



const PRIVATE_KEY_DEPLOYER = process.env.PRIVATE_KEY_DEPLOYER || "";
const PRIVATE_KEY_MANAGER = process.env.PRIVATE_KEY_MANAGER || "";
const URL = process.env.URL;
const contractSource = process.env.BUILD_SOURCES_PATH || "contracts";
const BALANCE = ethers.utils.parseEther("10000000").toString();

const config: HardhatUserConfig = {
  paths: {
    sources: contractSource,
  },
  networks: {
    hardhat: {
      chainId: 9527,
      accounts: {
        mnemonic: process.env.MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 10,
        accountsBalance: BALANCE,
      },
      forking: {
       // url: "https://eth-goerli.g.alchemy.com/v2/pQ_i8o-4xJTQPfhVJH1AzIPB7mpIdbh7" 
       url: "https://eth-mainnet.g.alchemy.com/v2/jz79v5kY5cDsz0fp3RH_VK37IKtU4Rdu",
      },
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId:9527,
      //kmsKeyId: process.env.INFRASTRUCTURE_KMSID,
    },
    forkEth: {
      //url: "http://127.0.0.1:8545",
      url: "http://Bastion-goerli-595491602.ap-southeast-1.elb.amazonaws.com:8221",
      chainId:9527,
      kmsKeyId: process.env.INFRASTRUCTURE_KMSID,
    },
    ganache: {
      url:"http://127.0.0.1:8545",
      allowUnlimitedContractSize: false,
      accounts: {
        mnemonic: process.env.MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 10,
      }
    },
    mainnet: {
      url: "https://eth-mainnet.g.alchemy.com/v2/jz79v5kY5cDsz0fp3RH_VK37IKtU4Rdu",
      chainId: Number(process.env.CHAINID),
      timeout: 100000,
      minMaxFeePerGas:50000000000,
      minMaxPriorityFeePerGas:1500000000,
      kmsKeyId: process.env.INFRASTRUCTURE_KMSID,
    },
    goerli: {
      url: "https://eth-goerli.g.alchemy.com/v2/pQ_i8o-4xJTQPfhVJH1AzIPB7mpIdbh7",
      chainId: Number(process.env.CHAINID),
      timeout: 100000,
      minMaxFeePerGas:50000000000,
      minMaxPriorityFeePerGas:1500000000,
      kmsKeyId: process.env.INFRASTRUCTURE_KMSID,
    },
    bsc: {
      url: "https://bsc-dataseed1.ninicoin.io",
      chainId: 56,
      timeout: 100000,
      kmsKeyId: process.env.INFRASTRUCTURE_KMSID,
    },
    bscTest: {
      url: "https://data-seed-prebsc-1-s3.binance.org:8545/",
      chainId: 97,
      timeout: 100000,
      kmsKeyId: process.env.INFRASTRUCTURE_KMSID,
    },
    mumbai: {
      url: "https://polygon-mumbai.g.alchemy.com/v2/vTm14J_YWEIi9VBmvm3Xf5T4LstCmcT7",
      chainId: 80001,
      timeout: 100000,
      kmsKeyId: process.env.INFRASTRUCTURE_KMSID,
    },
    prod: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_ID}`,
      chainId: 1,
      timeout: 100000,
      kmsKeyId: process.env.INFRASTRUCTURE_KMSID,
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.3",
        settings: {
          optimizer: {
            enabled: true,
            runs: 50,
          },
        },
      },
      {
        version: "0.5.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
    overrides: {
      "contracts/trustlists_contracts/filters/jeton/JetonFilter.sol": {
        version: "0.8.5",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      }
    }
  },
  etherscan: {
    apiKey: `${process.env.ETHERSCAN_APIKEY}`
  },
  gasReporter: {
    enabled: true,
    outputFile: "gas-usage-report.log",
    noColors: true,
    //currency: "USD",
    //coinmarketcap: COINMARKETCAP_KEY,
    //token:"MATIC",
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: false,
    disambiguatePaths: false,
  }
};

export default config;
