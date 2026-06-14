const hre = require("hardhat");

async function main() {
  const txHash = "0xf3467e6d274d65da4e6763fed51921c98553bf248e4fe24510a430b598c6b4f5";
  const provider = hre.ethers.provider;

  console.log(`Replaying transaction: ${txHash}`);
  
  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      console.error("Transaction not found.");
      return;
    }
    
    console.log(`Details:`);
    console.log(`  From: ${tx.from}`);
    console.log(`  To: ${tx.to}`);
    console.log(`  Block: ${tx.blockNumber}`);
    console.log(`  Data Length: ${tx.data.length} bytes`);
    
    // Perform call simulation
    try {
      await provider.call({
        from: tx.from,
        to: tx.to,
        data: tx.data,
        value: tx.value,
        gasPrice: tx.gasPrice,
        gasLimit: tx.gasLimit,
        blockTag: tx.blockNumber - 1
      });
      console.log("Simulation succeeded without revert! (Weird, it should revert)");
    } catch (callErr) {
      console.log("\nRevert Reason/Error message:");
      console.log(callErr.message);
      if (callErr.data) {
        console.log("Error Data Hex:", callErr.data);
        // Try decoding custom error if possible, or print it
        try {
          const iface = new hre.ethers.Interface([
            "error DivisionByZero()",
            "error SenderNotAllowed(address)",
            "error InvalidInputHandle()",
            "error EmptyInputProof()",
            "error DeserializingInputProofFail()",
            "error InvalidKMSSignatures()",
            "error KMSInvalidSigner()",
            "error EmptyDecryptionProof()"
          ]);
          const parsed = iface.parseError(callErr.data);
          if (parsed) {
            console.log(`Decoded custom error: ${parsed.name}(${parsed.args.join(", ")})`);
          }
        } catch (decErr) {
          // ignore decode errors
        }
      }
    }
  } catch (err) {
    console.error("Failed to fetch/simulate transaction:", err.message);
  }
}

main().catch(console.error);
