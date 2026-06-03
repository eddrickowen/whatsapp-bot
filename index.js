const { setupWhatsApp } = require('./src/whatsapp');
const { setupInternalApi, startBroadcastWorker } = require('./src/server');

// Initialize WhatsApp client
const client = setupWhatsApp();

// Start Internal API for Next.js Dashboard to fetch live state
const internalApp = setupInternalApi(client);
internalApp.listen(3001, () => {
    console.log(`📡 Internal API aktif di port 3001 untuk melayani Dashboard.`);
    // Start the broadcast sender worker after the server is live
    startBroadcastWorker(client);
});

console.log(`\n===================================================`);
console.log(`🤖 WHATSAPP BOT BACKEND AKTIF!`);
console.log(`(Web Dashboard kini dilayani oleh Next.js di port 3000)`);
console.log(`===================================================\n`);

// Graceful Shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    try {
        await client.destroy();
    } catch(e) {}
    process.exit(0);
});
