import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

const workFactor = 1 << 15
const keyLength = 64

function deriveKey(password: string, salt: Buffer, length: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, length, options, (error, key) => error ? reject(error) : resolve(key as Buffer))
  })
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const key = await deriveKey(password, salt, keyLength, {
    N: workFactor,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  })

  return `scrypt$${workFactor}$8$1$${salt.toString('hex')}$${key.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, n, r, p, saltHex, keyHex] = stored.split('$')
  if (algorithm !== 'scrypt' || !n || !r || !p || !saltHex || !keyHex) return false

  const expected = Buffer.from(keyHex, 'hex')
  const salt = Buffer.from(saltHex, 'hex')
  const actual = await deriveKey(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  })

  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
