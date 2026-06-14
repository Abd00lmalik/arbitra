async function main() {
  const url = "https://arbitra-dapp.vercel.app/upload";
  console.log(`Fetching ${url} page content...`);
  try {
    const res = await fetch(url);
    const html = await res.text();
    
    // Let's find script tags
    const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["']/g;
    let match;
    const scripts = [];
    while ((match = scriptRegex.exec(html)) !== null) {
      scripts.push(match[1]);
    }
    
    console.log(`Found ${scripts.length} scripts.`);
    
    const staleAddress = "0x1A889b7A754578fB4d8AF18502314059926d041E".toLowerCase();
    const correctAddress = "0x31d17A1DB4d72c63FD4E484A324E06b55c27c9CA".toLowerCase();
    
    let foundStale = false;
    let foundCorrect = false;
    
    // Check main page html first
    if (html.toLowerCase().includes(staleAddress)) {
      console.log("HTML contains stale address!");
      foundStale = true;
    }
    if (html.toLowerCase().includes(correctAddress)) {
      console.log("HTML contains correct address!");
      foundCorrect = true;
    }
    
    // Fetch and search scripts
    for (const scriptSrc of scripts) {
      // Resolve relative to domain root
      const scriptUrl = scriptSrc.startsWith("http") 
        ? scriptSrc 
        : (scriptSrc.startsWith("/") ? `${url.substring(0, url.indexOf("/upload"))}${scriptSrc}` : `${url.substring(0, url.indexOf("/upload"))}/${scriptSrc}`);
      console.log(`Scanning script: ${scriptUrl}...`);
      try {
        const scriptRes = await fetch(scriptUrl);
        const code = await scriptRes.text();
        const lowerCode = code.toLowerCase();
        
        if (lowerCode.includes(staleAddress)) {
          console.log(`=> Found STALE address in ${scriptSrc}`);
          foundStale = true;
        }
        if (lowerCode.includes(correctAddress)) {
          console.log(`=> Found CORRECT address in ${scriptSrc}`);
          foundCorrect = true;
        }
      } catch (err) {
        console.log(`Failed to scan script ${scriptSrc}: ${err.message}`);
      }
    }
    
    console.log("\nScan Summary:");
    console.log(`Stale Address Found: ${foundStale}`);
    console.log(`Correct Address Found: ${foundCorrect}`);
  } catch (err) {
    console.error("Scan failed:", err.message);
  }
}

main();
