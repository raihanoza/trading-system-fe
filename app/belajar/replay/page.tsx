import { Metadata } from "next";
import ReplayContent from "./_content";

export const metadata: Metadata = {
  title: "Replay | Belajar",
  description:
    "Berjalan bar demi bar di data historis, ambil keputusan, lihat hasilnya — dinilai resolver yang sama dengan sinyal live.",
};

export default function ReplayPage() {
  return (
    <div className="flex flex-col gap-6 p-6 w-full max-w-400 mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Replay</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Chart berjalan satu bar sekali. Kamu tidak bisa melihat bar
          berikutnya sebelum memutuskan — server memang tidak mengirimkannya.
          Hasil keputusanmu dinilai <em>resolver yang sama</em>{" "}
          dengan sinyal live: entry di open bar berikutnya, biaya masuk-keluar dihitung, dan
          kena stop berarti lebih buruk dari &minus;1R.
        </p>
        <p className="text-muted-foreground/70 mt-2 max-w-3xl text-sm">
          Sesi latihan tidak disimpan. Skornya bukan data pengukuran sistem, dan
          mencampurnya ke sana akan mengaburkan mana hasil sistem dan mana skor
          permainan.
        </p>
      </div>

      <ReplayContent />
    </div>
  );
}
