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
        <span className="text-white/45 text-base xl:text-2xl">/{num(denominador)}</span>
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
 * Cartão de largura total do crédito efetivado, com quatro colunas semanais e
 * barras horizontais retas (o arco SVG era achatado por preserveAspectRatio e
 * deixava entalhes e texto desalinhados).
 */
function CreditoSemanasCard({
  creditoMes,
  meta,
  pct,
  semanas,
}: {
  creditoMes: number;
  meta: number;
  pct: number;
  semanas: SemanaItem[];
}) {
  return (
    <div
      className="rounded-2xl border p-2 xl:p-3 flex flex-col flex-1 min-h-0 overflow-hidden"
      style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.10)" }}
    >
      {/* Cabeçalho — rótulo acima, valor grande + percentual alinhados pela base. */}
      <div className="text-white/60 uppercase tracking-widest text-[10px] xl:text-sm font-bold">
        Crédito efetivado
      </div>
      <div className="flex items-baseline gap-2 xl:gap-3 mt-0.5">
        <span className="text-3xl xl:text-5xl font-black leading-none" style={{ color: ACCENT }}>
          {abreviarBRL(creditoMes)}
        </span>
        <span className="text-sm xl:text-xl font-bold text-white/55 leading-none">
          {pct.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% de {abreviarBRL(meta)}
        </span>
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
          const corFill = isAtual ? ACCENT : "rgba(191,255,0,0.55)";

          return (
            <div
              key={s.indice}
              className={`flex flex-col min-w-0 ${isAtual ? "pl-2 xl:pl-3 border-l" : ""}`}
              style={{
                opacity: isFutura ? 0.4 : 1,
                borderColor: isAtual ? "rgba(191,255,0,0.25)" : undefined,
              }}
            >
              {/* 1 — rótulo à esquerda, percentual à direita. */}
              <div className="flex items-baseline justify-between gap-1 min-w-0">
                <span
                  className="text-[10px] xl:text-xs font-black tracking-widest uppercase truncate"
                  style={{ color: isAtual ? ACCENT : "rgba(255,255,255,0.45)" }}
                >
                  S{s.indice} · {dd(s.inicio)}–{dd(s.fim)}
                </span>
                <span
                  className="text-[10px] xl:text-xs font-bold shrink-0"
                  style={{ color: isAtual ? ACCENT : "rgba(255,255,255,0.45)" }}
                >
                  {semanaMeta > 0
                    ? Math.round((Number(s.credito || 0) / semanaMeta) * 100) + "%"
                    : "—"}
                </span>
              </div>

              {/* 2 — crédito da semana em destaque médio. */}
              <div className="flex-1 min-h-0 flex items-center mt-1">
                <span
                  className="text-base xl:text-2xl font-black leading-none truncate"
                  style={{ color: isFutura ? "rgba(255,255,255,0.45)" : corTexto }}
                >
                  {isFutura ? "—" : abreviarBRL(Number(s.credito || 0))}
                </span>
              </div>

              {/* 3 — barra horizontal. */}
              <div
                className="w-full rounded-full mt-1 h-1.5 xl:h-2.5 overflow-hidden"
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
      className="rounded-2xl border p-2 xl:p-3 flex flex-col flex-1 min-h-0"

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
  hoje: { valor: ReactNode; titleAttr?: string; rodape?: ReactNode; conteudo?: ReactNode };
  mes: { valor: ReactNode; titleAttr?: string; rodape?: ReactNode; conteudo?: ReactNode };
}) {
  const cor = alerta ? "#ef4444" : accent;
  return (
    <div
      className="rounded-2xl border p-2 xl:p-3 flex flex-col min-h-0"
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
            className={`flex flex-col min-w-0 ${i === 1 ? "pl-2 xl:pl-3 border-l" : ""}`}
            style={i === 1 ? { borderColor: "rgba(255,255,255,0.12)" } : undefined}
          >
            {/* Faixa do rótulo — altura natural, igual nas duas colunas. */}
            <div className="text-xs xl:text-sm font-black tracking-widest text-white/40 uppercase">{label}</div>
            {bloco.conteudo ? (
              /* Caminho alternativo (fração/conteúdo custom): mantém as 3 faixas
                 para alinhar com a coluna vizinha. */
              <>
                <div className="flex-1 min-h-0 flex items-center mt-0.5">{bloco.conteudo}</div>
                <div className="mt-1 text-[10px] xl:text-sm text-white/40 font-bold leading-none min-h-[1em]">
                  {bloco.rodape ?? <>&nbsp;</>}
                </div>
              </>
            ) : (
              <>
                {/* Faixa do número — flex-1 para centrar no espaço que sobra. */}
                <div className="flex-1 min-h-0 flex items-center mt-0.5">
                  <div
                    className="text-3xl xl:text-6xl font-black leading-none truncate w-full"
                    style={{ color: cor }}
                    title={bloco.titleAttr}
                  >
                    {bloco.valor}
                  </div>
                </div>
                {/* Faixa do rodapé — sempre renderizada, reserva a mesma altura. */}
                <div className="mt-1 text-[10px] xl:text-sm text-white/40 font-bold leading-none min-h-[1em]">
                  {bloco.rodape ?? <>&nbsp;</>}
                </div>
              </>
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
      className="rounded-3xl border p-3 xl:p-5 flex flex-col min-h-0"
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
      <div className="flex-1 min-h-0 mt-2 flex flex-col gap-2 xl:gap-2.5 overflow-hidden">
        {vazio ? <div className="text-white/35 font-semibold italic text-sm mt-2">sem dados no mês</div> : children}
      </div>
    </section>
  );
}

function Posicao({ idx, accent }: { idx: number; accent: string }) {
  const primeiro = idx === 0;
  return (
    <span
      className="h-7 w-7 xl:h-9 xl:w-9 shrink-0 rounded-lg flex items-center justify-center text-sm xl:text-base font-black"
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
      title="MCF · Painel de Equipe"
      subtitle="Consórcio · Equipe"
      accent={ACCENT}
      today={data.today}
      updatedAt={data.updated_at}
      warning={warning}
      mainRowsClassName="grid-rows-[minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,2fr)]"
    >
      {/* Linha 1 — crédito efetivado em largura total (barras semanais). */}
      <div className="min-h-0 flex flex-col">
        {meta && meta > 0 && data.semanas && data.semanas.length > 0 && data.semanas[0].meta != null ? (
          <CreditoSemanasCard
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
      <div className="grid grid-cols-4 gap-4 xl:gap-8 min-h-0">
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
            rodape: (
              <div className="text-[11px] xl:text-sm text-white/45 font-semibold">
                {pctTexto(Number(aMes.agendamentos || 0), Number(data.meta_agendamento?.mes ?? 0))} da meta
              </div>
            ),
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
              <div className="text-[11px] xl:text-sm text-white/45 font-semibold">
                {pctTexto(Number(aMes.realizadas || 0), Number(aMes.agendadas || 0))} dos agendados
              </div>
            ),
          }}
        />
        <DiaMesBlocoCard
          titulo="Vendas"
          accent={ACCENT}
          hoje={{
            valor: num(cDia.clientes),
            rodape: (
              <div className="text-[11px] xl:text-sm text-white/45 font-semibold">
                {num(cDia.cotas)} cotas
              </div>
            ),
          }}
          mes={{
            valor: num(cMes.clientes),
            rodape: (
              <div className="text-[11px] xl:text-sm text-white/45 font-semibold">
                {num(cMes.cotas)} cotas · ticket {abreviarBRL(cMes.ticket)}
              </div>
            ),
          }}
        />
        <DiaMesBlocoCard
          titulo="Produção gerada"
          accent={ACCENT}
          hoje={{
            valor: abreviarBRL(Number(pDia.credito || 0)),
            rodape: (
              <div className="text-[11px] xl:text-sm text-white/45 font-semibold">
                {num(pDia.cotas)} cotas
              </div>
            ),
          }}
          mes={{
            valor: abreviarBRL(Number(pMes.credito || 0)),
            rodape: (
              <div className="text-[11px] xl:text-sm text-white/45 font-semibold">
                {num(pMes.cotas)} cotas · {num(pMes.clientes)} clientes
              </div>
            ),
          }}
        />
      </div>


      {/* Linha 3 */}
      <div className="grid grid-cols-2 gap-4 xl:gap-8 min-h-0">
        <RankingShell titulo="Closers · crédito no mês" accent={ACCENT} vazio={closers.length === 0}>
          {closers.map((c, idx) => (
            <div
              key={`${c.nome}-${idx}`}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 xl:gap-x-4 rounded-xl border px-2 xl:px-3 py-2 xl:py-3"
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                borderColor: "rgba(255,255,255,0.10)",
                opacity: Number(c.credito || 0) === 0 && Number(c.cotas || 0) === 0 ? 0.45 : 1,
              }}
            >
              <Posicao idx={idx} accent={ACCENT} />
              <div className="min-w-0">
                <div className="truncate text-lg xl:text-2xl font-bold text-white/90">
                  {primeiroEUltimoNome(c.nome)}
                </div>
                <div className="text-[10px] xl:text-xs text-white/40 font-semibold">
                  {num(c.clientes)} clientes · {num(c.cotas)} cotas
                </div>
              </div>
              <span className="text-2xl xl:text-4xl font-black leading-none" style={{ color: ACCENT }}>
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
                className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2 xl:gap-x-4 rounded-xl border px-2 xl:px-3 py-2 xl:py-3"
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderColor: "rgba(255,255,255,0.10)",
                  opacity: Number(s.agendamentos || 0) === 0 ? 0.45 : 1,
                }}
              >
                <Posicao idx={idx} accent={ACCENT_SDR} />
                <span className="truncate text-lg xl:text-2xl font-bold text-white/90 capitalize">
                  {primeiroEUltimoNome(s.nome)}
                </span>
                <span className="text-right w-10 xl:w-12 text-base xl:text-xl font-black leading-none" style={{ color: ACCENT_SDR }}>
                  {num(hoje)}
                </span>
                <span className="text-right w-12 xl:w-16 text-2xl xl:text-4xl font-black leading-none text-white/90">
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
