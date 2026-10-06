# trading-system-fe

UI Next.js untuk backend `trading-system` (FastAPI, repo tetangga
`../trading-system`). Sistemnya **paper-only**: UI menampilkan sinyal,
pengukuran, dan jurnal; tidak ada eksekusi order.

## Arsitektur singkat

```
browser ──► /api/backend/*  (route handler, server Next) ──► backend :4010
        └─► /api/runtime    (identitas build + status backend)
```

- Browser **tidak pernah** memanggil backend langsung. Semua permintaan lewat
  proxy same-origin `app/api/backend/[...path]` (`lib/server/backend.ts`).
- Bila backend mewajibkan `API_WRITE_TOKEN` untuk POST/PUT/PATCH/DELETE, proxy
  yang menempelkannya dari environment server. Token tidak masuk bundle,
  localStorage, respons API, atau Git.
- Pagar proxy: Host harus loopback (anti DNS rebinding); mutasi harus
  same-origin (anti CSRF); batas waktu 15 menit (scan pernah >300 detik).
- Galat diklasifikasikan di `lib/api-error.ts` (401, 403/paper, 404, 409, 422,
  5xx, backend mati/lambat, jaringan, respons rusak) dan dijelaskan lewat
  `components/system/StateNotice.tsx`. "Kosong" dan "gagal" tidak pernah
  tampil sama.

## Konfigurasi

Salin `.env.example` ke `.env.production.local` (dibaca `next build` dan
`next start`). Variabel:

| Nama | Wajib | Arti |
|---|---|---|
| `TRADING_API_URL` | tidak (bawaan `http://127.0.0.1:4010`) | Alamat backend untuk proxy server |
| `API_WRITE_TOKEN` | hanya bila backend mewajibkannya | Sama dengan `API_WRITE_TOKEN` backend |
| `TRADING_API_TIMEOUT_MS` | tidak (900000) | Batas waktu proxy |
| `FE_ALLOWED_HOSTS` | tidak | Hostname tambahan selain loopback |

`NEXT_PUBLIC_API_URL` lama masih dibaca sebagai cadangan `TRADING_API_URL`,
tetapi tidak lagi dipakai browser.

## Identitas build & runtime

- `next.config.ts` menghitung identitas build lewat `lib/build-identity.cjs`:
  commit git, status dirty, dan **sidik isi sumber** (`app/`, `components/`,
  `hooks/`, `lib/`, `types/`, `public/`, berkas konfigurasi akar; tanpa
  `.env*`). BUILD_ID = `<commit7>-<c|d|u><sidik10>` dan deterministik:
  sumber yang sama → ID yang sama.
- `GET /api/runtime` melaporkan identitas build, sidik sumber di disk saat
  ini (`source_matches_build`), status koneksi backend, dan isi
  `GET /system/runtime` backend (sidik kode, mode paper/live, kontrak tier,
  lantai vonis forward).
- Chip di header dan halaman **Sistem** (`/settings`) menampilkan semuanya.

## Skrip

```bash
npm run dev            # pengembangan (port 3000)
npm run lint
npm run typecheck
npm test               # Vitest: klien API, proxy, runtime, komponen, integrasi
npm run build:verify   # build produksi ke .next-verify (tidak menyentuh .next)
npm run check:secrets  # pindai .next (atau: node scripts/check-bundle-secrets.mjs .next-verify)
npm run verify         # semua di atas, berurutan
```

Tes `tests/integration/backend-contract.test.ts` menyalakan backend FastAPI
asli dari `../trading-system` (atau `TRADING_BACKEND_DIR`) dengan DB, cache,
log, dan cwd di folder sementara; tes dilewati bila venv backend tidak ada.

## Deploy (service Windows `TradingSystemFrontend`, port 4011)

Service menjalankan `next start`, yang menyajikan isi `.next` — **bukan**
sumber. Perubahan sumber baru terlihat setelah build ulang, dan build harus
dijalankan saat service mati (`next start` memegang berkas di `.next`).
Gunakan `ops/windows-service/redeploy.ps1 -Services frontend` di repo backend
(Administrator), lalu periksa `GET http://127.0.0.1:4011/api/runtime`:
`frontend.build_id` harus sama dengan ID build verifikasi dan
`source_matches_build` harus `true`.
