'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getAutomations() {
  const data = await prisma.automation.findMany({
    orderBy: { createdAt: 'desc' }
  });
  return data.map((a: any) => ({
    ...a,
    created_at: a.createdAt.toISOString(),
    updated_at: a.updatedAt.toISOString(),
    last_executed_at: a.lastExecutedAt?.toISOString() ?? null,
    trigger_type: a.triggerType,
    trigger_config: a.triggerConfig,
    is_active: a.isActive,
    execution_count: a.executionCount,
  }));
}

export async function getAutomationById(id: string) {
  const a = await prisma.automation.findUnique({ where: { id } });
  if (!a) return null;
  return {
    ...a,
    created_at: a.createdAt.toISOString(),
    updated_at: a.updatedAt.toISOString(),
    last_executed_at: a.lastExecutedAt?.toISOString() ?? null,
    trigger_type: a.triggerType,
    trigger_config: a.triggerConfig,
    is_active: a.isActive,
    execution_count: a.executionCount,
  };
}

export async function createAutomation(payload: {
  name: string;
  description?: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  steps: unknown[];
  isActive: boolean;
}) {
  const a = await prisma.automation.create({
    data: {
      name: payload.name || 'Untitled Automation',
      description: payload.description || null,
      triggerType: payload.triggerType,
      triggerConfig: payload.triggerConfig as any,
      steps: payload.steps as any,
      isActive: payload.isActive,
    }
  });
  revalidatePath('/automations');
  return a.id;
}

export async function updateAutomation(id: string, payload: {
  name?: string;
  description?: string;
  triggerType?: string;
  triggerConfig?: Record<string, unknown>;
  steps?: unknown[];
  isActive?: boolean;
}) {
  await prisma.automation.update({
    where: { id },
    data: {
      ...(payload.name !== undefined && { name: payload.name }),
      ...(payload.description !== undefined && { description: payload.description }),
      ...(payload.triggerType !== undefined && { triggerType: payload.triggerType }),
      ...(payload.triggerConfig !== undefined && { triggerConfig: payload.triggerConfig as any }),
      ...(payload.steps !== undefined && { steps: payload.steps as any }),
      ...(payload.isActive !== undefined && { isActive: payload.isActive }),
    }
  });
  revalidatePath('/automations');
  return { success: true };
}

export async function toggleAutomation(id: string, isActive: boolean) {
  await prisma.automation.update({ where: { id }, data: { isActive } });
  revalidatePath('/automations');
  return { success: true };
}

export async function duplicateAutomation(id: string) {
  const src = await prisma.automation.findUnique({ where: { id } });
  if (!src) throw new Error('Not found');
  await prisma.automation.create({
    data: {
      name: `${src.name} (Copy)`,
      description: src.description,
      triggerType: src.triggerType,
      triggerConfig: src.triggerConfig as any,
      steps: src.steps as any,
      isActive: false,
    }
  });
  revalidatePath('/automations');
  return { success: true };
}

export async function deleteAutomation(id: string) {
  await prisma.automation.delete({ where: { id } });
  revalidatePath('/automations');
  return { success: true };
}
