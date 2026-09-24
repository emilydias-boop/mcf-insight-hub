import { supabase } from "@/integrations/supabase/client";

// Tabelas academia_* são novas; acesso sem tipagem gerada para não depender do arquivo de tipos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const adb = supabase as any;

export type TipoValidacao = "auto" | "gestor" | "padrinho" | "quiz" | "evidencia" | "pratica";
export type StatusTarefa = "pendente" | "enviada" | "aprovada" | "reprovada";

export interface APhase { id: string; track_template_id: string; ordem: number; codigo: string; titulo: string; periodo_label: string | null; dia_inicio: number | null; dia_fim: number | null; foco: string | null; quem_conduz: string | null; bloqueante: boolean; }
export interface AModule { id: string; phase_id: string; ordem: number; numero_label: string | null; titulo: string; objetivo: string | null; janela_label: string | null; phase?: APhase; }
export interface ATask { id: string; module_id: string; ordem: number; slug: string | null; titulo: string; detalhe: string | null; variantes: Record<string, string> | null; tipo_validacao: TipoValidacao; xp: number; obrigatoria: boolean; produto_id: string | null; badge_nivel: number | null; quiz_id: string | null; module?: AModule; }
export interface AUserTask { id: string; user_track_id: string; user_id: string; task_id: string; status: StatusTarefa; marcada_em: string | null; validada_em: string | null; comentario_validador: string | null; evidencia_url: string | null; reprovacoes: number; enviada_em: string | null; task: ATask; }
export interface APerfil { id: string; nome: string; cnpj: string | null; email: string | null; frente_id: string | null; produto_principal_id: string | null; funcao: string | null; atuacao_funil: string | null; data_inicio: string; gestor_id: string | null; padrinho_id: string | null; nivel: string; xp_total: number; status: string; }
export interface AUserTrack { id: string; user_id: string; track_template_id: string; tipo: "principal" | "extensao"; frente_id: string | null; iniciada_em: string; concluida_em: string | null; status: string; }
export interface AMilestone { id: string; user_track_id: string; user_id: string; codigo: "marco_30" | "conclusao_90"; assinatura_gestor_em: string | null; assinatura_padrinho_em: string | null; assinatura_colaborador_em: string | null; fechado_em: string | null; observacoes: string | null; }
export interface AFrente { id: string; nome: string; slug: string; cor: string | null; ordem: number; }
export interface AProduto { id: string; frente_id: string; nome: string; slug: string; resumo: string | null; para_quem: string | null; voce_precisa_saber: string | null; material: string | null; }
export interface ABadge { id: string; slug: string; nome: string; descricao: string | null; tipo: "produto" | "transversal" | "mestre"; produto_id: string | null; nivel: number | null; cor: string | null; xp_bonus: number; ordem: number; }

export const USER_TASK_SELECT = "*, task:academia_tasks(*, module:academia_modules(*, phase:academia_phases(*)))";

export const TIPO_LABEL: Record<TipoValidacao, string> = {
  auto: "Você marca", gestor: "Validação do gestor", padrinho: "Validação do padrinho",
  quiz: "Quiz", evidencia: "Evidência", pratica: "Evidência + gestor",
};

export const NIVEIS = [
  { nome: "Trainee", xp: 0 }, { nome: "Operador", xp: 300 }, { nome: "Consultor", xp: 800 },
  { nome: "Consultor Sênior", xp: 1500 }, { nome: "Mestre MCF", xp: 2500 },
];

export const MENSAGEM_TRAVA =
  "A Fase 0 precisa estar 100% aprovada antes de seguir. Um erro de comunicação ou de dados na primeira semana pode fechar conta em banco, gerar reclamação formal e expor a empresa.";

export function erroAcademia(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  const i = msg.indexOf(":");
  return i > 0 && /^[a-z_]+$/.test(msg.slice(0, i)) ? msg.slice(i + 1).trim() : msg;
}

export interface FaseAgrupada { phase: APhase; modulos: { module: AModule; tarefas: AUserTask[] }[]; tarefas: AUserTask[]; }

export function agruparPorFase(uts: AUserTask[]): FaseAgrupada[] {
  const fases = new Map<string, FaseAgrupada>();
  for (const ut of uts) {
    const m = ut.task.module!; const p = m.phase!;
    if (!fases.has(p.id)) fases.set(p.id, { phase: p, modulos: [], tarefas: [] });
    const f = fases.get(p.id)!;
    f.tarefas.push(ut);
    let mod = f.modulos.find((x) => x.module.id === m.id);
    if (!mod) { mod = { module: m, tarefas: [] }; f.modulos.push(mod); }
    mod.tarefas.push(ut);
  }
  const arr = [...fases.values()].sort((a, b) => a.phase.codigo.localeCompare(b.phase.codigo));
  arr.forEach((f) => {
    f.modulos.sort((a, b) => a.module.ordem - b.module.ordem);
    f.modulos.forEach((m) => m.tarefas.sort((a, b) => a.task.ordem - b.task.ordem));
  });
  return arr;
}

export function faseConcluida(f: FaseAgrupada) {
  return f.tarefas.filter((t) => t.task.obrigatoria).every((t) => t.status === "aprovada");
}

export function progresso(uts: AUserTask[]) {
  const obr = uts.filter((t) => t.task.obrigatoria);
  if (!obr.length) return 0;
  return Math.round((obr.filter((t) => t.status === "aprovada").length / obr.length) * 100);
}

export function diasDesde(data: string) {
  const d = new Date(data + "T00:00:00");
  return Math.max(1, Math.floor((Date.now() - d.getTime()) / 86400000) + 1);
}
