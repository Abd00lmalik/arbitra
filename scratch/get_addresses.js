const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "../deployments/sepolia");
if (fs.existsSync(dir)) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
  console.log("Sepolia Deployments:");
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      console.log(`- ${path.basename(file, ".json")}: ${data.address}`);
    } catch (e) {
      console.error(file, e.message);
    }
  }
} else {
  console.log("Sepolia deployments dir not found.");
}
