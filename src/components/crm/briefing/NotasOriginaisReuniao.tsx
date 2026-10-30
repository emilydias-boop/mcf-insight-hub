import { useState } from 'react';
import { useNotasReuniaoDoNegocio, type ReuniaoNotas } from '@/hooks/useNotasReuniao';

interface Nota { chave: string; titulo: string; texto: string; quando: string }

const fmt = (iso: string | null, hora = false) => {
  if (!iso) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
    ...(hora ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(iso)).replace(',', '');
};
const tipoReuniao = (t: string | null) => (t?.toLowerCase().includes('r2') ? 'R2' : 'R1');
const temTexto = (s: string | null | undefined): s is string => !!s && s.trim().length > 0;

function montarNotas(reunioes: ReuniaoNotas[], soSdr: boolean): Nota[] {
  const out: Nota[] = [];
  for (const r of reunioes) {
    const tipo = tipoReuniao(r.meeting_type);
    const data = fmt(r.scheduled_at);
    const base = r.scheduled_at ?? r.created_at ?? '';
    if (temTexto(r.notes)) {
      out.push({ chave: `${r.id}-sdr`, quando: r.booked_at ?? r.created_at ?? base,
        titulo: `Nota do SDR · agendamento da ${tipo} de ${data}${r.booked_by_nome ? ` · ${r.booked_by_nome}` : ''}`, texto: r.notes });
    }
    if (soSdr) continue;
    const closerTxt = [r.closer_notes, r.r2_observations].filter(temTexto).join('\n\n');
    if (closerTxt) {
      out.push({ chave: `${r.id}-closer`, quando: base,
        titulo: `Nota do closer · ${tipo} de ${data}${r.closer_nome ? ` · ${r.closer_nome}` : ''}`, texto: closerTxt });
    }
    r.attendee_notes.forEach((n, i) => {
      if (!temTexto(n.note)) return;
      out.push({ chave: `${r.id}-an-${i}`, quando: n.created_at,
        titulo: `Nota${n.note_type ? ` ${n.note_type}` : ''} · ${fmt(n.created_at, true)}${n.autor ? ` · ${n.autor}` : ''}`, texto: n.note });
    });
    if (temTexto(r.outcome_reason_note)) {
      out.push({ chave: `${r.id}-motivo`, quando: base, titulo: 'Motivo do resultado', texto: r.outcome_reason_note });
    }
  }
  return out;
}

/** Texto original escrito pela equipe (não é texto da IA). */
export function NotasOriginaisReuniao({ dealId, soSdr = false }: { dealId: string; soSdr?: boolean }) {
  const { data } = useNotasReuniaoDoNegocio(dealId);
  const [todas, setTodas] = useState(false);
  const notas = montarNotas(data ?? [], soSdr);
  if (notas.length === 0) return null;

  const recentes = [...notas].sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 2).map((n) => n.chave);
  const visiveis = todas || notas.length <= 2 ? notas : notas.filter((n) => recentes.includes(n.chave));

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {soSdr ? 'Nota do SDR (texto original)' : 'Notas da equipe (texto original)'}
      </div>
      {visiveis.map((n) => (
        <div key={n.chave} className="space-y-0.5">
          <div className="text-[10px] text-muted-foreground">{n.titulo}</div>
          <div className="border-l-2 border-muted-foreground/30 pl-2 text-xs whitespace-pre-wrap break-words">{n.texto}</div>
        </div>
      ))}
      {notas.length > 2 && (
        <button type="button" onClick={() => setTodas((v) => !v)}
          className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
          {todas ? 'Mostrar só as 2 mais recentes' : `Ver todas as notas (${notas.length})`}
        </button>
      )}
    </div>
  );
}
