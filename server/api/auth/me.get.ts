import { requireSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const { user } = await requireSession(event)
  return { user }
})
