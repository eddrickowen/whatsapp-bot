const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function fixAliases() {
  console.log('Memperbaiki Aliases dari config.json...');
  const configPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    const rawConfig = fs.readFileSync(configPath, 'utf-8');
    const configData = JSON.parse(rawConfig);

    if (configData.client_aliases) {
      for (const [clientName, aliases] of Object.entries(configData.client_aliases)) {
        await prisma.clientKeyword.updateMany({
          where: { name: clientName },
          data: { aliases: aliases }
        });
        console.log(`Updated Client ${clientName} aliases: ${aliases.join(', ')}`);
      }
    }

    if (configData.category_aliases) {
      for (const [catName, aliases] of Object.entries(configData.category_aliases)) {
        await prisma.validCategory.updateMany({
          where: { name: catName },
          data: { aliases: aliases }
        });
        console.log(`Updated Category ${catName} aliases: ${aliases.join(', ')}`);
      }
    }
  }
  
  // Add AGRO and AM
  const agroExists = await prisma.clientKeyword.findFirst({ where: { name: 'AGRO' } });
  if (!agroExists) {
    await prisma.clientKeyword.create({ data: { name: 'AGRO', aliases: ['AM'] } });
    console.log("Added AGRO with alias AM");
  } else {
    const currentAliases = agroExists.aliases || [];
    if (!currentAliases.includes('AM')) {
      await prisma.clientKeyword.update({
        where: { id: agroExists.id },
        data: { aliases: [...currentAliases, 'AM'] }
      });
      console.log("Updated AGRO to include alias AM");
    }
  }

  console.log('✅ Aliases berhasil diperbaiki!');
  await prisma.$disconnect();
}

fixAliases().catch(e => {
  console.error(e);
  prisma.$disconnect();
});
