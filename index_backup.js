const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

// Folders setup
const DIRS = {
    downloads: path.join(__dirname, 'downloads'),
    invoices: path.join(__dirname, 'classified', 'Invoices'),
    receiving: path.join(__dirname, 'classified', 'Receiving'),
    unclassified: path.join(__dirname, 'classified', 'Unclassified')
};

// Create folders if they don't exist
Object.values(DIRS).forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// We'll keep track of recent messages with images from each sender
// to group them together.
const imageBuffer = {};

// Wait 5 seconds after the last image before processing the group
const GROUPING_TIMEOUT_MS = 5000;

// Keywords for classification
const KEYWORDS = {
    invoice: ['invoice', 'faktur', 'tagihan', 'pembelian'],
    receiving: ['penerimaan', 'surat jalan', 'delivery', 'receipt']
};

function determineCategory(text) {
    const lowerText = text.toLowerCase();
    
    // Check invoice keywords
    if (KEYWORDS.invoice.some(kw => lowerText.includes(kw))) {
        return 'invoices';
    }
    
    // Check receiving keywords
    if (KEYWORDS.receiving.some(kw => lowerText.includes(kw))) {
        return 'receiving';
    }
    
    return 'unclassified';
}

async function processImageGroup(sender, group) {
    console.log(`Processing group of ${group.images.length} images from ${sender}...`);
    
    let combinedText = '';
    
    // If there is a caption on the first image, it might be enough
    if (group.caption) {
        combinedText += group.caption + '\n';
        console.log(`Caption provided: ${group.caption}`);
    }

    // Try OCR on the images
    let category = determineCategory(combinedText);

    if (category === 'unclassified') {
        for (let i = 0; i < group.images.length; i++) {
            const imgPath = group.images[i].path;
            console.log(`Running OCR on image ${i + 1}...`);
            try {
                const { data: { text } } = await Tesseract.recognize(imgPath, 'eng+ind'); // Supports English & Indonesian
                console.log(`Extracted text preview:`, text.substring(0, 100).replace(/\n/g, ' '));
                combinedText += text + '\n';
                
                category = determineCategory(combinedText);
                if (category !== 'unclassified') {
                    console.log(`Match found: ${category} based on OCR.`);
                    break; // No need to OCR the rest if we found a match
                }
            } catch (err) {
                console.error(`OCR failed for ${imgPath}:`, err);
            }
        }
    }

    // Move files to the classified folder
    // We'll create a subfolder with timestamp to group them
    const timestamp = Date.now();
    const targetDir = path.join(DIRS[category], `${sender}_${timestamp}`);
    fs.mkdirSync(targetDir, { recursive: true });

    group.images.forEach((img, index) => {
        const targetPath = path.join(targetDir, `image_${index + 1}${img.ext}`);
        fs.renameSync(img.path, targetPath);
        console.log(`Saved: ${targetPath}`);
    });

    console.log(`Finished processing group from ${sender}. Category: ${category}\n`);
}

// Initialize WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    // Generate and scan this code with your phone
    qrcode.generate(qr, { small: true });
    console.log('\n\nScan the QR code above with your WhatsApp app (Linked Devices)!\n\n');
});

client.on('ready', () => {
    console.log('Bot is ready and listening to messages!');
});

client.on('message', async msg => {
    // Check if the message contains media
    if (msg.hasMedia) {
        try {
            const media = await msg.downloadMedia();
            if (media && media.mimetype && media.mimetype.startsWith('image/')) {
                const sender = msg.from.replace('@c.us', '').replace('@g.us', ''); // Simplify sender ID
                const ext = mime.extension(media.mimetype) ? `.${mime.extension(media.mimetype)}` : '.jpg';
                const tempPath = path.join(DIRS.downloads, `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`);
                
                // Save media temporarily
                fs.writeFileSync(tempPath, media.data, 'base64');
                console.log(`Received image from ${sender}, saved temporarily.`);

                // Grouping logic
                if (!imageBuffer[sender]) {
                    imageBuffer[sender] = {
                        images: [],
                        caption: msg.body || '',
                        timer: null
                    };
                }

                // If the group doesn't have a caption yet, but this message has one, use it
                if (!imageBuffer[sender].caption && msg.body) {
                    imageBuffer[sender].caption = msg.body;
                }

                imageBuffer[sender].images.push({ path: tempPath, ext });

                // Reset the timer
                if (imageBuffer[sender].timer) {
                    clearTimeout(imageBuffer[sender].timer);
                }

                // Set a new timer to process the group after no new images arrive for a few seconds
                imageBuffer[sender].timer = setTimeout(() => {
                    const groupToProcess = imageBuffer[sender];
                    delete imageBuffer[sender]; // Clear the buffer for this sender
                    
                    processImageGroup(sender, groupToProcess).catch(console.error);
                }, GROUPING_TIMEOUT_MS);
            }
        } catch (error) {
             console.error("Error downloading media:", error);
        }
    }
});

client.initialize();
