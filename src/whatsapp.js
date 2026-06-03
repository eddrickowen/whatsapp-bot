const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const mime = require('mime-types');
const path = require('path');
const fs = require('fs');

const configModule = require('./config');
const { imageBuffer, processImageGroup, DIRS, getFormattedDateAndTime } = require('./fileManager');
const { prisma } = require('./db');
const { evaluateAutomations } = require('./automations');

let lidMap = {};
let cachedGroups = [];
let cachedContacts = [];

async function fetchContactsEfficiently(client) {
    const botConfig = configModule.getConfig();
    try {
        const chats = await client.getChats();
        const groups = chats.filter(c => c.isGroup);
        cachedGroups = groups.map(g => ({ id: g.id._serialized, name: g.name }));
        
        const recentUserChats = chats.filter(c => !c.isGroup).slice(0, 10);
        let recentContacts = [];
        
        const contactPromises = recentUserChats.map(chat => 
            chat.getContact().then(contact => ({ chat, contact })).catch(() => null)
        );
        const resolvedContacts = await Promise.all(contactPromises);
        
        for (let result of resolvedContacts) {
            if (!result) continue;
            const { chat, contact } = result;
            try {
                const resolvedId = contact.number ? contact.number + '@c.us' : contact.id._serialized;
                const displayName = contact.name || contact.pushname || contact.number || contact.id.user;
                
                if (contact.id._serialized.includes('@lid') && contact.number) {
                    lidMap[contact.id._serialized] = resolvedId;
                }
                if (chat.id._serialized.includes('@lid') && contact.number) {
                    lidMap[chat.id._serialized] = resolvedId;
                }
                
                recentContacts.push({ id: resolvedId, name: displayName });
            } catch(e) {}
        }
        
        const targetUserIds = botConfig.target_users || [];
        for (let uid of targetUserIds) {
            if (!recentContacts.find(c => c.id === uid)) {
                try {
                    const contact = await client.getContactById(uid);
                    const resolvedId = contact.number ? contact.number + '@c.us' : contact.id._serialized;
                    if (contact.id._serialized.includes('@lid') && contact.number) {
                        lidMap[contact.id._serialized] = resolvedId;
                    }
                    recentContacts.push({
                        id: resolvedId,
                        name: contact.name || contact.pushname || contact.number || contact.id.user
                    });
                } catch(e) {}
            }
        }
        
        cachedContacts = recentContacts;
    } catch (err) {
        console.error("Gagal menarik daftar kontak/grup:", err);
    }
}

function getCachedGroups() { return cachedGroups; }
function getCachedContacts() { return cachedContacts; }

function setupWhatsApp() {
    const client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    client.on('qr', (qr) => {
        qrcode.generate(qr, { small: true });
        console.log('\n\nSilakan scan QR code di atas menggunakan aplikasi WhatsApp!\n\n');
    });

    client.on('ready', async () => {
        console.log('\n--- Bot WhatsApp Terkoneksi! ---');
        console.log('Bot sudah siap dan sedang mendengarkan pesan...');
        await fetchContactsEfficiently(client);
        
        // Jalankan sinkronisasi pesan media terlewat secara asinkron
        syncPastMessages(client).catch(err => {
            console.error("Gagal sinkronisasi pesan masa lalu:", err);
        });
    });

    client.on('auth_failure', msg => {
        console.error('GAGAL LOGIN (Sesi mungkin kadaluarsa/rusak):', msg);
    });

    client.on('disconnected', (reason) => {
        console.log('Bot terputus dari WhatsApp:', reason);
        configModule.addLog('SYSTEM', 'Bot', `Terputus: ${reason}. Mencoba reconnect...`, 'WARNING');
        setTimeout(() => { client.initialize(); }, 10000);
    });

    client.on('message_create', async msg => {
        try {
            const { getIO } = require('./server');
            const io = getIO();
            if (io) {
                // Fetch contact to get a real name if available
                let senderName = msg._data?.notifyName;
                try {
                    const contact = await msg.getContact();
                    if (contact) {
                        senderName = contact.name || contact.pushname || senderName || contact.number;
                    }
                } catch (e) {}
                
                io.emit('new_message', { 
                    id: msg.id.id, 
                    senderId: msg.from, 
                    to: msg.to, 
                    body: msg.body, 
                    timestamp: msg.timestamp, 
                    isFromMe: msg.fromMe, 
                    hasMedia: msg.hasMedia,
                    senderName: senderName || msg.from.split('@')[0]
                });
            }

            // Bug #6 fix: Abaikan semua pesan yang dikirim oleh bot sendiri
            if (msg.fromMe) return;

            const botConfig = configModule.getConfig();
            const addLog = configModule.addLog;
            
            const hasGroups = botConfig.target_groups && botConfig.target_groups.length > 0;
            const hasUsers = botConfig.target_users && botConfig.target_users.length > 0;
            
            if (hasGroups || hasUsers) {
                let actualSenderId = msg.author || msg.from; 
                let resolvedSenderId = lidMap[actualSenderId] || actualSenderId;
                let resolvedFrom    = lidMap[msg.from] || msg.from;
                
                const isTargetGroup = hasGroups && (
                    botConfig.target_groups.includes(msg.from) || 
                    botConfig.target_groups.includes(msg.to)
                );
                const isTargetUser = hasUsers && (
                    botConfig.target_users.includes(actualSenderId)  || 
                    botConfig.target_users.includes(resolvedSenderId) || 
                    botConfig.target_users.includes(resolvedFrom) ||
                    botConfig.target_users.includes(msg.to)
                );
                
                if (!isTargetGroup && !isTargetUser) {
                    if (msg.hasMedia) {
                        addLog('LISTENER', resolvedSenderId, `Ditolak. Asli: ${actualSenderId}, Resolved: ${resolvedSenderId}`, 'ERROR');
                    }
                    return;
                }
            }

            const now = Math.floor(Date.now() / 1000);
            let timestampSec = msg.timestamp;
            if (timestampSec > 1000000000000) {
                timestampSec = Math.floor(timestampSec / 1000);
            }
            const diffSeconds = now - timestampSec;
            if (diffSeconds > (24 * 3600)) {
                return;
            }

            if (msg.hasMedia) {
                const media = await msg.downloadMedia();
                if (media) {
                    const ext = mime.extension(media.mimetype) || 'bin';
                    let resolvedSenderId = lidMap[msg.author || msg.from] || (msg.author || msg.from);
                    const senderName = await resolveSenderName(msg, resolvedSenderId, client);

                    const tempFileName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                    const tempFilePath = path.join(DIRS.downloads, tempFileName);
                    fs.writeFileSync(tempFilePath, media.data, 'base64');
                    
                    const groupId = `${msg.from}_${resolvedSenderId}`;
                    const msgCaption = msg.body || '';

                    const botConfig = configModule.getConfig();
                    const timeoutMs = (botConfig.buffer_timeout || 3) * 60 * 1000;
                    
                    // Inisialisasi antrean buffer jika belum ada
                    if (!imageBuffer[groupId]) {
                        imageBuffer[groupId] = {
                            messages: [],
                            senderName: senderName,
                            senderId: resolvedSenderId,
                            replyTo: msg.from,
                            timer: null
                        };
                        console.log(`⏱️ [BUFFER] Memulai antrean baru untuk pengirim ${senderName}`);
                    } else if (botConfig.buffer_mode === 'debounce' && imageBuffer[groupId].timer) {
                        clearTimeout(imageBuffer[groupId].timer);
                    }

                    if (!imageBuffer[groupId].timer || botConfig.buffer_mode === 'debounce') {
                        imageBuffer[groupId].timer = setTimeout(() => {
                            const groupToProcess = imageBuffer[groupId];
                            if (!groupToProcess) return; // guard null jika buffer sudah dihapus
                            delete imageBuffer[groupId];
                            processSlicingGroup(groupToProcess, client).catch(err => {
                                console.error("❌ Gagal memproses slicing group real-time:", err);
                            });
                        }, timeoutMs);
                    }

                    // Tambahkan pesan gambar terunduh ke antrean kronologis
                    imageBuffer[groupId].messages.push({
                        hasMedia: true,
                        tempFilePath: tempFilePath,
                        mediaExt: '.' + ext,
                        origFilename: media.filename || '',
                        body: msgCaption,
                        timestamp: timestampSec,
                        senderName: senderName,
                        senderId: resolvedSenderId,
                        replyTo: msg.from
                    });

                    console.log(`📥 [BUFFER] Gambar terunduh ditambahkan ke antrean (${imageBuffer[groupId].messages.length} pesan)`);
                }
            } else if (msg.body && !msg.fromMe) {
                let resolvedSenderId = lidMap[msg.author || msg.from] || (msg.author || msg.from);
                const groupId = `${msg.from}_${resolvedSenderId}`;
                
                const botConfig = configModule.getConfig();
                
                // Masukkan teks chat jika sesi buffer sedang aktif
                if (imageBuffer[groupId]) {
                    const senderName = await resolveSenderName(msg, resolvedSenderId, client);
                    imageBuffer[groupId].messages.push({
                        hasMedia: false,
                        body: msg.body,
                        timestamp: timestampSec,
                        senderName: senderName,
                        senderId: resolvedSenderId,
                        replyTo: msg.from
                    });
                    
                    if (botConfig.buffer_mode === 'debounce' && imageBuffer[groupId].timer) {
                        clearTimeout(imageBuffer[groupId].timer);
                        const timeoutMs = (botConfig.buffer_timeout || 3) * 60 * 1000;
                        imageBuffer[groupId].timer = setTimeout(() => {
                            const groupToProcess = imageBuffer[groupId];
                            if (!groupToProcess) return;
                            delete imageBuffer[groupId];
                            processSlicingGroup(groupToProcess, client).catch(err => {
                                console.error("❌ Gagal memproses slicing group real-time:", err);
                            });
                        }, timeoutMs);
                    }
                    console.log(`📝 [BUFFER] Teks chat ditambahkan ke antrean (${imageBuffer[groupId].messages.length} pesan)`);
                }
                
                if (botConfig.auto_reply) {
                    const triggerMatch = msg.body.toUpperCase().trim() === 'BOT STATUS';
                    if (triggerMatch) {
                        client.sendMessage(msg.from, `🤖 *Bot WhatsApp Aktif*\nSiap menerima dan mengklasifikasikan dokumen Anda.`);
                    }
                }
            }

            // Run automation engine for inbound messages
            if (!msg.fromMe) {
                evaluateAutomations(client, msg).catch(err => console.error('[Auto] Error:', err.message));
            }
        } catch (err) {
            console.error('Error saat memproses pesan:', err);
        }
    });

    client.initialize();
    
    return client;
}

// Bug #1 fix: Recursive scan ke dalam subfolder caption agar file unclassified tidak diduplikasi
function findFileInDirRecursive(dir, pattern) {
    if (!fs.existsSync(dir)) return false;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (findFileInDirRecursive(path.join(dir, entry.name), pattern)) return true;
        } else if (entry.name.includes(pattern)) {
            return true;
        }
    }
    return false;
}

async function isMessageProcessed(msg, cleanSender) {
    const { dateStr, timeStr } = getFormattedDateAndTime(msg.timestamp);
    const filePattern = `${dateStr}_${timeStr}_${cleanSender}`;
    
    // 1. Periksa di database PostgreSQL (berkas terklasifikasi)
    try {
        const doc = await prisma.document.findFirst({
            where: { fileName: { contains: filePattern } }
        });
        if (doc) return true;
    } catch (e) {
        console.error("Error saat memeriksa dokumen di database:", e);
    }
    
    // 2. Bug #1 fix: Scan rekursif ke subfolder caption di Unclassified
    try {
        const unclassifiedSenderDir = path.join(DIRS.unclassified, cleanSender, dateStr);
        if (findFileInDirRecursive(unclassifiedSenderDir, filePattern)) return true;
    } catch (e) {
        console.error("Error saat memeriksa file unclassified di disk:", e);
    }
    
    return false;
}

// Saran #2: Pisahkan array pesan menjadi sesi berdasarkan jarak waktu antar pesan
function splitIntoSessions(messages, maxGapSeconds = 1800) {
    if (messages.length === 0) return [];
    const sessions = [];
    let currentSession = [messages[0]];
    for (let i = 1; i < messages.length; i++) {
        const gap = messages[i].timestamp - messages[i - 1].timestamp;
        if (gap > maxGapSeconds) {
            sessions.push(currentSession);
            currentSession = [];
        }
        currentSession.push(messages[i]);
    }
    if (currentSession.length > 0) sessions.push(currentSession);
    return sessions;
}

async function syncPastMessages(client) {
    console.log('⏳ Memulai sinkronisasi pesan media terlewat (3 Hari Terakhir)...');
    const botConfig = configModule.getConfig();
    const targetGroups = botConfig.target_groups || [];
    const targetUsers = botConfig.target_users || [];
    const allTargets = [...targetGroups, ...targetUsers];
    
    if (allTargets.length === 0) {
        console.log('ℹ️ Tidak ada target obrolan yang terkonfigurasi untuk sinkronisasi catch-up.');
        return;
    }

    let processedCount = 0;

    // Ambil daftar chat aktif yang sudah ter-cache/loaded untuk meminimalkan error getChatById
    let loadedChats = [];
    try {
        loadedChats = await client.getChats();
    } catch (chatListErr) {
        console.error("⚠️ Gagal memuat daftar chat awal:", chatListErr.message);
    }

    for (const chatId of allTargets) {
        try {
            console.log(`🔍 Memindai riwayat chat untuk: ${chatId}`);
            
            // Prioritaskan mengambil dari loadedChats untuk menghindari Puppeteer 'No LID for user' evaluation error
            let chat = loadedChats.find(c => c.id._serialized === chatId);
            if (!chat) {
                try {
                    chat = await client.getChatById(chatId);
                } catch (getChatErr) {
                    console.error(`⚠️ Gagal memuat chat ${chatId} via getChatById:`, getChatErr.message);
                    continue; // Skip obrolan ini jika terjadi error Puppeteer
                }
            }

            // Ambil n pesan terakhir dari riwayat obrolan berdasarkan konfigurasi
            const fetchLimit = botConfig.catchup_limit || 50;
            const messages = await chat.fetchMessages({ limit: fetchLimit });
            
            // Urutkan dari terlama ke terbaru (chronological) agar grouping album media konsisten
            messages.sort((a, b) => a.timestamp - b.timestamp);
            
            // Tampung seluruh pesan gambar terunduh dan teks chat terlewat secara kronologis
            const unprocessedMessages = [];

            // Bug #7 fix: Cache resolvedSenderName per senderId agar tidak query berulang
            const resolvedNamesCache = {};

            for (const msg of messages) {
                // Pastikan pesan dikirim dalam rentang n hari terakhir (sesuai konfigurasi user)
                const now = Math.floor(Date.now() / 1000);
                const diffSeconds = now - msg.timestamp;
                const catchupDays = botConfig.catchup_days || 3;
                if (diffSeconds > (catchupDays * 24 * 3600)) {
                    continue; // Abaikan jika melebihi batas hari
                }
                
                let actualSenderId = msg.author || msg.from; 
                let resolvedSenderId = lidMap[actualSenderId] || actualSenderId;
                let resolvedFrom    = lidMap[msg.from] || msg.from;
                
                // Cek kesesuaian target pengirim
                const hasGroups = botConfig.target_groups && botConfig.target_groups.length > 0;
                const hasUsers = botConfig.target_users && botConfig.target_users.length > 0;
                
                if (hasGroups || hasUsers) {
                    const isTargetGroup = hasGroups && (
                        botConfig.target_groups.includes(msg.from) || 
                        botConfig.target_groups.includes(msg.to)
                    );
                    const isTargetUser = hasUsers && (
                        botConfig.target_users.includes(actualSenderId)  || 
                        botConfig.target_users.includes(resolvedSenderId) || 
                        botConfig.target_users.includes(resolvedFrom) ||
                        botConfig.target_users.includes(msg.to)
                    );
                    
                    if (!isTargetGroup && !isTargetUser) continue;
                }

                // Bug #7 fix: Gunakan cache nama pengirim agar tidak panggil Puppeteer+DB berulang
                if (!resolvedNamesCache[resolvedSenderId]) {
                    resolvedNamesCache[resolvedSenderId] = await resolveSenderName(msg, resolvedSenderId, client);
                }
                const senderName = resolvedNamesCache[resolvedSenderId];
                const cleanSender = senderName.replace(/[\/\\?%*:|"<> ]/g, '_');

                // Bug #2 fix: isMessageProcessed hanya dipanggil untuk pesan media, bukan teks
                if (msg.hasMedia) {
                    // Periksa apakah berkas ini sudah pernah diproses di DB / Disk sebelumnya
                    const alreadyProcessed = await isMessageProcessed(msg, cleanSender);
                    if (alreadyProcessed) continue;

                    console.log(`📥 Mengunduh media terlewat dari ${senderName} (${new Date(msg.timestamp * 1000).toLocaleString()})`);
                    try {
                        const media = await msg.downloadMedia();
                        if (media) {
                            const ext = mime.extension(media.mimetype) || 'bin';
                            const tempFileName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                            const tempFilePath = path.join(DIRS.downloads, tempFileName);
                            fs.writeFileSync(tempFilePath, media.data, 'base64');
                            
                            unprocessedMessages.push({
                                hasMedia: true,
                                tempFilePath: tempFilePath,
                                mediaExt: '.' + ext,
                                origFilename: media.filename || '',
                                body: msg.body || '',
                                timestamp: msg.timestamp,
                                senderName: senderName,
                                senderId: resolvedSenderId,
                                replyTo: msg.from
                            });
                        }
                    } catch (dlErr) {
                        console.error(`⚠️ Gagal mendownload media untuk pesan ${msg.id.id}:`, dlErr.message);
                    }
                } else if (msg.body && msg.body.trim() !== '') {
                    // Cek apakah ada pesan gambar sebelumnya dalam antrean catch-up ini dari pengirim yang sama
                    const hasPriorMedia = unprocessedMessages.some(m => m.hasMedia && m.senderId === resolvedSenderId);
                    if (hasPriorMedia) {
                        unprocessedMessages.push({
                            hasMedia: false,
                            body: msg.body,
                            timestamp: msg.timestamp,
                            senderName: senderName,
                            senderId: resolvedSenderId,
                            replyTo: msg.from
                        });
                    }
                }
            }

            // Saran #2: Pisahkan pesan ke sesi berdasarkan jarak waktu (default 30 menit)
            // agar caption yang dikirim berjam-jam/berhari-hari kemudian tidak salah digabungkan
            const sessionGapSeconds = (botConfig.catchup_session_gap || 30) * 60;
            const sessions = splitIntoSessions(unprocessedMessages, sessionGapSeconds);
            const allSlicedGroups = [];
            for (const session of sessions) {
                const sessionGroups = sliceMessagesIntoGroups(session);
                allSlicedGroups.push(...sessionGroups);
            }
            const slicedGroups = allSlicedGroups;

            // Jalankan proses pengolahan grup berkas secara sekuensial (berurutan)
            for (const slicedGroup of slicedGroups) {
                const groupToProcess = {
                    images: slicedGroup.images,
                    caption: slicedGroup.caption,
                    timer: null,
                    senderName: slicedGroup.senderName,
                    senderId: slicedGroup.senderId,
                    replyTo: slicedGroup.replyTo,
                    timestamp: slicedGroup.timestamp,
                    isCatchUp: true // Matikan auto-reply untuk obrolan masa lalu
                };

                try {
                    await processImageGroup(groupToProcess.senderName, groupToProcess.senderId, groupToProcess, client);
                    processedCount += slicedGroup.images.length;
                } catch (procErr) {
                    console.error(`❌ Gagal memproses grup sinkronisasi catch-up:`, procErr);
                    slicedGroup.images.forEach(img => {
                        try { fs.unlinkSync(img.path); } catch(e) {}
                    });
                }
            }
        } catch (err) {
            console.error(`Gagal sinkronisasi pesan terlewat untuk chat ${chatId}:`, err);
        }
    }
    
    if (processedCount > 0) {
        console.log(`✅ Sinkronisasi selesai. Memproses ${processedCount} pesan media terlewat baru.`);
    } else {
        console.log(`✅ Sinkronisasi selesai. Tidak ada media terlewat baru.`);
    }
}

async function processSlicingGroup(group, client) {
    console.log(`⚙️ [BUFFER TIMER] Memproses antrean buffer 3 menit untuk ${group.senderName}...`);
    
    // Jalankan algoritma pengelompokan proksimitas caption (Slicing)
    const slicedGroups = sliceMessagesIntoGroups(group.messages);
    console.log(`⚙️ [BUFFER TIMER] Berhasil membagi antrean menjadi ${slicedGroups.length} grup klasifikasi.`);
    
    for (const slicedGroup of slicedGroups) {
        const payload = {
            images: slicedGroup.images,
            caption: slicedGroup.caption,
            timer: null,
            senderName: slicedGroup.senderName,
            senderId: slicedGroup.senderId,
            replyTo: slicedGroup.replyTo,
            timestamp: slicedGroup.timestamp,
            isCatchUp: false // Ini real-time, jadi kirim auto-reply normal!
        };
        
        try {
            await processImageGroup(payload.senderName, payload.senderId, payload, client);
        } catch (err) {
            console.error(`❌ Gagal memproses grup klasifikasi dari slicing:`, err);
            slicedGroup.images.forEach(img => {
                try { fs.unlinkSync(img.path); } catch(e) {}
            });
        }
    }
}

function sliceMessagesIntoGroups(messages) {
    const groups = [];
    let currentUncaptionedImages = [];
    
    for (const msg of messages) {
        const cleanSender = msg.senderName.replace(/[\/\\?%*:|"<> ]/g, '_');
        const senderKey = `${msg.replyTo}_${msg.senderId}`;
        
        if (msg.hasMedia) {
            const ext = msg.mediaExt || '.jpg';
            const tempFilePath = msg.tempFilePath;
            const origFilename = msg.origFilename || '';
            const inlineCaption = msg.body || '';
            
            const imageObj = {
                path: tempFilePath,
                ext: ext,
                origFilename: origFilename
            };
            
            if (inlineCaption && inlineCaption.trim() !== '') {
                // Skenario: Gambar memiliki caption bawaan sendiri.
                // Jika sebelumnya ada gambar tanpa caption yang menumpuk dari pengirim yang SAMA,
                // masukkan mereka ke grup unclassified tersendiri.
                if (currentUncaptionedImages.length > 0) {
                    const sameSenderImages = currentUncaptionedImages.filter(img => img.senderKey === senderKey);
                    const otherSenderImages = currentUncaptionedImages.filter(img => img.senderKey !== senderKey);
                    
                    if (sameSenderImages.length > 0) {
                        const firstImg = sameSenderImages[0];
                        groups.push({
                            images: sameSenderImages,
                            caption: '',
                            timestamp: firstImg.timestamp,
                            senderName: firstImg.senderName,
                            senderId: firstImg.senderId,
                            replyTo: firstImg.replyTo,
                            senderKey: firstImg.senderKey,
                            hasExplicitCaption: false
                        });
                    }
                    currentUncaptionedImages = otherSenderImages; // Pertahankan gambar pengirim lain
                }
                
                groups.push({
                    images: [imageObj],
                    caption: inlineCaption,
                    timestamp: msg.timestamp,
                    senderName: msg.senderName,
                    senderId: msg.senderId,
                    replyTo: msg.replyTo,
                    senderKey: senderKey,
                    hasExplicitCaption: true
                });
            } else {
                imageObj.timestamp = msg.timestamp;
                imageObj.senderName = msg.senderName;
                imageObj.senderId = msg.senderId;
                imageObj.replyTo = msg.replyTo;
                imageObj.senderKey = senderKey;
                currentUncaptionedImages.push(imageObj);
            }
        } else if (msg.body && msg.body.trim() !== '') {
            // Ini adalah pesan teks chat (caption terpisah)
            // Cari apakah ada gambar tanpa caption sebelumnya dari pengirim yang sama!
            const matchingUncaptionedIndex = currentUncaptionedImages.findIndex(img => img.senderKey === senderKey);
            
            if (matchingUncaptionedIndex !== -1) {
                // Ada gambar tanpa caption sebelumnya dari pengirim yang sama! 
                // Kelompokkan semua gambar tanpa caption milik pengirim ini yang dikirim sebelum teks chat ini
                const imagesForThisSender = currentUncaptionedImages.filter(img => img.senderKey === senderKey);
                
                // Hapus dari list uncaptioned utama
                currentUncaptionedImages = currentUncaptionedImages.filter(img => img.senderKey !== senderKey);
                
                groups.push({
                    images: imagesForThisSender,
                    caption: msg.body,
                    timestamp: imagesForThisSender[0].timestamp,
                    senderName: msg.senderName,
                    senderId: msg.senderId,
                    replyTo: msg.replyTo,
                    senderKey: senderKey,
                    hasExplicitCaption: true
                });
            } else {
                // Jika tidak ada gambar sebelumnya dari pengirim ini,
                // cari apakah grup terakhir milik pengirim ini bisa kita tempeli teks chat baru
                const lastGroupForSender = [...groups].reverse().find(g => g.senderKey === senderKey);
                if (lastGroupForSender) {
                    lastGroupForSender.caption += "\n" + msg.body;
                }
            }
        }
    }
    
    // Penanganan akhir setelah loop selesai:
    if (currentUncaptionedImages.length > 0) {
        // Kelompokkan sisa gambar berdasarkan senderKey
        const uncaptionedGroups = {};
        for (const img of currentUncaptionedImages) {
            if (!uncaptionedGroups[img.senderKey]) {
                uncaptionedGroups[img.senderKey] = [];
            }
            uncaptionedGroups[img.senderKey].push(img);
        }
        
        for (const [sKey, imgList] of Object.entries(uncaptionedGroups)) {
            const firstImg = imgList[0];
            // Cari apakah ada grup ber-caption sebelumnya dari pengirim ini untuk digabungkan (Rule 3)
            const lastCaptionedGroup = [...groups].reverse().find(g => g.senderKey === sKey && g.hasExplicitCaption);
            if (lastCaptionedGroup) {
                lastCaptionedGroup.images.push(...imgList);
                console.log(`[SLICING] Menggabungkan ${imgList.length} gambar sisa tanpa caption dari ${firstImg.senderName} ke grup ber-caption sebelumnya.`);
            } else {
                groups.push({
                    images: imgList,
                    caption: '',
                    timestamp: firstImg.timestamp,
                    senderName: firstImg.senderName,
                    senderId: firstImg.senderId,
                    replyTo: firstImg.replyTo,
                    senderKey: sKey,
                    hasExplicitCaption: false
                });
            }
        }
    }
    
    return groups;
}

async function resolveSenderName(msg, resolvedSenderId, client) {
    // 1. Coba ambil dari kontak asli pesan WhatsApp (msg.getContact())
    try {
        if (msg && typeof msg.getContact === 'function') {
            const contact = await msg.getContact();
            if (contact) {
                // Simpan mapping LID ke phone number jika ada
                if (contact.id._serialized.includes('@lid') && contact.number) {
                    const resolvedId = contact.number + '@c.us';
                    lidMap[contact.id._serialized] = resolvedId;
                }
                if (contact.name || contact.pushname || contact.verifiedName || contact.shortName) {
                    return contact.name || contact.pushname || contact.verifiedName || contact.shortName;
                }
            }
        }
    } catch (e) {}

    // 2. Coba ambil dari konfigurasi Whitelist TargetUser di database PostgreSQL
    try {
        const targetUser = await prisma.targetUser.findUnique({
            where: { id: resolvedSenderId }
        });
        if (targetUser && targetUser.name) {
            return targetUser.name;
        }
    } catch (dbErr) {}

    // 3. Coba ambil dari konfigurasi Whitelist TargetGroup di database PostgreSQL
    try {
        const targetGroup = await prisma.targetGroup.findUnique({
            where: { id: resolvedSenderId }
        });
        if (targetGroup && targetGroup.name) {
            return targetGroup.name;
        }
    } catch (dbErr) {}

    // 4. Coba dari cache kontak lokal
    const cached = cachedContacts.find(c => c.id === resolvedSenderId);
    if (cached && cached.name && cached.name !== resolvedSenderId.split('@')[0]) {
        return cached.name;
    }

    // 5. Fallback terakhir: Ambil getContactById atau nomor telepon mentah
    try {
        const contactById = await client.getContactById(resolvedSenderId);
        return contactById.name || contactById.pushname || contactById.verifiedName || contactById.shortName || contactById.number || resolvedSenderId.split('@')[0];
    } catch (err) {
        return resolvedSenderId.split('@')[0];
    }
}

module.exports = {
    setupWhatsApp,
    getCachedGroups,
    getCachedContacts,
    fetchContactsEfficiently
};
