"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FlaskConical,
  GraduationCap,
  Lightbulb,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_LESSONS, findLesson, LEARNING_LEVELS, type LevelId } from "./_curriculum";
import LessonVisual from "./_lesson-visual";
import SystemLab from "./_system-lab";

const PROGRESS_KEY = "trading-os-learning-progress-v1";
const LAST_LESSON_KEY = "trading-os-last-lesson-v1";
const PROJECT_COUNT = ALL_LESSONS.filter(({ lesson }) => lesson.isProject).length;

const LEVEL_STYLES: Record<LevelId, { accent: string; soft: string; border: string; number: string }> = {
  pemula: { accent: "text-emerald-300", soft: "bg-emerald-400/10", border: "border-emerald-400/20", number: "01" },
  dasar: { accent: "text-sky-300", soft: "bg-sky-400/10", border: "border-sky-400/20", number: "02" },
  menengah: { accent: "text-amber-300", soft: "bg-amber-400/10", border: "border-amber-400/20", number: "03" },
  lanjutan: { accent: "text-orange-300", soft: "bg-orange-400/10", border: "border-orange-400/20", number: "04" },
  expert: { accent: "text-rose-300", soft: "bg-rose-400/10", border: "border-rose-400/20", number: "05" },
};

function readStoredProgress(): string[] {
  try {
    const stored = localStorage.getItem(PROGRESS_KEY);
    const lessonIds = new Set(ALL_LESSONS.map(({ lesson }) => lesson.id));
    return stored
      ? (JSON.parse(stored) as string[]).filter((lessonId) => lessonIds.has(lessonId))
      : [];
  } catch {
    return [];
  }
}

function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return (
    <div
      className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(#34d399 ${percent * 3.6}deg, rgba(255,255,255,.08) 0deg)` }}
      aria-label={`Progres belajar ${percent}%`}
    >
      <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-[#0d1210] text-center">
        <div><p className="font-mono text-xl font-bold text-white">{percent}%</p><p className="text-[9px] uppercase tracking-widest text-white/35">selesai</p></div>
      </div>
    </div>
  );
}

function LevelStrip({
  selectedLevel,
  completed,
  onSelect,
}: {
  selectedLevel: LevelId;
  completed: Set<string>;
  onSelect: (levelId: LevelId) => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-5">
      {LEARNING_LEVELS.map((level) => {
        const style = LEVEL_STYLES[level.id];
        const done = level.lessons.filter((lesson) => completed.has(lesson.id)).length;
        const isActive = selectedLevel === level.id;
        return (
          <button
            key={level.id}
            onClick={() => onSelect(level.id)}
            className={cn(
              "group rounded-xl border p-3 text-left transition-all",
              isActive ? `${style.soft} ${style.border}` : "border-white/8 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.045]",
            )}
          >
            <div className="flex items-center justify-between">
              <span className={cn("font-mono text-[10px] font-bold tracking-[0.18em]", isActive ? style.accent : "text-white/35")}>LEVEL {style.number}</span>
              <span className="font-mono text-[9px] text-white/30">{done}/{level.lessons.length}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-white/90">{level.title}</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-white/40">{level.subtitle}</p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/6">
              <div className="h-full rounded-full bg-current text-emerald-400 transition-all" style={{ width: `${(done / level.lessons.length) * 100}%` }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function LessonList({
  levelId,
  selectedLessonId,
  completed,
  onSelect,
}: {
  levelId: LevelId;
  selectedLessonId: string;
  completed: Set<string>;
  onSelect: (lessonId: string) => void;
}) {
  const level = LEARNING_LEVELS.find((item) => item.id === levelId) ?? LEARNING_LEVELS[0];
  const style = LEVEL_STYLES[level.id];
  return (
    <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
      <div className={cn("rounded-2xl border bg-[#0d1210]", style.border)}>
        <div className="border-b border-white/8 p-4">
          <p className={cn("font-mono text-[10px] font-bold tracking-[0.18em]", style.accent)}>LEVEL {style.number}</p>
          <h2 className="mt-2 text-xl font-bold text-white">{level.title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/45">{level.description}</p>
        </div>
        <div className="p-2">
          {level.lessons.map((lesson, index) => {
            const isDone = completed.has(lesson.id);
            const isActive = selectedLessonId === lesson.id;
            return (
              <button
                key={lesson.id}
                onClick={() => onSelect(lesson.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-all",
                  isActive ? "bg-white/7 text-white" : "text-white/55 hover:bg-white/4 hover:text-white/80",
                )}
              >
                <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border font-mono text-[10px]", isDone ? "border-emerald-400/30 bg-emerald-400/12 text-emerald-300" : isActive ? `${style.border} ${style.soft} ${style.accent}` : "border-white/10 text-white/30")}>
                  {isDone ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span className="min-w-0"><span className="block text-xs font-semibold leading-snug">{lesson.title}</span><span className="mt-1 flex items-center gap-1.5 text-[9px] text-white/30"><Clock3 className="h-2.5 w-2.5" />{lesson.duration}{lesson.isProject && <span className="rounded bg-amber-400/10 px-1.5 py-0.5 font-bold tracking-wider text-amber-300">PROYEK</span>}</span></span>
                {isActive && <ChevronRight className={cn("ml-auto mt-1 h-3 w-3 shrink-0", style.accent)} />}
              </button>
            );
          })}
        </div>
        <div className="border-t border-white/8 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Hasil level ini</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/55">{level.outcome}</p>
        </div>
      </div>
    </aside>
  );
}

function LessonArticle({
  lessonId,
  completed,
  onComplete,
  onNavigate,
}: {
  lessonId: string;
  completed: Set<string>;
  onComplete: (lessonId: string) => void;
  onNavigate: (lessonId: string) => void;
}) {
  const found = findLesson(lessonId);
  const { lesson, level } = found;
  const lessonIndex = ALL_LESSONS.findIndex((item) => item.lesson.id === lesson.id);
  const previous = ALL_LESSONS[lessonIndex - 1];
  const next = ALL_LESSONS[lessonIndex + 1];
  const style = LEVEL_STYLES[level.id];
  const [answer, setAnswer] = useState<number | null>(null);

  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-white/8 bg-[#0d1210]">
      <header className="relative overflow-hidden border-b border-white/8 px-5 py-7 sm:px-8 sm:py-9">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-400/6 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
            <span className={style.accent}>Level {style.number} · {level.title}</span><span>/</span><span>{lesson.isProject ? "Proyek kelulusan" : `Pelajaran ${level.lessons.findIndex((item) => item.id === lesson.id) + 1}`}</span><span>/</span><span>{lesson.duration}</span>
          </div>
          <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl">{lesson.title}</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-white/58">{lesson.summary}</p>
        </div>
      </header>

      <div className="space-y-9 p-5 sm:p-8">
        <section aria-labelledby="pahami-title">
          <div className="mb-4 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-400/10 text-sky-300"><BookOpen className="h-3.5 w-3.5" /></span><h3 id="pahami-title" className="text-sm font-bold uppercase tracking-[0.12em] text-white/80">Pahami dulu</h3></div>
          <div className="space-y-4 text-sm leading-7 text-white/62">{lesson.explanation.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
          <div className="mt-5 flex gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.045] p-4"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><div><p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Ingat ini</p><p className="mt-1 text-sm leading-relaxed text-white/70">{lesson.remember}</p></div></div>
        </section>

        <section aria-labelledby="lihat-chart-title">
          <div className="mb-4 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300"><Play className="h-3.5 w-3.5" /></span><h3 id="lihat-chart-title" className="text-sm font-bold uppercase tracking-[0.12em] text-white/80">Lihat di chart</h3></div>
          <LessonVisual kind={lesson.visual} title={lesson.visualTitle} caption={lesson.visualCaption} />
        </section>

        <section className="grid gap-5 md:grid-cols-[1fr_0.8fr]" aria-labelledby="praktik-title">
          <div className="rounded-2xl border border-emerald-400/18 bg-emerald-400/[0.035] p-5">
            <div className="flex items-center gap-2"><Target className="h-4 w-4 text-emerald-300" /><h3 id="praktik-title" className="text-sm font-bold uppercase tracking-[0.12em] text-emerald-200">Coba sendiri</h3></div>
            <ol className="mt-4 space-y-3">{lesson.steps.map((step, index) => <li key={step} className="flex gap-3 text-sm leading-relaxed text-white/65"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400/12 font-mono text-[9px] font-bold text-emerald-300">{index + 1}</span><span>{step}</span></li>)}</ol>
            <div className="mt-5 border-t border-emerald-400/12 pt-4"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Tugas praktik</p><p className="mt-2 text-sm leading-6 text-white/70">{lesson.exercise}</p></div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Istilah baru</p>
            <dl className="mt-4 space-y-4">{lesson.terms.map((item) => <div key={item.term}><dt className="text-sm font-semibold text-white/85">{item.term}</dt><dd className="mt-1 text-xs leading-relaxed text-white/48">{item.meaning}</dd></div>)}</dl>
          </div>
        </section>

        <section className="rounded-2xl border border-sky-400/15 bg-sky-400/[0.035] p-5 sm:p-6" aria-labelledby="quiz-title">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-sky-300" /><h3 id="quiz-title" className="text-sm font-bold uppercase tracking-[0.12em] text-sky-200">Cek pemahaman</h3></div>
          <p className="mt-4 text-base font-semibold leading-relaxed text-white/85">{lesson.quiz.question}</p>
          <div className="mt-4 grid gap-2">{lesson.quiz.options.map((option, index) => {
            const isSelected = answer === index;
            const isCorrect = answer !== null && index === lesson.quiz.answer;
            const isWrong = isSelected && answer !== lesson.quiz.answer;
            return <button key={option} onClick={() => setAnswer(index)} className={cn("flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all", isCorrect ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : isWrong ? "border-rose-400/30 bg-rose-400/8 text-rose-100" : isSelected ? "border-sky-400/30 bg-sky-400/8 text-white" : "border-white/8 bg-black/10 text-white/60 hover:border-white/16 hover:text-white/85")}><span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border font-mono text-[10px]", isCorrect ? "border-emerald-400/40 text-emerald-300" : isWrong ? "border-rose-400/40 text-rose-300" : "border-white/12 text-white/35")}>{isCorrect ? <Check className="h-3 w-3" /> : String.fromCharCode(65 + index)}</span>{option}</button>;
          })}</div>
          {answer !== null && <div className={cn("mt-4 rounded-xl border p-4 text-sm leading-relaxed", answer === lesson.quiz.answer ? "border-emerald-400/20 bg-emerald-400/6 text-emerald-100/75" : "border-amber-400/20 bg-amber-400/6 text-amber-100/75")}><p className="font-semibold">{answer === lesson.quiz.answer ? "Tepat." : "Belum tepat—coba lihat alasannya."}</p><p className="mt-1 opacity-80">{lesson.quiz.explanation}</p></div>}
        </section>

        <div className="flex flex-col gap-3 border-t border-white/8 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {previous && <button onClick={() => onNavigate(previous.lesson.id)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/55 transition hover:bg-white/5 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" />Sebelumnya</button>}
            {next && <button onClick={() => onNavigate(next.lesson.id)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/55 transition hover:bg-white/5 hover:text-white">Berikutnya<ArrowRight className="h-3.5 w-3.5" /></button>}
          </div>
          <button disabled={answer === null} onClick={() => onComplete(lesson.id)} className={cn("inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-35", completed.has(lesson.id) ? "border border-emerald-400/20 bg-emerald-400/8 text-emerald-300" : "bg-emerald-400 text-emerald-950 hover:bg-emerald-300")}>
            {completed.has(lesson.id) ? <><CheckCircle2 className="h-4 w-4" />Sudah selesai</> : <><Trophy className="h-4 w-4" />Tandai selesai</>}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function BelajarContent() {
  const [section, setSection] = useState<"kurikulum" | "lab">("kurikulum");
  const [selectedLessonId, setSelectedLessonId] = useState(ALL_LESSONS[0].lesson.id);
  const [selectedLevel, setSelectedLevel] = useState<LevelId>(ALL_LESSONS[0].level.id);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    let isActive = true;
    queueMicrotask(() => {
      if (!isActive) return;
      setCompleted(new Set(readStoredProgress()));
      const lastLesson = localStorage.getItem(LAST_LESSON_KEY);
      if (lastLesson && ALL_LESSONS.some((item) => item.lesson.id === lastLesson)) {
        const found = findLesson(lastLesson);
        setSelectedLessonId(lastLesson);
        setSelectedLevel(found.level.id);
      }
    });
    return () => {
      isActive = false;
    };
  }, []);

  const completedCount = completed.size;
  const activeLevel = useMemo(() => LEARNING_LEVELS.find((level) => level.id === selectedLevel) ?? LEARNING_LEVELS[0], [selectedLevel]);

  function selectLesson(lessonId: string) {
    const found = findLesson(lessonId);
    setSelectedLessonId(lessonId);
    setSelectedLevel(found.level.id);
    localStorage.setItem(LAST_LESSON_KEY, lessonId);
    document.getElementById("lesson-area")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectLevel(levelId: LevelId) {
    const level = LEARNING_LEVELS.find((item) => item.id === levelId) ?? LEARNING_LEVELS[0];
    setSelectedLevel(levelId);
    const nextLesson = level.lessons.find((lesson) => !completed.has(lesson.id)) ?? level.lessons[0];
    selectLesson(nextLesson.id);
  }

  function toggleComplete(lessonId: string) {
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(lessonId)) next.delete(lessonId); else next.add(lessonId);
      localStorage.setItem(PROGRESS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function resetProgress() {
    setCompleted(new Set());
    localStorage.removeItem(PROGRESS_KEY);
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/8 bg-[#0d1210] px-5 py-7 sm:px-8 sm:py-9">
        <div className="absolute -right-24 -top-32 h-80 w-80 rounded-full bg-emerald-400/8 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-32 w-80 bg-sky-400/4 blur-3xl" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300"><GraduationCap className="h-3.5 w-3.5" />TradingOS Academy · {ALL_LESSONS.length} materi · {PROJECT_COUNT} proyek</div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-5xl">Belajar trading dengan melihat, mencoba, lalu mengulang.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">Mulai dari mekanisme harga dan keamanan akun sampai riset edge, portfolio risk, dan operasi sistem produksi. Setiap materi memakai bahasa sederhana, contoh visual, tugas praktik, dan evaluasi; setiap level ditutup proyek yang menghasilkan bukti kemampuan.</p>
            <div className="mt-6 flex flex-wrap gap-3"><button onClick={() => { setSection("kurikulum"); selectLesson(ALL_LESSONS.find((item) => !completed.has(item.lesson.id))?.lesson.id ?? ALL_LESSONS[0].lesson.id); }} className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-bold text-emerald-950 transition hover:bg-emerald-300"><Play className="h-3.5 w-3.5" />{completedCount ? "Lanjut belajar" : "Mulai dari dasar"}</button><Link href="/belajar/replay" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-4 py-2.5 text-xs font-semibold text-white/65 transition hover:bg-white/7 hover:text-white"><FlaskConical className="h-3.5 w-3.5" />Buka simulator chart</Link></div>
          </div>
          <div className="flex items-center gap-5 rounded-2xl border border-white/8 bg-black/15 p-4 sm:p-5"><ProgressRing completed={completedCount} total={ALL_LESSONS.length} /><div><p className="text-2xl font-bold text-white">{completedCount}<span className="text-white/25">/{ALL_LESSONS.length}</span></p><p className="mt-1 text-xs text-white/45">pelajaran selesai</p>{completedCount > 0 && <button onClick={resetProgress} className="mt-3 inline-flex items-center gap-1 text-[10px] text-white/30 transition hover:text-white/60"><RotateCcw className="h-3 w-3" />Reset progres</button>}</div></div>
        </div>
      </section>

      <div className="flex gap-2 border-b border-white/8 pb-3">
        <button onClick={() => setSection("kurikulum")} className={cn("inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition", section === "kurikulum" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-white/8 text-white/40 hover:text-white/70")}><BookOpen className="h-3.5 w-3.5" />Kurikulum</button>
        <button onClick={() => setSection("lab")} className={cn("inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition", section === "lab" ? "border-rose-400/25 bg-rose-400/10 text-rose-300" : "border-white/8 text-white/40 hover:text-white/70")}><FlaskConical className="h-3.5 w-3.5" />Lab Sistem<span className="rounded bg-white/6 px-1.5 py-0.5 font-mono text-[8px] text-white/35">EXPERT</span></button>
      </div>

      {section === "kurikulum" ? (
        <>
          <LevelStrip selectedLevel={selectedLevel} completed={completed} onSelect={selectLevel} />
          <div id="lesson-area" className="scroll-mt-20 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <LessonList levelId={activeLevel.id} selectedLessonId={selectedLessonId} completed={completed} onSelect={selectLesson} />
            <LessonArticle key={selectedLessonId} lessonId={selectedLessonId} completed={completed} onComplete={toggleComplete} onNavigate={selectLesson} />
          </div>
        </>
      ) : (
        <section className="rounded-2xl border border-rose-400/15 bg-[#0d1210] p-4 sm:p-6">
          <div className="mb-6 max-w-3xl"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-rose-300">LEVEL 05 · LAB SISTEM</p><h2 className="mt-2 text-2xl font-bold text-white">Uji teori dengan angka sistem yang nyata</h2><p className="mt-2 text-sm leading-6 text-white/50">Bagian ini sengaja lebih teknis. Buka setelah memahami expectancy, ukuran sampel, dan kalibrasi. Angka di bawah berasal dari hasil backtest sistem, bukan contoh buatan.</p></div>
          <SystemLab />
        </section>
      )}
    </div>
  );
}
