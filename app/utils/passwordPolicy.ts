// Rules for a password a person sets for their own account. The form shows each rule as a checklist and
// the server checks the same list, so the two never disagree.
export const minPasswordLength = 8
export const maxPasswordLength = 200

export const passwordRules = [
  { id: 'length', label: `Minimal ${minPasswordLength} karakter`, test: (value: string) => value.length >= minPasswordLength },
  { id: 'letter', label: 'Memuat huruf', test: (value: string) => /\p{L}/u.test(value) },
  { id: 'digit', label: 'Memuat angka', test: (value: string) => /\d/.test(value) },
  { id: 'symbol', label: 'Memuat simbol, misalnya ! @ # atau -', test: (value: string) => /[^\p{L}\d\s]/u.test(value) },
] as const

export function unmetPasswordRules(value: string) {
  return passwordRules.filter((rule) => !rule.test(value)).map(({ label }) => label)
}
