export type DisponibilidadePosVenda = { gerente_id: string; dia_semana: number; horario: string };
export type OcupacaoPosVenda = { inicio: string; duracao_min: number; status: string; gerente_id: string };

export function inicioSlotSP(dia: string, horario: string): Date {
  return new Date(`${dia}T${horario.slice(0, 5)}:00-03:00`);
}

export function horariosLivresPosVenda(
  disponibilidade: DisponibilidadePosVenda[], gerenteId: string, dia: string,
  reunioes: OcupacaoPosVenda[], duracao: number, agora = new Date(),
): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !Number.isFinite(duracao) || duracao <= 0) return [];
  const diaSemana = new Date(`${dia}T12:00:00-03:00`).getUTCDay();
  return [...new Set(disponibilidade.filter((d) => d.gerente_id === gerenteId && d.dia_semana === diaSemana)
    .map((d) => d.horario.slice(0, 5)))].sort().filter((hora) => {
    const inicio = +inicioSlotSP(dia, hora);
    const fim = inicio + duracao * 60_000;
    return inicio > +agora && !reunioes.some((r) => r.gerente_id === gerenteId && r.status !== 'cancelada'
      && +new Date(r.inicio) < fim && +new Date(r.inicio) + r.duracao_min * 60_000 > inicio);
  });
}
/** Meias-horas da grade que ficam travadas para um gerente configurado (fora da faixa ou já passadas). */
export function horariosTravadosPosVenda(
  disponibilidade: DisponibilidadePosVenda[], gerenteId: string, dia: string,
  grade: string[], agora = new Date(),
): string[] {
  if (!disponibilidade.some((d) => d.gerente_id === gerenteId)) return [];
  const diaSemana = new Date(`${dia}T12:00:00-03:00`).getUTCDay();
  const faixa = new Set(disponibilidade.filter((d) => d.gerente_id === gerenteId && d.dia_semana === diaSemana).map((d) => d.horario.slice(0, 5)));
  return grade.filter((h) => !faixa.has(h) || +inicioSlotSP(dia, h) <= +agora);
}
