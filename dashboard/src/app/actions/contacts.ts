'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

const PAGE_SIZE = 25;

export async function getContacts(page = 0, search = '') {
  const skip = page * PAGE_SIZE;
  const take = PAGE_SIZE;

  const whereClause = search
    ? {
        OR: [
          { name: { contains: search } },
          { phone: { contains: search } },
          { email: { contains: search } },
        ],
      }
    : {};

  const [data, totalCount] = await Promise.all([
    prisma.contact.findMany({
      where: whereClause,
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.contact.count({ where: whereClause }),
  ]);

  // Flatten the tags array to match the expected UI structure
  const formattedData = data.map((contact: any) => ({
    ...contact,
    created_at: contact.createdAt.toISOString(),
    updated_at: contact.updatedAt.toISOString(),
    tags: contact.tags.map((ct: any) => ct.tag),
  }));

  return { data: formattedData, totalCount };
}

export async function getTags() {
  const data = await prisma.tag.findMany({
    orderBy: { name: 'asc' },
  });
  return { data };
}

export async function createContact(
  data: { name: string | null; phone: string; email: string | null; company: string | null },
  tagIds: string[]
) {
  const contact = await prisma.contact.create({
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email,
      company: data.company,
      tags: {
        create: tagIds.map(tagId => ({
          tag: {
            connect: { id: tagId }
          }
        }))
      }
    },
  });
  revalidatePath('/contacts');
  return { id: contact.id };
}

export async function updateContact(
  id: string,
  data: { name: string | null; phone: string; email: string | null; company: string | null },
  tagIds: string[]
) {
  // First delete existing tags
  await prisma.contactTag.deleteMany({
    where: { contactId: id }
  });

  // Then update contact and create new tags
  await prisma.contact.update({
    where: { id },
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email,
      company: data.company,
      tags: {
        create: tagIds.map(tagId => ({
          tag: {
            connect: { id: tagId }
          }
        }))
      }
    },
  });
  revalidatePath('/contacts');
  return { success: true };
}

export async function deleteContact(id: string) {
  await prisma.contact.delete({
    where: { id },
  });
  revalidatePath('/contacts');
  return { success: true };
}
