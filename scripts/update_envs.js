const { exec } = require("child_process");

const envs = ["production"];

const vars = {
  "NEXT_PUBLIC_APP_URL": "https://arbitra-dapp.vercel.app",
  "NEXT_PUBLIC_USE_ENV_CONTRACT_ADDRESSES": "true",
  "NEXT_PUBLIC_REGISTRY_ADDRESS": "0xd63b7b493f7a2b2cdD33B329afB249eecdFfaD49",
  "NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS": "0xB95d930BE201E235c327626d3C6230552920DBE5",
  "NEXT_PUBLIC_ESCROW_RECEIVER_ADDRESS": "0x9A81Ee3cD7255e2bb1ab86861904Df408c91D9e0",
  "NEXT_PUBLIC_FINGERPRINT_REGISTRY_ADDRESS": "0xF5E50261eBD2794CFF3C447fC833cA9d78d2803e",
  "NEXT_PUBLIC_IDENTITY_ADDRESS": "0xF343B260c40C77670c40ED575dF8f42B8b1EB592",
  "NEXT_PUBLIC_SBT_ADDRESS": "0x1B88e4d2c70F137B0F7e40c52921D03e7849DF65",
  "NEXT_PUBLIC_INVESTOR_SBT_ADDRESS": "0x52DfdBA750528207216f3d558D5f3aD04Be23e3b",
  "NEXT_PUBLIC_KYB_ORACLE_ADDRESS": "0x8a8f06F0A8dc3dAD0e76f1eBd6CA0834f021f862",
  "NEXT_PUBLIC_INVESTOR_KYB_ORACLE_ADDRESS": "0xAB15403eE452d22A3F1a45Ba458B8c4beBcf3f9D",
  "NEXT_PUBLIC_RISK_CALC_ADDRESS": "0x54119bDf49E69b54c8EC176CA98e3f4dC0A25d5c",
  "NEXT_PUBLIC_USDC_ADDRESS": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  "NEXT_PUBLIC_CUSDC_ADDRESS": "0xBf7BF8aF778fA83cCfb6e18B53ACa13A0a0A0Fe1"
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
