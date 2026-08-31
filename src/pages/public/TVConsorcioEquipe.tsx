import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TVShell, TVMsg } from "@/components/public/TVTeamShared";


const TOKEN = "24151d71-1f8e-44b9-9761-b01f1fca7bec";

const ACCENT = "#bfff00";
const ACCENT_SDR = "#ff7a00";

interface ContratosBloco {
  cotas: number;
  clientes: number;
  credito: number;
  ticket: number;
  por_closer?: unknown[];
}
interface AgendaBloco {
  agendadas: number;
  agendamentos: number;
  realizadas: number;
  no_show: number;
  por_sdr?: unknown[];
}
interface RankingCloser { nome: string; cotas: number; clientes: number; credito: number }
interface RankingSdr { nome: string; agendadas: number; agendamentos: number; realizadas: number }


interface SemanaItem {
  indice: number;      // 1 a 4
  inicio: string;      // ISO date
  fim: string;         // ISO date
  atual: boolean;      // semana que contém hoje
  futura: boolean;     // ainda não começou
  credito: number;
  cotas: number;
  meta: number | null; // meta do mês / 4
}

interface Payload {
  today: string;
  updated_at: string;
  snapshot_em?: string;
  snapshot_atrasado?: boolean;
  meta_credito_mes?: number | null;
  meta_agendamento?: {
    dia: number | null;
    mes: number | null;
    dias_uteis: number;
  } | null;
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
  semanas_producao?: Array<{
    indice: number;
    inicio: string;
    fim: string;
    atual: boolean;
    futura: boolean;
    credito: number;
    cotas: number;
  }> | null;
  error?: string;
}

function abreviarBRL(v: number) {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1_000_000)
    return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}mi`;
  if (Math.abs(n) >= 1_000)
    return `R$ ${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function num(v: number) {
  return Number(v || 0).toLocaleString("pt-BR");
}

function pctTexto(parte: number, total: number) {
  if (!total) return "0%";
  return `${((parte / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
}

/** "2026-08-22" → "22/08". */
function ddmm(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "").trim());
  if (!m) return "—";
  return `${m[3]}/${m[2]}`;
}

/** Primeiro + último nome ("Andre dos Santos Duarte" → "Andre Duarte"). */
function primeiroEUltimoNome(nome: string) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

/** Fração "realizadas/agendadas" — numerador em destaque, resto discreto. */
function Fracao({ numerador, denominador, cor }: { numerador: number; denominador: number; cor: string }) {
  return (
    <span className="inline-flex items-baseline">
      <span style={{ color: cor }}>{num(numerador)}</span>
      {denominador > 0 ? (
        <span className="text-white/45 text-xl xl:text-4xl">/{num(denominador)}</span>
      ) : null}
    </span>
  );
}

/** Extrai apenas o dia de um ISO date ("2026-08-22" → "22"). */
function dd(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "").trim());
  return m ? m[3] : "—";
}

/**
 * Cartão de largura total com quatro colunas semanais e barras horizontais retas.
 * Reutilizado por Crédito efetivado e Produção gerada (mesma anatomia).
 */
function MetaSemanasCard({
  titulo,
  accent,
  corTrilhoSemana,
  creditoMes,
  meta,
  pct,
  semanas,
  rodapeValor,
}: {
  titulo: string;
  accent: string;
  corTrilhoSemana: string;
  creditoMes: number;
  meta: number;
  pct: number;
  semanas: Array<{ indice: number; inicio: string; fim: string; atual: boolean; futura: boolean; credito: number; cotas: number; meta?: number | null }>;
  /** Texto discreto extra ao lado do percentual (ex.: "135 cotas · 48 clientes"). */
  rodapeValor?: ReactNode;
}) {
  const ACCENT = accent;
  return (
    <div
      className="rounded-2xl border p-1.5 xl:p-2 flex flex-col flex-1 min-h-0 overflow-hidden"
      style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.10)" }}
    >
      {/* Cabeçalho — rótulo acima, valor grande + percentual alinhados pela base. */}
      <div className="text-white/60 uppercase tracking-widest text-sm xl:text-xl font-bold">
        {titulo}
      </div>
      <div className="flex items-baseline gap-2 xl:gap-3 mt-0.5">
        <span className="text-5xl xl:text-8xl font-black leading-none" style={{ color: ACCENT }}>
          {abreviarBRL(creditoMes)}
        </span>
        {meta > 0 ? (
          <span className="text-sm xl:text-2xl font-bold text-white/55 leading-none">
            {pct.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% de {abreviarBRL(meta)}
          </span>
        ) : null}
        {rodapeValor ? (
          <span className="text-sm xl:text-2xl font-semibold text-white/40 leading-none">{rodapeValor}</span>
        ) : null}
      </div>


      {/* Barra do mês — largura total, trilho e preenchimento. */}
      <div
        className="w-full rounded-full mt-1 xl:mt-1.5 mb-1 xl:mb-1.5 h-2.5 xl:h-4 overflow-hidden"
        style={{ backgroundColor: "rgba(255,255,255,0.07)" }}
      >
        {pct > 0 ? (
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: ACCENT }}
          />
        ) : null}
      </div>

      {/* Corpo — 4 colunas, uma por semana. */}
      <div className="flex-1 min-h-0 grid grid-cols-4 gap-2 xl:gap-4 mt-1">
        {semanas.map((s) => {
          const semanaMeta = s.meta ?? 0;
          const semanaPct = semanaMeta > 0 ? Math.min((Number(s.credito || 0) / semanaMeta) * 100, 100) : 0;
          const isAtual = s.atual === true;
          const isFutura = s.futura === true;
          const corTexto = isAtual ? ACCENT : "rgba(255,255,255,0.85)";
          const corFill = isAtual ? ACCENT : corTrilhoSemana;


          return (
            <div
              key={s.indice}
              className={`flex flex-col justify-center min-w-0 ${isAtual ? "pl-2 xl:pl-3 border-l" : ""}`}
              style={{
                opacity: isFutura ? 0.4 : 1,
                borderColor: isAtual ? corTrilhoSemana : undefined,
              }}
            >
              {/* 1 — rótulo da semana (discreto). */}
              <span
                className="text-sm xl:text-2xl font-black tracking-widest uppercase truncate"
                style={{ color: isAtual ? ACCENT : "rgba(255,255,255,0.45)" }}
              >
                S{s.indice} · {dd(s.inicio)}–{dd(s.fim)}
              </span>

              {/* 2 — valor em reais, grande e em destaque (número principal do bloco). */}
              <span
                className="block mt-2 xl:mt-3 text-4xl xl:text-7xl font-black leading-none truncate"
                style={{ color: isFutura ? "rgba(255,255,255,0.45)" : corTexto }}
              >
                {isFutura ? "—" : abreviarBRL(Number(s.credito || 0))}
              </span>

              {/* 3 — barra horizontal. */}
              <div
                className="w-full rounded-full mt-1.5 h-2 xl:h-4 overflow-hidden"
                style={{ backgroundColor: "rgba(255,255,255,0.07)" }}
              >
                {!isFutura && semanaPct > 0 ? (
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${semanaPct}%`, backgroundColor: corFill }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Mesmo cartão de largura total, sem arco, quando não há meta configurada. */
function CreditoSemMetaCard({ creditoMes, creditoHoje }: { creditoMes: number; creditoHoje: number }) {
  return (
    <div
      className="rounded-2xl border p-1.5 xl:p-2 flex flex-col flex-1 min-h-0"

      style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.10)" }}
    >
      <div className="text-white/60 uppercase tracking-widest text-[10px] xl:text-sm font-bold">
        Crédito efetivado
      </div>
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1">
        <div className="flex items-baseline gap-3 xl:gap-5">
          <span className="text-[10px] xl:text-sm tracking-widest text-white/40 font-black uppercase">Hoje</span>
          <span className="text-2xl xl:text-4xl font-black" style={{ color: ACCENT }}>
            {abreviarBRL(creditoHoje)}
          </span>
          <span className="text-white/20">·</span>
          <span className="text-[10px] xl:text-sm tracking-widest text-white/40 font-black uppercase">Mês</span>
          <span className="text-2xl xl:text-4xl font-black" style={{ color: ACCENT }}>
            {abreviarBRL(creditoMes)}
          </span>
        </div>
        <div className="text-[11px] xl:text-sm text-white/35 font-semibold italic">meta não configurada</div>
      </div>
    </div>
  );
}

const ACCENT_PROD = "#38bdf8";





/** Cartão com duas colunas internas: HOJE e MÊS, separadas por divisória vertical. */
function DiaMesBlocoCard({
  titulo,
  accent,
  alerta,
  hoje,
  mes,
}: {
  titulo: string;
  accent: string;
  alerta?: boolean;
  hoje: { valor: ReactNode; titleAttr?: string; conteudo?: ReactNode };
  mes: { valor: ReactNode; titleAttr?: string; conteudo?: ReactNode };
}) {
  const cor = alerta ? "#ef4444" : accent;
  return (
    <div
      className="rounded-2xl border p-1.5 xl:p-2 flex flex-col min-h-0"
      style={{
        backgroundColor: alerta ? "rgba(239,68,68,0.10)" : "rgba(255,255,255,0.04)",
        borderColor: alerta ? "rgba(239,68,68,0.55)" : "rgba(255,255,255,0.10)",
      }}
    >
      <div className="text-white/60 uppercase tracking-widest text-xs xl:text-base font-bold">{titulo}</div>
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-2 xl:gap-3 mt-1">
        {([["Hoje", hoje], ["Mês", mes]] as const).map(([label, bloco], i) => (
          <div
            key={label}
            className={`flex flex-col justify-center min-w-0 ${i === 1 ? "pl-2 xl:pl-3 border-l" : ""}`}
            style={i === 1 ? { borderColor: "rgba(255,255,255,0.12)" } : undefined}
          >
            {/* Rótulo, número e legenda agrupados e centrados na coluna. */}
            <div className="text-sm xl:text-lg font-black tracking-widest text-white/40 uppercase">{label}</div>
            {bloco.conteudo ? (
              <div className="mt-2 xl:mt-3">{bloco.conteudo}</div>
            ) : (
              <div
                className="mt-2 xl:mt-3 text-4xl xl:text-7xl font-black leading-none truncate w-full"
                style={{ color: cor }}
                title={bloco.titleAttr}
              >
                {bloco.valor}
              </div>
            )}
          </div>

        ))}

      </div>
    </div>
  );
}


function RankingShell({
  titulo,
  extra,
  accent,
  vazio,
  children,
}: {
  titulo: string;
  extra?: string;
  accent: string;
  vazio: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-3xl border p-2 xl:p-3 flex flex-col min-h-0"
      style={{ borderColor: `${accent}4d`, backgroundColor: `${accent}0a` }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm xl:text-xl font-black tracking-widest uppercase" style={{ color: accent }}>
          {titulo}
        </h2>
        {extra ? (
          <span className="text-[10px] xl:text-xs font-bold tracking-widest text-white/40 uppercase">{extra}</span>
        ) : null}
      </div>
      <div className="flex-1 min-h-0 mt-2 flex flex-col justify-stretch gap-1.5 xl:gap-2 overflow-hidden">
        {vazio ? <div className="text-white/35 font-semibold italic text-sm mt-2">sem dados no mês</div> : children}
      </div>
    </section>
  );
}

function Posicao({ idx, accent }: { idx: number; accent: string }) {
  const primeiro = idx === 0;
  return (
    <span
      className="h-9 w-9 xl:h-14 xl:w-14 shrink-0 rounded-lg flex items-center justify-center text-base xl:text-2xl font-black"
      style={
        primeiro
          ? { color: "#050505", backgroundColor: accent }
          : { color: "rgba(255,255,255,0.7)", backgroundColor: "rgba(255,255,255,0.08)" }
      }
    >
      {idx + 1}
    </span>
  );
}

export default function TVConsorcioEquipe() {
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
  const pDia = data.producao?.dia ?? { cotas: 0, clientes: 0, credito: 0 };
  const pMes = data.producao?.mes ?? { cotas: 0, clientes: 0, credito: 0 };

  const meta = data.meta_credito_mes ?? null;
  const pctMeta = meta && meta > 0 ? Math.min((Number(cMes.credito || 0) / meta) * 100, 100) : 0;
  const pctProducao = meta && meta > 0 ? Math.min((Number(pMes.credito || 0) / meta) * 100, 100) : 0;
  const metaSemanaProducao = meta && meta > 0 ? Number(meta) / 4 : null;
  const semanasProducao = (data.semanas_producao ?? []).map((s) => ({ ...s, meta: metaSemanaProducao }));




  const closers = (data.ranking_closer ?? []).slice(0, 6);
  const sdrs = [...(data.ranking_sdr ?? [])]
    .sort((a, b) => Number(b.agendamentos || 0) - Number(a.agendamentos || 0))
    .slice(0, 6);
  const sdrDiaMap = new Map((data.ranking_sdr_dia ?? []).map((r) => [r.nome, r]));

  const warning = data.snapshot_atrasado ? (
    <>
      Dados podem estar atrasados — última atualização às{" "}
      {data.snapshot_em ? new Date(data.snapshot_em).toLocaleTimeString("pt-BR") : "—"}
    </>
  ) : undefined;

  return (
    <TVShell
      escalaDivisor={104}
      title="MCF · Painel de Equipe"
      subtitle="Consórcio · Equipe"
      accent={ACCENT}
      today={data.today}
      updatedAt={data.updated_at}
      warning={warning}
      mainRowsClassName="grid-rows-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,2fr)]"
    >
      {/* Linha 1 — produção gerada, largura total (mesma meta do crédito). */}
      <div className="min-h-0 flex flex-col">
        <MetaSemanasCard
          titulo="Produção gerada"
          accent={ACCENT_PROD}
          corTrilhoSemana="rgba(56,189,248,0.55)"
          creditoMes={Number(pMes.credito || 0)}
          meta={meta && meta > 0 ? Number(meta) : 0}
          pct={pctProducao}
          semanas={semanasProducao}
          rodapeValor={`· ${num(Number(pMes.cotas || 0))} cotas · ${num(Number(pMes.clientes || 0))} clientes`}
        />
      </div>

      {/* Linha 2 — crédito efetivado, largura total. */}
      <div className="min-h-0 flex flex-col">
        {meta && meta > 0 && data.semanas && data.semanas.length > 0 && data.semanas[0].meta != null ? (
          <MetaSemanasCard
            titulo="Crédito efetivado"
            accent={ACCENT}
            corTrilhoSemana="rgba(191,255,0,0.55)"
            creditoMes={Number(cMes.credito || 0)}
            meta={Number(meta)}
            pct={pctMeta}
            semanas={data.semanas}
          />
        ) : (
          <CreditoSemMetaCard
            creditoMes={Number(cMes.credito || 0)}
            creditoHoje={Number(cDia.credito || 0)}
          />
        )}
      </div>


      {/* Linha 2 */}
      <div className="grid grid-cols-3 gap-3 xl:gap-5 min-h-0">

        <DiaMesBlocoCard
          titulo="Agendamento"
          accent={ACCENT}
          hoje={{
            valor: (
              <Fracao
                numerador={Number(aDia.agendamentos || 0)}
                denominador={Number(data.meta_agendamento?.dia ?? 0)}
                cor={ACCENT}
              />
            ),
            titleAttr: `${num(aDia.agendamentos)} de ${num(data.meta_agendamento?.dia ?? 0)} na meta do dia`,
          }}
          mes={{
            valor: (
              <Fracao
                numerador={Number(aMes.agendamentos || 0)}
                denominador={Number(data.meta_agendamento?.mes ?? 0)}
                cor={ACCENT}
              />
            ),
            titleAttr: `${num(aMes.agendamentos)} de ${num(data.meta_agendamento?.mes ?? 0)} na meta do mês`,
          }}
        />
        <DiaMesBlocoCard
          titulo="R1 realizadas"
          accent={ACCENT}
          hoje={{
            valor: (
              <Fracao
                numerador={Number(aDia.realizadas || 0)}
                denominador={Number(aDia.agendadas || 0)}
                cor={ACCENT}
              />
            ),
            titleAttr: `${num(aDia.realizadas)} de ${num(aDia.agendadas)} agendadas`,
          }}
          mes={{
            valor: (
              <Fracao
                numerador={Number(aMes.realizadas || 0)}
                denominador={Number(aMes.agendadas || 0)}
                cor={ACCENT}
              />
            ),
            titleAttr: `${num(aMes.realizadas)} de ${num(aMes.agendadas)} agendadas`,
            rodape: (
              <span className="text-white/45">
                {pctTexto(Number(aMes.realizadas || 0), Number(aMes.agendadas || 0))} dos agendados
              </span>
            ),
          }}
        />
        <DiaMesBlocoCard
          titulo="Vendas"
          accent={ACCENT}
          hoje={{
            valor: num(cDia.clientes),
            rodape: (
              <span className="text-white/45">
                {num(cDia.cotas)} cotas
              </span>
            ),
          }}
          mes={{
            valor: num(cMes.clientes),
            rodape: (
              <span className="text-white/45">
                {num(cMes.cotas)} cotas · ticket {abreviarBRL(cMes.ticket)}
              </span>
            ),
          }}
        />
      </div>


      {/* Linha 3 */}
      <div className="grid grid-cols-2 gap-3 xl:gap-5 min-h-0">
        <RankingShell titulo="Closers · produção no mês" accent={ACCENT} vazio={closers.length === 0}>
          {closers.map((c, idx) => (
            <div
              key={`${c.nome}-${idx}`}
              className="flex-1 min-h-0 grid grid-cols-[auto_1fr_auto] items-center gap-x-2 xl:gap-x-4 rounded-xl border px-2 xl:px-3 py-1 xl:py-2"
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                borderColor: "rgba(255,255,255,0.10)",
                opacity: Number(c.credito || 0) === 0 && Number(c.cotas || 0) === 0 ? 0.45 : 1,
              }}
            >
              <Posicao idx={idx} accent={ACCENT} />
              <div className="min-w-0">
                <div className="truncate text-xl xl:text-3xl font-bold text-white/90">
                  {primeiroEUltimoNome(c.nome)}
                </div>
                <div className="text-[10px] xl:text-base text-white/40 font-semibold">
                  {num(c.clientes)} clientes · {num(c.cotas)} cotas
                </div>
              </div>
              <span className="text-3xl xl:text-6xl font-black leading-none" style={{ color: ACCENT }}>
                {abreviarBRL(c.credito)}
              </span>
            </div>
          ))}
        </RankingShell>

        <RankingShell titulo="SDR · agendamentos" extra="Hoje / Mês" accent={ACCENT_SDR} vazio={sdrs.length === 0}>
          {sdrs.map((s, idx) => {
            const hoje = Number(sdrDiaMap.get(s.nome)?.agendamentos ?? 0);
            return (
              <div
                key={`${s.nome}-${idx}`}
                className="flex-1 min-h-0 grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2 xl:gap-x-4 rounded-xl border px-2 xl:px-3 py-1 xl:py-2"
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderColor: "rgba(255,255,255,0.10)",
                  opacity: Number(s.agendamentos || 0) === 0 ? 0.45 : 1,
                }}
              >
                <Posicao idx={idx} accent={ACCENT_SDR} />
                <span className="truncate text-xl xl:text-3xl font-bold text-white/90 capitalize">
                  {primeiroEUltimoNome(s.nome)}
                </span>
                <span className="text-right w-16 xl:w-24 text-3xl xl:text-6xl font-black leading-none" style={{ color: ACCENT_SDR }}>
                  {num(hoje)}
                </span>
                <span className="text-right w-20 xl:w-32 text-3xl xl:text-6xl font-black leading-none text-white/90">
                  {num(s.agendamentos)}
                </span>
              </div>
            );
          })}
        </RankingShell>
      </div>
    </TVShell>
  );
}
