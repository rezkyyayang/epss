# Sectoral

Sectoral is an Indonesian assessment and review application built with Nuxt, Prisma, and PostgreSQL. It follows the interaction patterns described in `Analisis_EPSS_BPS_dan_Rancangan_SectOra.md` and the interface direction in `design.md`. It uses its own Sectoral identity and starts with an empty database.

## Requirements

- Node.js 20 or newer
- Docker Compose
- npm

## Local setup

1. Install dependencies and prepare local settings. Put a unique local database password in `POSTGRES_PASSWORD`, then set the same password in `DATABASE_URL`:

   ```powershell
   npm install
   Copy-Item .env.example .env
   ```

   Use a password with URL-safe characters, such as a 32-byte hexadecimal value. Keep `.env` private; the PostgreSQL port binds to this machine only. To use a hosted database such as Supabase instead, put its connection string in `DATABASE_URL` and skip step 2.

2. Start PostgreSQL:

   ```powershell
   docker compose up -d db
   ```

3. Create the schema:

   ```powershell
   npm run db:migrate:deploy
   ```

4. Create the first Admin. Set a private email, display name, and password (at least 14 characters) in the current PowerShell session, then run the bootstrap command:

   ```powershell
   $env:BOOTSTRAP_ADMIN_EMAIL = 'admin@your-organization.example'
   $env:BOOTSTRAP_ADMIN_NAME = 'Your name'
   $env:BOOTSTRAP_ADMIN_PASSWORD = 'a-long-private-password'
   npm run admin:create
   Remove-Item Env:BOOTSTRAP_ADMIN_EMAIL, Env:BOOTSTRAP_ADMIN_NAME, Env:BOOTSTRAP_ADMIN_PASSWORD
   ```

   The script refuses to create a second bootstrap Admin. Additional accounts are created from the Admin screen, where an Admin can also deactivate an account or set a new password for it. Both changes sign that account out.

5. Start Sectoral:

   ```powershell
   npm run dev
   ```

   Open `http://localhost:3000`.

The first Admin can configure periods, indicators, accounts, and units. Admins are Pusdatin staff: they see and verify every unit's assessment. Assign each User account to its unit from the account form; a User sees only the units it belongs to.

## Runtime settings

Copy `.env.example` to `.env` for local development. Keep `.env` out of version control.

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `DATABASE_POOL_MAX` | Connections each server process may hold (default 5). Keep it times the number of server processes under the database's client limit; Supabase session mode allows 15 in total |
| `APP_ORIGIN` | Comma-separated origin allowlist for mutation requests; local development accepts both loopback URLs |
| `SESSION_DURATION_HOURS` | Database session and cookie lifetime |
| `TRUST_PROXY` | Set to `true` only behind a reverse proxy that appends `X-Forwarded-For`; login throttling then keys on the client address the proxy reports |

In production, set `APP_ORIGIN` to the externally served origin. The local loopback defaults only apply outside production.

Evidence is a list of links, not uploaded files. Users paste up to 10 `http`/`https` links per indicator (for example Google Drive or OneDrive). Sectoral stores only the URL, so access to the linked document is controlled by wherever it is hosted.

## Product behavior

- User accounts can access only their assigned units and assessments they created.
- Flow: the unit names its one statistical activity for the period (name and year), fills a level, an explanation and evidence links per indicator, and submits. Submitting locks the answers.
- Admins (Pusdatin) see every unit. For each indicator they set a final level and a verification comment, then send the verification result, which locks it and shows the final scores to the unit.
- Unit assignment and indicator catalogs lock when the first assessment for a period is created.
- Each period's catalog is Domain → Indicator → maturity levels (2 to 5). Domains and indicators carry whole-percent weights: domain weights in a period total 100, and indicator weights in each domain total 100. The catalog editor can fill in the standard catalog (5 domains, 13 indicators, 5 levels each; levels 4 and 5 are the same for every indicator).
- The weighted score is the sum of (domain weight × sum of (indicator weight × chosen level)). It appears only when every indicator has a saved level. The self-assessment score uses the unit's levels; the final score uses Pusdatin's verified levels.
- On a five-level catalog, each total gets an index predicate: 4,20 to 5,00 Memuaskan, 3,50 to under 4,20 Sangat Baik, 2,60 to under 3,50 Baik, 1,80 to under 2,60 Cukup, under 1,80 Kurang. The band follows the score as shown (two decimals). Catalogs on another scale show no predicate.
- Statuses: Draf → Menunggu verifikasi → Dalam verifikasi → Terverifikasi. There is no revision round; status and audit events are stored in PostgreSQL.
- There is no sample submission or score seed.

Self-service password reset, moving a User to another unit, SSO, notifications, data retention, reopening approved assessments, and exports are not implemented yet.

## Commands

```powershell
npm run dev
npm run typecheck
npm run test:unit
npm run test:api
npm run build
npm run db:generate
npm run db:migrate:dev
npm run db:migrate:deploy
npm run units:seed
```

`npm run units:seed` loads the 23 LAN work units (20 eselon II units from the 2025 organization chart, plus the three Politeknik STIA LAN campuses) in `scripts/seed-units.ts`. It is safe to run again: units are matched by code, then by name, and corrected in place.

`npm run test:api` runs the API regression tests in `tests/api/` against a running server. Point it at a server backed by a disposable database, because each run creates accounts and units. Set `SECTORA_TEST_URL` (included in `APP_ORIGIN`), `SECTORA_TEST_ADMIN_EMAIL`, and `SECTORA_TEST_ADMIN_PASSWORD`; without them the tests are skipped.

//Redeploy 1 - 20261023
//Redeploy 2 - 20261026