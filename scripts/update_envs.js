const { exec } = require("child_process");

const envs = ["production", "preview"];

const vars = {
  "NEXT_PUBLIC_APP_URL": "https://arbitra-dapp.vercel.app",
  "NEXT_PUBLIC_USE_ENV_CONTRACT_ADDRESSES": "true",
  "NEXT_PUBLIC_REGISTRY_ADDRESS": "0x90512d8b10Ae535FBDF4Ba5e36e5437303571124",
  "NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS": "0xB60747bd18ad3680AfAc6A74F155F48024be2053",
  "NEXT_PUBLIC_ESCROW_RECEIVER_ADDRESS": "0x897B76cAEcd5E4002637fC3d4a7A98043Ca18f79",
  "NEXT_PUBLIC_FINGERPRINT_REGISTRY_ADDRESS": "0x16D38F1836444247209d4b72cbA8b72F0EC50712",
  "NEXT_PUBLIC_IDENTITY_ADDRESS": "0xF343B260c40C77670c40ED575dF8f42B8b1EB592",
  "NEXT_PUBLIC_SBT_ADDRESS": "0x1B88e4d2c70F137B0F7e40c52921D03e7849DF65",
  "NEXT_PUBLIC_INVESTOR_SBT_ADDRESS": "0x52DfdBA750528207216f3d558D5f3aD04Be23e3b",
  "NEXT_PUBLIC_KYB_ORACLE_ADDRESS": "0x995910d02e0f98d3A15834BDe8aead5230754819",
  "NEXT_PUBLIC_INVESTOR_KYB_ORACLE_ADDRESS": "0xa36ef46077BFD31A0877413a68551c47Dd472708",
  "NEXT_PUBLIC_RISK_CALC_ADDRESS": "0xFb9F6fFaf309843ad103c6aD99eD36Ba80335434",
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
