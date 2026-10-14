export type ClimaTipo = "escala_0_10" | "texto";
export interface ClimaPergunta { id: string; pesquisa_id: string; ordem: number; enunciado: string; tipo: ClimaTipo; permite_comentario: boolean; obrigatoria: boolean }
export interface ClimaPesquisa { id: string; titulo: string; descricao: string | null; ativa: boolean; created_at: string }
export type ClimaRespostaItem = { nota?: number | null; texto?: string | null };
export interface ClimaResposta { id: string; pesquisa_id: string; user_id: string; respostas: Record<string, ClimaRespostaItem>; created_at: string }

export type NivelSatisfacao = "feliz" | "entediado" | "triste";
export const NIVEL_INFO: Record<NivelSatisfacao, { emoji: string; label: string }> = {
  feliz: { emoji: "😄", label: "Feliz" },
  entediado: { emoji: "😐", label: "Entediado" },
  triste: { emoji: "😢", label: "Triste" },
};

/** Média ≥ 7 feliz; 4 a 6,9 entediado; < 4 triste. */
export function nivelPorMedia(media: number): NivelSatisfacao {
  if (media >= 7) return "feliz";
  if (media >= 4) return "entediado";
  return "triste";
}

export function mediaNotas(perguntas: ClimaPergunta[], respostas: Record<string, ClimaRespostaItem>): number | null {
  const notas = perguntas.filter((p) => p.tipo === "escala_0_10").map((p) => respostas[p.id]?.nota).filter((n): n is number => typeof n === "number");
  if (!notas.length) return null;
  return Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10;
}
