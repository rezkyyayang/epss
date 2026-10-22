<script setup lang="ts">
import { getApiError, formatDate } from '../../utils/format'

interface UnitRow { id: string; name: string; code: string; isActive: boolean; _count: { memberships: number; assessments: number } }
interface UserRow { id: string; email: string; displayName: string; role: string; isActive: boolean; createdAt: string; memberships: Array<{ unit: { id: string; name: string; code: string } }> }
const [{ data: unitData, refresh: refreshUnits, pending: unitsPending, error: unitsError }, { data: userData, refresh: refreshUsers, pending: usersPending, error: usersError }] = await Promise.all([
  useFetch<{ units: UnitRow[] }>('/api/admin/units'),
  useFetch<{ users: UserRow[] }>('/api/admin/users'),
])
const listsPending = computed(() => unitsPending.value || usersPending.value)
const listsError = computed(() => unitsError.value || usersError.value)
const unitName = ref('')
const unitCode = ref('')
const displayName = ref('')
const email = ref('')
const password = ref('')
const role = ref<'USER' | 'ADMIN'>('USER')
const selectedUnitIds = ref<string[]>([])
const saving = ref(false)
const message = ref('')
const pageError = ref('')

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

async function createUser() {
  saving.value = true; message.value = ''; pageError.value = ''
  try {
    await $fetch('/api/admin/users', { method: 'POST', body: { displayName: displayName.value, email: email.value, password: password.value, role: role.value, unitIds: selectedUnitIds.value } })
    displayName.value = ''; email.value = ''; password.value = ''; role.value = 'USER'; selectedUnitIds.value = []
    message.value = 'Akun berhasil dibuat.'
    await refreshUsers()
  } catch (error) { pageError.value = getApiError(error, 'Akun belum dapat dibuat.') }
  finally { saving.value = false }
}
</script>

<template>
  <PageHeading title="Pengguna dan unit" subtitle="Buat akun, berikan akses unit, dan lihat keanggotaan yang sudah terdaftar." />
  <div v-if="listsPending" class="panel loading-state" role="status">Memuat pengguna dan unit...</div>
  <NoticeBanner v-else-if="listsError" tone="error" role="alert">
    {{ getApiError(listsError, 'Daftar pengguna dan unit belum dapat dimuat.') }}
    <button class="btn btn-secondary btn-small" type="button" @click="refreshLists">Coba lagi</button>
  </NoticeBanner>
  <template v-else>
  <div class="section-stack">
    <NoticeBanner v-if="pageError" tone="error" role="alert">{{ pageError }}</NoticeBanner>
    <NoticeBanner v-else-if="message" tone="success" aria-live="polite">{{ message }}</NoticeBanner>
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
          <fieldset class="field">
            <legend class="field-label">Unit yang dapat diakses</legend>
            <div class="check-list">
              <label v-for="unit in (unitData?.units || []).filter((item) => item.isActive)" :key="unit.id" class="check-row"><input v-model="selectedUnitIds" type="checkbox" :value="unit.id"><span>{{ unit.name }} · {{ unit.code }}</span></label>
              <p v-if="!(unitData?.units || []).some((item) => item.isActive)" class="field-hint">Buat unit sebelum menambahkan akun dengan akses unit.</p>
            </div>
          </fieldset>
          <p v-if="role === 'ADMIN'" class="field-hint">Admin dapat mengelola pengaturan. Keputusan pemeriksaan hanya tersedia pada unit yang dipilih.</p>
          <div class="form-actions"><button class="btn btn-primary" type="submit" :disabled="saving || (role === 'USER' && selectedUnitIds.length === 0)">{{ saving ? 'Menyimpan...' : 'Buat akun' }}</button></div>
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
      <div v-if="userData?.users.length" class="data-table-wrap mobile-records"><table class="data-table"><thead><tr><th>Nama</th><th>Peran</th><th>Unit</th><th>Dibuat</th></tr></thead><tbody><tr v-for="account in userData.users" :key="account.id"><td data-label="Nama"><strong>{{ account.displayName }}</strong><br>{{ account.email }}</td><td data-label="Peran">{{ account.role === 'ADMIN' ? 'Admin' : 'User' }} · {{ account.isActive ? 'Aktif' : 'Nonaktif' }}</td><td data-label="Unit">{{ account.memberships.map(({ unit }) => `${unit.name} · ${unit.code}`).join(', ') || (account.role === 'ADMIN' ? 'Belum diberi cakupan unit' : 'Belum ditugaskan') }}</td><td data-label="Dibuat">{{ formatDate(account.createdAt) }}</td></tr></tbody></table></div>
      <EmptyState v-else title="Belum ada akun" message="Akun yang Anda buat akan muncul di sini." />
    </section>
  </div>
  </template>
</template>
