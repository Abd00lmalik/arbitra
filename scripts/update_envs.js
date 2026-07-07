const { exec } = require("child_process");

const envs = ["production"];

const vars = {
  "NEXT_PUBLIC_APP_URL": "https://arbitra-dapp.vercel.app",
  "NEXT_PUBLIC_USE_ENV_CONTRACT_ADDRESSES": "true",
  "NEXT_PUBLIC_REGISTRY_ADDRESS": "0x7a3B97658e8aEFA74e28CD675d73f448cbd359B6",
  "NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS": "0x85945875ebC2BC857E2bEC6c8483A732A990c7BA",
  "NEXT_PUBLIC_ESCROW_RECEIVER_ADDRESS": "0x9d9E1be5E7340D5f82DD226E07F8c4391E7f8E35",
  "NEXT_PUBLIC_FINGERPRINT_REGISTRY_ADDRESS": "0xcFf939E8468f10394A19DB15B2F6a725985Fa2A8",
  "NEXT_PUBLIC_IDENTITY_ADDRESS": "0xF343B260c40C77670c40ED575dF8f42B8b1EB592",
  "NEXT_PUBLIC_SBT_ADDRESS": "0x1B88e4d2c70F137B0F7e40c52921D03e7849DF65",
  "NEXT_PUBLIC_INVESTOR_SBT_ADDRESS": "0x52DfdBA750528207216f3d558D5f3aD04Be23e3b",
  "NEXT_PUBLIC_KYB_ORACLE_ADDRESS": "0x295558A582bBc3Ff122Eb43abC01FB5d0fEE2c43",
  "NEXT_PUBLIC_INVESTOR_KYB_ORACLE_ADDRESS": "0x0Ef1168bcd5542048Fc3457016EF70C77eEF562C",
  "NEXT_PUBLIC_RISK_CALC_ADDRESS": "0x1d957EaD11bbDA340254FD753721d263fc7E6dA2",
  "NEXT_PUBLIC_USDC_ADDRESS": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  "NEXT_PUBLIC_CUSDC_ADDRESS": "0xBf7BF8aF778fA83cCfb6e18B53ACa13A0a0A0Fe1",
  "WRAPPERS_REGISTRY_ADDRESS": "0x2f0750Bbb0A246059d80e94c454586a7F27a128e"
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
