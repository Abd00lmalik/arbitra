import { ethers } from "hardhat";

const SUSPECTED_CUSDT = ethers.getAddress("0xAe0207C757Aa2B4019AD96edD0092ddc63EF0c50".toLowerCase());

const ERC7984_ABI = [
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "underlyingToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
];

async function main() {
  const provider = ethers.provider;
  console.log(`Checking suspected cUSDT address: ${SUSPECTED_CUSDT}`);

  const code = await provider.getCode(SUSPECTED_CUSDT);
  console.log(`Bytecode length: ${code.length} bytes`);
  if (code === "0x") {
    console.error("ERROR: No contract deployed here!");
    return;
  }

  const contract = new ethers.Contract(SUSPECTED_CUSDT, ERC7984_ABI, provider);

  try {
    const name = await contract.name();
    const symbol = await contract.symbol();
    const decimals = await contract.decimals();
    console.log(`✅ Success!`);
    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Decimals: ${decimals}`);

    try {
      const underlying = await contract.underlyingToken();
      console.log(`Underlying Token: ${underlying}`);
    } catch (_) {
      console.log("No underlyingToken() method found (might be direct confidential ERC20)");
    }
  } catch (err: any) {
    console.error("Error calling methods:", err.message || err);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
