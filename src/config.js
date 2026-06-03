const { prisma } = require('./db');

let botConfig = { 
    target_groups: [], 
    target_users: [], 
    known_clients: ['SJIO'],
    valid_categories: ['PENERIMAAN', 'PENGIRIMAN', 'RETUR', 'TF', 'PEMBELIAN', 'RESI'],
    category_aliases: {
        "PENERIMAAN": ["terima", "nerima"],
        "TF": ["tranfer", "tt"]
    },
    client_aliases: {
        "SJIO": ["sumber jaya", "sumber jaya industri oleo"]
    },
    auto_reply: true,
    use_ocr: false,
    media_format: 'original',
    buffer_mode: 'fixed',
    buffer_timeout: 3,
    catchup_days: 3,
    catchup_session_gap: 30,
    catchup_limit: 50,
    blacklist_words: ["SEMALAM", "KEMARIN", "HARI_INI", "HARI INI", "TADI", "OK", "SIAP", "DARI", "UNTUK", "DAN", "YANG", "DENGAN", "SUDAH", "BELUM", "BARU", "LAMA", "PAGI", "SIANG", "SORE", "MALAM", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU", "MINGGU", "BUAT", "INI", "ITU", "YA", "OKE", "BESOK", "LUSA", "BULAN", "TAHUN", "TANGGAL", "JAM", "MENIT", "DETIK", "HARI"],
    base_directory: '',
    folder_mappings: []
};

async function syncConfigFromDb() {
    try {
        const conf = await prisma.config.findFirst();
        if (conf) {
            botConfig.auto_reply = conf.autoReply;
            botConfig.use_ocr = conf.useOcr;
            botConfig.media_format = conf.mediaFormat;
            
            if (conf.bufferMode) botConfig.buffer_mode = conf.bufferMode;
            if (conf.bufferTimeout) botConfig.buffer_timeout = conf.bufferTimeout;
            if (conf.catchupDays) botConfig.catchup_days = conf.catchupDays;
            if (conf.catchupSessionGap) botConfig.catchup_session_gap = conf.catchupSessionGap;
            if (conf.catchupLimit) botConfig.catchup_limit = conf.catchupLimit;
            if (conf.blacklistWords && conf.blacklistWords.length > 0) {
                botConfig.blacklist_words = conf.blacklistWords;
            }
            if (conf.baseDirectory !== undefined) {
                botConfig.base_directory = conf.baseDirectory;
            }
        }

        const categories = await prisma.validCategory.findMany();
        if (categories.length > 0) {
            botConfig.valid_categories = categories.map(c => c.name);
            botConfig.category_aliases = {};
            categories.forEach(c => {
                if (c.aliases && c.aliases.length > 0) {
                    botConfig.category_aliases[c.name] = c.aliases;
                }
            });
        }

        const clients = await prisma.clientKeyword.findMany();
        if (clients.length > 0) {
            botConfig.known_clients = clients.map(c => c.name);
            botConfig.client_aliases = {};
            clients.forEach(c => {
                if (c.aliases && c.aliases.length > 0) {
                    botConfig.client_aliases[c.name] = c.aliases;
                }
            });
        }

        const targetGroups = await prisma.targetGroup.findMany();
        botConfig.target_groups = targetGroups.map(g => g.id);

        const targetUsers = await prisma.targetUser.findMany();
        botConfig.target_users = targetUsers.map(u => u.id);

        const folderMappings = await prisma.folderMapping.findMany();
        botConfig.folder_mappings = folderMappings.map(m => ({
            id: m.id,
            folderName: m.folderName
        }));

    } catch (e) {
        console.error("Gagal sinkronisasi config dari database:", e);
    }
}

// Keep it synchronous for legacy support in existing codebase
function getConfig() {
    return botConfig;
}

// Log history to DB asynchronously
function addLog(type, sender, details, status) {
    prisma.logHistory.create({
        data: {
            type,
            sender,
            details,
            status
        }
    }).catch(e => {
        console.error("Gagal menyimpan log ke database:", e);
    });
}

function getHistory() {
    // Return empty array since dashboard now handles history viewing.
    // Bot internals rarely need to read history back.
    return [];
}

function saveConfig(newConfig) {
    // Left empty/stubbed since Next.js Dashboard will handle saving configs.
    console.warn("saveConfig dipanggil, tetapi sekarang seharusnya Next.js yang menangani DB");
}

// Initial Sync & Periodic Polling (every 10 seconds)
syncConfigFromDb();
setInterval(syncConfigFromDb, 10000);

module.exports = {
    getConfig,
    saveConfig,
    getHistory,
    addLog
};
