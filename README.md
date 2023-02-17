## Compile

Compile contracts

```
yarn hardhat compile
```

Compile test_contracts

```
BUILD_SOURCES_PATH=test_contracts yarn hardhat compile
```

## Test

Add a `.env` file in the root of the directory with the `INFURA_KEY` property set to your Infura API key (if you need to do deployments) and similarly for `ALCHEMY_KEY` (if you need to run integration tests).

Run the tests:

```
yarn hardhat test
```

To run coverage testing:

```
yarn hardhat coverage
```

Run test with hardhat node fork:

```
yarn hardhat node --fork `ALCHEMY_URL`
yarn hardhat test --network localhost
```

Run staging test:

```
node testStaging/sdk/testEchoooAccount.js
node testStaging/sdk/testEchoooRelayZK.js
```

## Deploy

```
yarn hardhat deploy-base --network `network`
yarn hardhat deploy-walletFactory --network `network`
yarn hardhat deploy-module --network `network`
```

## Verify

```
yarn hardhat run deploy/verify.ts --network `network`
```

## License

Released under [GPL-3.0](LICENSE)
