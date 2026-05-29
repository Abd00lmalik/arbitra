import { ethers } from "hardhat";

const PAIRS = [
  { underlying: "0x9b5cd13b8efbb58dc25a05cf411d8056058adfff", confidential: "0x7c5bf43b851c1dff1a4fee8db225b87f2c223639" },
  { underlying: "0xa7da08fafdc9097cc0e7d4f113a61e31d7e8e9b0", confidential: "0x4e7b06d78965594eb5ef5414c357ca21e1554491" },
  { underlying: "0xff54739b16576fa5402f211d0b938469ab9a5f3f", confidential: "0x46208622da27d91db4f0393733c8ba082ed83158" },
  { underlying: "0xff021fb13ca64e5354c62c954b949a88cfdeb25e", confidential: "0xaa5612fa27c927a0c7961f5aefee5ba3a0f9c891" },
  { underlying: "0x75355a85c6fb9df5f0c80ff54e8747eee9a0bf57", confidential: "0xf2d628d2598af4eaf94cb76a437ff86ca78ffbfb" },
  { underlying: "0x93c931278a2aad1916783f952f94276ea5111442", confidential: "0xfce5c7069c5525ef6c8c2b2e35a745ba20a2f7cc" },
  { underlying: "0x24377ae4aa0c45ecee71225007f17c5d423dd940", confidential: "0xe4fcf848739845bc81dee1d5352cf3844f0a60c7" },
  { underlying: "0xf6ef9adb61a48e29e36bc873070a46a3d2667ff3", confidential: "0x167dc962808b32cfffc7e14b5018c0be06a3a208" },
];

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

async function main() {
  const provider = ethers.provider;
  console.log("Identifying registered tokens on Sepolia...");

  for (const pair of PAIRS) {
    try {
      const undAddr = ethers.getAddress(pair.underlying);
      const confAddr = ethers.getAddress(pair.confidential);

      const undContract = new ethers.Contract(undAddr, ERC20_ABI, provider);
      const confContract = new ethers.Contract(confAddr, ERC20_ABI, provider);

      const undSymbol = await undContract.symbol().catch(() => "UNKNOWN");
      const undName = await undContract.name().catch(() => "UNKNOWN");

      const confSymbol = await confContract.symbol().catch(() => "UNKNOWN");
      const confName = await confContract.name().catch(() => "UNKNOWN");

      console.log(`\n--------------------------------------------`);
      console.log(`Underlying: ${undAddr} | Symbol: ${undSymbol} | Name: ${undName}`);
      console.log(`Confidential: ${confAddr} | Symbol: ${confSymbol} | Name: ${confName}`);
    } catch (err: any) {
      console.error(`Error processing pair ${pair.underlying} / ${pair.confidential}:`, err.message || err);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
