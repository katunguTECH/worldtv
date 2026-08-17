const fs = require('fs');
const https = require('https');
const path = require('path');

const SOURCE_URL =
  'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'disposable-domains.json');

function fetchList(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`Request failed: ${res.statusCode}`));
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching disposable domain list...');
  const raw = await fetchList(SOURCE_URL);
  const domains = raw.split('\n').map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith('#'));
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(domains));
  console.log(`Saved ${domains.length} domains to ${OUTPUT_PATH}`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
