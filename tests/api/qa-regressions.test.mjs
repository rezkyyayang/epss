// Regression tests for the QA findings fixed on 22 October 2026 (QA-01, QA-03, QA-07, QA-22).
// They run against a live server backed by a disposable database, never a shared one:
//   SECTORA_TEST_URL=http://127.0.0.1:3002 SECTORA_TEST_ADMIN_EMAIL=... SECTORA_TEST_ADMIN_PASSWORD=... npm run test:api
// Each run creates its own accounts and units with random names.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { before, describe, test } from 'node:test'

const baseUrl = process.env.SECTORA_TEST_URL
const adminEmail = process.env.SECTORA_TEST_ADMIN_EMAIL
const adminPassword = process.env.SECTORA_TEST_ADMIN_PASSWORD
const skip = !baseUrl || !adminEmail || !adminPassword ? 'Set SECTORA_TEST_URL, SECTORA_TEST_ADMIN_EMAIL, and SECTORA_TEST_ADMIN_PASSWORD.' : false

const token = () => randomBytes(6).toString('hex')
const password = () => `test-${randomBytes(12).toString('hex')}`

class Client {
  cookie = ''

  async request(method, path, body) {
    const headers = { origin: baseUrl }
    if (this.cookie) headers.cookie = this.cookie
    if (body !== undefined) headers['content-type'] = 'application/json'
    const response = await fetch(baseUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' })
    for (const value of response.headers.getSetCookie()) {
      const [pair] = value.split(';')
      if (pair.startsWith('sectora_session=')) this.cookie = pair.endsWith('=') ? '' : pair
    }
    const text = await response.text()
    let data = text
    try { data = JSON.parse(text) } catch { /* HTML pages stay as text */ }
    return { status: response.status, data }
  }

  login(email, secret) {
    return this.request('POST', '/api/auth/login', { email, password: secret })
  }
}

describe('QA regressions', { skip }, () => {
  const admin = new Client()
  let unitId = ''

  before(async () => {
    const login = await admin.login(adminEmail, adminPassword)
    assert.equal(login.status, 200, 'Admin login failed')
    const created = await admin.request('POST', '/api/admin/units', { name: `Unit uji ${token()}`, code: `T-${token()}` })
    assert.equal(created.status, 200)
    unitId = created.data.unit.id
  })

  async function createUser(secret = password()) {
    const email = `test-${token()}@example.test`
    const created = await admin.request('POST', '/api/admin/users', { email, displayName: 'Akun uji', password: secret, role: 'USER', unitIds: [unitId] })
    assert.equal(created.status, 200)
    return { id: created.data.user.id, email, secret }
  }

  describe('QA-07 duplicates return 409 with a readable message', () => {
    test('duplicate email, in any letter case', async () => {
      const account = await createUser()
      const again = await admin.request('POST', '/api/admin/users', { email: account.email.toUpperCase(), displayName: 'Akun ganda', password: password(), role: 'USER', unitIds: [unitId] })
      assert.equal(again.status, 409)
      assert.equal(again.data.statusMessage, 'Email ini sudah dipakai akun lain.')
    })

    test('duplicate unit code, in any letter case', async () => {
      const code = `T-${token()}`
      assert.equal((await admin.request('POST', '/api/admin/units', { name: 'Unit uji pertama', code })).status, 200)
      const again = await admin.request('POST', '/api/admin/units', { name: 'Unit uji kedua', code: code.toLowerCase() })
      assert.equal(again.status, 409)
      assert.equal(again.data.statusMessage, 'Kode unit ini sudah dipakai unit lain.')
    })
  })

  describe('QA-03 Admin can deactivate accounts and set a new password', () => {
    test('deactivation ends existing sessions and blocks login until reactivated', async () => {
      const account = await createUser()
      const user = new Client()
      assert.equal((await user.login(account.email, account.secret)).status, 200)

      assert.equal((await admin.request('PATCH', `/api/admin/users/${account.id}`, { isActive: false })).status, 200)
      assert.equal((await user.request('GET', '/api/auth/me')).status, 401)
      assert.equal((await new Client().login(account.email, account.secret)).status, 401)

      assert.equal((await admin.request('PATCH', `/api/admin/users/${account.id}`, { isActive: true })).status, 200)
      assert.equal((await new Client().login(account.email, account.secret)).status, 200)
    })

    test('a new password replaces the old one and ends existing sessions', async () => {
      const account = await createUser()
      const user = new Client()
      assert.equal((await user.login(account.email, account.secret)).status, 200)

      const next = password()
      assert.equal((await admin.request('PATCH', `/api/admin/users/${account.id}`, { password: next })).status, 200)
      assert.equal((await user.request('GET', '/api/auth/me')).status, 401)
      assert.equal((await new Client().login(account.email, account.secret)).status, 401)
      assert.equal((await new Client().login(account.email, next)).status, 200)
    })

    test('Admin cannot deactivate their own account', async () => {
      const me = await admin.request('GET', '/api/auth/me')
      const result = await admin.request('PATCH', `/api/admin/users/${me.data.user.id}`, { isActive: false })
      assert.equal(result.status, 400)
      assert.equal((await admin.request('GET', '/api/auth/me')).status, 200)
    })

    test('short passwords and empty updates are rejected', async () => {
      const account = await createUser()
      assert.equal((await admin.request('PATCH', `/api/admin/users/${account.id}`, { password: 'pendek' })).status, 400)
      assert.equal((await admin.request('PATCH', `/api/admin/users/${account.id}`, {})).status, 400)
    })

    test('unknown accounts return 404', async () => {
      assert.equal((await admin.request('PATCH', '/api/admin/users/tidak-ada', { isActive: false })).status, 404)
    })

    test('a User cannot change accounts', async () => {
      const account = await createUser()
      const target = await createUser()
      const user = new Client()
      await user.login(account.email, account.secret)
      assert.equal((await user.request('PATCH', `/api/admin/users/${target.id}`, { isActive: false })).status, 403)
    })
  })

  describe('QA-22 closing a period freezes its drafts', () => {
    const closedMessage = 'Periode ini sudah tidak aktif, sehingga isian tidak dapat diubah atau dikirim.'

    test('a complete draft cannot be changed or sent until the period is active again', async () => {
      const period = await admin.request('POST', '/api/admin/periods', { name: `Periode uji ${token()}` })
      assert.equal(period.status, 200)
      const periodId = period.data.period.id
      const levels = [1, 2].map((level) => ({ level, criterion: `Kriteria ${level}` }))
      const catalog = { domains: [{ code: 'D1', name: 'Domain uji', weight: 100, indicators: [{ code: 'I1', title: 'Indikator uji', weight: 100, maturityLevels: levels }] }] }
      assert.equal((await admin.request('PUT', `/api/admin/periods/${periodId}/catalog`, catalog)).status, 200)
      assert.equal((await admin.request('PUT', `/api/admin/periods/${periodId}/units`, { unitIds: [unitId] })).status, 200)
      assert.equal((await admin.request('PATCH', `/api/admin/periods/${periodId}`, { status: 'ACTIVE' })).status, 200)

      const account = await createUser()
      const user = new Client()
      await user.login(account.email, account.secret)
      const opened = await user.request('POST', '/api/user/assessments', { periodId, unitId, activityName: 'Kegiatan uji', activityYear: 2027 })
      assert.equal(opened.status, 200)
      const assessmentId = opened.data.assessment.id
      const [response] = (await user.request('GET', `/api/user/assessments/${assessmentId}`)).data.assessment.responses
      const [levelOne, levelTwo] = response.indicator.maturityLevels
      const saved = await user.request('PUT', `/api/user/responses/${response.id}`, { maturityLevelId: levelOne.id, explanation: 'Penjelasan uji', expectedVersion: response.version })
      assert.equal(saved.status, 200)
      const link = await user.request('POST', `/api/user/responses/${response.id}/evidence`, { url: `https://example.com/${token()}` })
      assert.equal(link.status, 200)

      assert.equal((await admin.request('PATCH', `/api/admin/periods/${periodId}`, { status: 'CLOSED' })).status, 200)
      const version = saved.data.response.version + 1
      const attempts = [
        await user.request('PUT', `/api/user/responses/${response.id}`, { maturityLevelId: levelTwo.id, explanation: 'Diubah setelah ditutup', expectedVersion: version }),
        await user.request('POST', `/api/user/responses/${response.id}/evidence`, { url: `https://example.com/${token()}` }),
        await user.request('DELETE', `/api/user/evidence/${link.data.evidence.id}`),
        await user.request('PUT', `/api/user/assessments/${assessmentId}/activity`, { activityName: 'Diubah setelah ditutup', activityYear: 2027 }),
        await user.request('POST', `/api/user/assessments/${assessmentId}/submit`),
      ]
      for (const attempt of attempts) {
        assert.equal(attempt.status, 409)
        assert.equal(attempt.data.statusMessage, closedMessage)
      }
      const after = (await user.request('GET', `/api/user/assessments/${assessmentId}`)).data.assessment
      assert.equal(after.status, 'DRAFT')
      assert.equal(after.responses[0].explanation, 'Penjelasan uji')
      assert.equal(after.responses[0].evidence.length, 1)

      assert.equal((await admin.request('PATCH', `/api/admin/periods/${periodId}`, { status: 'ACTIVE' })).status, 200)
      assert.equal((await user.request('POST', `/api/user/assessments/${assessmentId}/submit`)).status, 200)
    })
  })

  describe('QA-01 public copy matches the no-revision workflow', () => {
    for (const path of ['/pusat-bantuan', '/home', '/login']) {
      test(`${path} does not promise a revision round`, async () => {
        const page = await new Client().request('GET', path)
        assert.equal(page.status, 200)
        assert.doesNotMatch(page.data, /revisi|perlu diperbaiki|mengirim ulang/i)
      })
    }

    test('help center says answers lock after sending', async () => {
      const page = await new Client().request('GET', '/pusat-bantuan')
      assert.match(page.data, /Setelah penilaian dikirim, semuanya terkunci/)
    })
  })
})
