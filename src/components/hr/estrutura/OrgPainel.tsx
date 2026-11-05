import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ExternalLink, Star } from 'lucide-react';
import { caminhoAteTopo, criaCiclo, iniciais, mapaPais, rotuloRequisicao, type Modelo, type Requisicao } from '@/lib/estruturaOrg';
import { useEstruturaMutacao } from '@/hooks/useEstruturaOrg';

export type Selecao = { tipo: 'setor' | 'cargo' | 'pessoa'; id: string | null } | null;

const NONE = '__none';
const fmtData = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—');
const brl = (v: number | null) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));
const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return <div className="space-y-1"><div className="text-xs text-muted-foreground">{rotulo}</div><div className="text-sm">{children}</div></div>;
}
function Escolha({ valor, onChange, opcoes, vazio = 'Nenhum' }: { valor: string | null; onChange: (v: string | null) => void; opcoes: { id: string; nome: string }[]; vazio?: string }) {
  return (
    <Select value={valor ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{vazio}</SelectItem>
        {opcoes.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
function Ligacao({ nome, onClick }: { nome: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="text-left text-sm text-primary hover:underline">{nome}</button>;
}

type Props = {
  modelo: Modelo; selecao: Selecao; requisicoes: Requisicao[]; podeEditar: boolean; editando: boolean;
  onSelecionar: (s: Selecao) => void; onFechar: () => void;
};

export function OrgPainel({ modelo: m, selecao, requisicoes, podeEditar, editando, onSelecionar, onFechar }: Props) {
  const aberto = !!selecao;
  const titulo = !selecao ? '' : selecao.id == null ? (selecao.tipo === 'setor' ? 'Novo setor' : 'Novo cargo')
    : selecao.tipo === 'setor' ? m.setores.get(selecao.id)?.nome : selecao.tipo === 'cargo' ? m.cargos.get(selecao.id)?.nome : m.pessoas.get(selecao.id)?.nome;
  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{titulo}</SheetTitle>
          <SheetDescription>{selecao?.tipo === 'setor' ? 'Setor' : selecao?.tipo === 'cargo' ? 'Cargo' : 'Pessoa'}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {selecao?.tipo === 'setor' && <PainelSetor m={m} id={selecao.id} reqs={requisicoes} editar={podeEditar && editando} sel={onSelecionar} />}
          {selecao?.tipo === 'cargo' && <PainelCargo m={m} id={selecao.id} reqs={requisicoes} editar={podeEditar && editando} rh={podeEditar} sel={onSelecionar} />}
          {selecao?.tipo === 'pessoa' && selecao.id && <PainelPessoa m={m} id={selecao.id} rh={podeEditar} sel={onSelecionar} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PainelSetor({ m, id, reqs, editar, sel }: { m: Modelo; id: string | null; reqs: Requisicao[]; editar: boolean; sel: (s: Selecao) => void }) {
  const s = id ? m.setores.get(id) : null;
  const [f, setF] = useState({ nome: '', parent: null as string | null, resp: null as string | null });
  useEffect(() => setF({ nome: s?.nome ?? '', parent: s?.parent_id ?? null, resp: s?.responsavel_employee_id ?? null }), [s]);
  const salvar = useEstruturaMutacao('gov_setor_salvar', 'Setor salvo');
  const pais = useMemo(() => mapaPais(m, 'setores'), [m]);
  const cargos = [...m.cargos.values()].filter((c) => c.departamento_id === id);
  const pessoas = [...m.pessoas.values()].filter((p) => m.setorDaPessoa.get(p.id) === id);
  const subs = [...m.setores.values()].filter((x) => x.parent_id === id);
  const vagos = cargos.filter((c) => !(m.ocupantes.get(c.id)?.length)).length;
  const nReq = reqs.filter((r) => r.departamento_id === id).length;
  const resp = s?.responsavel_employee_id ? m.pessoas.get(s.responsavel_employee_id) : null;
  const opcoesPai = [...m.setores.values()].filter((x) => !id || (x.id !== id && !criaCiclo(pais, id, x.id)));

  return (
    <>
      {s && (
        <>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[['Cargos', cargos.length], ['Pessoas', pessoas.length], ['Vagos', vagos], ['Requisições', nReq]].map(([r, v]) => (
              <div key={r} className="rounded-md border p-2"><div className="text-lg font-bold">{v}</div><div className="text-[10px] text-muted-foreground">{r}</div></div>
            ))}
          </div>
          <Campo rotulo="Responsável">{resp ? <Ligacao nome={resp.nome} onClick={() => sel({ tipo: 'pessoa', id: resp.id })} /> : 'Não definido'}</Campo>
          <Campo rotulo="Setor pai">{s.parent_id && m.setores.get(s.parent_id) ? <Ligacao nome={m.setores.get(s.parent_id)!.nome} onClick={() => sel({ tipo: 'setor', id: s.parent_id })} /> : '—'}</Campo>
          <Campo rotulo="Subsetores"><div className="flex flex-col gap-1">{subs.length ? subs.map((x) => <Ligacao key={x.id} nome={x.nome} onClick={() => sel({ tipo: 'setor', id: x.id })} />) : '—'}</div></Campo>
          <Campo rotulo="Cargos"><div className="flex flex-col gap-1">{cargos.length ? cargos.map((c) => <Ligacao key={c.id} nome={c.nome} onClick={() => sel({ tipo: 'cargo', id: c.id })} />) : '—'}</div></Campo>
          <Campo rotulo="Pessoas"><div className="flex flex-col gap-1">{pessoas.length ? pessoas.map((p) => <Ligacao key={p.id} nome={p.nome} onClick={() => sel({ tipo: 'pessoa', id: p.id })} />) : '—'}</div></Campo>
        </>
      )}
      {editar && (
        <div className="space-y-3 rounded-md border p-3">
          <div className="text-sm font-semibold">{s ? 'Editar setor' : 'Criar setor'}</div>
          <div className="space-y-1"><Label>Nome</Label><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></div>
          <div className="space-y-1"><Label>Setor pai</Label><Escolha valor={f.parent} onChange={(v) => setF({ ...f, parent: v })} opcoes={opcoesPai} /></div>
          <div className="space-y-1"><Label>Responsável</Label><Escolha valor={f.resp} onChange={(v) => setF({ ...f, resp: v })} opcoes={[...m.pessoas.values()].sort((a, b) => a.nome.localeCompare(b.nome))} /></div>
          <Button disabled={salvar.isPending || !f.nome.trim()} onClick={() => salvar.mutate({ p_id: id, p_nome: f.nome, p_parent_id: f.parent, p_responsavel: f.resp })}>Salvar</Button>
        </div>
      )}
    </>
  );
}

function PainelCargo({ m, id, reqs, editar, rh, sel }: { m: Modelo; id: string | null; reqs: Requisicao[]; editar: boolean; rh: boolean; sel: (s: Selecao) => void }) {
  const c = id ? m.cargos.get(id) : null;
  const [f, setF] = useState({ nome: '', dep: null as string | null, rep: null as string | null, nivel: '', desc: '', min: '', max: '' });
  useEffect(() => setF({ nome: c?.nome ?? '', dep: c?.departamento_id ?? null, rep: c?.reporta_a_cargo_id ?? null, nivel: c?.nivel?.toString() ?? '', desc: c?.descricao ?? '', min: c?.faixa_min?.toString() ?? '', max: c?.faixa_max?.toString() ?? '' }), [c]);
  const [vinc, setVinc] = useState({ pessoa: null as string | null, inicio: hojeSP(), interino: false });
  const [fim, setFim] = useState(hojeSP());
  const salvar = useEstruturaMutacao('gov_cargo_salvar', 'Cargo salvo');
  const atribuir = useEstruturaMutacao('gov_vinculo_atribuir', 'Vínculo registrado');
  const encerrar = useEstruturaMutacao('gov_vinculo_encerrar', 'Vínculo encerrado');
  const pais = useMemo(() => mapaPais(m, 'cargos'), [m]);
  const ocup = id ? m.ocupantes.get(id) ?? [] : [];
  const historico = id ? m.raw.vinculos.filter((v) => v.cargo_id === id).sort((a, b) => b.data_inicio.localeCompare(a.data_inicio)) : [];
  const reqsCargo = reqs.filter((r) => r.cargo_catalogo_id === id);
  const opcoesRep = [...m.cargos.values()].filter((x) => !id || (x.id !== id && !criaCiclo(pais, id, x.id)));
  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  return (
    <>
      {c && (
        <>
          <Campo rotulo="Setor">{c.departamento_id && m.setores.get(c.departamento_id) ? <Ligacao nome={m.setores.get(c.departamento_id)!.nome} onClick={() => sel({ tipo: 'setor', id: c.departamento_id })} /> : 'Sem setor'}</Campo>
          <Campo rotulo="Nível hierárquico">{c.nivel ?? '—'}</Campo>
          <Campo rotulo="Reporta a">{c.reporta_a_cargo_id && m.cargos.get(c.reporta_a_cargo_id) ? <Ligacao nome={m.cargos.get(c.reporta_a_cargo_id)!.nome} onClick={() => sel({ tipo: 'cargo', id: c.reporta_a_cargo_id })} /> : '—'}</Campo>
          {c.descricao && <Campo rotulo="Descrição"><p className="whitespace-pre-wrap">{c.descricao}</p></Campo>}
          <Campo rotulo="Ocupante atual">
            {ocup.length ? (
              <div className="flex flex-col gap-2">{ocup.map((o) => (
                <div key={o.pessoa.id} className="flex items-center gap-2">
                  <Ligacao nome={o.pessoa.nome} onClick={() => sel({ tipo: 'pessoa', id: o.pessoa.id })} />
                  {o.interino && <Badge variant="secondary" className="text-[10px]">Interino</Badge>}
                </div>))}
              </div>
            ) : <Badge variant="outline">Vago</Badge>}
          </Campo>
          {rh && (c.faixa_min != null || c.faixa_max != null) && <Campo rotulo="Faixa salarial (visível só para RH)">{brl(c.faixa_min)} a {brl(c.faixa_max)}</Campo>}
          {reqsCargo.length > 0 && <Campo rotulo="Requisições vinculadas"><div className="flex flex-col gap-1">{reqsCargo.map((r) => <Link key={r.id} to="/rh/requisicoes" className="text-primary hover:underline">{rotuloRequisicao(r.status)}</Link>)}</div></Campo>}
          <Separator />
          <Campo rotulo="Histórico de ocupantes">
            {historico.length ? (
              <ul className="space-y-1.5">{historico.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium">{m.pessoas.get(v.employee_id)?.nome ?? 'Ex-colaborador'}</span>
                  <span className="text-muted-foreground">{fmtData(v.data_inicio)} → {v.data_fim ? fmtData(v.data_fim) : 'atual'}</span>
                  {v.interino && <Badge variant="secondary" className="text-[10px]">Interino</Badge>}
                  {editar && !v.data_fim && (
                    <Button size="sm" variant="outline" className="h-6 text-[11px]" disabled={encerrar.isPending}
                      onClick={() => encerrar.mutate({ p_vinculo_id: v.id, p_data_fim: fim })}>Encerrar em {fmtData(fim)}</Button>
                  )}
                </li>))}
              </ul>
            ) : 'Sem histórico registrado'}
          </Campo>
          {editar && (
            <div className="space-y-2 rounded-md border p-3">
              <div className="text-sm font-semibold">Atribuir pessoa ao cargo</div>
              <Escolha valor={vinc.pessoa} onChange={(v) => setVinc({ ...vinc, pessoa: v })} vazio="Escolha a pessoa" opcoes={[...m.pessoas.values()].sort((a, b) => a.nome.localeCompare(b.nome))} />
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label>Início</Label><Input type="date" value={vinc.inicio} onChange={(e) => setVinc({ ...vinc, inicio: e.target.value })} /></div>
                <div className="space-y-1"><Label>Data p/ encerrar</Label><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={vinc.interino} onCheckedChange={(v) => setVinc({ ...vinc, interino: !!v })} />Interino / substituto temporário</label>
              <p className="text-xs text-muted-foreground">Sem "interino", o cargo anterior da pessoa é encerrado no dia anterior ao início. O histórico é preservado.</p>
              <Button size="sm" disabled={!vinc.pessoa || !vinc.inicio || atribuir.isPending}
                onClick={() => atribuir.mutate({ p_employee_id: vinc.pessoa, p_cargo_id: id, p_data_inicio: vinc.inicio, p_interino: vinc.interino })}>Atribuir</Button>
            </div>
          )}
        </>
      )}
      {editar && (
        <div className="space-y-3 rounded-md border p-3">
          <div className="text-sm font-semibold">{c ? 'Editar cargo' : 'Criar cargo'}</div>
          <div className="space-y-1"><Label>Nome</Label><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></div>
          <div className="space-y-1"><Label>Setor (obrigatório)</Label><Escolha valor={f.dep} onChange={(v) => setF({ ...f, dep: v })} vazio="Escolha o setor" opcoes={[...m.setores.values()]} /></div>
          <div className="space-y-1"><Label>Reporta a</Label><Escolha valor={f.rep} onChange={(v) => setF({ ...f, rep: v })} opcoes={opcoesRep} /></div>
          <div className="space-y-1"><Label>Nível hierárquico</Label><Input type="number" value={f.nivel} onChange={(e) => setF({ ...f, nivel: e.target.value })} /></div>
          <div className="space-y-1"><Label>Descrição</Label><Textarea value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Faixa mín.</Label><Input type="number" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} /></div>
            <div className="space-y-1"><Label>Faixa máx.</Label><Input type="number" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} /></div>
          </div>
          <Button disabled={salvar.isPending || !f.nome.trim() || !f.dep}
            onClick={() => salvar.mutate({ p_id: id, p_nome: f.nome, p_departamento_id: f.dep, p_reporta_a: f.rep, p_nivel: num(f.nivel), p_descricao: f.desc || null, p_faixa_min: num(f.min), p_faixa_max: num(f.max) })}>Salvar</Button>
        </div>
      )}
    </>
  );
}

function PainelPessoa({ m, id, rh, sel }: { m: Modelo; id: string; rh: boolean; sel: (s: Selecao) => void }) {
  const p = m.pessoas.get(id)!;
  const pais = useMemo(() => mapaPais(m, 'pessoas'), [m]);
  const c = m.cargoDaPessoa.get(id);
  const cargo = c ? m.cargos.get(c.cargoId) : null;
  const setorId = m.setorDaPessoa.get(id);
  const setor = setorId ? m.setores.get(setorId) : null;
  const cadeia = caminhoAteTopo(pais, id).slice(1);
  const subs = [...m.pessoas.values()].filter((x) => m.superior.get(x.id) === id);
  const eu = m.raw.meu_employee_id === id;
  const responsavel = [...m.setores.values()].filter((s) => s.responsavel_employee_id === id);
  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar className="h-14 w-14">{p.avatar_url && <AvatarImage src={p.avatar_url} alt={p.nome} />}<AvatarFallback>{iniciais(p.nome)}</AvatarFallback></Avatar>
        <div>
          <div className="font-semibold">{p.nome}</div>
          {responsavel.map((s) => <div key={s.id} className="text-xs text-muted-foreground flex items-center gap-1"><Star className="h-3 w-3 fill-primary text-primary" />Responsável por {s.nome}</div>)}
        </div>
      </div>
      <Campo rotulo="Cargo">{cargo ? <span className="flex items-center gap-2"><Ligacao nome={cargo.nome} onClick={() => sel({ tipo: 'cargo', id: cargo.id })} />{c?.interino && <Badge variant="secondary" className="text-[10px]">Interino</Badge>}</span> : 'Sem cargo'}</Campo>
      <Campo rotulo="Setor">{setor ? <Ligacao nome={setor.nome} onClick={() => sel({ tipo: 'setor', id: setor.id })} /> : '—'}</Campo>
      <Campo rotulo="Superior imediato">{cadeia[0] ? <Ligacao nome={m.pessoas.get(cadeia[0])!.nome} onClick={() => sel({ tipo: 'pessoa', id: cadeia[0] })} /> : '—'}</Campo>
      <Campo rotulo="Cadeia até o topo">
        {cadeia.length ? <ol className="space-y-1 border-l pl-3">{cadeia.map((x) => <li key={x}><Ligacao nome={m.pessoas.get(x)?.nome ?? '—'} onClick={() => sel({ tipo: 'pessoa', id: x })} /></li>)}</ol> : 'Topo da hierarquia'}
      </Campo>
      <Campo rotulo={`Subordinados diretos (${subs.length})`}><div className="flex flex-col gap-1">{subs.length ? subs.map((s) => <Ligacao key={s.id} nome={s.nome} onClick={() => sel({ tipo: 'pessoa', id: s.id })} />) : '—'}</div></Campo>
      {(rh || eu) && (
        <Button asChild variant="outline" size="sm">
          <Link to={rh ? `/rh/colaboradores/${id}` : '/meu-rh'}><ExternalLink className="h-4 w-4 mr-1" />{rh ? 'Abrir perfil e dossiê' : 'Abrir Meu RH'}</Link>
        </Button>
      )}
    </>
  );
}
