import { ReactNode, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, BarChart3, CalendarCheck, CalendarDays, Coins, FileCheck, Trophy, Users, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TVMsg } from "@/components/public/TVTeamShared";

const TOKEN = "24151d71-1f8e-44b9-9761-b01f1fca7bec";

const ACCENT = "#c6ff00";
const ACCENT_SDR = "#ff7a00";
const CARD_BG = "rgba(255,255,255,0.03)";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const TRILHO = "rgba(255,255,255,0.08)";

interface ContratosBloco { cotas: number; clientes: number; credito: number; ticket: number; por_closer?: unknown[] }
interface AgendaBloco { agendadas: number; agendamentos: number; realizadas: number; no_show: number; por_sdr?: unknown[] }
interface RankingCloser { nome: string; cotas: number; clientes: number; credito: number; avatar_url?: string | null }
interface RankingSdr { nome: string; agendadas: number; agendamentos: number; realizadas: number; avatar_url?: string | null }

interface SemanaItem {
  indice: number;
  inicio: string;
  fim: string;
  atual: boolean;
  futura: boolean;
  credito: number;
  cotas: number;
  meta?: number | null;
  dias_uteis?: number | null;
}

interface Payload {
  today: string;
  updated_at: string;
  snapshot_em?: string;
  snapshot_atrasado?: boolean;
  meta_credito_mes?: number | null;
  meta_agendamento?: { dia: number | null; mes: number | null; dias_uteis: number } | null;
  contratos?: { dia?: ContratosBloco; mes?: ContratosBloco };
  agenda?: { dia?: AgendaBloco; mes?: AgendaBloco };
  ranking_closer?: RankingCloser[];
  ranking_sdr?: RankingSdr[];
  ranking_sdr_dia?: RankingSdr[];
  producao?: {
    dia: { cotas: number; clientes: number; credito: number };
    mes: { cotas: number; clientes: number; credito: number };
  } | null;
  semanas?: SemanaItem[] | null;
  semanas_producao?: SemanaItem[] | null;
  error?: string;
}

/* ---------- formatação ---------- */

function partesBRL(v: number): { num: string; sufixo: string } {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1_000_000)
    return { num: (n / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }), sufixo: "mi" };
  if (Math.abs(n) >= 1_000)
    return { num: Math.round(n / 1_000).toLocaleString("pt-BR"), sufixo: "mil" };
  return { num: "0", sufixo: "" };
}
function abreviarBRL(v: number) {
  const p = partesBRL(v);
  return p.sufixo ? `R$ ${p.num} ${p.sufixo}` : "R$ 0";
}
const num = (v: number) => Number(v || 0).toLocaleString("pt-BR");
function pct(parte: number, total: number) {
  if (!total) return 0;
  return (parte / total) * 100;
}
const pctTxt = (p: number) => `${p.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
function dd(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? m[3] : "—";
}
function hhmm(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}
function dataExtenso(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  const txt = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return txt
    .split(" ")
    .map((w) => (w === "de" ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}
function nomeCurto(nome: string) {
  const p = String(nome || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (p.length === 0) return "";
  if (p.length === 1) return cap(p[0]);
  return `${cap(p[0])} ${cap(p[p.length - 1])}`;
}
function iniciais(nome: string) {
  const p = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  return ((p[0][0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

/* ---------- curva monotônica (Fritsch–Carlson) ---------- */

function caminhoMonotonico(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    m.push((pts[i + 1].y - pts[i].y) / dx[i]);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i].x + h},${pts[i].y + t[i] * h} ${pts[i + 1].x - h},${pts[i + 1].y - t[i + 1] * h} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

/* ---------- peças ---------- */

function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-2xl border p-[1.6rem] flex flex-col min-h-0 min-w-0 overflow-hidden ${className}`}
      style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER, ...style }}
    >
      {children}
    </div>
  );
}

function Titulo({ icon, texto, extra, cor = ACCENT, corTexto = "rgba(255,255,255,0.7)" }: {
  icon: ReactNode; texto: string; extra?: string; cor?: string; corTexto?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-[1rem] shrink-0">
      <div className="flex items-center gap-[0.8rem]">
        <span style={{ color: cor }} className="[&>svg]:h-[1.9rem] [&>svg]:w-[1.9rem]">{icon}</span>
        <span className="uppercase tracking-[0.18em] font-bold text-[1.45rem]" style={{ color: corTexto }}>{texto}</span>
      </div>
      {extra ? <span className="uppercase tracking-[0.18em] font-bold text-[1.1rem] text-white/40">{extra}</span> : null}
    </div>
  );
}

function GraficoProducao({ semanas }: { semanas: SemanaItem[] }) {
  const n = semanas.length;
  const W = 1000, H = 300, TOPO = 40;
  const xPct = (i: number) => ((i + 0.5) / n) * 100;
  const comDado = semanas.map((s, i) => ({ s, i })).filter(({ s }) => !s.futura);
  const max = Math.max(1, ...comDado.map(({ s }) => Number(s.credito || 0)));
  const pts = comDado.map(({ s, i }) => ({
    x: (xPct(i) / 100) * W,
    y: H - (Number(s.credito || 0) / max) * (H - TOPO),
    i, s,
  }));
  const linha = caminhoMonotonico(pts);
  const area = pts.length > 1 ? `${linha} L${pts[pts.length - 1].x},${H} L${pts[0].x},${H} Z` : "";
  const maiorIdx = pts.length ? pts.reduce((a, b) => (Number(b.s.credito) > Number(a.s.credito) ? b : a)).i : -1;
  const maior = pts.find((p) => p.i === maiorIdx);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative flex-1 min-h-0 mt-[2.6rem]">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
          <defs>
            <linearGradient id="tvc-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.45} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>
          {pts.map((p) => (
            <line key={p.i} x1={p.x} x2={p.x} y1={p.y} y2={H} stroke="rgba(255,255,255,0.18)"
              strokeWidth={1} strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
          ))}
          {area ? <path d={area} fill="url(#tvc-area)" className="transition-all duration-700" /> : null}
          {pts.length > 1 ? (
            <path d={linha} fill="none" stroke={ACCENT} strokeWidth={3} vectorEffect="non-scaling-stroke"
              strokeLinecap="round" className="transition-all duration-700" />
          ) : null}
        </svg>
        {pts.map((p) => {
          const grande = p.s.atual;
          const tam = grande ? "1.5rem" : "0.95rem";
          return (
            <span key={p.i} className="absolute rounded-full transition-all duration-700"
              style={{
                left: `${xPct(p.i)}%`, top: `${(p.y / H) * 100}%`, width: tam, height: tam,
                transform: "translate(-50%,-50%)", backgroundColor: ACCENT,
                boxShadow: grande ? `0 0 1.4rem ${ACCENT}, 0 0 0 0.35rem rgba(198,255,0,0.2)` : undefined,
              }} />
          );
        })}
        {maior ? (
          <span className="absolute text-white font-bold text-[1.35rem] whitespace-nowrap tabular-nums"
            style={{ left: `${xPct(maior.i)}%`, top: `${(maior.y / H) * 100}%`, transform: "translate(-50%, -170%)" }}>
            {abreviarBRL(Number(maior.s.credito || 0))}
          </span>
        ) : null}
      </div>
      <div className="grid shrink-0 mt-[1rem]" style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}>
        {semanas.map((s) => {
          const cor = s.atual ? ACCENT : undefined;
          return (
            <div key={s.indice} className="flex flex-col items-center leading-tight tabular-nums">
              <span className="font-bold text-[1.2rem]" style={{ color: cor ?? "rgba(255,255,255,0.7)" }}>S{s.indice}</span>
              <span className="text-[1.05rem]" style={{ color: cor ?? "rgba(255,255,255,0.45)" }}>{dd(s.inicio)}–{dd(s.fim)}</span>
              <span className="font-bold text-[1.3rem]"
                style={{ color: s.futura ? "rgba(255,255,255,0.4)" : cor ?? "#fff" }}>
                {s.futura ? "—" : abreviarBRL(Number(s.credito || 0))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Anel({ valor, meta }: { valor: number; meta: number }) {
  const R = 42, C = 2 * Math.PI * R;
  const frac = meta > 0 ? Math.min(valor / meta, 1) : 0;
  return (
    <div className="relative h-full aspect-square max-h-full">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90"
        style={{ filter: frac > 0 ? "drop-shadow(0 0 0.6rem rgba(198,255,0,0.35))" : undefined }}>
        <circle cx={50} cy={50} r={R} fill="none" stroke={TRILHO} strokeWidth={8} />
        {meta > 0 && frac > 0 ? (
          <circle cx={50} cy={50} r={R} fill="none" stroke={ACCENT} strokeWidth={8} strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - frac)} className="transition-all duration-700" />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center tabular-nums">
        <span className="text-white font-black text-[2.6rem] leading-none whitespace-nowrap">{abreviarBRL(valor)}</span>
        <span className="text-white/45 text-[1.2rem] mt-[0.4rem]">{meta > 0 ? `de ${abreviarBRL(meta)}` : "sem meta"}</span>
      </div>
    </div>
  );
}

function Fracao({ a, b }: { a: number; b: number }) {
  return (
    <span className="inline-flex items-baseline">
      <span style={{ color: "inherit" }}>{num(a)}</span>
      <span className="text-white/45 text-[0.55em]">/{num(b)}</span>
    </span>
  );
}

function DiaMesCard({ icon, titulo, hoje, mes, legHoje, legMes }: {
  icon: ReactNode; titulo: string; hoje: ReactNode; mes: ReactNode; legHoje?: ReactNode; legMes?: ReactNode;
}) {
  return (
    <Card>
      <Titulo icon={icon} texto={titulo} />
      <div className="flex-1 min-h-0 grid grid-cols-2 mt-[0.8rem]">
        {([["Hoje", hoje, legHoje, ACCENT], ["Mês", mes, legMes, "#fff"]] as const).map(([rot, v, leg, cor], i) => (
          <div key={rot} className={`flex flex-col justify-center min-w-0 ${i === 1 ? "pl-[1.6rem] border-l" : ""}`}
            style={i === 1 ? { borderColor: CARD_BORDER } : undefined}>
            <span className="uppercase tracking-[0.18em] font-bold text-[1.1rem] text-white/40">{rot}</span>
            <span className="font-black tabular-nums leading-none text-[4.6rem] mt-[0.4rem] truncate" style={{ color: cor }}>{v}</span>
            <span className="text-[1.1rem] text-white/45 mt-[0.5rem] min-h-[1.3em] truncate">{leg ?? "\u00a0"}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function LinhaRanking({ pos, nome, avatar, sub, valor, frac, cor, zerado }: {
  pos: number; nome: string; avatar?: string | null; sub: string; valor: string; frac: number; cor: string; zerado: boolean;
}) {
  return (
    <div className="flex items-center gap-[1.4rem] h-[5.2rem] shrink-0 border-b last:border-b-0"
      style={{ borderColor: "rgba(255,255,255,0.06)", opacity: zerado ? 0.45 : 1 }}>
      <div className="relative shrink-0 h-[3.2rem] w-[3.2rem]">
        {avatar ? (
          <img src={avatar} alt="" className="h-full w-full rounded-xl object-cover" />
        ) : (
          <div className="h-full w-full rounded-xl flex items-center justify-center font-bold text-[1.2rem] text-white/70"
            style={{ backgroundColor: TRILHO }}>{iniciais(nome)}</div>
        )}
        <span className="absolute -top-[0.5rem] -right-[0.5rem] h-[1.5rem] w-[1.5rem] rounded-full flex items-center justify-center text-[0.85rem] font-black text-black"
          style={{ backgroundColor: cor }}>{pos}</span>
      </div>
      <div className="w-[30%] min-w-0">
        <div className="text-white font-bold text-[1.6rem] leading-tight truncate">{nomeCurto(nome)}</div>
        <div className="text-white/45 text-[1.05rem] truncate tabular-nums">{sub}</div>
      </div>
      <div className="flex-1 h-[0.6rem] rounded-full overflow-hidden" style={{ backgroundColor: TRILHO }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(frac, 1)) * 100}%`, backgroundColor: cor }} />
      </div>
      <div className="font-black tabular-nums text-[2.2rem] text-right whitespace-nowrap min-w-[8rem]" style={{ color: cor }}>{valor}</div>
    </div>
  );
}

function RankingCard({ icon, titulo, extra, cor, vazio, children }: {
  icon: ReactNode; titulo: string; extra: string; cor: string; vazio: boolean; children: ReactNode;
}) {
  return (
    <Card style={{ borderColor: `${cor}59`, backgroundColor: `${cor}0a`, boxShadow: `0 0 2.5rem ${cor}14` }}>
      <Titulo icon={icon} texto={titulo} extra={extra} cor={cor} />
      <div className="flex-1 min-h-0 mt-[0.8rem] flex flex-col justify-start overflow-hidden">
        {vazio ? <div className="text-white/40 italic text-[1.3rem] mt-[0.8rem]">sem dados no mês</div> : children}
      </div>
    </Card>
  );
}

/* ---------- página ---------- */

export default function TVConsorcioEquipe() {
  useEffect(() => {
    const el = document.documentElement;
    const anterior = el.style.fontSize;
    el.style.fontSize = "calc(100vh / 104)";
    return () => { el.style.fontSize = anterior; };
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["tv-consorcio-equipe", TOKEN],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_tv_consorcio_public" as any, { _token: TOKEN });
      if (error) throw error;
      return data as unknown as Payload;
    },
    refetchInterval: 45000,
  });

  if (isLoading) return <TVMsg title="Carregando…" msg="Buscando dados ao vivo" accent={ACCENT} />;
  if (error || !data || data.error)
    return <TVMsg title="Acesso negado" msg="Chave inválida ou desativada." accent={ACCENT} />;

  const cDia = data.contratos?.dia ?? { cotas: 0, clientes: 0, credito: 0, ticket: 0 };
  const cMes = data.contratos?.mes ?? { cotas: 0, clientes: 0, credito: 0, ticket: 0 };
  const aDia = data.agenda?.dia ?? { agendadas: 0, agendamentos: 0, realizadas: 0, no_show: 0 };
  const aMes = data.agenda?.mes ?? { agendadas: 0, agendamentos: 0, realizadas: 0, no_show: 0 };
  const pMes = data.producao?.mes ?? { cotas: 0, clientes: 0, credito: 0 };
  const meta = Number(data.meta_credito_mes ?? 0);
  const metaAgDia = data.meta_agendamento?.dia ?? null;
  const metaAgMes = Number(data.meta_agendamento?.mes ?? 0);
  const semanasProd = data.semanas_producao ?? [];
  const prodPartes = partesBRL(Number(pMes.credito || 0));

  const closers = (data.ranking_closer ?? []).slice(0, 5);
  const sdrs = [...(data.ranking_sdr ?? [])]
    .sort((a, b) => Number(b.agendamentos || 0) - Number(a.agendamentos || 0))
    .slice(0, 5);
  const sdrDia = new Map((data.ranking_sdr_dia ?? []).map((r) => [r.nome, r]));
  const topCloser = Math.max(0, ...closers.map((c) => Number(c.credito || 0)));
  const topSdr = Math.max(0, ...sdrs.map((s) => Number(s.agendamentos || 0)));

  return (
    <div className="fixed inset-0 overflow-hidden text-white" style={{ backgroundColor: "#050505" }}>
      <div className="pointer-events-none absolute inset-0" style={{
        background: "radial-gradient(circle at 0% 0%, rgba(198,255,0,0.06), transparent 45%), radial-gradient(circle at 100% 100%, rgba(198,255,0,0.06), transparent 45%)",
      }} />
      <div className="relative h-full w-full p-[2.4rem] grid gap-[1.6rem]"
        style={{ gridTemplateRows: "auto minmax(0,1.3fr) minmax(0,0.75fr) minmax(0,0.95fr)" }}>
        {/* Cabeçalho */}
        <header className="flex items-center justify-between gap-[2rem]">
          <div>
            <div className="flex items-center gap-[1rem]">
              <h1 className="text-[2.6rem] font-bold text-white leading-none">MCF · Painel de Equipe</h1>
              <span className="relative flex h-[0.9rem] w-[0.9rem]">
                <span className="absolute inline-flex h-full w-full rounded-full animate-ping opacity-60" style={{ backgroundColor: "#22c55e" }} />
                <span className="relative inline-flex h-full w-full rounded-full" style={{ backgroundColor: "#22c55e" }} />
              </span>
              <span className="text-[1.3rem] font-semibold" style={{ color: "#22c55e" }}>ao vivo</span>
            </div>
            <div className="text-[1.5rem] font-semibold mt-[0.4rem]" style={{ color: ACCENT }}>Consórcio · Equipe</div>
          </div>
          {data.snapshot_atrasado ? (
            <div className="rounded-full px-[1.6rem] py-[0.6rem] text-[1.2rem] font-semibold border"
              style={{ color: "#fbbf24", borderColor: "rgba(251,191,36,0.4)", backgroundColor: "rgba(251,191,36,0.1)" }}>
              Dados podem estar atrasados — última atualização às {hhmm(data.snapshot_em)}
            </div>
          ) : null}
          <div className="flex items-center gap-[1rem]">
            <span className="h-[4rem] w-[4rem] rounded-xl flex items-center justify-center border"
              style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER, color: ACCENT }}>
              <CalendarDays className="h-[2rem] w-[2rem]" />
            </span>
            <div>
              <div className="text-[1.5rem] font-semibold text-white">{dataExtenso(data.today)}</div>
              <div className="text-[1.15rem] text-white/45 tabular-nums">Atualizado {hhmm(data.updated_at)}</div>
            </div>
          </div>
        </header>

        {/* Linha 1 */}
        <div className="grid gap-[1.6rem] min-h-0" style={{ gridTemplateColumns: "2fr 1fr" }}>
          <Card>
            <Titulo icon={<AreaChart />} texto="Produção gerada" />
            <div className="flex-1 min-h-0 flex gap-[2rem]">
              <div className="w-[40%] flex flex-col justify-center min-w-0">
                <div className="font-black tabular-nums leading-none text-[7rem] whitespace-nowrap">
                  <span className="text-white">R$ </span>
                  <span style={{ color: ACCENT }}>{prodPartes.num}{prodPartes.sufixo ? ` ${prodPartes.sufixo}` : ""}</span>
                </div>
                <div className="flex items-center gap-[0.6rem] mt-[1.2rem] text-[1.35rem] text-white/80 tabular-nums">
                  <Users className="h-[1.6rem] w-[1.6rem]" style={{ color: ACCENT }} />
                  <span>{num(pMes.cotas)} cotas • {num(pMes.clientes)} clientes</span>
                  {meta > 0 ? <span className="text-white/45">• {pctTxt(pct(Number(pMes.credito || 0), meta))} da meta</span> : null}
                </div>
              </div>
              <div className="w-[60%] min-w-0 min-h-0">
                {semanasProd.length ? <GraficoProducao semanas={semanasProd} /> : null}
              </div>
            </div>
          </Card>

          <Card>
            <Titulo icon={<Coins />} texto="Crédito efetivado" />
            <div className="flex-1 min-h-0 flex items-center gap-[2rem] mt-[1rem]">
              <div className="h-full min-h-0 flex items-center"><Anel valor={Number(cMes.credito || 0)} meta={meta} /></div>
              <div className="flex-1 min-w-0 flex flex-col gap-[1rem] tabular-nums">
                <div>
                  <div className="uppercase tracking-[0.18em] font-bold text-[1.1rem] text-white/40">Hoje</div>
                  <div className="font-black text-[2.8rem] leading-none whitespace-nowrap" style={{ color: ACCENT }}>{abreviarBRL(Number(cDia.credito || 0))}</div>
                </div>
                <div>
                  <div className="uppercase tracking-[0.18em] font-bold text-[1.1rem] text-white/40">Mês</div>
                  <div className="font-black text-[2.8rem] leading-none text-white whitespace-nowrap">{abreviarBRL(Number(cMes.credito || 0))}</div>
                </div>
                <div className="h-px w-full" style={{ backgroundColor: CARD_BORDER }} />
                <div className="text-[1.2rem] text-white/45">
                  {meta > 0 ? `${pctTxt(pct(Number(cMes.credito || 0), meta))} da meta` : "meta não configurada"}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Linha 2 */}
        <div className="grid grid-cols-3 gap-[1.6rem] min-h-0">
          <DiaMesCard icon={<CalendarCheck />} titulo="Agendamentos"
            hoje={num(aDia.agendamentos)} mes={num(aMes.agendamentos)}
            legHoje={metaAgDia ? `meta ${num(metaAgDia)}` : undefined}
            legMes={metaAgMes > 0 ? `${pctTxt(pct(Number(aMes.agendamentos || 0), metaAgMes))} da meta` : "meta não configurada"} />
          <DiaMesCard icon={<FileCheck />} titulo="Reuniões realizadas"
            hoje={<Fracao a={Number(aDia.realizadas || 0)} b={Number(aDia.agendadas || 0)} />}
            mes={<Fracao a={Number(aMes.realizadas || 0)} b={Number(aMes.agendadas || 0)} />}
            legMes={`${pctTxt(pct(Number(aMes.realizadas || 0), Number(aMes.agendadas || 0)))} dos agendados`} />
          <DiaMesCard icon={<BarChart3 />} titulo="Vendas"
            hoje={num(cDia.clientes)} mes={num(cMes.clientes)}
            legHoje={`${num(cDia.cotas)} cotas`}
            legMes={`${num(cMes.cotas)} cotas · Ticket ${abreviarBRL(Number(cMes.ticket || 0))}`} />
        </div>

        {/* Linha 3 */}
        <div className="grid grid-cols-2 gap-[1.6rem] min-h-0">
          <RankingCard icon={<Trophy />} titulo="Top produção do mês" extra="R$ gerado" cor={ACCENT} vazio={closers.length === 0}>
            {closers.map((c, i) => (
              <LinhaRanking key={c.nome + i} pos={i + 1} nome={c.nome} avatar={c.avatar_url}
                sub={`${num(c.clientes)} clientes · ${num(c.cotas)} cotas`}
                valor={abreviarBRL(Number(c.credito || 0))}
                frac={topCloser > 0 ? Number(c.credito || 0) / topCloser : 0}
                cor={ACCENT} zerado={Number(c.credito || 0) === 0} />
            ))}
          </RankingCard>
          <RankingCard icon={<Zap />} titulo="Top agendamentos" extra="Agendamentos" cor={ACCENT_SDR} vazio={sdrs.length === 0}>
            {sdrs.map((s, i) => (
              <LinhaRanking key={s.nome + i} pos={i + 1} nome={s.nome} avatar={s.avatar_url}
                sub={`hoje ${num(sdrDia.get(s.nome)?.agendamentos ?? 0)}`}
                valor={num(s.agendamentos)}
                frac={topSdr > 0 ? Number(s.agendamentos || 0) / topSdr : 0}
                cor={ACCENT_SDR} zerado={Number(s.agendamentos || 0) === 0} />
            ))}
          </RankingCard>
        </div>
      </div>
    </div>
  );
}
