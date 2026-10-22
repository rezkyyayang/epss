<script setup lang="ts">
import { getApiError, formatDate } from '../../utils/format'

interface UnitRow { id: string; name: string; code: string; isActive: boolean; _count: { memberships: number; assessments: number } }
interface UserRow { id: string; email: string; displayName: string; role: string; isActive: boolean; createdAt: string; memberships: Array<{ unit: { id: string; name: string; code: string } }> }
const [{ data: unitData, refresh: refreshUnits, pending: unitsPending, error: unitsError }, { data: userData, refresh: refreshUsers, pending: usersPending, error: usersError }] = [
  useFetch<{ units: UnitRow[] }>('/api/admin/units', { lazy: true }),
  useFetch<{ users: UserRow[] }>('/api/admin/users', { lazy: true }),
]
const grantableUnits = computed(() => (unitData.value?.units || []).filter((unit) => unit.isActive))
const listsPending = computed(() => unitsPending.value || usersPending.value)
const listsError = computed(() => unitsError.value || usersError.value)
const unitName = ref('')
const unitCode = ref('')
const displayName = ref('')
const email = ref('')
const password = ref('')
const role = ref<'USER' | 'ADMIN'>('USER')
const selectedUnitId = ref('')
const saving = ref(false)
const message = toastRef('success')
const pageError = toastRef('error')

async function refreshLists() {
  await Promise.all([refreshUnits(), refreshUsers()])
}

async function createUnit() {
  saving.value = true; message.value = ''; pageError.value = ''
  try {
    await $fetch('/api/admin/units', { method: 'POST', body: { name: unitName.value, code: unitCode.value } })
    unitName.value = ''; unitCode.value = ''; message.value = 'Unit berhasil dibuat.'
    await refreshUnits()
  } catch (error) { pageError.value = getApiError(error, 'Unit belum dapat dibuat.') }
  finally { saving.value = false }
}

const auth = useAuth()
const updatingId = ref('')
const resetUserId = ref('')
const resetPassword = ref('')

async function updateAccount(id: string, body: { isActive?: boolean; password?: string }, success: string) {
  updatingId.value = id; message.value = ''; pageError.value = ''
  try {
    await $fetch(`/api/admin/users/${id}`, { method: 'PATCH', body })
    message.value = success
    await refreshUsers()
    return true
  } catch (error) {
    pageError.value = getApiError(error, 'Akun belum dapat diperbarui.')
    return false
  } finally { updatingId.value = '' }
}

async function toggleActive(account: UserRow) {
  if (account.isActive && !window.confirm(`Nonaktifkan ${account.displayName}? Akun ini langsung keluar dan tidak dapat masuk sampai diaktifkan lagi.`)) return
  await updateAccount(account.id, { isActive: !account.isActive }, account.isActive ? 'Akun dinonaktifkan.' : 'Akun diaktifkan kembali.')
}

async function submitPasswordReset() {
  if (await updateAccount(resetUserId.value, { password: resetPassword.value }, 'Kata sandi baru tersimpan. Sesi lama akun tersebut sudah diakhiri.')) {
    resetUserId.value = ''; resetPassword.value = ''
  }
}

async function createUser() {
  saving.value = true; message.value = ''; pageError.value = ''
  try {
    await $fetch('/api/admin/users', { method: 'POST', body: { displayName: displayName.value, email: email.value, password: password.value, role: role.value, unitIds: role.value === 'USER' && selectedUnitId.value ? [selectedUnitId.value] : [] } })
    displayName.value = ''; email.value = ''; password.value = ''; role.value = 'USER'; selectedUnitId.value = ''
    message.value = 'Akun berhasil dibuat.'
    await refreshUsers()
  } catch (error) { pageError.value = getApiError(error, 'Akun belum dapat dibuat.') }
  finally { saving.value = false }
}
</script>

<template>
  <PageHeading title="Pengguna dan unit" subtitle="Buat akun, berikan akses unit, dan lihat keanggotaan yang sudah terdaftar." />
  <LoadingState v-if="listsPending && !unitData && !userData" label="Memuat pengguna dan unit..." />
  <NoticeBanner v-else-if="listsError" tone="error" role="alert">
    {{ getApiError(listsError, 'Daftar pengguna dan unit belum dapat dimuat.') }}
    <button class="btn btn-secondary btn-small" type="button" @click="refreshLists">Coba lagi</button>
  </NoticeBanner>
  <template v-else>
  <div class="section-stack">
    <div class="management-grid">
      <section class="panel" aria-labelledby="create-unit-heading">
        <div class="panel-header"><div><h2 id="create-unit-heading">Tambah unit</h2><p>Kode unit harus unik.</p></div></div>
        <form class="panel-body form-stack" @submit.prevent="createUnit">
          <div class="field"><label for="unit-name">Nama unit</label><input id="unit-name" v-model.trim="unitName" class="control" required maxlength="160"></div>
          <div class="field"><label for="unit-code">Kode unit</label><input id="unit-code" v-model.trim="unitCode" class="control" required maxlength="32" pattern="[A-Za-z0-9_-]{2,32}" autocomplete="off"><p class="field-hint">Gunakan 2–32 huruf, angka, tanda hubung, atau garis bawah.</p></div>
          <div class="form-actions"><button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? 'Menyimpan...' : 'Buat unit' }}</button></div>
        </form>
      </section>

      <section class="panel" aria-labelledby="create-user-heading">
        <div class="panel-header"><div><h2 id="create-user-heading">Tambah akun</h2><p>Kata sandi awal digunakan untuk masuk ke SectOra.</p></div></div>
        <form class="panel-body form-stack" @submit.prevent="createUser">
          <div class="form-grid">
            <div class="field"><label for="user-name">Nama</label><input id="user-name" v-model.trim="displayName" class="control" required maxlength="120" autocomplete="name"></div>
            <div class="field"><label for="user-email">Email</label><input id="user-email" v-model.trim="email" class="control" required type="email" maxlength="254" autocomplete="email"></div>
            <div class="field"><label for="user-password">Kata sandi awal</label><input id="user-password" v-model="password" class="control" required type="password" minlength="14" maxlength="200" autocomplete="new-password"><p class="field-hint">Minimum 14 karakter.</p></div>
            <div class="field"><label for="user-role">Peran</label><select id="user-role" v-model="role" class="control"><option value="USER">User</option><option value="ADMIN">Admin</option></select></div>
          </div>
          <div v-if="role === 'USER'" class="field">
            <label for="user-unit">Unit kerja</label>
            <select id="user-unit" v-model="selectedUnitId" class="control" required :disabled="!grantableUnits.length">
              <option value="" disabled>Pilih unit kerja</option>
              <option v-for="unit in grantableUnits" :key="unit.id" :value="unit.id">{{ unit.name }} · {{ unit.code }}</option>
            </select>
            <p class="field-hint">{{ grantableUnits.length ? 'Akun User mewakili satu unit kerja dan mengisi satu kegiatan statistik per periode.' : 'Belum ada unit aktif. Tambahkan unit terlebih dahulu.' }}</p>
          </div>
          <p v-else class="field-hint">Admin (Pusdatin) mengelola pengaturan dan memverifikasi penilaian semua unit kerja, sehingga tidak perlu memilih unit.</p>
          <div class="form-actions"><button class="btn btn-primary" type="submit" :disabled="saving || (role === 'USER' && !selectedUnitId)">{{ saving ? 'Menyimpan...' : 'Buat akun' }}</button></div>
        </form>
      </section>
    </div>

    <section class="panel">
      <div class="panel-header"><div><h2>Unit terdaftar</h2><p>Ringkasan unit, keanggotaan, dan penilaian.</p></div></div>
      <div v-if="unitData?.units.length" class="data-table-wrap mobile-records"><table class="data-table"><thead><tr><th>Unit</th><th>Status</th><th>Anggota</th><th>Penilaian</th></tr></thead><tbody><tr v-for="unit in unitData.units" :key="unit.id"><td data-label="Unit"><strong>{{ unit.name }}</strong><br>{{ unit.code }}</td><td data-label="Status">{{ unit.isActive ? 'Aktif' : 'Nonaktif' }}</td><td data-label="Anggota">{{ unit._count.memberships }}</td><td data-label="Penilaian">{{ unit._count.assessments }}</td></tr></tbody></table></div>
      <EmptyState v-else title="Belum ada unit" message="Tambahkan unit agar Admin dapat menugaskan User dan periode." />
    </section>

    <section class="panel">
      <div class="panel-header"><div><h2>Akun terdaftar</h2><p>Keanggotaan menentukan unit yang tersedia bagi User.</p></div></div>
      <div v-if="userData?.users.length" class="data-table-wrap mobile-records"><table class="data-table"><thead><tr><th>Nama</th><th>Peran</th><th>Unit</th><th>Dibuat</th><th>Aksi</th></tr></thead><tbody><tr v-for="account in userData.users" :key="account.id"><td data-label="Nama"><strong>{{ account.displayName }}</strong><br>{{ account.email }}</td><td data-label="Peran">{{ account.role === 'ADMIN' ? 'Admin' : 'User' }} · {{ account.isActive ? 'Aktif' : 'Nonaktif' }}</td><td data-label="Unit">{{ account.memberships.map(({ unit }) => `${unit.name} · ${unit.code}`).join(', ') || (account.role === 'ADMIN' ? 'Semua unit (Pusdatin)' : 'Belum ditugaskan') }}</td><td data-label="Dibuat">{{ formatDate(account.createdAt) }}</td><td data-label="Aksi"><span v-if="account.id === auth.user.value?.id" class="field-hint">Akun Anda</span><button v-else class="btn btn-secondary btn-small" type="button" :disabled="updatingId === account.id" @click="toggleActive(account)">{{ account.isActive ? 'Nonaktifkan' : 'Aktifkan' }}</button></td></tr></tbody></table></div>
      <EmptyState v-else title="Belum ada akun" message="Akun yang Anda buat akan muncul di sini." />
    </section>

    <section v-if="userData?.users.length" class="panel" aria-labelledby="reset-password-heading">
      <div class="panel-header"><div><h2 id="reset-password-heading">Atur kata sandi baru</h2><p>Untuk akun yang lupa kata sandi. Semua sesi lama akun itu ikut diakhiri.</p></div></div>
      <form class="panel-body form-stack" @submit.prevent="submitPasswordReset">
        <div class="form-grid">
          <div class="field">
            <label for="reset-user">Akun</label>
            <select id="reset-user" v-model="resetUserId" class="control" required>
              <option value="" disabled>Pilih akun</option>
              <option v-for="account in userData.users" :key="account.id" :value="account.id">{{ account.displayName }} · {{ account.email }}</option>
            </select>
          </div>
          <div class="field"><label for="reset-password">Kata sandi baru</label><input id="reset-password" v-model="resetPassword" class="control" required type="password" minlength="14" maxlength="200" autocomplete="new-password"><p class="field-hint">Minimum 14 karakter. Sampaikan ke pemilik akun lewat jalur yang aman.</p></div>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit" :disabled="Boolean(updatingId) || !resetUserId">{{ updatingId ? 'Menyimpan...' : 'Simpan kata sandi' }}</button></div>
      </form>
    </section>
  </div>
  </template>
</template>
