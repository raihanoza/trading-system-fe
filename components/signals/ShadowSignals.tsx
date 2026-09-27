"use client";

import { useEffect, useState } from "react";
import {
  EyeOff,
  Layers,
  Ban,
  Ruler,
  ArrowLeftRight,
  ShieldAlert,
  Scale,
  Gauge,
} from "lucide-react";

import { TIER_CONFIG, type ShadowSignal } from "@/types";
import { Badge } from "@/components/ui/badge";
import { getTierSpecs } from "@/lib/api";
import { weightedScoreDetails } from "@/lib/tiers";
import WeightedExplanation from "./WeightedExplanation";
import { formatGateLabel, getGateDescription } from "@/lib/gates";
import { cn, formatPrice } from "@/lib/utils";

/**
 * Kandidat yang TIDAK diterbitkan, tapi tetap ditampilkan.
 *
 * Backend sudah mengembalikan `shadow_signals` sejak 24 Agustus 2026; FE
 * membuangnya diam-diam sampai 25 Agustus. Akibatnya scan forex yang
 * menganalisis 8 pair penuh tampil persis seperti scanner yang mati: layar
 * kosong. Yang TIDAK diterbitkan tetap harus TERLIHAT — itu seluruh alasan
 * komponen ini ada.
 *
 * Sengaja TIDAK memakai `SignalCard`: kartu itu menawarkan "Record Trade" dan
 * menampilkan ukuran posisi, dua hal yang justru tidak berlaku di sini.
 */

type ShadowKind =
  | "duplicate"
  | "opposite"
  | "no-levels"
  | "preflight"
  | "sizing"
  | "mechanical"
  | "tier";

const KIND: Record<
  ShadowKind,
  { label: string; icon: typeof Ban; className: string }
> = {
  duplicate: {
    label: "Duplikat",
    icon: Layers,
    className: "border-amber-400/30 bg-amber-400/10 text-amber-500",
  },
  "no-levels": {
    label: "Level tak lengkap",
    icon: Ruler,
    className: "border-sky-400/30 bg-sky-400/10 text-sky-500",
  },
  opposite: {
    label: "Arah berlawanan diblokir",
    icon: ArrowLeftRight,
    className: "border-rose-400/30 bg-rose-400/10 text-rose-500",
  },
  preflight: {
    label: "Tidak lolos pra-periksa",
    icon: ShieldAlert,
    className: "border-violet-400/30 bg-violet-400/10 text-violet-500",
  },
  sizing: {
    label: "Tak bisa di-sizing",
    icon: Scale,
    className: "border-orange-400/30 bg-orange-400/10 text-orange-500",
  },
  mechanical: {
    label: "Ditolak aturan pasar",
    icon: Gauge,
    className: "border-teal-400/30 bg-teal-400/10 text-teal-500",
  },
  tier: {
    label: "Gugur di tangga tier",
    icon: Ban,
    className: "border-border bg-secondary text-muted-foreground",
  },
};

/**
 * EMPAT asal-usul, dibedakan dari dua flag (`duplicate`, `blocked_opposite`)
 * dan penanda di `reason` — penanda yang sama dipakai backend untuk memutuskan
 * baris mana yang boleh masuk DB (`NO_LEVELS_MARKER` di
 * core/shadow_signal.py).
 *
 * Urutannya bukan selera: `blocked_opposite` HARUS diperiksa sebelum fallback
 * "tier", karena setup itu justru LOLOS tangga tier.
 */
export function classifyShadow(s: ShadowSignal): ShadowKind {
  if (s.duplicate) return "duplicate";
  // Diperiksa SEBELUM fallback "tier": setup ini LOLOS tangga tier, yang
  // menolaknya aturan portofolio. Sampai 30 Agu 2026 flag-nya tidak dikenal FE
  // sehingga kartunya jatuh ke cabang terakhir dan mengaku "gugur di tangga
  // tier" — menyembunyikan satu-satunya alasan yang sebenarnya.
  if (s.blocked_opposite) return "opposite";
  if (s.reason?.startsWith("[NO-LEVELS]")) return "no-levels";
  // Ditolak SEBELUM satu gate pun dihitung (kualitas data / likuiditas).
  // Harus diperiksa sebelum fallback "tier" dengan alasan yang sama seperti
  // `blocked_opposite`: setup ini tidak pernah SAMPAI ke tangga tier, jadi
  // menyebutnya "gugur di tangga tier" menyembunyikan sebab yang sebenarnya.
  if (s.reason?.startsWith("[PRA-PERIKSA]")) return "preflight";
  // Dua penanda ini sudah lama ada di backend tapi TIDAK pernah dikenal di
  // sini, jadi kartunya jatuh ke fallback dan mengaku "gugur di tangga tier" —
  // padahal keduanya justru LOLOS tangga tier dan ditolak sesudahnya. Kelas
  // yang sama persis dengan `blocked_opposite` (30 Agu) dan `[PRA-PERIKSA]`.
  if (s.reason?.startsWith("[TAK-BISA-DISIZING]")) return "sizing";
  if (s.reason?.startsWith("[ATURAN-MEKANIS]")) return "mechanical";
  return "tier";
}

const stripMarker = (reason: string): string =>
  reason.replace(
    /^\[(NO-LEVELS|SHADOW|DUPLIKAT|ARAH BERLAWANAN|PRA-PERIKSA|TAK-BISA-DISIZING|ATURAN-MEKANIS)\]\s*/,
    "",
  );

function Chip({ g, ok, kandidat }: { g: string; ok: boolean; kandidat: boolean }) {
  return (
    <span
      title={
        `${formatGateLabel(g)} — ${getGateDescription(g)}` +
        (kandidat
          ? " — gate KANDIDAT: dihitung dan disimpan, tapi TIDAK menentukan tier."
          : "")
      }
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] leading-none border",
        kandidat
          ? // Kandidat sengaja TIDAK pernah hijau penuh: chip hijau yang sama
            // dengan gate penentu membuatnya terbaca sebagai bukti yang setara,
            // padahal ia tidak menentukan apa pun.
            ok
            ? "border-dashed border-muted-foreground/40 bg-transparent text-muted-foreground"
            : "border-dashed border-border bg-transparent text-muted-foreground/40"
          : ok
            ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-500"
            : "border-border bg-secondary/60 text-muted-foreground/60",
      )}
    >
      {formatGateLabel(g)}
    </span>
  );
}

function GateStrip({ s }: { s: ShadowSignal }) {
  // Gate mana yang BENAR-BENAR menentukan tier — diambil dari /meta/tiers,
  // tidak disalin ke sini. Sampai 29 Agu 2026 komponen ini menghitung
  // "Gate n/12" dari SELURUH isi `gates_all`, mencampur gate penentu dengan
  // gate KANDIDAT (protokol 3.7) yang tidak menentukan apa pun. Terukur:
  // LTCUSDT tampil "GATE 6/12" padahal hanya 4 dari 6 itu berpengaruh, dan
  // salah satu kandidat (`funding_rate_ok`) menyala di ~99,75 % kesempatan.
  const [scored, setScored] = useState<Set<string> | null>(null);
  useEffect(() => {
    let alive = true;
    getTierSpecs()
      .then((r) => {
        if (alive && Array.isArray(r.scored)) setScored(new Set(r.scored));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // `gates_all` = vektor PENUH (termasuk yang gagal). Sinyal lama belum
  // punya kolom itu — di situ pass/fail direkonstruksi dari dua daftar.
  const entries: [string, boolean][] = s.gates_all
    ? Object.entries(s.gates_all)
    : [
        ...(s.gates_passed ?? []).map((g) => [g, true] as [string, boolean]),
        ...(s.gates_failed ?? []).map((g) => [g, false] as [string, boolean]),
      ];
  if (entries.length === 0) return null;

  const penentu = scored ? entries.filter(([g]) => scored.has(g)) : entries;
  const kandidat = scored ? entries.filter(([g]) => !scored.has(g)) : [];
  const lolos = penentu.filter(([, v]) => v).length;

  return (
    <div className="space-y-1.5">
      {/* Angkanya ditahan sampai daftar penentu termuat. Menampilkan hitungan
          yang mencampur kandidat lebih buruk daripada tidak menampilkan angka:
          yang pertama terbaca sebagai fakta, yang kedua jelas belum siap. */}
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
        {scored ? (
          <>
            Gate {lolos}/{penentu.length} penentu tier
          </>
        ) : (
          <>Gate</>
        )}
      </p>
      <div className="flex flex-wrap gap-1">
        {penentu.map(([g, ok]) => (
          <Chip key={g} g={g} ok={ok} kandidat={false} />
        ))}
      </div>

      {kandidat.length > 0 && (
        <div className="space-y-1">
          <p
            className="text-[10px] uppercase tracking-wide text-muted-foreground/50"
            title="Dihitung dan disimpan untuk pengukuran, tapi tidak menentukan tier (protokol 3.7)."
          >
            Kandidat · tidak menentukan tier
          </p>
          <div className="flex flex-wrap gap-1">
            {kandidat.map(([g, ok]) => (
              <Chip key={g} g={g} ok={ok} kandidat />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Levels({ s }: { s: ShadowSignal }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-xs">
      <div>
        <p className="text-muted-foreground text-[10px]">Entry</p>
        <p className="font-mono">{formatPrice(s.entry, s.market)}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-[10px]">SL</p>
        <p className="font-mono text-red-400">
          {formatPrice(s.stop_loss, s.market)}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground text-[10px]">TP</p>
        <p className="font-mono text-emerald-400">
          {formatPrice(s.take_profit, s.market)}
        </p>
      </div>
    </div>
  );
}

function ShadowCard({ s }: { s: ShadowSignal }) {
  const kind = classifyShadow(s);
  const meta = KIND[kind];
  const Icon = meta.icon;
  const tanpaLevel = kind === "no-levels" || kind === "preflight";

  // `tier` pada baris SKIP adalah NILAI DEFAULT, bukan tier yang dicapai:
  // `GateEvaluator.evaluate()` mengembalikan `Tier.RADAR` untuk SETIAP jalur
  // SKIP — baik veto absolute-mandatory maupun "tidak ada tier yang lolos".
  // Menampilkannya sebagai lencana membuat kartu membantah dirinya sendiri:
  // badge "Radar" tepat di sebelah kalimat "belum cukup untuk tier mana pun".
  //
  // Yang benar-benar punya tier hanyalah baris duplikat — ia LOLOS tangga
  // tier, cuma tidak disimpan ulang. Pembedanya `action`: SKIP = tanpa tier.
  const reachedTier = s.action !== "SKIP";
  const tier = reachedTier ? TIER_CONFIG[s.tier] : null;
  const scoreDetails = weightedScoreDetails(s.score_details);

  return (
    <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{s.ticker}</span>
            {reachedTier ? (
              <Badge
                variant="outline"
                className={cn("text-[10px]", tier?.color, tier?.bgColor)}
              >
                {tier?.emoji} {tier?.label ?? s.tier}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] border-dashed text-muted-foreground"
                title="Tidak mencapai tier mana pun. Nilai tier pada baris SKIP hanya default, bukan hasil."
              >
                Tanpa tier
              </Badge>
            )}
          </div>
          {tanpaLevel && s.entry > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              {formatPrice(s.entry, s.market)}
            </p>
          )}
        </div>
        <span
          className={cn(
            "flex items-center gap-1 shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
            meta.className,
          )}
        >
          <Icon className="w-3 h-3" />
          {meta.label}
        </span>
      </div>

      {/* `stop_loss`/`take_profit` baris NO-LEVELS dan PRA-PERIKSA bernilai 0.0
          dan BUKAN harga — menampilkannya sebagai level akan jadi bohong yang
          rapi. Baris PRA-PERIKSA malah tidak pernah menghitung level sama
          sekali; ia berhenti sebelum gate pertama. */}
      {!tanpaLevel && <Levels s={s} />}

      {!tanpaLevel && (
        <p className="text-xs text-muted-foreground">
          R:R{" "}
          <span className="font-mono text-foreground">
            1:{s.rr_ratio.toFixed(1)}
          </span>
        </p>
      )}

      {scoreDetails ? <WeightedExplanation details={scoreDetails} /> : <GateStrip s={s} />}

      <p
        title={s.reason}
        className="text-xs text-muted-foreground/80 leading-relaxed border-t border-border pt-2"
      >
        {kind === "tier" && !scoreDetails
          ? "Gate di atas belum cukup untuk tier mana pun — lihat chip yang redup."
          : stripMarker(s.reason)}
        {kind === "preflight" && (
          <span className="block mt-1 text-muted-foreground/60">
            Berhenti sebelum gate pertama dihitung — jadi tidak ada bukti gate
            untuk ditampilkan, bukan bukti yang semuanya gagal.
          </span>
        )}
      </p>
    </div>
  );
}

export default function ShadowSignals({ shadow }: { shadow: ShadowSignal[] }) {
  if (shadow.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
        <h2 className="text-sm font-semibold">
          Tidak diterbitkan ({shadow.length})
        </h2>
      </div>
      <p className="text-xs text-muted-foreground/70">
        Kandidat yang sudah dianalisis penuh tapi tidak jadi sinyal. Bukan
        rekomendasi — ditampilkan supaya &quot;gate-nya jelek&quot;,
        &quot;level tak terbentuk&quot;, dan &quot;scanner mati&quot; tidak
        terlihat sama.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {shadow.map((s) => (
          <ShadowCard key={`${s.ticker}-${s.reason.slice(0, 24)}`} s={s} />
        ))}
      </div>
    </div>
  );
}
