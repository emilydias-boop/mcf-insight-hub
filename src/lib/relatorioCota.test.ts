import { describe, it, expect } from 'vitest';
import { mesAtualSP, mesesHistoricos, mesSemRegistro, rotuloTipoLance, type MesRelatorio } from './relatorioCota';

const m = (mes: string, extra: Partial<MesRelatorio> = {}): MesRelatorio => ({ mes, assembleia: null, loteria: null, lances: [], resultados: [], ...extra });

describe('relatorioCota', () => {
  it('usa o mês de São Paulo na virada do mês', () => {
    expect(mesAtualSP(new Date('2026-11-01T02:00:00Z'))).toBe('2026-10');
  });
  it('não mostra meses futuros', () => {
    expect(mesesHistoricos([m('2026-11'), m('2026-10'), m('2026-09')], '2026-10').map((x) => x.mes)).toEqual(['2026-10', '2026-09']);
  });
  it('mês só com assembleia é "sem registro"', () => {
    expect(mesSemRegistro(m('2026-04', { assembleia: { numero: 5, data: '2026-04-24', sorteio: null } }))).toBe(true);
    expect(mesSemRegistro(m('2026-10', { loteria: { numero: '4459', aplicado: '4459', consultado_em: '2026-10-22' } }))).toBe(false);
  });
  it('lance antigo sem tipo', () => {
    expect(rotuloTipoLance(null)).toBe('Tipo não informado');
    expect(rotuloTipoLance('embutido')).toBe('Lance embutido');
  });
});
