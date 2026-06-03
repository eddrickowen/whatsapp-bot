import * as React from "react";
import { prisma } from "@/lib/prisma";
import SettingsForm from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // Fetch everything from PostgreSQL
  const config = await prisma.config.findFirst() || { autoReply: true, useOcr: false, mediaFormat: 'original' };
  const categories = await prisma.validCategory.findMany();
  const clients = await prisma.clientKeyword.findMany();
  const targetGroups = await prisma.targetGroup.findMany();
  const targetUsers = await prisma.targetUser.findMany();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">System Settings</h1>
        <p className="text-muted-foreground mt-2">Configure core behaviors, dictionaries, and monitoring targets.</p>
      </div>

      <SettingsForm 
        initialConfig={config}
        initialCategories={categories}
        initialClients={clients}
        initialGroups={targetGroups}
        initialUsers={targetUsers}
      />
    </div>
  );
}
