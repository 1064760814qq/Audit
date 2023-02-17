const { run } = require("hardhat");

async function verify(contractName, contractAddress, args) {
    console.log("Verifying contract...");
    try {
      await run("verify:verify", {
        address: contractAddress,
        constructorArguments: args,
      }) 
      console.log(`${contractName} verified success in ${contractAddress}`)
    } catch (e) {
      if (e.message.toLowerCase().includes("already verified")) {
        console.log(`${contractName} Already Verified!`);
      } else {
        console.log(e)
      }
    }
  }

  module.exports = {verify}