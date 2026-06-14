const userAddress = "0x328f1245fe05ea8c9dbc7c203b4af1e6098a431e";

async function main() {
  const fallbackUrl = `https://api.etherscan.io/v2/api?chainid=11155111&module=account&action=txlist&address=${userAddress}&sort=desc`;
  try {
    const fbRes = await fetch(fallbackUrl);
    const fbData = await fbRes.json();
    console.log("Status:", fbData.status);
    console.log("Message:", fbData.message);
    if (fbData.result) {
      console.log("Result type:", typeof fbData.result);
      if (Array.isArray(fbData.result)) {
        console.log("Result length:", fbData.result.length);
        console.log("First item keys:", Object.keys(fbData.result[0]));
        console.log("First item:", JSON.stringify(fbData.result[0], null, 2));
      } else {
        console.log("Result:", fbData.result);
      }
    }
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

main();
