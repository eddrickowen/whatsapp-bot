'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

const SPEC_DEFAULT_STAGES = [
  { name: "New Lead", color: "#3b82f6", position: 0 },
  { name: "Qualified", color: "#eab308", position: 1 },
  { name: "Proposal Sent", color: "#f97316", position: 2 },
  { name: "Negotiation", color: "#8b5cf6", position: 3 },
  { name: "Won", color: "#22c55e", position: 4 },
];

export async function getPipelines() {
  const data = await prisma.pipeline.findMany({
    orderBy: { createdAt: 'asc' }
  });
  return data.map((d: any) => ({
    ...d,
    created_at: d.createdAt.toISOString()
  }));
}

export async function getStages(pipelineId: string) {
  const data = await prisma.stage.findMany({
    where: { pipelineId },
    orderBy: { position: 'asc' }
  });
  return data.map((d: any) => ({
    ...d,
    created_at: d.createdAt.toISOString(),
    pipeline_id: d.pipelineId
  }));
}

export async function getDeals(pipelineId: string) {
  const data = await prisma.deal.findMany({
    where: { pipelineId },
    include: { contact: true },
    orderBy: { createdAt: 'desc' }
  });
  return data.map((d: any) => ({
    ...d,
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
    pipeline_id: d.pipelineId,
    stage_id: d.stageId,
    contact_id: d.contactId
  }));
}

export async function seedPipeline() {
  const pipeline = await prisma.pipeline.create({
    data: { name: "Sales Pipeline" }
  });

  await prisma.stage.createMany({
    data: SPEC_DEFAULT_STAGES.map(s => ({
      pipelineId: pipeline.id,
      name: s.name,
      color: s.color,
      position: s.position
    }))
  });

  revalidatePath('/pipelines');
  return { id: pipeline.id, name: pipeline.name, created_at: pipeline.createdAt.toISOString() };
}

export async function createPipeline(name: string) {
  const pipeline = await prisma.pipeline.create({
    data: { name }
  });

  await prisma.stage.createMany({
    data: SPEC_DEFAULT_STAGES.map(s => ({
      pipelineId: pipeline.id,
      name: s.name,
      color: s.color,
      position: s.position
    }))
  });

  revalidatePath('/pipelines');
  return { id: pipeline.id, name: pipeline.name, created_at: pipeline.createdAt.toISOString() };
}

export async function updateDealStage(dealId: string, newStageId: string) {
  await prisma.deal.update({
    where: { id: dealId },
    data: { stageId: newStageId }
  });
  revalidatePath('/pipelines');
  return { success: true };
}

export async function getContactsSimple() {
  const data = await prisma.contact.findMany({
    orderBy: { name: 'asc' }
  });
  return data.map((d: any) => ({
    ...d,
    created_at: d.createdAt.toISOString()
  }));
}

export async function createDeal(payload: any) {
  const deal = await prisma.deal.create({
    data: {
      pipelineId: payload.pipeline_id,
      stageId: payload.stage_id,
      contactId: payload.contact_id,
      title: payload.title,
      value: payload.value,
      currency: payload.currency,
      notes: payload.notes,
      status: payload.status
    }
  });
  revalidatePath('/pipelines');
  return deal;
}

export async function updateDeal(id: string, payload: any) {
  await prisma.deal.update({
    where: { id },
    data: {
      stageId: payload.stage_id,
      contactId: payload.contact_id,
      title: payload.title,
      value: payload.value,
      currency: payload.currency,
      notes: payload.notes,
      status: payload.status
    }
  });
  revalidatePath('/pipelines');
  return { success: true };
}

export async function deleteDeal(id: string) {
  await prisma.deal.delete({ where: { id } });
  revalidatePath('/pipelines');
  return { success: true };
}

export async function renamePipeline(id: string, name: string) {
  await prisma.pipeline.update({
    where: { id },
    data: { name }
  });
  revalidatePath('/pipelines');
  return { success: true };
}

export async function upsertStages(pipelineId: string, stages: any[]) {
  // Prisma doesn't have a clean bulk upsert with different IDs.
  // We'll run them sequentially in a transaction.
  await prisma.$transaction(
    stages.map(s => {
      // If it has a temporary ID or is an existing one
      return prisma.stage.upsert({
        where: { id: s.id },
        update: { name: s.name, color: s.color, position: s.position },
        create: {
          id: s.id.startsWith('new-') ? undefined : s.id,
          pipelineId,
          name: s.name,
          color: s.color,
          position: s.position
        }
      });
    })
  );
  revalidatePath('/pipelines');
  return { success: true };
}

export async function addStage(pipelineId: string, name: string, color: string, position: number) {
  const stage = await prisma.stage.create({
    data: { pipelineId, name, color, position }
  });
  revalidatePath('/pipelines');
  return { ...stage, created_at: stage.createdAt.toISOString(), pipeline_id: stage.pipelineId };
}

export async function deleteStage(stageId: string) {
  const count = await prisma.deal.count({ where: { stageId } });
  if (count > 0) return { error: "Move or delete deals in this stage first" };

  await prisma.stage.delete({ where: { id: stageId } });
  revalidatePath('/pipelines');
  return { success: true };
}

export async function deletePipeline(pipelineId: string) {
  await prisma.pipeline.delete({ where: { id: pipelineId } });
  revalidatePath('/pipelines');
  return { success: true };
}
