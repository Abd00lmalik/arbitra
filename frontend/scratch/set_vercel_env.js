const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const envPath = path.join(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
  console.error('.env.local file not found at:', envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split(/\r?\n/);
const envVars = {};

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  if (key) {
    envVars[key] = val;
  }
}

const envs = ['production', 'preview', 'development'];

for (const [key, val] of Object.entries(envVars)) {
  if (!val) {
    console.log(`Skipping empty variable: ${key}`);
    continue;
  }
  for (const env of envs) {
    console.log(`Adding ${key} to ${env}...`);
    try {
      // Escape double quotes and backslashes in value
      const escapedVal = val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const cmd = `npx vercel env add "${key}" "${env}" --value "${escapedVal}" --yes --force`;
      execSync(cmd, { stdio: 'inherit' });
    } catch (err) {
      console.error(`Failed to add ${key} to ${env}:`, err.message);
    }
  }
}
console.log('Done adding environment variables!');
