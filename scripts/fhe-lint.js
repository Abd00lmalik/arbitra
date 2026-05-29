#!/usr/bin/env node
/**
 * fhe-lint.js
 * 
 * FHE compliance linter for Arbitra contracts.
 * Checks for the most critical FHEVM v0.11 anti-patterns.
 * 
 * Usage: node scripts/fhe-lint.js [dir]
 *   dir defaults to "contracts/"
 * 
 * Exit code:
 *   0 = all checks passed
 *   1 = one or more violations found
 */

const fs = require("fs");
const path = require("path");

const VIOLATIONS = [
  /* Anti-pattern #1: TFHE instead of FHE */
  {
    id: "AP01",
    pattern: /\bTFHE\b/,
    message: "Use FHE not TFHE — TFHE is the old v0.8 API (removed in v0.9+)",
    severity: "ERROR",
  },
  /* Anti-pattern #2: SepoliaConfig in Solidity */
  {
    id: "AP02",
    pattern: /import.*SepoliaConfig.*from.*@fhevm\/solidity/,
    message:
      "SepoliaConfig is removed in v0.9+. Use ZamaEthereumConfig from @fhevm/solidity/config/ZamaConfig.sol",
    severity: "ERROR",
  },
  /* Anti-pattern #3: euint160 usage */
  {
    id: "AP03",
    pattern: /\beuint160\b/,
    message:
      "euint160 has ZERO FHE functions. Use eaddress instead for 160-bit addresses.",
    severity: "ERROR",
  },
  /* Anti-pattern #4: eint* signed types */
  {
    id: "AP04",
    pattern: /\beint(8|16|32|64|128|256)\b/,
    message:
      "Signed eint* types have no FHE.* overloads and will fail at first use. Use euint* instead.",
    severity: "ERROR",
  },
  /* Anti-pattern #5: Non-standard euint widths */
  {
    id: "AP05",
    pattern: /\beuint(24|40|48|56|72|80|88|96|104|112|120|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248)\b/,
    message:
      "Non-power-of-2 euint types have no FHE.* overloads. Use euint8/16/32/64/128/256 only.",
    severity: "ERROR",
  },
  /* Anti-pattern #6: FHE.div with encrypted divisor */
  {
    id: "AP06",
    pattern: /FHE\.div\(\s*\w+\s*,\s*\w+\s*\)/,
    message:
      "FHE.div only supports plaintext divisors. Verify the second argument is a plaintext uint, not an encrypted handle.",
    severity: "WARNING",
  },
  /* Anti-pattern #7: allowForDecryption (doesn't exist) */
  {
    id: "AP07",
    pattern: /FHE\.allowForDecryption/,
    message:
      "FHE.allowForDecryption does not exist. Use FHE.makePubliclyDecryptable(handle) instead.",
    severity: "ERROR",
  },
  /* Anti-pattern #8: Missing allowThis after FHE computation */
  {
    id: "AP08",
    pattern: /=\s*FHE\.(add|sub|mul|div|rem|select|and|or|xor|shl|shr)\([^;]+\);(?!\s*(FHE\.allowThis|FHE\.allow))/,
    message:
      "FHE operation result may be missing FHE.allowThis() call. Verify persistent ACL is granted.",
    severity: "WARNING",
  },
  /* Anti-pattern #9: view/pure functions calling FHE ops */
  {
    id: "AP09",
    pattern: /function\s+\w+\s*\([^)]*\)\s+(external|public|internal|private)?\s+(view|pure)\s+[^{]*\{[^}]*FHE\.(add|sub|mul|div|select|fromExternal)/,
    message:
      "FHE operations (add/sub/mul/div/fromExternal/select) cannot be in view/pure functions — they mutate coprocessor state.",
    severity: "ERROR",
  },
  /* Anti-pattern #10: initFhevm (old API) */
  {
    id: "AP10",
    pattern: /initFhevm\(\)/,
    message:
      "initFhevm() is the old API. Use initSDK() from @zama-fhe/relayer-sdk/web in v0.11.",
    severity: "ERROR",
  },
  /* Anti-pattern #11: bare import of relayer-sdk */
  {
    id: "AP11",
    pattern: /from\s+['"]@zama-fhe\/relayer-sdk['"]/,
    message:
      "Bare import of @zama-fhe/relayer-sdk fails. Use the sub-path: @zama-fhe/relayer-sdk/web (browser) or /node (Node.js).",
    severity: "ERROR",
  },
  /* Anti-pattern #12: FHE.select with mismatched types (manual check hint) */
  {
    id: "AP12",
    pattern: /FHE\.select\s*\(/,
    message:
      "FHE.select requires EXACT same type for both branches. Ensure no implicit upcast.",
    severity: "INFO",
  },
  /* Anti-pattern #13: results.values instead of clearValues */
  {
    id: "AP13",
    pattern: /\.values\[/,
    message:
      "publicDecrypt result uses .clearValues[], not .values[]. userDecrypt returns a bare Record (no wrapper).",
    severity: "WARNING",
  },
  /* Anti-pattern #14: Using euint4 (deprecated) */
  {
    id: "AP14",
    pattern: /\beuint4\b/,
    message:
      "euint4 is deprecated. Use euint8 (smallest supported width) instead.",
    severity: "WARNING",
  },
  /* Anti-pattern #15: FHE.randBoundedEuint (doesn't exist) */
  {
    id: "AP15",
    pattern: /FHE\.randBounded/,
    message:
      "FHE.randBoundedEuintXX does not exist. Use FHE.randEuintXX(powerOf2) instead.",
    severity: "ERROR",
  },
];

function lint(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const findings = [];

  for (const v of VIOLATIONS) {
    lines.forEach((line, idx) => {
      /* Skip comments */
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

      if (v.pattern.test(line)) {
        findings.push({
          severity: v.severity,
          id: v.id,
          line: idx + 1,
          content: line.trim(),
          message: v.message,
        });
      }
    });
  }

  return findings;
}

function walk(dir) {
  const results = [];
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walk(fullPath));
    } else if (
      file.endsWith(".sol") ||
      file.endsWith(".ts") ||
      file.endsWith(".tsx")
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

function main() {
  const targetDir = process.argv[2] || "contracts";
  const absDir = path.resolve(process.cwd(), targetDir);

  if (!fs.existsSync(absDir)) {
    console.error(`[fhe-lint] Directory not found: ${absDir}`);
    process.exit(1);
  }

  const files = walk(absDir);
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalInfos = 0;
  let filesWithIssues = 0;

  console.log(`\n🔍 FHE Lint — Arbitra FHEVM v0.11 compliance check`);
  console.log(`📁 Scanning ${files.length} files in ${absDir}\n`);

  for (const filePath of files) {
    const findings = lint(filePath);
    if (findings.length === 0) continue;

    filesWithIssues++;
    const rel = path.relative(process.cwd(), filePath);
    console.log(`📄 ${rel}`);

    for (const f of findings) {
      const icon = f.severity === "ERROR" ? "❌" : f.severity === "WARNING" ? "⚠️" : "ℹ️";
      console.log(`  ${icon} [${f.id}] Line ${f.line}: ${f.message}`);
      console.log(`     ${f.content.slice(0, 80)}${f.content.length > 80 ? "..." : ""}`);

      if (f.severity === "ERROR") totalErrors++;
      else if (f.severity === "WARNING") totalWarnings++;
      else totalInfos++;
    }
    console.log("");
  }

  console.log("─".repeat(60));
  console.log(`📊 Results: ${totalErrors} errors, ${totalWarnings} warnings, ${totalInfos} infos`);
  console.log(`   Files with issues: ${filesWithIssues} / ${files.length}`);

  if (totalErrors === 0 && totalWarnings === 0) {
    console.log("✅ All FHE compliance checks passed!\n");
    process.exit(0);
  } else if (totalErrors > 0) {
    console.log("❌ FHE lint failed — fix errors before deploying.\n");
    process.exit(1);
  } else {
    console.log("⚠️  FHE lint passed with warnings — review before deploying.\n");
    process.exit(0);
  }
}

main();
