'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getBroadcasts() {
  const data = await prisma.broadcast.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { targets: true } }
    }
  });
  return data.map((b: any) => ({
    ...b,
    created_at: b.createdAt.toISOString(),
    updated_at: b.updatedAt.toISOString(),
    scheduled_at: b.scheduledAt?.toISOString() ?? null,
    total_recipients: b.totalRecipients,
    sent_count: b.sentCount,
  }));
}

export async function getBroadcastById(id: string) {
  const data = await prisma.broadcast.findUnique({
    where: { id },
    include: {
      targets: {
        include: { contact: true },
        orderBy: { status: 'asc' }
      }
    }
  });
  if (!data) return null;
  return {
    ...data,
    created_at: data.createdAt.toISOString(),
    updated_at: data.updatedAt.toISOString(),
    scheduled_at: data.scheduledAt?.toISOString() ?? null,
    total_recipients: data.totalRecipients,
    sent_count: data.sentCount,
  };
}

export async function createBroadcast(payload: {
  name: string;
  message: string;
  tagIds?: string[];
  contactIds?: string[];
  scheduledAt?: string;
}) {
  // Resolve contacts from tags or explicit contact list
  let contactIds: string[] = payload.contactIds ?? [];

  if (payload.tagIds && payload.tagIds.length > 0) {
    const tagContacts = await prisma.contactTag.findMany({
      where: { tagId: { in: payload.tagIds } },
      select: { contactId: true }
    });
    const fromTags = tagContacts.map((tc: any) => tc.contactId);
    // Merge and deduplicate
    contactIds = [...new Set([...contactIds, ...fromTags])];
  }

  // If no audience specified, use all contacts
  if (contactIds.length === 0 && (!payload.tagIds || payload.tagIds.length === 0)) {
    const allContacts = await prisma.contact.findMany({ select: { id: true } });
    contactIds = allContacts.map((c: any) => c.id);
  }

  const broadcast = await prisma.broadcast.create({
    data: {
      name: payload.name,
      message: payload.message,
      status: 'draft',
      totalRecipients: contactIds.length,
      sentCount: 0,
      scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : null,
      targets: {
        create: contactIds.map((contactId) => ({
          contactId,
          status: 'pending'
        }))
      }
    }
  });

  revalidatePath('/broadcasts');
  return broadcast.id;
}

export async function startBroadcast(id: string) {
  await prisma.broadcast.update({
    where: { id },
    data: { status: 'sending' }
  });
  revalidatePath('/broadcasts');
  return { success: true };
}

export async function deleteBroadcast(id: string) {
  await prisma.broadcast.delete({ where: { id } });
  revalidatePath('/broadcasts');
  return { success: true };
}

export async function getTagsForBroadcast() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { contacts: true } }
    }
  });
  return tags.map((t: any) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    contactCount: t._count.contacts
  }));
}

export async function getContactsForBroadcast() {
  const contacts = await prisma.contact.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, phone: true }
  });
  return contacts;
}
