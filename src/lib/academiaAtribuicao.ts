export interface TemplateAtribuicao {
  id: string;
  nome: string;
  frente_id: string | null;
  descricao: string | null;
}

export function disponibilidadeTrilha(
  template: TemplateAtribuicao,
  tracks: { track_template_id: string; frente_id: string | null; tipo: string }[],
  taskIds: string[],
  existentes: Set<string>,
): "disponivel" | "ja_atribuida" | "ja_contemplada" | "frente_ja_atribuida" | "sem_tarefas" {
  if (tracks.some((t) => t.track_template_id === template.id)) return "ja_atribuida";
  if (!taskIds.length) return "sem_tarefas";
  if (taskIds.every((id) => existentes.has(id))) return "ja_contemplada";
  if (template.frente_id && tracks.some((t) => t.tipo === "extensao" && t.frente_id === template.frente_id)) return "frente_ja_atribuida";
  return "disponivel";
}