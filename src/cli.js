// Quick check: node src/cli.js check <username>
import { getLiveInfo, normalizeUsername } from './tiktok.js';

const [cmd, user] = process.argv.slice(2);
if (cmd !== 'check' || !user) {
  console.log('Usage: node src/cli.js check <username>');
  process.exit(1);
}
const info = await getLiveInfo(normalizeUsername(user));
console.log(JSON.stringify(info, null, 2));
