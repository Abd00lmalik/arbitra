/*
 * @file runtime-paths.ts
 * @description Resolves package asset paths across local, test, and serverless runtimes.
 */

import fs from "fs";
import path from "path";

/**
 * Walk upward from the current working directory until a matching package path exists.
 *
 * @param packageName NPM package name.
 * @param pathParts Relative path inside the package.
 * @returns Absolute path to the resolved asset.
 */
export function resolvePackageAsset(packageName: string, ...pathParts: string[]): string {
  const rootsToTry: string[] = [];
  let current = process.cwd();

  while (true) {
    rootsToTry.push(current);
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  for (const root of rootsToTry) {
    const candidate = path.join(root, "node_modules", packageName, ...pathParts);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to resolve package asset for ${packageName}/${pathParts.join("/")}`);
}
