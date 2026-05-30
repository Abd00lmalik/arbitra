import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction }             from "hardhat-deploy/types";

/*
 * Zama Wrappers Registry on Sepolia.
 * USDC on Sepolia (official Circle): 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
 * USDT on Sepolia (Zama underlying): 0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0
 */
const WRAPPERS_REGISTRY = "0x2f0750Bbb0A246059d80e94c454586a7F27a128e";
const USDC_SEPOLIA       = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const USDT_SEPOLIA       = "0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0";

/* Minimal ABI for getConfidentialTokenAddress */
const REGISTRY_ABI = [
  "function getConfidentialTokenAddress(address token) external view returns (bool found, address confidentialToken)"
];

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network, ethers: hEthers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  let cUSDCAddress: string;

  if (network.name === "sepolia") {
    /* Query the Zama Wrappers Registry for the canonical cUSDC address */
    const registry = new hEthers.Contract(
      WRAPPERS_REGISTRY, REGISTRY_ABI,
      await hEthers.provider.getSigner(deployer)
    );
    
    console.log(`\nQuerying wrappers registry at ${WRAPPERS_REGISTRY} for USDC ${USDC_SEPOLIA}...`);
    try {
      const [found, confidentialToken] = await registry.getConfidentialTokenAddress(USDC_SEPOLIA);
      if (found && confidentialToken !== hEthers.ZeroAddress) {
        cUSDCAddress = confidentialToken;
        console.log(`✓ cUSDC address from Zama Wrappers Registry: ${cUSDCAddress}`);
      } else {
        console.log(`⚠️ cUSDC not found in Zama Wrappers Registry for USDC. Querying cUSDT as fallback...`);
        const [usdtFound, usdtConfidentialToken] = await registry.getConfidentialTokenAddress(USDT_SEPOLIA);
        if (usdtFound && usdtConfidentialToken !== hEthers.ZeroAddress) {
          cUSDCAddress = usdtConfidentialToken;
          console.log(`✓ Using cUSDT from Wrappers Registry as cUSDC fallback: ${cUSDCAddress}`);
        } else {
          cUSDCAddress = "0x4E7B06D78965594eB5EF5414c357ca21E1554491"; // hardcoded fallback
          console.log(`✓ Using hardcoded cUSDT address as fallback: ${cUSDCAddress}`);
        }
      }
    } catch (e: any) {
      console.warn(`⚠️ Registry query failed: ${e.message || e}. Using hardcoded fallback.`);
      cUSDCAddress = "0x4E7B06D78965594eB5EF5414c357ca21E1554491"; // cUSDT fallback
    }
  } else {
    /*
     * For local testing: deploy a minimal ERC-20 mock that satisfies
     * the IERC7984 interface.
     */
    const mock = await deploy("MockERC7984", {
      from: deployer, args: [], log: true, waitConfirmations: 1,
    });
    cUSDCAddress = mock.address;
    console.log(`(local) MockERC7984 at ${cUSDCAddress}`);
  }

  const registry = await deploy("ArbitraInvoiceRegistry", {
    from: deployer,
    args: [cUSDCAddress],
    log: true,
    waitConfirmations: network.name === "sepolia" ? 2 : 1,
  });

  console.log("\n════════════════════════════════════════════════════");
  console.log("DEPLOYMENT COMPLETE — ADD TO VERCEL ENV VARIABLES:");
  console.log(`NEXT_PUBLIC_REGISTRY_ADDRESS=${registry.address}`);
  console.log(`NEXT_PUBLIC_CUSDC_ADDRESS=${cUSDCAddress}`);
  console.log(`NEXT_PUBLIC_USDC_ADDRESS=${USDC_SEPOLIA}`);
  console.log("════════════════════════════════════════════════════\n");
};

func.tags = ["ArbitraInvoiceRegistry"];
export default func;
