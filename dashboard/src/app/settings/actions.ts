"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function saveSettings(formData: any) {
  try {
    const { config, groups, users, categories, clients, folderMappings } = formData;

    // 1. Update Config
    if (config) {
      await prisma.config.upsert({
        where: { id: 1 },
        update: {
          autoReply: config.autoReply,
          useOcr: config.useOcr,
          mediaFormat: config.mediaFormat,
          bufferMode: config.bufferMode,
          bufferTimeout: config.bufferTimeout,
          catchupDays: config.catchupDays,
          catchupSessionGap: config.catchupSessionGap,
          catchupLimit: config.catchupLimit,
          blacklistWords: config.blacklistWords,
          baseDirectory: config.baseDirectory,
        },
        create: {
          id: 1,
          autoReply: config.autoReply,
          useOcr: config.useOcr,
          mediaFormat: config.mediaFormat,
          bufferMode: config.bufferMode,
          bufferTimeout: config.bufferTimeout,
          catchupDays: config.catchupDays,
          catchupSessionGap: config.catchupSessionGap,
          catchupLimit: config.catchupLimit,
          blacklistWords: config.blacklistWords,
          baseDirectory: config.baseDirectory,
        }
      });
    }

    // 2. Update Target Groups
    if (groups) {
      // Get existing groups
      const existingGroups = await prisma.targetGroup.findMany();
      const existingIds = existingGroups.map((g) => g.id);
      const newIds = groups.map((g: any) => g.id);
      
      const toDelete = existingIds.filter(id => !newIds.includes(id));
      if (toDelete.length > 0) {
        await prisma.targetGroup.deleteMany({ where: { id: { in: toDelete } } });
      }
      
      for (const g of groups) {
        if (!existingIds.includes(g.id)) {
          await prisma.targetGroup.create({ data: { id: g.id, name: g.name || 'Unknown' } });
        }
      }
    }

    // 3. Update Target Users
    if (users) {
      const existingUsers = await prisma.targetUser.findMany();
      const existingIds = existingUsers.map((u) => u.id);
      const newIds = users.map((u: any) => u.id);
      
      const toDelete = existingIds.filter(id => !newIds.includes(id));
      if (toDelete.length > 0) {
        await prisma.targetUser.deleteMany({ where: { id: { in: toDelete } } });
      }
      
      for (const u of users) {
        if (!existingIds.includes(u.id)) {
          await prisma.targetUser.create({ data: { id: u.id, name: u.name || 'Unknown' } });
        }
      }
    }

    // 4. Update Categories
    if (categories) {
      // For simplicity in settings, we clear and recreate
      await prisma.validCategory.deleteMany({});
      if (categories.length > 0) {
        await prisma.validCategory.createMany({
          data: categories.map((c: any) => ({ name: c.name, aliases: c.aliases }))
        });
      }
    }

    // 5. Update Clients
    if (clients) {
      await prisma.clientKeyword.deleteMany({});
      if (clients.length > 0) {
        await prisma.clientKeyword.createMany({
          data: clients.map((c: any) => ({ name: c.name, aliases: c.aliases }))
        });
      }
    }
    // 6. Update Folder Mappings
    if (folderMappings) {
      const existingMappings = await prisma.folderMapping.findMany();
      const existingIds = existingMappings.map((m: any) => m.id);
      const newIds = folderMappings.map((m: any) => m.id);
      
      const toDelete = existingIds.filter((id: any) => !newIds.includes(id));
      if (toDelete.length > 0) {
        await prisma.folderMapping.deleteMany({ where: { id: { in: toDelete } } });
      }
      
      for (const m of folderMappings) {
        if (!existingIds.includes(m.id)) {
          await prisma.folderMapping.create({ data: { id: m.id, folderName: m.folderName } });
        } else {
          await prisma.folderMapping.update({ where: { id: m.id }, data: { folderName: m.folderName } });
        }
      }
    }
    
    return { success: true };
  } catch (error: any) {
    console.error("Failed to save settings:", error);
    return { success: false, error: error.message };
  }
}
