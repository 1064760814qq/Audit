require("dotenv").config();
let tokenIn;
let tokenOut;
let token0;
let token1;
let pool_address;
let Pool_contract;
let TokenIn_Contract;
let TokenOut_Contract;
let zeroForOne = false;

const ethers = require("ethers");
const provider = new ethers.providers.JsonRpcProvider('https://goerli.infura.io/v3/0c269400a93145b29826b1fd0c84c3a6');
const mywallet = ethers.Wallet.fromMnemonic(process.env.MNEMONIC).connect(provider);
const QuoterABI = require("@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json").abi;
const PoolABI = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json').abi;
const PoolIf = new ethers.utils.Interface(PoolABI);
const RouterABI = require("@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json").abi;
const RouterIf = new ethers.utils.Interface(RouterABI);
const WalletABI = require("../build/contracts/NewWallet.json").abi;
const Wallet_Address = "0xa23A1CCe52Af36A2b839Bf4e355AacCF14E25196";
const Wallet_Contract = new ethers.Contract(Wallet_Address, WalletABI, mywallet);
const FactoryABI = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json").abi;
const Factory_Address = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
const Quoter_Address = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
const UniswapV3Factory_Contract = new ethers.Contract(Factory_Address, FactoryABI, mywallet);
const UniswapV3Quoter_Contract = new ethers.Contract(Quoter_Address, QuoterABI, mywallet);
const IERC20MetadataABI = require("@openzeppelin/contracts/build/contracts/IERC20Metadata.json").abi;
const IERC20ABI = require("@openzeppelin/contracts/build/contracts/IERC20.json").abi;
const IERC20If = new ethers.utils.Interface(IERC20ABI);
const usdc_goerli = "0x07865c6e87b9f70255377e024ace6630c1eaa37f"; // Token0
const weth_goerli = "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6"; // Token1
const swap_fee = 3000;
const amountIn = "0.01";

function encodeTransaction(to, value, data){ return ({ to, value, data });}

async function prepareWallet() {
   console.log("Start funding the wallet!");
   if (await provider.getBalance(Wallet_Address) > 0) {
      console.log("The wallet has been funded!");
   } else {
      console.log("The wallet funding ....");
      // Transfer WETH some initial funds to wallet
      let tx = await tokenIn.contract.transfer(Wallet_Address, ethers.utils.parseUnits("0.1", tokenIn.decimals));
      await tx.wait();

      // Transfer ETH to wallet
      tx = await mywallet.sendTransaction({
       to: Wallet_Address,
       value: ethers.utils.parseEther("0.01")
      });
      await tx.wait();
   }
   console.log("Wallet TokenIn balance of", ethers.utils.formatUnits(await tokenIn.contract.balanceOf(Wallet_Address), tokenIn.decimals));
   console.log("Wallet TokenOut balance of", ethers.utils.formatUnits(await tokenOut.contract.balanceOf(Wallet_Address), tokenOut.decimals));
   console.log("Wallet ETH balance", ethers.utils.formatEther(await provider.getBalance(Wallet_Address)));
}

// Utility function to generate 20bytes salt
function randomSalt() {
   const random = ethers.utils.randomBytes(20);
   return ethers.utils.hexZeroPad(ethers.BigNumber.from(random).toHexString(), 20);
}

// Prepare swapping token ERC20 contract
async function prepareTokens(_tokenIn, _tokenOut) {
   TokenIn_Contract = new ethers.Contract(_tokenIn, IERC20MetadataABI, mywallet);
   TokenOut_Contract = new ethers.Contract(_tokenOut, IERC20MetadataABI, mywallet);
   tokenIn = {address: _tokenIn, contract: TokenIn_Contract, decimals: await TokenIn_Contract.decimals(), name: await TokenIn_Contract.name()};
   tokenOut = {address: _tokenOut, contract: TokenOut_Contract, decimals: await TokenOut_Contract.decimals(), name: await TokenOut_Contract.name()};
}

// According to token address find the relevant pool
async function find_pool() {
   pool_address =  await UniswapV3Factory_Contract.getPool(tokenIn.address, tokenOut.address, swap_fee); 
   Pool_Contract = new ethers.Contract(pool_address, PoolABI, mywallet);
   console.log("Pool address:", pool_address);
   token0 = await Pool_Contract.token0();
   token1 = await Pool_Contract.token1();
   const zeroForOne = tokenIn.address.toLowerCase() == token0.toLowerCase();
   if (zeroForOne) {
      token0 = tokenIn;
      token1 = tokenOut;
   } else {
      token0 = tokenOut;
      token1 = tokenIn;
   }
   console.log("Pool liquidity:", ethers.utils.formatUnits(await Pool_Contract.liquidity(), token0.decimals));
   console.log(`Pool Token0 is: ${token0.name} (${token0.address})`);
   console.log(`Pool Token1 is: ${token1.name} (${token1.address})`);
   console.log(`Swap TokenIn is: ${tokenIn.name} (${tokenIn.address})`);
   console.log(`Swap TokenOut is: ${tokenOut.name} (${tokenOut.address})`);
}

// Query the swapping rate
async function query_swap() {
   console.log("TokenIn amount:", amountIn);
   const amountOut = await UniswapV3Quoter_Contract.callStatic.quoteExactInputSingle(tokenIn.address, tokenOut.address, swap_fee, ethers.utils.parseUnits(amountIn, tokenIn.decimals), 0);
   console.log("TokenOut amount:", ethers.utils.formatUnits(amountOut, tokenOut.decimals));
}

// perform swapping
async function do_swap() {
   console.log(`Start swaping from ${tokenIn.name} to ${tokenOut.name}`);
   console.log(`   ERC20 Aprpove ${amountIn} for ${process.env.UNISWAPV3_ROUTER} of ${tokenIn.name}`);
   let allowance = await tokenIn.contract.allowance(Wallet_Address, process.env.UNISWAPV3_ROUTER);
   if (allowance <  ethers.utils.parseUnits(amountIn, tokenIn.decimals)) {
      console.log("   current allowance:", ethers.utils.formatUnits(allowance, tokenIn.decimals));
      const approve_data = IERC20If.encodeFunctionData("approve", [process.env.UNISWAPV3_ROUTER, ethers.utils.parseUnits(amountIn, tokenIn.decimals)]);
      const tx = await Wallet_Contract.invoke(tokenIn.address, "0x00", approve_data); 
      await tx.wait();
      allowance = await tokenIn.contract.allowance(Wallet_Address, process.env.UNISWAPV3_ROUTER);
      console.log("   after approval allowance:", ethers.utils.formatUnits(allowance, tokenIn.decimals));
   }
   console.log("   Done approval");
   console.log("   Start swapping");
   const salt = randomSalt();
   const abicoder = ethers.utils.defaultAbiCoder;
   const calldata = abicoder.encode(["address", "address", "uint24", "bytes"], [token0.address, token1.address, swap_fee, salt]);
   const data_hash = ethers.utils.keccak256(calldata);
   const data_sig = await mywallet.signMessage(ethers.utils.arrayify(data_hash));
   const calldata_with_sig = abicoder.encode(["address", "address", "uint24", "bytes", "bytes"], [token0.address, token1.address, swap_fee, salt, data_sig]);
   console.log("salt:", salt);
   console.log("calldata:",calldata);
   console.log("calldata hash:", data_hash);
   console.log("sig:", data_sig);
   console.log("data_sig:", calldata_with_sig);
   const slots = await Pool_Contract.slot0();
   const limit = zeroForOne ? slots[0].div(2) : slots[0].mul(2);
   const params = {
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      fee: swap_fee,
      recipient: Wallet_Address,
      deadline: Math.floor(Date.now() / 1000 + 1800),
      amountIn: ethers.utils.parseUnits(amountIn, tokenIn.decimals),
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0
   };
   const swap_data = RouterIf.encodeFunctionData("exactInputSingle", [params]);
   const tx = await Wallet_Contract.invoke(process.env.UNISWAPV3_ROUTER, 0, swap_data, {gasLimit: 1000000});
   await tx.wait();
   console.log("   Done swapping");
   console.log("TokenIn balance of", ethers.utils.formatUnits(await tokenIn.contract.balanceOf(Wallet_Address), tokenIn.decimals));
   console.log("TokenOut balance of", ethers.utils.formatUnits(await tokenOut.contract.balanceOf(Wallet_Address), tokenOut.decimals));
}

// main
async function main() {

   // Prepare tokens
   await prepareTokens(weth_goerli, usdc_goerli);

   // Initial funding of the Wallet
   await prepareWallet();

   // Locate which pool to use the pool
   await find_pool();

   // Query the swaping rate
   await query_swap();

   // Perform the swap
   await do_swap();
}

main();
