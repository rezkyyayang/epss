import { createError } from 'h3'
import type { H3Event } from 'h3'
import { z } from 'zod'
import { parseWebUrl, readValidatedPayload } from './validation'

const archiveSchema = z.object({
  type: z.string().trim().min(2).max(120),
  title: z.string().trim().min(3).max(240),
  year: z.number().int().min(1990).max(2100),
  url: z.string().trim().min(1).max(2000),
})

// Shared by create and edit: the same fields, and the link must be a plain web address.
export async function readArchivePayload(event: H3Event) {
  const body = await readValidatedPayload(event, archiveSchema)
  const url = parseWebUrl(body.url)
  if (!url) throw createError({ statusCode: 400, statusMessage: 'Tautan harus diawali http:// atau https://, misalnya https://drive.google.com/...' })
  return { ...body, url }
}

export const archiveSelect = { id: true, type: true, title: true, year: true, url: true, updatedAt: true } as const
