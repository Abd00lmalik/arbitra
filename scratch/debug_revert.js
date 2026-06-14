const hre = require("hardhat");

async function main() {
  const oracleAddress = "0x27eB4eA7966C5d8700625567dFE6bD87f9Efaed3";
  const data = "0x1add0806000000000000000000000000328f1245fe05ea8c9d0c7c203b4af1e6098a431e0e18c0dabfe28885cdca1f949d1c039f9d3574a364fecbafbcd56f0653927da95e045281b2b03d295190808d5cdc68d7fac63404fcae743065ef5e12edbda7160000000000000000000000000000000000000000000000000000000000000025000000000000000000000000000000000000000000000000000000006a2cc63100000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000419354e8237a523821a2019dcc16e03c5e21ec04bfa392877c23ffadc45df54f17052a7fcb9bc9d9ea63140c328a84c77ac29ae51b0e2a07c563ab9322c59cc7521c00000000000000000000000000000000000000000000000000000000000000";

  const [deployer] = await hre.ethers.getSigners();
  const oracle = await hre.ethers.getContractAt("MockKYBOracle", oracleAddress, deployer);
  const decoded = oracle.interface.decodeFunctionData("submitKYBAttestation", data);

  console.log("Estimating gas from deployer:", deployer.address);
  try {
    const gasEst = await oracle.submitKYBAttestation.estimateGas(
      decoded[0], decoded[1], decoded[2], decoded[3], decoded[4], decoded[5]
    );
    console.log("Gas estimation succeeded! Gas:", gasEst.toString());
  } catch (error) {
    console.error("Gas estimation failed!");
    console.error(error.message);
    if (error.data) {
      console.error("Revert data:", error.data);
    }
  }
}

main().catch(console.error);
