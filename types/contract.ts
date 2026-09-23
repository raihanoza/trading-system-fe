/**
 * Kontrak tier yang dipilih endpoint analitik performa (backend
 * `core/cohort.py`, sejak 22 Sep 2026).
 *
 * Nama tier yang sama ("STANDARD") dipakai dua kontrak berbeda — AND
 * `39000b3b` dan weighted-v1 `f553ce3d` — untuk populasi yang berbeda.
 * Backend karena itu memilih SATU kontrak secara bawaan dan melaporkan apa
 * yang ia keluarkan. Tanpa field ini halaman terbaca "belum ada sinyal
 * teresolusi" padahal ratusan baris kontrak lain sengaja disisihkan.
 */
export interface ContractInfo {
  /** Nilai `?contract=` yang diminta: "active", "all", "none" atau hash. */
  requested: string;
  /** Kontrak yang benar-benar dipakai angka ("all" bila digabung). */
  selected: string;
  /** Hash kontrak yang ditulis kode yang sedang berjalan. */
  active: string;
  /** Jumlah baris per kontrak SEBELUM dipilih; "none" = baris tanpa hash. */
  counts: Record<string, number>;
  /** Baris yang tidak ikut angka karena kontraknya lain. */
  excluded: number;
  /** True bila angka menggabungkan lebih dari satu kontrak. */
  mixed: boolean;
  warning: string | null;
}

/** Parameter `?contract=` yang dikirim klien. */
export type ContractParam = "active" | "all" | "none" | (string & {});
