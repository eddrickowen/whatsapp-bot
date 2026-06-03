const fs = require('fs');
const path = require('path');
const configModule = require('./config');
const { getOCR, smartExtract } = require('./parser');

const IS_BUN = typeof Bun !== 'undefined';

const DIRS = {
    downloads: path.join(__dirname, '../downloads'),
    classified: path.join(__dirname, '../classified'),
    unclassified: path.join(__dirname, '../classified', 'Unclassified')
};

function setupDirectories() {
    const botConfig = configModule.getConfig();
    if (botConfig.base_directory && botConfig.base_directory.trim() !== '') {
        DIRS.classified = botConfig.base_directory;
        DIRS.unclassified = path.join(botConfig.base_directory, 'Unclassified');
    } else {
        DIRS.classified = path.join(__dirname, '../classified');
        DIRS.unclassified = path.join(__dirname, '../classified', 'Unclassified');
    }
    
    Object.values(DIRS).forEach(dir => {
        if (!fs.existsSync(dir)) {
            try {
                fs.mkdirSync(dir, { recursive: true });
            } catch (e) {
                console.error("Gagal membuat direktori:", dir, e);
            }
        }
    });
}

// Initial setup
setupDirectories();

// Cleanup temporary files on startup
try {
    const tempFiles = fs.readdirSync(DIRS.downloads).filter(f => f.startsWith('temp_'));
    tempFiles.forEach(f => fs.unlinkSync(path.join(DIRS.downloads, f)));
    if (tempFiles.length > 0) console.log(`[CLEANUP] ${tempFiles.length} file temporary dibersihkan.`);
} catch(e) {}

function isCompressibleImage(ext) {
    if (!ext) return false;
    const e = ext.toLowerCase();
    return e === '.jpg' || e === '.jpeg' || e === '.png';
}

async function saveOrCompressFile(src, dest, forceWebp = false, deleteSource = false) {
    const ext = path.extname(src);
    let finalDest = dest;
    
    if (isCompressibleImage(ext) && forceWebp) {
        finalDest = dest.substring(0, dest.lastIndexOf('.')) + '.webp';
        try {
            const sharp = require('sharp');
            await sharp(src)
                .webp({ lossless: true })
                .toFile(finalDest);
        } catch (e) {
            console.error("Gagal kompresi WebP (Sharp Error), fallback ke copy biasa:", e);
            finalDest = dest;
            fs.copyFileSync(src, finalDest);
        }
    } else {
        fs.copyFileSync(src, finalDest);
    }
    
    if (deleteSource) {
        try {
            fs.unlinkSync(src);
        } catch (e) {
            console.error("Gagal menghapus file temporary:", e);
        }
    }
    
    return finalDest;
}

function getFormattedDateAndTime(timestampSec) {
    const now = timestampSec ? new Date(timestampSec * 1000) : new Date();
    const yyyy = now.getFullYear().toString();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return {
        dateStr: `${yyyy}${mm}${dd}`,
        timeStr: `${hh}${min}${ss}`
    };
}

// Map for processing timers
const imageBuffer = {};


async function processImageGroup(senderName, senderId, group, client) {
    const botConfig = configModule.getConfig();
    const addLog = configModule.addLog;
    
    // Ensure directories are updated based on current config
    setupDirectories();
    
    // Bersihkan nama pengirim dari karakter terlarang
    const cleanSender = senderName.replace(/[\/\\?%*:|"<> ]/g, '_');
    
    console.log(`Processing group of ${group.images.length} images from ${cleanSender}...`);
    console.log(`[DEBUG] Caption grup ini: "${group.caption}"`);

    // --- PHASE 2: DIRECT FOLDER MAPPING BYPASS ---
    const mappedFolderObj = botConfig.folder_mappings?.find(m => m.id === senderId);
    if (mappedFolderObj) {
        const { dateStr, timeStr } = getFormattedDateAndTime(group.timestamp);
        const mappedFolderName = mappedFolderObj.folderName;
        
        // Save directly to base_directory / mappedFolderName / dateStr
        const targetDir = path.join(DIRS.classified, mappedFolderName, dateStr);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        const forceWebp = (botConfig.media_format === 'webp_lossless');
        for (let index = 0; index < group.images.length; index++) {
            const img = group.images[index];
            let origNamePart = "";
            if (img.origFilename) {
                const baseName = path.parse(img.origFilename).name;
                origNamePart = `_${baseName.replace(/[\/\\?%*:|"<> ]/g, '-')}`;
            }
            const fileName = `${dateStr}_${timeStr}_${cleanSender}_MAPPED_${index + 1}${origNamePart}${img.ext}`;
            const targetPath = path.join(targetDir, fileName);
            const finalPath = await saveOrCompressFile(img.path, targetPath, forceWebp, true);
            console.log(`Tersimpan (Mapped): ${finalPath}`);
            
            // Add to PostgreSQL Database (Folder Mapping Category)
            try {
                const { prisma } = require('./db');
                await prisma.document.create({
                    data: {
                        fileName: fileName,
                        filePath: finalPath,
                        category: 'MAPPED',
                        client: mappedFolderName,
                        poNumber: 'N/A',
                        sender: cleanSender
                    }
                });
            } catch(dbErr) {
                console.error("Gagal menyimpan data dokumen (Mapped) ke PostgreSQL:", dbErr);
            }
        }
        
        addLog('MAPPED', cleanSender, `Berhasil memproses ${group.images.length} foto langsung ke folder ${mappedFolderName}`, 'SUCCESS');
        
        if (botConfig.auto_reply && client && !group.isCatchUp) {
            client.sendMessage(group.replyTo || senderId, `✅ *Berhasil Diproses*\n${group.images.length} foto disimpan langsung ke folder ${mappedFolderName}.`).catch(e => console.error("Auto-reply failed:", e.message));
        }
        
        console.log(`Selesai memproses (Mapped) grup dari ${cleanSender}.\n`);
        return; // Bypass the rest
    }
    // ---------------------------------------------
    
    let parsedData = smartExtract(group.caption, botConfig);

    // OCR Fallback jika masih mau dipakai
    if (!parsedData && botConfig.use_ocr) {
        console.log("Caption tidak dimengerti. Mencoba OCR secara longgar...");
        for (let i = 0; i < group.images.length; i++) {
            const imgPath = group.images[i].path;
            if (!imgPath.toLowerCase().endsWith('.pdf')) {
                try {
                    const TesseractLib = getOCR();
                    const { data: { text } } = await TesseractLib.recognize(imgPath, 'eng+ind');
                    parsedData = smartExtract(text, botConfig);
                    if (parsedData) {
                        console.log(`Keyword ditemukan dari OCR foto ke-${i+1}! Kategori: ${parsedData.category}`);
                        break; 
                    }
                } catch (err) {
                    console.error(`OCR failed for ${imgPath}:`, err);
                }
            }
        }
    }

    const { dateStr, timeStr } = getFormattedDateAndTime(group.timestamp);

    if (!parsedData) {
        // GAGAL KLASIFIKASI
        let fallbackCaption = group.caption ? group.caption.substring(0, 40).replace(/[\/\\?%*:|"<> \n\r]/g, '_') : 'Tanpa_Keterangan';
        if (!fallbackCaption || fallbackCaption.trim() === '_' || fallbackCaption.trim() === '') {
            fallbackCaption = 'Tanpa_Keterangan';
        }
        
        // Struktur: Unclassified -> Pengirim -> Tanggal -> Caption (Item)
        const targetDir = path.join(DIRS.unclassified, cleanSender, dateStr, fallbackCaption);
        
        console.log(`Gagal diklasifikasi. Masuk ke folder Unclassified: ${targetDir}`);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        const forceWebp = (botConfig.media_format === 'webp_lossless');
        for (let index = 0; index < group.images.length; index++) {
            const img = group.images[index];
            let origNamePart = "";
            if (img.origFilename) {
                const baseName = path.parse(img.origFilename).name;
                origNamePart = `_${baseName.replace(/[\/\\?%*:|"<> ]/g, '-')}`;
            }
            const fileName = `${dateStr}_${timeStr}_${cleanSender}_UNCLASSIFIED_${index + 1}${origNamePart}${img.ext}`;
            const targetPath = path.join(targetDir, fileName);
            const finalPath = await saveOrCompressFile(img.path, targetPath, forceWebp, true);
            console.log(`Tersimpan: ${finalPath}`);
        }
        
        addLog('UNCLASSIFIED', cleanSender, `Gagal diklasifikasi. ${group.images.length} foto masuk ke folder Unclassified. Caption: ${fallbackCaption}`, 'WARNING');
        
        if (botConfig.auto_reply && client && !group.isCatchUp) {
            client.sendMessage(group.replyTo || senderId, `⚠️ *Gagal Diklasifikasi*\n${group.images.length} foto Anda telah disimpan di folder Unclassified karena format caption tidak dikenali atau nama PT tidak terdeteksi.`).catch(e => console.error("Auto-reply failed:", e.message));
        }
    } else {
        // BERHASIL KLASIFIKASI (Multi-PO & Folder Client-Centric)
        const folderDesc = `${dateStr}_${parsedData.itemsDesc}`;
        const catName = parsedData.category;
        
        let successMsg = `✅ *Berhasil Diproses*\n${group.images.length} foto diterima:\n`;
        let targetLog = [];
        const forceWebp = (botConfig.media_format === 'webp_lossless');
        
        for (let imgIndex = 0; imgIndex < group.images.length; imgIndex++) {
            const img = group.images[imgIndex];
            const urut = imgIndex + 1;
            
            // Loop ke setiap target PO (Duplikasi)
            for (let targetIndex = 0; targetIndex < parsedData.targets.length; targetIndex++) {
                const target = parsedData.targets[targetIndex];
                const poClientName = target.poClient.replace(/ /g, '_');
                const poNumName = target.poNumber !== 'Tanpa_Nomor_PO' ? '_' + target.poNumber.replace(/ /g, '_') : '';
                const fileDesc = `_${parsedData.itemsDesc}`;
                
                // Struktur Folder Baru: Client -> PO Number -> Category -> Item
                const targetDir = path.join(DIRS.classified, target.poClient, target.poNumber, catName, folderDesc);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                let origNamePart = "";
                if (img.origFilename) {
                    const baseName = path.parse(img.origFilename).name;
                    origNamePart = `_${baseName.replace(/[\/\\?%*:|"<> ]/g, '-')}`;
                }

                const fileName = `${dateStr}_${timeStr}_${cleanSender}_${catName}_${poClientName}${poNumName}${fileDesc}_${urut}${origNamePart}${img.ext}`;
                const targetPath = path.join(targetDir, fileName);
                
                let finalPath = '';
                if (targetIndex === parsedData.targets.length - 1) {
                    finalPath = await saveOrCompressFile(img.path, targetPath, forceWebp, true);
                } else {
                    finalPath = await saveOrCompressFile(img.path, targetPath, forceWebp, false);
                }
                
                // Add to PostgreSQL Database
                try {
                    const { prisma } = require('./db');
                    await prisma.document.create({
                        data: {
                            fileName: fileName,
                            filePath: finalPath,
                            category: catName,
                            client: target.poClient,
                            poNumber: target.poNumber,
                            sender: cleanSender
                        }
                    });
                } catch(dbErr) {
                    console.error("Gagal menyimpan data dokumen ke PostgreSQL:", dbErr);
                }

                if (imgIndex === 0) {
                    targetLog.push(`- PT. ${target.poClient} / ${target.poNumber} / ${catName}`);
                }
                console.log(`Tersimpan: [PT: ${target.poClient}] [PO: ${target.poNumber}] -> ${finalPath}`);
            }
        }
        
        addLog('DOWNLOAD', cleanSender, `Berhasil memproses ${group.images.length} foto. Kategori: ${catName}`, 'SUCCESS');
        
        if (botConfig.auto_reply && client && !group.isCatchUp) {
            successMsg += targetLog.join('\n');
            client.sendMessage(group.replyTo || senderId, successMsg).catch(e => console.error("Auto-reply failed:", e.message));
        }
    }

    console.log(`Selesai memproses grup dari ${cleanSender}.\n`);
}

module.exports = {
    DIRS,
    setupDirectories,
    imageBuffer,
    processImageGroup,
    getFormattedDateAndTime
};
