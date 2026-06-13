const { exec } = require("child_process");

const envs = ["production", "preview"];

const vars = {
  "NEXT_PUBLIC_REGISTRY_ADDRESS": "0x8bE1232c5f85349727F7142e771317E5EE173F0C",
  "NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS": "0x49e24230E07E3eF2D84D9552a401A6B1C37ea527",
  "NEXT_PUBLIC_ESCROW_RECEIVER_ADDRESS": "0x2D70379Cf824456C3C16E38CAB591E206C92dcB0",
  "NEXT_PUBLIC_FINGERPRINT_REGISTRY_ADDRESS": "0x026FfC2822cd9F7F00705e31daFab9f06BbCfA85",
  "NEXT_PUBLIC_IDENTITY_ADDRESS": "0x31dA844d811f94ff34e8B3E84aC9a5fcB5eAB584",
  "NEXT_PUBLIC_SBT_ADDRESS": "0xa2Fb6d7d6058e4407Ca685192308c0a5C346b530",
  "NEXT_PUBLIC_KYB_ORACLE_ADDRESS": "0x27eB4eA7966C5d8700625567dFE6bD87f9Efaed3",
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
