const { privateKeyToAccount } = require("viem/accounts");
const { createWalletClient, createPublicClient, http, defineChain } = require("viem");
const { createHash } = require("crypto");

const sepolia = defineChain({
  id: 11155111,
  name: "Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://11155111.rpc.thirdweb.com"],
    },
  },
  testnet: true,
});

async function test() {
  const verifierKey = "0xbd8fb5c7d64ccd6fefa83cbfa95ee3a490455e5801bf9c67e4a532ae2d38c6d1";
  const rpcUrl = "https://eth-sepolia.g.alchemy.com/v2/yotZI2qyTxO9HqPMGJANO";

  try {
    console.log("1. Parsing private key...");
    const account = privateKeyToAccount(verifierKey);
    console.log("   Verifier Address:", account.address);

    console.log("2. Creating clients...");
    const client = createWalletClient({
      account,
      chain: sepolia,
      transport: http(rpcUrl)
    });
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl)
    });

    console.log("3. Fetching block number to test RPC connection...");
    const blockNum = await publicClient.getBlockNumber();
    console.log("   Success! Block Number:", blockNum.toString());

    console.log("4. Fetching wallet balance...");
    const balance = await publicClient.getBalance({ address: account.address });
    console.log(`   Balance: ${Number(balance) / 1e18} ETH`);
  } catch (err) {
    console.error("Test failed with error:", err);
  }
}

test();
