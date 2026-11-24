import { useParams } from 'react-router-dom';
import { useTrilha, AssinaturaTrilha, STATUS_ETAPA, type DocTipo } from '@/components/governanca/AssinaturaTrilha';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer } from 'lucide-react';

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
const CAMPOS: Record<string, string> = { titulo: 'Título', centro_custo: 'Centro de custo', regime: 'Regime', quantidade: 'Vagas', salario_base: 'Salário base', variavel: 'Variável', beneficios: 'Benefícios', modelo_trabalho: 'Modelo de trabalho', local: 'Local', data_inicio: 'Início desejado', missao: 'Missão', responsabilidades: 'Responsabilidades', requisitos_obrigatorios: 'Requisitos obrigatórios', competencias: 'Competências', indicadores: 'Indicadores', justificativa: 'Justificativa', tipo: 'Tipo', motivo: 'Motivo', descricao: 'Descrição', data_prevista: 'Data prevista', justificativa_reforcada: 'Justificativa reforçada', enviado_em: 'Enviado em' };

export default function VerificacaoAssinatura() {
  const { tipo, id } = useParams<{ tipo: DocTipo; id: string }>();
  const q = useTrilha(tipo as DocTipo, id);
  if (q.isLoading) return <p className="p-6">Carregando…</p>;
  if (q.error || !q.data?.length) return <p className="p-6 text-muted-foreground">Documento não encontrado ou sem permissão.</p>;
  const atual = q.data[0];
  return <div className="mx-auto max-w-4xl space-y-6 p-6 print:p-0">
    <div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-bold">Verificação de assinaturas</h1><p className="text-muted-foreground">{tipo === 'requisicao' ? 'Requisição de contratação' : 'Solicitação de desligamento'} · versão {atual.versao} · {fmt(atual.criada_em)}</p></div>
      <Button variant="outline" className="print:hidden" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" /> Exportar PDF</Button></div>
    <div className="print:hidden"><AssinaturaTrilha tipo={tipo as DocTipo} id={id!} /></div>
    <section className="rounded-lg border p-4"><h2 className="mb-2 font-semibold">Código de verificação (SHA-256)</h2><p className="break-all font-mono text-sm">{atual.hash}</p></section>
    <section className="rounded-lg border p-4"><h2 className="mb-3 font-semibold">Conteúdo assinado</h2><dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">{Object.entries(CAMPOS).filter(([k]) => atual.snapshot?.[k] != null && atual.snapshot[k] !== '').map(([k, l]) => <div key={k}><dt className="text-xs text-muted-foreground">{l}</dt><dd className="whitespace-pre-wrap text-sm">{String(atual.snapshot[k])}</dd></div>)}</dl></section>
    {q.data.map(v => <section key={v.versao} className="rounded-lg border p-4"><h2 className="mb-3 font-semibold">Trilha — versão {v.versao} <Badge variant="outline">{v.status === 'ativa' ? 'Em andamento' : v.status === 'concluida' ? 'Concluída' : 'Invalidada'}</Badge></h2>
      <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-1">Etapa</th><th>Assinante</th><th>Decisão</th><th>Registro</th></tr></thead><tbody>{v.etapas.map(e => <tr key={e.id} className="border-t align-top">
        <td className="py-2">{e.ordem}. {e.papel}</td>
        <td>{e.decidido_nome ?? e.aprovador ?? '—'}{e.decidido_cargo && <div className="text-xs text-muted-foreground">{e.decidido_cargo}{e.decidido_setor ? ` · ${e.decidido_setor}` : ''}</div>}</td>
        <td>{STATUS_ETAPA[e.status] ?? e.status}{e.comentario && <div className="text-xs italic">“{e.comentario}”</div>}</td>
        <td className="text-xs">{e.decidido_em ? <>{fmt(e.decidido_em)} · {e.metodo === 'google' ? 'Conta Google' : 'Senha'}<br />IP {e.ip ?? '—'}<br /><span className="break-all font-mono">{e.hash}</span></> : '—'}</td>
      </tr>)}</tbody></table></section>)}
  </div>;
}
