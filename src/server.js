const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const { getCachedGroups, getCachedContacts, fetchContactsEfficiently } = require('./whatsapp');

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

module.exports = {
    setupInternalApi,
    getIO
};
