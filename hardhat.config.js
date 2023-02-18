//hardhat项目依赖组件
require("@nomiclabs/hardhat-waffle");

//hardhat项目配置项
module.exports = {
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
  },
  networks: {
    hardhat: {
      forking: {
        url: "https://polygon-mainnet.g.alchemy.com/v2/lKsPH03Bqn3oMk7hBnDYhYmNI_4Fmqm0",
      }
    },
    local: {
      url: 'http://127.0.0.1:8545',
    }
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
}


