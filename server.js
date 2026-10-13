import { config } from ./config.js';
import { createApp } from './src/app.js';
import { enabledStores } from './src/stores/index.js';

const server = createApp();
/* Searches can take a while; do not let Node cut the socket before our own time budget does. */
server.requestTimeout = 60_000;
server.headersTimeout = 20_000;

server.listen(config.port, '0.0.0.0', () => {
  console.log(`ShopSmart backend listening on :${config.port}`);
  console.log(`Stores: ${enabledStores().map((s) => s.id).join(', ') || '(none)'}`);
  if (!config.zenrowsKey) console.warn('WARNING: ZENROWS_API_KEY is not set. /api/search will answer 503.');
  if (config.corsOrigins.includes('*')) console.warn('Note: CORS is open to every origin. Set CORS_ORIGINS in production.');
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`${sig} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
