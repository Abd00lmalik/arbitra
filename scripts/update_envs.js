const { exec } = require("child_process");

const envs = ["production", "preview"];

const vars = {
  "NEXT_PUBLIC_APP_URL": "https://arbitra-dapp.vercel.app",
  "NEXT_PUBLIC_USE_ENV_CONTRACT_ADDRESSES": "true",
  "NEXT_PUBLIC_REGISTRY_ADDRESS": "0xDE46d22134f0a9595188aA96dFFAC82561172b9f",
  "NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS": "0x5abc39D2a5D37CCB994B85298924a415415F2658",
  "NEXT_PUBLIC_ESCROW_RECEIVER_ADDRESS": "0x6B1Abb3e6d0918F9B86e975Ef0FE93a8eBd81FAA",
  "NEXT_PUBLIC_FINGERPRINT_REGISTRY_ADDRESS": "0x4De4d767a628aa021f5E3bb6CC8B3Bf80880C4eC",
  "NEXT_PUBLIC_IDENTITY_ADDRESS": "0xF343B260c40C77670c40ED575dF8f42B8b1EB592",
  "NEXT_PUBLIC_SBT_ADDRESS": "0x1B88e4d2c70F137B0F7e40c52921D03e7849DF65",
  "NEXT_PUBLIC_INVESTOR_SBT_ADDRESS": "0x52DfdBA750528207216f3d558D5f3aD04Be23e3b",
  "NEXT_PUBLIC_KYB_ORACLE_ADDRESS": "0x8a8f06F0A8dc3dAD0e76f1eBd6CA0834f021f862",
  "NEXT_PUBLIC_INVESTOR_KYB_ORACLE_ADDRESS": "0xAB15403eE452d22A3F1a45Ba458B8c4beBcf3f9D",
  "NEXT_PUBLIC_RISK_CALC_ADDRESS": "0x4A33a848de45d79f6A8082D1d2aE93b3c85a1F91",
  "NEXT_PUBLIC_USDC_ADDRESS": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
};

function runCmdAndKill(cmd) {
  return new Promise((resolve) => {
    console.log(`Running: ${cmd}`);
    const child = exec(cmd, (error, stdout, stderr) => {
      if (stdout) console.log(`Stdout: ${stdout}`);
      if (stderr) console.error(`Stderr: ${stderr}`);
    });

    setTimeout(() => {
      console.log("Terminating process...");
      child.kill("SIGTERM");
      resolve();
    }, 4500);
  });
}

async function main() {
  for (const env of envs) {
    for (const [key, val] of Object.entries(vars)) {
      const cmd = `vercel env add ${key} ${env} --value "${val}" --yes --force --non-interactive`;
      await runCmdAndKill(cmd);
      console.log("");
    }
  }
  console.log("All environment variables updated!");
}

main().catch(console.error);
