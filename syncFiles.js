const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { DIRS } = require('./src/fileManager'); // Make sure DIRS is exported or we hardcode it

const prisma = new PrismaClient();
const CLASSIFIED_DIR = path.join(__dirname, 'classified');

async function syncFiles() {
    console.log("Memulai sinkronisasi file lama ke database PostgreSQL...");
    let count = 0;

    // Struktur Folder: Client -> PO Number -> Category -> [Folder Grup] -> Files
    if (!fs.existsSync(CLASSIFIED_DIR)) {
        console.log("Folder classified tidak ditemukan.");
        return;
    }

    const clients = fs.readdirSync(CLASSIFIED_DIR, { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== 'Unclassified');
    
    for (const clientDir of clients) {
        const clientName = clientDir.name;
        const pos = fs.readdirSync(path.join(CLASSIFIED_DIR, clientName), { withFileTypes: true }).filter(d => d.isDirectory());
        
        for (const poDir of pos) {
            const poNumber = poDir.name;
            const categories = fs.readdirSync(path.join(CLASSIFIED_DIR, clientName, poNumber), { withFileTypes: true }).filter(d => d.isDirectory());
            
            for (const catDir of categories) {
                const category = catDir.name;
                const groups = fs.readdirSync(path.join(CLASSIFIED_DIR, clientName, poNumber, category), { withFileTypes: true }).filter(d => d.isDirectory());
                
                for (const groupDir of groups) {
                    const files = fs.readdirSync(path.join(CLASSIFIED_DIR, clientName, poNumber, category, groupDir.name), { withFileTypes: true }).filter(f => f.isFile());
                    
                    for (const file of files) {
                        const fileName = file.name;
                        const filePath = path.join(CLASSIFIED_DIR, clientName, poNumber, category, groupDir.name, fileName);
                        
                        // Extract sender from filename if possible: date_time_sender_...
                        // If not, just use "Unknown"
                        const parts = fileName.split('_');
                        const sender = parts.length > 2 ? parts[2] : "Unknown";

                        // Cek apakah sudah ada di DB
                        const existing = await prisma.document.findFirst({
                            where: { filePath: filePath }
                        });

                        if (!existing) {
                            await prisma.document.create({
                                data: {
                                    fileName,
                                    filePath,
                                    category,
                                    client: clientName,
                                    poNumber,
                                    sender
                                }
                            });
                            count++;
                        }
                    }
                }
            }
        }
    }
    
    console.log(`Berhasil mensinkronisasi ${count} file lama ke dalam database!`);
    await prisma.$disconnect();
}

syncFiles().catch(e => {
    console.error(e);
    prisma.$disconnect();
});
