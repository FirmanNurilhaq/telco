const path = require('path');
// Load .env from backend/ dir regardless of where node is invoked from
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const { startAutoRefresh } = require('./cache');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/api', routes);

console.log('[server] Starting up...');
console.log(`[server] CWD: ${process.cwd()}`);
console.log(`[server] __dirname: ${__dirname}`);

app.listen(PORT, async () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
  // startAutoRefresh awaits the first fetch before returning
  await startAutoRefresh(10000);
  console.log('[server] Initial data load complete. Ready to serve requests.');
});
