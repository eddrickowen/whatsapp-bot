const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const { getCachedGroups, getCachedContacts, fetchContactsEfficiently } = require('./whatsapp');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BROADCAST_CHUNK_SIZE = 5;   // messages per tick
const BROADCAST_TICK_MS   = 8000; // 8 seconds between chunks (anti-ban pacing)

let ioInstance;

function getIO() {
    return ioInstance;
}

function setupInternalApi(client) {
    const app = express();
    app.use(express.json());
    app.use(cors()); // Allow Next.js dashboard to fetch

    const server = http.createServer(app);
    const io = new Server(server, { cors: { origin: '*' } });
    ioInstance = io;

    app.get('/api/groups', (req, res) => {
        res.json(getCachedGroups() || []);
    });

    app.get('/api/contacts', (req, res) => {
        res.json(getCachedContacts() || []);
    });

    app.get('/api/status', async (req, res) => {
        try {
            const state = await client.getState();
            res.json({ connected: state === 'CONNECTED' });
        } catch (e) {
            res.json({ connected: false });
        }
    });

    app.post('/api/refresh', async (req, res) => {
        try {
            const state = await client.getState().catch(() => null);
            if (state !== 'CONNECTED') {
                return res.status(400).json({ error: 'Bot belum terkoneksi ke WhatsApp. Silakan scan QR code terlebih dahulu.' });
            }
            await fetchContactsEfficiently(client);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Failed to refresh contacts' });
        }
    });

    app.post('/api/send', async (req, res) => {
        try {
            const { targetId, message } = req.body;
            if (!targetId || !message) {
                return res.status(400).json({ error: 'targetId and message are required' });
            }
            await client.sendMessage(targetId, message);
            res.json({ success: true });
        } catch (err) {
            console.error('Failed to send message:', err);
            res.status(500).json({ error: 'Failed to send message' });
        }
    });

    app.get('/api/messages/:targetId', async (req, res) => {
        try {
            const chat = await client.getChatById(req.params.targetId);
            if (!chat) return res.json([]);
            const messages = await chat.fetchMessages({ limit: 50 });
            const formatted = messages.map(m => ({
                id: m.id.id,
                text: m.body || (m.hasMedia ? '[Media Document/Image]' : ''),
                sender: m.fromMe ? 'me' : 'them',
                timestamp: new Date(m.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: 'read'
            }));
            res.json(formatted);
        } catch (err) {
            console.error('Failed to fetch messages:', err.message);
            res.json([]);
        }
    });

    return server;
}

/**
 * Background broadcast worker.
 * Runs every BROADCAST_TICK_MS and sends a small chunk of pending targets.
 * Updates target status and broadcast sentCount in real-time.
 */
async function broadcastWorker(client) {
    try {
        // Find any broadcast that is currently in 'sending' state
        const activeBroadcasts = await prisma.broadcast.findMany({
            where: { status: 'sending' },
            include: {
                targets: {
                    where: { status: 'pending' },
                    include: { contact: true },
                    take: BROADCAST_CHUNK_SIZE
                }
            }
        });

        for (const broadcast of activeBroadcasts) {
            if (broadcast.targets.length === 0) {
                // No more pending targets — mark as completed
                await prisma.broadcast.update({
                    where: { id: broadcast.id },
                    data: { status: 'completed' }
                });
                console.log(`[Broadcast] "${broadcast.name}" completed.`);
                continue;
            }

            for (const target of broadcast.targets) {
                const phone = target.contact?.phone;
                if (!phone) {
                    await prisma.broadcastTarget.update({
                        where: { id: target.id },
                        data: { status: 'failed', errorMsg: 'No phone number' }
                    });
                    continue;
                }

                try {
                    await client.sendMessage(phone, broadcast.message);
                    await prisma.broadcastTarget.update({
                        where: { id: target.id },
                        data: { status: 'sent' }
                    });
                    await prisma.broadcast.update({
                        where: { id: broadcast.id },
                        data: { sentCount: { increment: 1 } }
                    });
                    console.log(`[Broadcast] Sent to ${phone}`);
                } catch (err) {
                    await prisma.broadcastTarget.update({
                        where: { id: target.id },
                        data: { status: 'failed', errorMsg: err.message?.substring(0, 200) }
                    });
                    console.error(`[Broadcast] Failed to send to ${phone}:`, err.message);
                }
            }
        }
    } catch (err) {
        console.error('[Broadcast Worker] Error:', err.message);
    }
}

function startBroadcastWorker(client) {
    console.log('[Broadcast Worker] Started. Polling every', BROADCAST_TICK_MS / 1000, 'seconds.');
    setInterval(() => broadcastWorker(client), BROADCAST_TICK_MS);
}

module.exports = {
    setupInternalApi,
    getIO,
    startBroadcastWorker
};
