const { exec } = require("child_process");

const envs = ["production"];

const vars = {
  "NEXT_PUBLIC_APP_URL": "https://arbitra-dapp.vercel.app",
  "NEXT_PUBLIC_USE_ENV_CONTRACT_ADDRESSES": "true",
  "NEXT_PUBLIC_REGISTRY_ADDRESS": "0x709A65C50a592079df4Ac376a8E31eF35D5D9a39",
  "NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS": "0x8aD8705396389AA6e446532A1D0Dcd8E766Cb803",
  "NEXT_PUBLIC_ESCROW_RECEIVER_ADDRESS": "0x19DF224CC80FF95b2bcc6E4374521a364BAf045A",
  "NEXT_PUBLIC_FINGERPRINT_REGISTRY_ADDRESS": "0xD0ed1Ca29c5c6A03164cfc5a1fa358fa6A5Daf48",
  "NEXT_PUBLIC_IDENTITY_ADDRESS": "0xF343B260c40C77670c40ED575dF8f42B8b1EB592",
  "NEXT_PUBLIC_SBT_ADDRESS": "0x1B88e4d2c70F137B0F7e40c52921D03e7849DF65",
  "NEXT_PUBLIC_INVESTOR_SBT_ADDRESS": "0x52DfdBA750528207216f3d558D5f3aD04Be23e3b",
  "NEXT_PUBLIC_KYB_ORACLE_ADDRESS": "0x8a8f06F0A8dc3dAD0e76f1eBd6CA0834f021f862",
  "NEXT_PUBLIC_INVESTOR_KYB_ORACLE_ADDRESS": "0xAB15403eE452d22A3F1a45Ba458B8c4beBcf3f9D",
  "NEXT_PUBLIC_RISK_CALC_ADDRESS": "0xFDB7600f1B30504D367de1BE5112e89C024a7876",
  "NEXT_PUBLIC_USDC_ADDRESS": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  "NEXT_PUBLIC_CUSDC_ADDRESS": "0x4E7B06D78965594eB5EF5414c357ca21E1554491"
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
