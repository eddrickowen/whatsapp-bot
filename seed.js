const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding data from flat files to PostgreSQL...');
  
  // 1. Seed Config & Dictionary from config.json
  const configPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    const rawConfig = fs.readFileSync(configPath, 'utf-8');
    const configData = JSON.parse(rawConfig);
    
    // Config
    await prisma.config.upsert({
      where: { id: 1 },
      update: {
        autoReply: configData.auto_reply ?? true,
        useOcr: configData.use_ocr ?? false,
        mediaFormat: configData.media_format ?? 'original'
      },
      create: {
        id: 1,
        autoReply: configData.auto_reply ?? true,
        useOcr: configData.use_ocr ?? false,
        mediaFormat: configData.media_format ?? 'original'
      }
    });

    // Categories
    if (configData.valid_categories && Array.isArray(configData.valid_categories)) {
      for (const cat of configData.valid_categories) {
        await prisma.validCategory.upsert({
          where: { name: cat },
          update: {},
          create: { name: cat, aliases: [] }
        });
      }
    }

    // Clients
    if (configData.known_clients && Array.isArray(configData.known_clients)) {
      for (const client of configData.known_clients) {
        await prisma.clientKeyword.upsert({
          where: { name: client },
          update: {},
          create: { name: client, aliases: [] }
        });
      }
    }
    
    // Target Groups
    if (configData.target_groups && Array.isArray(configData.target_groups)) {
      for (const grp of configData.target_groups) {
        await prisma.targetGroup.upsert({
          where: { id: grp },
          update: {},
          create: { id: grp, name: 'Unknown Group' }
        });
      }
    }

    // Target Users
    if (configData.target_users && Array.isArray(configData.target_users)) {
      for (const usr of configData.target_users) {
        await prisma.targetUser.upsert({
          where: { id: usr },
          update: {},
          create: { id: usr, name: 'Unknown User' }
        });
      }
    }
    
    console.log('✅ Config data seeded successfully!');
  }

  // 2. Seed History from history.json
  const historyPath = path.join(__dirname, 'history.json');
  if (fs.existsSync(historyPath)) {
    const rawHistory = fs.readFileSync(historyPath, 'utf-8');
    const historyData = JSON.parse(rawHistory);
    
    // We only seed if there are no logs yet to prevent duplication on multiple runs
    const logCount = await prisma.logHistory.count();
    if (logCount === 0) {
      const logsToInsert = historyData.map(log => ({
        type: log.type,
        sender: log.sender,
        details: log.details,
        status: log.status,
        timestamp: new Date(log.timestamp)
      }));
      
      await prisma.logHistory.createMany({
        data: logsToInsert
      });
      console.log(`✅ ${historyData.length} History logs seeded successfully!`);
    } else {
      console.log('⚠️ History logs already exist in DB, skipping history seed.');
    }
  }

  console.log('Seeding complete.');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
