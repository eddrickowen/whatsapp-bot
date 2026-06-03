let Tesseract = null;
function getOCR() {
    if (!Tesseract) Tesseract = require('tesseract.js');
    return Tesseract;
}


function smartExtract(text, botConfig) {
    if (!text) return null;
    
    const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .filter(line => {
            const l = line.toLowerCase();
            // WhatsApp Web sometimes auto-appends the filename to the caption.
            // If a line is just a long filename without spaces ending in an image extension, ignore it.
            const isFileExt = l.endsWith('.jpeg') || l.endsWith('.jpg') || l.endsWith('.png') || l.endsWith('.pdf');
            const hasNoSpaces = !line.includes(' ');
            return !(isFileExt && hasNoSpaces);
        });
    
    // Jika semua baris dibuang karena isinya cuma nama file, kembalikan teks aslinya saja
    if (lines.length === 0) {
        lines.push("Tanpa_Keterangan");
    }

    const textUpper = lines.join(' ').toUpperCase();
    
    // Cari kategori utama & aliasnya
    let matchedCategory = null;
    let matchedStringForRegex = null;
    
    for (let cat of (botConfig.valid_categories || [])) {
        const catUpper = cat.toUpperCase();
        const wordBoundaryRegex = new RegExp(`\\b${catUpper}\\b`, 'i');
        if (wordBoundaryRegex.test(textUpper)) {
            matchedCategory = cat;
            matchedStringForRegex = cat;
            break;
        }
        
        // Cek alias
        const aliases = botConfig.category_aliases && botConfig.category_aliases[cat];
        if (aliases && Array.isArray(aliases)) {
            const foundAlias = aliases.find(alias => new RegExp(`\\b${alias}\\b`, 'i').test(textUpper));
            if (foundAlias) {
                matchedCategory = cat;
                matchedStringForRegex = foundAlias;
                break;
            }
        }
    }
    
    if (!matchedCategory) return null; 
    
    let targets = [];
    let itemsDesc = "";

    let poLine = "";
    if (lines.length >= 2) {
        poLine = lines[lines.length - 1];
        if (lines.length > 2) {
            itemsDesc = lines.slice(1, lines.length - 1).join('_');
        } else {
            itemsDesc = lines[1];
        }
    } else {
        poLine = lines[0];
        const regexCat = new RegExp(matchedStringForRegex, 'i');
        itemsDesc = lines[0].replace(regexCat, '').trim();
    }

    // 1. Cari Client dari KESELURUHAN text (agar tidak bergantung posisi baris)
    let globalResolvedClient = null;
    let globalFoundDict = null;

    if (botConfig.known_clients && botConfig.known_clients.length > 0) {
        globalFoundDict = botConfig.known_clients.find(kc => textUpper.includes(kc.toUpperCase()));
        if (globalFoundDict) {
            globalResolvedClient = globalFoundDict;
        } else {
            // Cek alias
            for (let kc of botConfig.known_clients) {
                const aliases = botConfig.client_aliases && botConfig.client_aliases[kc];
                if (aliases && Array.isArray(aliases)) {
                    const foundAlias = aliases.find(alias => textUpper.includes(alias.toUpperCase()));
                    if (foundAlias) {
                        globalResolvedClient = kc;
                        globalFoundDict = foundAlias;
                        break;
                    }
                }
            }
        }
    }

    const poChunks = poLine.split(',').map(c => c.trim()).filter(c => c.length > 0);
    
    poChunks.forEach(chunk => {
        let poClient = "Unknown_Client";
        let poNumber = "Tanpa_Nomor_PO";
        const chunkUpper = chunk.toUpperCase();
        
        let foundDict = globalFoundDict;
        let resolvedClient = globalResolvedClient;
        
        // Cek lagi khusus di baris ini jika tidak ketemu secara global (jarang terjadi)
        if (!resolvedClient && botConfig.known_clients && botConfig.known_clients.length > 0) {
            foundDict = botConfig.known_clients.find(kc => chunkUpper.includes(kc.toUpperCase()));
            if (foundDict) {
                resolvedClient = foundDict;
            } else {
                for (let kc of botConfig.known_clients) {
                    const aliases = botConfig.client_aliases && botConfig.client_aliases[kc];
                    if (aliases && Array.isArray(aliases)) {
                        const foundAlias = aliases.find(alias => chunkUpper.includes(alias.toUpperCase()));
                        if (foundAlias) {
                            resolvedClient = kc;
                            foundDict = foundAlias;
                            break;
                        }
                    }
                }
            }
        }
        
        if (resolvedClient) {
            poClient = resolvedClient;
            // Jika alias/client ada di dalam chunk PO ini, ambil angka setelahnya sebagai nomor PO
            if (foundDict && chunkUpper.includes(foundDict.toUpperCase())) {
                const idx = chunkUpper.indexOf(foundDict.toUpperCase());
                const afterClient = chunk.substring(idx + foundDict.length).trim();
                const firstDigit = afterClient.search(/\d/);
                if (firstDigit !== -1) {
                    poNumber = afterClient.substring(firstDigit).trim();
                } else if (afterClient.length > 0) {
                    // Coba ambil kata setelahnya jika itu bukan digit (bisa jadi nomor seri tanpa angka)
                    poNumber = afterClient;
                }
            } else {
                // Jika client ditemukan di baris lain (misal di baris 1), maka baris PO ini kemungkinan besar berisi nomor PO murni
                poNumber = chunk;
            }
        } else {
            const matchPrefix = chunkUpper.match(/(?:PT|PO|CV)\.?\s+([A-Z0-9\s-]+)/);
            if (matchPrefix) {
                let extracted = matchPrefix[1].trim();
                const firstDigit = extracted.search(/\d/);
                if (firstDigit !== -1) {
                    poClient = extracted.substring(0, firstDigit).trim();
                    poNumber = extracted.substring(firstDigit).trim();
                } else {
                    poClient = extracted;
                }
            } else {
                const firstDigit = chunk.search(/\d/);
                if (firstDigit !== -1) {
                    poClient = chunk.substring(0, firstDigit).trim();
                    poNumber = chunk.substring(firstDigit).trim();
                } else {
                    poClient = chunk; 
                }
                
                // Hapus nama kategori atau string yang cocok dari tebakan nama perusahaan jika murni tanpa awalan
                const regexCat = new RegExp(matchedStringForRegex, 'i');
                poClient = poClient.replace(regexCat, '').trim();
            }
        }
        
        poClient = poClient.replace(/[\/\\?%*:|"<>]/g, '-').trim();
        poNumber = poNumber.replace(/[\/\\?%*:|"<>]/g, '-').trim();
        
        // Cek jika tebakan nama client adalah kata-kata temporal/deskripsi umum, set sebagai Unknown_Client
        const cleanPoClientUpper = poClient.toUpperCase().replace(/_/g, ' ').trim();
        const blacklist = botConfig.blacklist_words || [];
        if (blacklist.includes(cleanPoClientUpper)) {
            poClient = "Unknown_Client";
        }
        
        if (!poClient || poClient.length === 0) poClient = "Unknown_Client";
        if (!poNumber || poNumber.length === 0) poNumber = "Tanpa_Nomor_PO";
        
        targets.push({ poClient, poNumber });
    });

    itemsDesc = itemsDesc.replace(/[\/\\?%*:|"<> ]/g, '_');
    if (itemsDesc.length > 50) itemsDesc = itemsDesc.substring(0, 50);
    if (!itemsDesc || itemsDesc === '_') itemsDesc = "Item_Lainnya";

    // Filter target: abaikan jika hanya menghasilkan target kosong total (Unknown_Client & Tanpa_Nomor_PO)
    const validTargets = targets.filter(t => !(t.poClient === 'Unknown_Client' && t.poNumber === 'Tanpa_Nomor_PO'));
    
    if (validTargets.length === 0) return null;

    return {
        category: matchedCategory,
        targets: validTargets,
        itemsDesc: itemsDesc
    };
}

module.exports = {
    getOCR,
    smartExtract
};
