import { ReactNode, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, CalendarDays, Check, Clock, Crosshair, FileText, Loader2, Phone, Trophy, Users, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TVMsg, type Metric } from "@/components/public/TVTeamShared";
import type { TVSdrRankingRow } from "@/components/public/TVSdrRankingBlock";
import type { TVCloserRankingRow } from "@/components/public/TVCloserRankingBlock";
import type { TVLigacaoRankingRow } from "@/components/public/TVLigacaoRankingBlock";

const TOKEN = "e03633d2-f881-4b6d-a5dd-a928e6b7da0c";

const ACCENT = "#c6ff00";
const CARD_BG = "rgba(255,255,255,0.03)";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const TRILHO = "rgba(255,255,255,0.08)";
const VERDE = "#22c55e";
const VERMELHO = "#ef4444";
const MEDALS = ["#ffd24a", "#cbd5e1", "#e08d4a"];

interface SegBlock {
  agendamento: Metric;
  r1_realizada: Metric;
  no_show: Metric;
  contrato_pago: Metric;
}
interface Block extends SegBlock {
  a?: SegBlock;
  b?: SegBlock;
}
interface ReguaSemana {
  numero: number;
  inicio: string;
  fim: string;
  status: "passada" | "atual" | "futura";
  dias_uteis: number;
  meta_base: number;
  ajuste?: number | null;
  meta: number;
  realizadas: number | null;
  saldo: number | null;
  faltam: number | null;
}
interface ReguaR1 {
  meta_mes: number;
  realizadas_mes: number;
  pct_mes: number;
  faltam_mes?: number;
  dias_uteis_mes: number;
  dias_uteis_restantes: number;
  necessario_por_dia_util: number | null;
  ritmo_mes_anterior: number | null;
  saldo_antes_semana_atual?: number | null;
  semanas_restantes?: number;
  semana_atual: ReguaSemana | null;
  semanas: ReguaSemana[];
}
type ComAvatar<T> = T & { avatar_url?: string | null };
interface Payload {
  today: string;
  updated_at: string;
  snapshot_atrasado?: boolean;
  snapshot_em?: string;
  dia: Block;
  mes: Block;
  leads_novos?: { dia: Metric; mes: Metric } | null;
  sdr_ranking?: ComAvatar<TVSdrRankingRow>[];
  closer_ranking?: ComAvatar<TVCloserRankingRow>[];
  ligacao_ranking?: ComAvatar<TVLigacaoRankingRow>[];
  regua_r1?: ReguaR1 | null;
  error?: string;
}

const fmt = (v: number | null | undefined) => Number(v ?? 0).toLocaleString("pt-BR");
const ddmm = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };
const dd = (iso: string) => iso.split("-")[2];

function cap(s: string) {
  return s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1).toLocaleLowerCase("pt-BR");
}
function nomeCurto(nome: string) {
  const p = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "";
  if (p.length === 1) return cap(p[0]);
  return `${cap(p[0])} ${cap(p[p.length - 1])}`;
}
function iniciais(nome: string) {
  const p = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}
function horaSP(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}
function dataExtenso(iso?: string) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12);
  const sem = dt.toLocaleDateString("pt-BR", { weekday: "long" });
  const mes = dt.toLocaleDateString("pt-BR", { month: "long" });
  return `${cap(sem)}, ${d} de ${cap(mes)} de ${y}`;
}

function Selo({ idx, size = "2.4rem" }: { idx: number; size?: string }) {
  const bg = MEDALS[idx] ?? "rgba(255,255,255,0.25)";
  return (
    <div className="rounded-full flex items-center justify-center font-black shrink-0"
      style={{ width: size, height: size, backgroundColor: bg, color: "#050505", fontSize: `calc(${size} * 0.4)` }}>
      {idx + 1}º
    </div>
  );
}

function Avatar({ nome, url, size }: { nome: string; url?: string | null; size: string }) {
  if (url) return <img src={url} alt={nome} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  return (
    <div className="rounded-full flex items-center justify-center font-black text-white/80 shrink-0"
      style={{ width: size, height: size, backgroundColor: TRILHO, fontSize: `calc(${size} * 0.36)` }}>
      {iniciais(nome)}
    </div>
  );
}

function Card({ icon, titulo, sub, extra, children, style, className = "" }: {
  icon: ReactNode; titulo: string; sub?: ReactNode; extra?: ReactNode; children: ReactNode; style?: React.CSSProperties; className?: string;
}) {
  return (
    <div className={`rounded-2xl border p-[1.4rem] flex flex-col min-h-0 min-w-0 overflow-hidden ${className}`}
      style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER, ...style }}>
      <div className="flex items-center gap-[0.8rem]">
        <span style={{ color: ACCENT }}>{icon}</span>
        <span className="uppercase tracking-[0.18em] font-black text-white text-[1.3rem]">{titulo}</span>
        {extra}
      </div>
      {sub ? <div className="text-white/45 text-[1.05rem] font-semibold mt-[0.2rem]">{sub}</div> : null}
      <div className="flex-1 min-h-0 mt-[0.9rem]">{children}</div>
    </div>
  );
}

function Barra({ pct, cor = ACCENT, h = "0.45rem" }: { pct: number; cor?: string; h?: string }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: h, backgroundColor: TRILHO }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(pct, 100))}%`, backgroundColor: cor }} />
    </div>
  );
}

function KpiCard({ icon, titulo, dia, mes, diaB, mesB }: {
  icon: ReactNode; titulo: string; dia?: Metric; mes?: Metric; diaB?: Metric; mesB?: Metric;
}) {
  const col = (label: string, m: Metric | undefined, b: Metric | undefined, cor: string) => {
    const atual = Number(m?.atual ?? 0);
    const meta = Number(m?.meta ?? 0);
    return (
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="uppercase tracking-[0.18em] text-white/45 font-black text-[0.95rem]">{label}</div>
        <div className="flex items-baseline gap-[0.4rem]">
          <span className="font-black tabular-nums leading-none text-[4.4rem]" style={{ color: cor }}>{fmt(atual)}</span>
          {meta > 0 ? <span className="text-white/40 font-bold text-[1.6rem] tabular-nums">/ {fmt(meta)}</span> : null}
        </div>
        {meta > 0 ? <div className="mt-[0.4rem]"><Barra pct={(atual / meta) * 100} /></div> : null}
        {b ? <div className="text-white/45 font-semibold text-[1.05rem] mt-[0.3rem] tabular-nums">Lead B {fmt(b.atual)}</div> : null}
      </div>
    );
  };
  return (
    <div className="rounded-2xl border p-[1.3rem] flex items-center gap-[1.3rem] min-h-0 overflow-hidden"
      style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}>
      <div className="flex-1 min-w-0 flex flex-col h-full">
        <div className="flex items-center gap-[0.8rem]">
          <div className="rounded-xl flex items-center justify-center shrink-0"
            style={{ width: "3.6rem", height: "3.6rem", backgroundColor: "rgba(198,255,0,0.10)", color: ACCENT }}>{icon}</div>
          <div className="uppercase tracking-[0.18em] font-black text-white text-[1.25rem]">{titulo}</div>
        </div>
        <div className="flex-1 flex items-stretch gap-[1.2rem] mt-[0.4rem]">
          {col("Hoje", dia, diaB, ACCENT)}
          <div className="w-px" style={{ backgroundColor: CARD_BORDER }} />
          {col("Mês", mes, mesB, "#ffffff")}
        </div>
      </div>
    </div>
  );
}

function SdrChart({ rows }: { rows: ComAvatar<TVSdrRankingRow>[] }) {
  if (rows.length === 0) return <div className="text-white/40 italic text-[1.2rem]">sem dados no mês</div>;
  const max = Math.max(1, ...rows.map((r) => Number(r.mes ?? 0)));
  const n = rows.length;
  const rebaix = n >= 4;
  const isRebaix = (i: number) => rebaix && i >= n - 2;
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 grid gap-[0.8rem] relative" style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}>
        {rebaix ? (
          <div className="absolute top-0 flex flex-col items-center" style={{ left: `${((n - 2) / n) * 100}%`, right: 0 }}>
            <div className="text-[0.85rem] font-black tracking-[0.15em] uppercase" style={{ color: VERMELHO }}>Zona de rebaixamento</div>
            <div className="w-full h-px mt-[0.2rem]" style={{ backgroundColor: VERMELHO }} />
          </div>
        ) : null}
        {rows.map((r, i) => {
          const v = Number(r.mes ?? 0);
          const pct = (v / max) * 100;
          const red = isRebaix(i);
          const top = i < 3 && !red;
          const bg = red ? "rgba(239,68,68,0.45)" : top ? `linear-gradient(to bottom, #e6ff80, ${ACCENT} 45%, #7a9e00)` : "linear-gradient(to bottom, rgba(255,255,255,0.10), rgba(255,255,255,0.05))";
          const cor = red ? VERMELHO : top ? ACCENT : "#ffffff";
          return (
            <div key={r.sdr_name + i} className="flex flex-col justify-end items-center min-w-0 pt-[2rem]">
              <div className="flex items-baseline gap-[0.3rem] whitespace-nowrap">
                <span className="font-black tabular-nums text-[1.9rem] leading-none" style={{ color: cor }}>{fmt(v)}</span>
              </div>
              <div className="text-white/45 text-[0.9rem] font-semibold tabular-nums mb-[0.3rem]">hoje {fmt(r.dia)}</div>
              <div className="w-[70%] rounded-t-lg transition-all duration-700" style={{ height: `calc(${pct}% - 3.6rem)`, minHeight: "0.3rem", background: bg }} />
            </div>
          );
        })}
      </div>
      <div className="h-px w-full" style={{ backgroundColor: "rgba(255,255,255,0.18)" }} />
      <div className="grid gap-[0.8rem]" style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}>
        {rows.map((r, i) => (
          <div key={r.sdr_name + i} className="flex flex-col items-center min-w-0 -mt-[1rem] relative z-10">
            <Selo idx={i} size="2rem" />
            <div className="mt-[0.4rem]"><Avatar nome={r.sdr_name} url={r.avatar_url} size="3.4rem" /></div>
            <div className="mt-[0.3rem] text-white font-bold text-[1rem] leading-tight text-center line-clamp-2">{nomeCurto(r.sdr_name)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CloserList({ rows }: { rows: ComAvatar<TVCloserRankingRow>[] }) {
  const list = rows.slice(0, 5);
  if (list.length === 0) return <div className="text-white/40 italic text-[1.2rem]">sem dados no mês</div>;
  const max = Math.max(1, Number(list[0]?.mes ?? 0));
  const rebaix = list.length >= 4;
  return (
    <div className="h-full flex flex-col gap-[0.6rem]">
      {list.map((r, i) => {
        const red = rebaix && i >= list.length - 2;
        return (
          <div key={r.name + i} className="contents">
            {rebaix && i === list.length - 2 ? (
              <div className="flex items-center gap-[0.6rem]">
                <div className="flex-1 h-px" style={{ backgroundColor: VERMELHO }} />
                <span className="text-[0.85rem] font-black tracking-[0.15em] uppercase" style={{ color: VERMELHO }}>Zona de rebaixamento</span>
                <div className="flex-1 h-px" style={{ backgroundColor: VERMELHO }} />
              </div>
            ) : null}
            <div className="flex-1 min-h-0 rounded-xl border flex items-center gap-[0.9rem] px-[0.9rem]"
              style={{ backgroundColor: red ? "rgba(239,68,68,0.10)" : CARD_BG, borderColor: red ? "rgba(239,68,68,0.5)" : "transparent" }}>
              <Selo idx={i} size="2.2rem" />
              <Avatar nome={r.name} url={r.avatar_url} size="4rem" />
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-[1.25rem] truncate">{(r.name ?? "").trim()}</div>
                <div className="mt-[0.4rem]"><Barra pct={(Number(r.mes ?? 0) / max) * 100} cor={red ? VERMELHO : ACCENT} /></div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-black tabular-nums text-[2.4rem] leading-none" style={{ color: red ? VERMELHO : ACCENT }}>{fmt(r.mes)}</div>
                <div className="text-white/45 text-[0.95rem] font-semibold tabular-nums">hoje {fmt(r.dia)}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LigacaoList({ rows }: { rows: ComAvatar<TVLigacaoRankingRow>[] }) {
  const list = rows.slice(0, 7);
  if (list.length === 0) return <div className="text-white/40 italic text-[1.2rem]">sem dados no mês</div>;
  const max = Math.max(1, Number(list[0]?.mes?.total ?? 0));
  return (
    <div className="h-full flex flex-col justify-between gap-[0.4rem]">
      {list.map((r, i) => (
        <div key={r.sdr_name + i} className="flex items-center gap-[0.7rem] min-h-0">
          <Selo idx={i} size="1.7rem" />
          <Avatar nome={r.sdr_name} url={r.avatar_url} size="2.4rem" />
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-[1.05rem] truncate">{nomeCurto(r.sdr_name)}</div>
            <div className="mt-[0.2rem]"><Barra pct={(Number(r.mes?.total ?? 0) / max) * 100} h="0.35rem" /></div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-black tabular-nums text-[1.5rem] leading-none" style={{ color: ACCENT }}>{fmt(r.mes?.total)}</div>
            <div className="text-white/45 text-[0.85rem] font-semibold tabular-nums">hoje {fmt(r.dia?.total)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Regua({ r }: { r: ReguaR1 }) {
  const semanas = r.semanas ?? [];
  return (
    <div className="h-full flex flex-col gap-[0.9rem]">
      <div className="flex-1 min-h-0 flex items-stretch">
        {semanas.map((s, i) => {
          const passada = s.status === "passada";
          const atual = s.status === "atual";
          const futura = s.status === "futura";
          const bateu = passada && Number(s.saldo ?? 0) >= 0;
          const falhou = passada && !bateu;
          const iconCor = bateu ? VERDE : falhou ? VERMELHO : atual ? ACCENT : "rgba(255,255,255,0.45)";
          return (
            <div key={s.numero} className="flex items-center flex-1 min-w-0">
              {i > 0 ? <div className="w-[1.2rem] h-[2px] shrink-0" style={{ backgroundColor: ACCENT }} /> : null}
              <div className="flex-1 min-w-0 h-full rounded-xl p-[0.9rem] flex flex-col justify-between"
                style={{
                  backgroundColor: CARD_BG,
                  border: atual ? `2px solid ${ACCENT}` : `1px solid ${CARD_BORDER}`,
                  boxShadow: atual ? "0 0 1.4rem rgba(198,255,0,0.25)" : undefined,
                }}>
                <div className="flex items-center gap-[0.5rem]">
                  <div className="rounded-full flex items-center justify-center shrink-0"
                    style={{ width: "1.9rem", height: "1.9rem", border: `2px solid ${iconCor}`, color: iconCor }}>
                    {bateu ? <Check size="1.1rem" strokeWidth={3} /> : falhou ? <X size="1.1rem" strokeWidth={3} /> : atual ? <Loader2 size="1.1rem" className="animate-spin" /> : <Clock size="1.1rem" />}
                  </div>
                  <span className="text-white/60 font-bold text-[0.95rem] whitespace-nowrap">S{s.numero} · {dd(s.inicio)}-{dd(s.fim)}</span>
                </div>
                <div className="flex items-baseline gap-[0.3rem]">
                  <span className="font-black tabular-nums text-[3rem] leading-none" style={{ color: falhou ? VERMELHO : "#ffffff" }}>
                    {futura ? "—" : fmt(s.realizadas)}
                  </span>
                  <span className="text-white/40 font-bold text-[1.3rem] tabular-nums">/ {fmt(s.meta)}</span>
                </div>
                <div className="font-bold text-[0.95rem]" style={{ color: bateu ? VERDE : falhou ? VERMELHO : atual ? ACCENT : "rgba(255,255,255,0.45)" }}>
                  {bateu ? `Bateu +${fmt(s.saldo)}` : falhou ? `−${fmt(Math.abs(Number(s.saldo ?? 0)))} faltaram` : atual ? `Em andamento · faltam ${fmt(s.faltam)}` : `${s.dias_uteis} dias úteis`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="rounded-xl border px-[1.1rem] py-[0.8rem] flex items-center gap-[1.2rem]" style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}>
        <BarChart3 size="1.6rem" style={{ color: ACCENT }} />
        <span className="uppercase tracking-[0.18em] font-black text-white/70 text-[0.95rem] whitespace-nowrap">Total do mês</span>
        <div className="flex items-baseline gap-[0.3rem] whitespace-nowrap">
          <span className="font-black tabular-nums text-[2.4rem] leading-none" style={{ color: ACCENT }}>{fmt(r.realizadas_mes)}</span>
          <span className="text-white/40 font-bold text-[1.2rem] tabular-nums">/ {fmt(r.meta_mes)}</span>
        </div>
        <div className="flex-1 min-w-[6rem]"><Barra pct={Number(r.pct_mes ?? 0)} h="0.55rem" /></div>
        <div className="w-px self-stretch" style={{ backgroundColor: CARD_BORDER }} />
        <div className="text-white/55 font-semibold text-[1rem] whitespace-nowrap">
          {Number(r.pct_mes ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% concluído
          {r.necessario_por_dia_util != null ? <> · precisa de <b className="text-white">~{fmt(r.necessario_por_dia_util)} por dia útil</b></> : null}
        </div>
      </div>
    </div>
  );
}

export default function TVIncorporadorEquipe() {
  useEffect(() => {
    const el = document.documentElement;
    const anterior = el.style.fontSize;
    el.style.fontSize = "calc(100vh / 104)";
    return () => { el.style.fontSize = anterior; };
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["tv-incorporador-equipe", TOKEN],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_tv_incorporador_public" as any, { _token: TOKEN });
      if (error) throw error;
      return data as unknown as Payload;
    },
    refetchInterval: 45000,
  });

  if (isLoading) return <TVMsg title="Carregando…" msg="Buscando dados ao vivo" accent={ACCENT} />;
  if (error || !data || (data as any).error)
    return <TVMsg title="Acesso negado" msg="Chave inválida ou desativada." accent={ACCENT} />;

  const regua = data.regua_r1;
  const sa = regua?.semana_atual;
  const iconSz = "2.4rem";

  return (
    <div className="fixed inset-0 overflow-hidden text-white"
      style={{
        backgroundColor: "#050505",
        backgroundImage: "radial-gradient(circle at 0% 0%, rgba(198,255,0,0.06), transparent 35%), radial-gradient(circle at 100% 100%, rgba(198,255,0,0.05), transparent 35%)",
      }}>
      <div className="h-full w-full p-[1.8rem] grid gap-[1.2rem]" style={{ gridTemplateRows: "auto 0.55fr 1.15fr 1fr" }}>
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-[2rem]">
          <div>
            <div className="flex items-center gap-[0.9rem]">
              <span className="relative flex" style={{ width: "1rem", height: "1rem" }}>
                <span className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: VERDE, opacity: 0.6 }} />
                <span className="relative rounded-full w-full h-full" style={{ backgroundColor: VERDE }} />
              </span>
              <span className="font-black text-[2.6rem] leading-none">MCF · Painel de Equipe</span>
              <span className="rounded-full border px-[0.8rem] py-[0.15rem] uppercase tracking-[0.18em] font-black text-[0.85rem]"
                style={{ borderColor: ACCENT, color: ACCENT }}>Ao vivo</span>
            </div>
            <div className="font-bold text-[1.4rem] mt-[0.3rem]" style={{ color: ACCENT }}>BU - Incorporador MCF</div>
          </div>
          {data.snapshot_atrasado ? (
            <div className="rounded-full border px-[1.2rem] py-[0.4rem] font-bold text-[1.1rem]"
              style={{ borderColor: "#f59e0b", color: "#f59e0b", backgroundColor: "rgba(245,158,11,0.10)" }}>
              Dados podem estar atrasados — última atualização às {horaSP(data.snapshot_em ?? data.updated_at)}
            </div>
          ) : null}
          <div className="text-right">
            <div className="font-bold text-[1.5rem]">{dataExtenso(data.today)}</div>
            <div className="flex items-center justify-end gap-[0.4rem] text-white/50 font-semibold text-[1.1rem] mt-[0.2rem]">
              <Clock size="1.1rem" /> Atualizado {horaSP(data.updated_at)}
            </div>
          </div>
        </div>

        {/* Linha 1 */}
        <div className="grid grid-cols-3 gap-[1.2rem] min-h-0">
          <KpiCard icon={<Users size={iconSz} />} titulo="Leads novos" dia={data.leads_novos?.dia} mes={data.leads_novos?.mes} />
          <KpiCard icon={<CalendarDays size={iconSz} />} titulo="Agendamentos"
            dia={data.dia.a?.agendamento} mes={data.mes.a?.agendamento} diaB={data.dia.b?.agendamento} mesB={data.mes.b?.agendamento} />
          <KpiCard icon={<FileText size={iconSz} />} titulo="Contratos pagos"
            dia={data.dia.a?.contrato_pago} mes={data.mes.a?.contrato_pago} diaB={data.dia.b?.contrato_pago} mesB={data.mes.b?.contrato_pago} />
        </div>

        {/* Linha 2 */}
        <div className="grid gap-[1.2rem] min-h-0" style={{ gridTemplateColumns: "2fr 1fr" }}>
          <Card icon={<BarChart3 size="1.7rem" />} titulo="Desempenho SDR" sub="Agendamentos Lead A · mês e hoje">
            <SdrChart rows={data.sdr_ranking ?? []} />
          </Card>
          <Card icon={<Trophy size="1.7rem" />} titulo="Ranking Closer" sub="Contratos pagos">
            <CloserList rows={data.closer_ranking ?? []} />
          </Card>
        </div>

        {/* Linha 3 */}
        <div className="grid gap-[1.2rem] min-h-0" style={{ gridTemplateColumns: regua ? "2fr 1fr" : "1fr" }}>
          {regua ? (
            <Card icon={<Crosshair size="1.7rem" />} titulo="Régua do mês"
              extra={<span className="text-white/45 font-semibold text-[1rem]">R1 realizada</span>}
              sub={sa ? `Semana ${sa.numero} · ${ddmm(sa.inicio)} a ${ddmm(sa.fim)}` : undefined}>
              <Regua r={regua} />
            </Card>
          ) : null}
          <Card icon={<Phone size="1.7rem" />} titulo="Ranking Ligações"
            style={{ borderColor: "rgba(198,255,0,0.6)", boxShadow: "0 0 1.6rem rgba(198,255,0,0.15)" }}>
            <LigacaoList rows={data.ligacao_ranking ?? []} />
          </Card>
        </div>
      </div>
    </div>
  );
}
