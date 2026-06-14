const fs = require("fs");
const path = "c:/Users/USER/Downloads/arbitra/deployments/sepolia/ArbitraFingerprintRegistry.json";

try {
  const data = JSON.parse(fs.readFileSync(path, "utf-8"));
  console.log("Root keys:", Object.keys(data));
  if (data.receipt) {
    console.log("Receipt keys:", Object.keys(data.receipt));
    console.log("Transaction Hash:", data.receipt.transactionHash);
    console.log("Block Number:", data.receipt.blockNumber);
  } else {
    console.log("No receipt field found.");
    // Print all keys except abi
    const filtered = {};
    for (const key of Object.keys(data)) {
      if (key !== "abi" && key !== "bytecode" && key !== "deployedBytecode" && key !== "storageLayout") {
        filtered[key] = data[key];
      }
    }
    console.log("Other fields:", filtered);
  }
} catch (err) {
  console.error(err);
}
