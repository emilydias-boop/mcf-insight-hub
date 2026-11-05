import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, useNodesState, useReactFlow,
  type Edge, type Node, MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Building2, Briefcase, Download, Network, Pencil, Plus, Search, Users, UserX, FileText, Maximize } from 'lucide-react';
import { useEstruturaOrg, useEstruturaMutacao, useRequisicoesAbertas } from '@/hooks/useEstruturaOrg';
import {
  caminhoAteTopo, criaCiclo, descendentes, filhosDe, layoutHierarquico, mapaPais, montarModelo, profundidades,
  recolhidosIniciais, rotuloRequisicao, visiveis, type Modelo, type Modo,
} from '@/lib/estruturaOrg';
import { NODE_W, nodeH, nodeTypes, type OrgCardData } from '@/components/hr/estrutura/OrgNodes';
import { OrgPainel, type Selecao } from '@/components/hr/estrutura/OrgPainel';
import { OrgLista } from '@/components/hr/estrutura/OrgLista';

const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const TODOS = '__todos';
const tipoDoModo = { setores: 'setor', cargos: 'cargo', pessoas: 'pessoa' } as const;
const modoDoTipo = { setor: 'setores', cargo: 'cargos', pessoa: 'pessoas' } as const;

export default function EstruturaOrganizacional() {
  return <ReactFlowProvider><Tela /></ReactFlowProvider>;
}

function Tela() {
  const hoje = hojeSP();
  const [data, setData] = useState(hoje);
  const q = useEstruturaOrg(data);
  const reqsQ = useRequisicoesAbertas();
  const reqs = reqsQ.data ?? [];
  const m = useMemo(() => (q.data ? montarModelo(q.data, data, hoje) : null), [q.data, data, hoje]);

  const [modo, setModo] = useState<Modo>('pessoas');
  const [vista, setVista] = useState<'fluxo' | 'lista'>(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'lista' : 'fluxo'));
  const [filtroSetor, setFiltroSetor] = useState<string | null>(null);
  const [filtroNivel, setFiltroNivel] = useState<string | null>(null);
  const [soVagos, setSoVagos] = useState(false);
  const [busca, setBusca] = useState('');
  const [foco, setFoco] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [selecao, setSelecao] = useState<Selecao>(null);
  const [editando, setEditando] = useState(false);
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [mover, setMover] = useState<{ id: string; novoPai: string } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const rf = useReactFlow();
  const podeEditar = !!q.data?.pode_editar;
  const historico = data !== hoje;

  const paisTodos = useMemo(() => (m ? mapaPais(m, modo) : new Map<string, string | null>()), [m, modo]);

  useEffect(() => { setRecolhidos(recolhidosIniciais(paisTodos)); setFoco(null); }, [paisTodos]);
  useEffect(() => { if (historico) setEditando(false); }, [historico]);

  // Filtros
  const incluidos = useMemo(() => {
    const s = new Set<string>();
    if (!m) return s;
    const setoresDoFiltro = filtroSetor ? new Set([filtroSetor, ...descendentes(filhosDe(mapaPais(m, 'setores')), filtroSetor)]) : null;
    for (const id of paisTodos.keys()) {
      let setorId: string | null = null; let nivel: number | null = null; let vago = false;
      if (modo === 'setores') { setorId = id; vago = [...m.cargos.values()].some((c) => c.departamento_id === id && !m.ocupantes.get(c.id)?.length); }
      if (modo === 'cargos') { const c = m.cargos.get(id)!; setorId = c.departamento_id; nivel = c.nivel; vago = !m.ocupantes.get(id)?.length; }
      if (modo === 'pessoas') { setorId = m.setorDaPessoa.get(id) ?? null; const c = m.cargoDaPessoa.get(id); nivel = c ? m.cargos.get(c.cargoId)?.nivel ?? null : null; }
      if (setoresDoFiltro && (!setorId || !setoresDoFiltro.has(setorId))) continue;
      if (filtroNivel && modo !== 'setores' && String(nivel ?? '') !== filtroNivel) continue;
      if (soVagos && modo !== 'pessoas' && !vago) continue;
      s.add(id);
    }
    return s;
  }, [m, modo, paisTodos, filtroSetor, filtroNivel, soVagos]);

  // Pai efetivo = ancestral incluído mais próximo
  const pais = useMemo(() => {
    const r = new Map<string, string | null>();
    for (const id of incluidos) {
      let p = paisTodos.get(id) ?? null; let g = 0;
      while (p && !incluidos.has(p) && g++ < 200) p = paisTodos.get(p) ?? null;
      r.set(id, p);
    }
    return r;
  }, [incluidos, paisTodos]);
  const filhos = useMemo(() => filhosDe(pais), [pais]);
  const prof = useMemo(() => profundidades(pais), [pais]);

  // Dados dos cards
  const dados = useMemo(() => {
    const r = new Map<string, OrgCardData>();
    if (!m) return r;
    const responsaveis = new Set([...m.setores.values()].map((s) => s.responsavel_employee_id).filter(Boolean) as string[]);
    for (const id of incluidos) {
      const base = { nivel: prof.get(id) ?? 0, filhos: filhos.get(id)?.length ?? 0, recolhido: recolhidos.has(id), estado: 'normal' as const,
        onToggle: () => setRecolhidos((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }) };
      if (modo === 'setores') {
        const s = m.setores.get(id)!;
        const cargos = [...m.cargos.values()].filter((c) => c.departamento_id === id);
        const pessoas = [...m.pessoas.values()].filter((p) => m.setorDaPessoa.get(p.id) === id).length;
        const vagos = cargos.filter((c) => !m.ocupantes.get(c.id)?.length).length;
        const nReq = reqs.filter((x) => x.departamento_id === id).length;
        const resp = s.responsavel_employee_id ? m.pessoas.get(s.responsavel_employee_id) : null;
        r.set(id, { ...base, titulo: s.nome, cor: m.corSetor.get(id) ?? 1, subtitulo: resp ? `Responsável: ${resp.nome}` : 'Sem responsável',
          avatar: resp ? { nome: resp.nome, url: resp.avatar_url } : null,
          linhas: [`${cargos.length} cargos · ${pessoas} pessoas · ${vagos} vagos`],
          badges: nReq ? [{ texto: `${nReq} requisição(ões)`, tipo: 'req' }] : [] });
      } else if (modo === 'cargos') {
        const c = m.cargos.get(id)!;
        const occ = m.ocupantes.get(id) ?? [];
        const req = reqs.find((x) => x.cargo_catalogo_id === id);
        const badges: OrgCardData['badges'] = [];
        if (!occ.length) badges.push({ texto: 'Vago', tipo: 'vago' });
        if (occ.some((o) => o.interino)) badges.push({ texto: 'Interino', tipo: 'interino' });
        if (req) badges.push({ texto: rotuloRequisicao(req.status), tipo: 'req' });
        r.set(id, { ...base, titulo: c.nome, cor: c.departamento_id ? m.corSetor.get(c.departamento_id) ?? 1 : 1, vago: !occ.length,
          subtitulo: c.nivel != null ? `Nível ${c.nivel}` : undefined,
          avatar: occ[0] ? { nome: occ[0].pessoa.nome, url: occ[0].pessoa.avatar_url } : null,
          linhas: occ.length ? [occ.map((o) => o.pessoa.nome).join(', ')] : [], badges,
          responsavel: occ.some((o) => responsaveis.has(o.pessoa.id)) });
      } else {
        const p = m.pessoas.get(id)!;
        const c = m.cargoDaPessoa.get(id);
        const setorId = m.setorDaPessoa.get(id);
        const badges: OrgCardData['badges'] = [];
        if (setorId && m.setores.get(setorId)) badges.push({ texto: m.setores.get(setorId)!.nome, tipo: 'setor' });
        if (c?.interino) badges.push({ texto: 'Interino', tipo: 'interino' });
        r.set(id, { ...base, titulo: p.nome, cor: setorId ? m.corSetor.get(setorId) ?? 1 : 1, avatar: { nome: p.nome, url: p.avatar_url },
          subtitulo: c ? m.cargos.get(c.cargoId)?.nome : 'Sem cargo', badges, responsavel: responsaveis.has(id) });
      }
    }
    return r;
  }, [m, modo, incluidos, prof, filhos, recolhidos, reqs]);

  const vis = useMemo(() => visiveis(pais, recolhidos, incluidos), [pais, recolhidos, incluidos]);

  // Destaque: busca (caminho até o topo) ou hover (conexões diretas)
  const destaque = useMemo(() => {
    if (foco && pais.has(foco)) return new Set(caminhoAteTopo(pais, foco));
    if (hover && pais.has(hover)) return new Set([hover, ...(pais.get(hover) ? [pais.get(hover)!] : []), ...(filhos.get(hover) ?? [])]);
    return null;
  }, [foco, hover, pais, filhos]);

  const { nodesCalc, edges } = useMemo(() => {
    const ids = [...vis];
    const arestas = ids.filter((id) => pais.get(id) && vis.has(pais.get(id)!)).map((id) => [pais.get(id)!, id] as [string, string]);
    const tam = (id: string) => ({ w: NODE_W, h: nodeH(dados.get(id) ?? {}) });
    const pos = layoutHierarquico(ids, arestas, tam);
    const nodes: Node[] = ids.map((id) => ({
      id, type: 'card', position: pos.get(id)!, draggable: editando && modo !== 'pessoas',
      data: { ...dados.get(id)!, estado: destaque ? (destaque.has(id) ? 'hl' : 'dim') : 'normal' } as any,
    }));
    if (modo === 'cargos' && m) {
      const grupos = new Map<string, { x1: number; y1: number; x2: number; y2: number }>();
      for (const id of ids) {
        const dep = m.cargos.get(id)?.departamento_id; if (!dep) continue;
        const p = pos.get(id)!; const t = tam(id); const g = grupos.get(dep);
        grupos.set(dep, g ? { x1: Math.min(g.x1, p.x), y1: Math.min(g.y1, p.y), x2: Math.max(g.x2, p.x + t.w), y2: Math.max(g.y2, p.y + t.h) } : { x1: p.x, y1: p.y, x2: p.x + t.w, y2: p.y + t.h });
      }
      for (const [dep, g] of grupos) nodes.unshift({
        id: `grupo:${dep}`, type: 'grupo', position: { x: g.x1 - 16, y: g.y1 - 28 }, draggable: false, selectable: false, zIndex: -1,
        style: { width: g.x2 - g.x1 + 32, height: g.y2 - g.y1 + 44 },
        data: { titulo: m.setores.get(dep)?.nome ?? '', cor: m.corSetor.get(dep) ?? 1, dim: !!destaque },
      });
    }
    const edges: Edge[] = arestas.map(([a, b]) => {
      const no = !!destaque && destaque.has(a) && destaque.has(b);
      return { id: `${a}-${b}`, source: a, target: b, type: 'smoothstep', animated: no,
        style: { stroke: no ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.5)', strokeWidth: no ? 2 : 1.25, opacity: destaque && !no ? 0.25 : 1 },
        markerEnd: { type: MarkerType.ArrowClosed, color: no ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' } };
    });
    return { nodesCalc: nodes, edges };
  }, [vis, pais, dados, editando, modo, m, destaque]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  useEffect(() => setNodes(nodesCalc), [nodesCalc, setNodes]);
  useEffect(() => { const t = setTimeout(() => rf.fitView({ padding: 0.15, duration: 300 }), 60); return () => clearTimeout(t); }, [modo, data, filtroSetor, filtroNivel, soVagos, rf, q.data]);

  // Busca
  const resultados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!m || t.length < 2) return [];
    const r: { tipo: 'setor' | 'cargo' | 'pessoa'; id: string; nome: string }[] = [];
    for (const p of m.pessoas.values()) if (p.nome.toLowerCase().includes(t)) r.push({ tipo: 'pessoa', id: p.id, nome: p.nome });
    for (const c of m.cargos.values()) if (c.nome.toLowerCase().includes(t)) r.push({ tipo: 'cargo', id: c.id, nome: c.nome });
    for (const s of m.setores.values()) if (s.nome.toLowerCase().includes(t)) r.push({ tipo: 'setor', id: s.id, nome: s.nome });
    return r.slice(0, 10);
  }, [busca, m]);

  const focar = useCallback((tipo: 'setor' | 'cargo' | 'pessoa', id: string) => {
    if (!m) return;
    const novoModo = modoDoTipo[tipo];
    setFiltroSetor(null); setFiltroNivel(null); setSoVagos(false); setBusca('');
    setModo(novoModo);
    setTimeout(() => {
      const caminho = caminhoAteTopo(mapaPais(m, novoModo), id);
      setRecolhidos((s) => { const n = new Set(s); caminho.slice(1).forEach((x) => n.delete(x)); return n; });
      setFoco(id);
      setVista((v) => v);
      setTimeout(() => rf.fitView({ nodes: [{ id }], duration: 500, maxZoom: 1.1, padding: 0.6 }), 120);
    }, 0);
  }, [m, rf]);

  // Mover por arrastar (modo edição)
  const moverMut = useEstruturaMutacao('gov_estrutura_mover', 'Estrutura atualizada');
  const onDragStop = useCallback((_: unknown, node: Node) => {
    const alvo = rf.getIntersectingNodes(node).find((n) => n.type === 'card' && n.id !== node.id);
    if (!alvo || alvo.id === pais.get(node.id)) { setNodes(nodesCalc); return; }
    if (criaCiclo(paisTodos, node.id, alvo.id)) { toast.error(modo === 'setores' ? 'Um setor não pode ficar abaixo de um subsetor seu' : 'Um cargo não pode reportar a um subordinado seu'); setNodes(nodesCalc); return; }
    setMover({ id: node.id, novoPai: alvo.id });
  }, [rf, pais, paisTodos, nodesCalc, setNodes, modo]);

  const impacto = useMemo(() => {
    if (!mover || !m) return null;
    const desc = [mover.id, ...descendentes(filhosDe(paisTodos), mover.id)];
    const nome = (id: string | null) => (id ? (modo === 'setores' ? m.setores.get(id)?.nome : m.cargos.get(id)?.nome) ?? '—' : 'Nenhum (topo)');
    let cargos = 0; let pessoas = 0;
    if (modo === 'cargos') { cargos = desc.length; pessoas = desc.reduce((a, id) => a + (m.ocupantes.get(id)?.length ?? 0), 0); }
    else { const set = new Set(desc); cargos = [...m.cargos.values()].filter((c) => c.departamento_id && set.has(c.departamento_id)).length; pessoas = [...m.pessoas.values()].filter((p) => set.has(m.setorDaPessoa.get(p.id) ?? '')).length; }
    return { nome: nome(mover.id), antes: nome(paisTodos.get(mover.id) ?? null), depois: nome(mover.novoPai), cargos, pessoas, sub: desc.length - 1 };
  }, [mover, m, paisTodos, modo]);

  // Exportar
  const exportar = async (fmt: 'png' | 'pdf') => {
    const el = canvasRef.current; if (!el) return;
    try {
      const bg = `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--background').trim()})`;
      const url = await toPng(el, { backgroundColor: bg, pixelRatio: 2, filter: (n) => !(n as HTMLElement).classList?.contains('react-flow__controls') && !(n as HTMLElement).classList?.contains('react-flow__minimap') });
      const nome = `estrutura-${modo}-${data}`;
      if (fmt === 'png') { const a = document.createElement('a'); a.href = url; a.download = `${nome}.png`; a.click(); return; }
      const img = new Image(); img.src = url; await img.decode();
      const pdf = new jsPDF({ orientation: img.width >= img.height ? 'landscape' : 'portrait', unit: 'px', format: [img.width / 2, img.height / 2] });
      pdf.addImage(url, 'PNG', 0, 0, img.width / 2, img.height / 2);
      pdf.save(`${nome}.pdf`);
    } catch { toast.error('Não foi possível exportar a imagem'); }
  };

  // Indicadores
  const kpis = m ? {
    setores: m.setores.size, cargos: m.cargos.size, pessoas: m.pessoas.size,
    vagos: [...m.cargos.keys()].filter((id) => !m.ocupantes.get(id)?.length).length, reqs: reqs.length,
  } : null;
  const niveis = m ? [...new Set([...m.cargos.values()].map((c) => c.nivel).filter((n) => n != null))].sort((a, b) => a! - b!) : [];
  const raizes = [...pais.entries()].filter(([, p]) => !p).map(([id]) => id);
  const vazio = m && m.setores.size === 0 && m.cargos.size === 0;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Network className="h-6 w-6 text-primary" />Estrutura Organizacional</h1>
          <p className="text-sm text-muted-foreground">Setores, cargos e pessoas, com quem se reporta a quem.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Ver estrutura em</Label>
            <Input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value || hoje)} className="h-9 w-40" />
          </div>
          {historico && <Button variant="ghost" size="sm" onClick={() => setData(hoje)}>Hoje</Button>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={vista !== 'fluxo'}><Download className="h-4 w-4 mr-1" />Exportar</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportar('png')}>PNG</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportar('pdf')}><FileText className="h-4 w-4 mr-1" />PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {podeEditar && (
            <Button size="sm" variant={editando ? 'default' : 'outline'} disabled={historico} onClick={() => setEditando(!editando)} title={historico ? 'A edição só vale para a data de hoje' : undefined}>
              <Pencil className="h-4 w-4 mr-1" />{editando ? 'Concluir edição' : 'Editar estrutura'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {([['Setores', kpis?.setores, Building2], ['Cargos', kpis?.cargos, Briefcase], ['Pessoas ativas', kpis?.pessoas, Users], ['Cargos vagos', kpis?.vagos, UserX], ['Requisições em andamento', kpis?.reqs, FileText]] as const).map(([r, v, I]) => (
          <Card key={r}><CardContent className="flex items-center gap-3 p-3">
            <I className="h-5 w-5 text-primary shrink-0" />
            <div>{q.isLoading ? <Skeleton className="h-6 w-10" /> : <div className="text-xl font-bold">{v ?? 0}</div>}<div className="text-xs text-muted-foreground">{r}</div></div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-3">
          <ToggleGroup type="single" value={modo} onValueChange={(v) => v && setModo(v as Modo)} variant="outline" size="sm">
            <ToggleGroupItem value="setores"><Building2 className="h-4 w-4 mr-1" />Setores</ToggleGroupItem>
            <ToggleGroupItem value="cargos"><Briefcase className="h-4 w-4 mr-1" />Cargos</ToggleGroupItem>
            <ToggleGroupItem value="pessoas"><Users className="h-4 w-4 mr-1" />Pessoas</ToggleGroupItem>
          </ToggleGroup>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa, cargo ou setor" className="h-9 pl-8" />
            {resultados.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
                {resultados.map((r) => (
                  <button key={`${r.tipo}-${r.id}`} type="button" onClick={() => focar(r.tipo, r.id)} className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent">
                    <span className="truncate">{r.nome}</span><span className="text-xs text-muted-foreground">{r.tipo}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Select value={filtroSetor ?? TODOS} onValueChange={(v) => setFiltroSetor(v === TODOS ? null : v)}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Setor" /></SelectTrigger>
            <SelectContent><SelectItem value={TODOS}>Todos os setores</SelectItem>{m && [...m.setores.values()].map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filtroNivel ?? TODOS} onValueChange={(v) => setFiltroNivel(v === TODOS ? null : v)} disabled={modo === 'setores'}>
            <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Nível" /></SelectTrigger>
            <SelectContent><SelectItem value={TODOS}>Todos os níveis</SelectItem>{niveis.map((n) => <SelectItem key={n} value={String(n)}>Nível {n}</SelectItem>)}</SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm"><Switch checked={soVagos} onCheckedChange={setSoVagos} disabled={modo === 'pessoas'} />Apenas vagos</label>
          {foco && <Button variant="ghost" size="sm" onClick={() => setFoco(null)}>Limpar destaque</Button>}
          <div className="ml-auto flex items-center gap-2">
            {editando && (
              <>
                <Button size="sm" variant="outline" onClick={() => setSelecao({ tipo: 'setor', id: null })}><Plus className="h-4 w-4 mr-1" />Setor</Button>
                <Button size="sm" variant="outline" onClick={() => setSelecao({ tipo: 'cargo', id: null })}><Plus className="h-4 w-4 mr-1" />Cargo</Button>
              </>
            )}
            <Tabs value={vista} onValueChange={(v) => setVista(v as 'fluxo' | 'lista')}>
              <TabsList className="h-9"><TabsTrigger value="fluxo">Fluxograma</TabsTrigger><TabsTrigger value="lista">Lista</TabsTrigger></TabsList>
            </Tabs>
          </div>
          {editando && modo !== 'pessoas' && <p className="w-full text-xs text-muted-foreground">Arraste um card sobre outro para mudar {modo === 'setores' ? 'o setor pai' : 'a quem o cargo reporta'}. Clique num card para editar.</p>}
          {historico && <p className="w-full text-xs text-muted-foreground">Mostrando quem ocupava cada cargo em {data.split('-').reverse().join('/')}. Setores e cargos aparecem como estão hoje.</p>}
        </CardContent>
      </Card>

      {q.isError ? (
        <Card><CardContent className="p-6 text-sm text-destructive">Não foi possível carregar a estrutura. {(q.error as any)?.message}</CardContent></Card>
      ) : q.isLoading || !m ? (
        <Skeleton className="h-[640px] w-full rounded-lg" />
      ) : vazio ? (
        <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <Network className="h-10 w-10 text-muted-foreground" />
          <div className="font-semibold">A estrutura ainda não foi configurada</div>
          <p className="text-sm text-muted-foreground">Cadastre setores e cargos para ver o fluxograma.</p>
          {podeEditar && <Button asChild><Link to="/rh/configuracoes">Configurar estrutura</Link></Button>}
        </CardContent></Card>
      ) : vista === 'lista' ? (
        <Card><CardContent className="p-3">
          <OrgLista raizes={raizes} filhos={filhos} dados={dados} onAbrir={(id) => setSelecao({ tipo: tipoDoModo[modo], id })} />
        </CardContent></Card>
      ) : (
        <div ref={canvasRef} className="org-flow h-[calc(100vh-320px)] min-h-[520px] w-full overflow-hidden rounded-lg border bg-background">
          <ReactFlow
            nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange}
            onNodeClick={(_, n) => n.type === 'card' && setSelecao({ tipo: tipoDoModo[modo], id: n.id })}
            onNodeMouseEnter={(_, n) => n.type === 'card' && setHover(n.id)} onNodeMouseLeave={() => setHover(null)}
            onNodeDragStop={onDragStop} onPaneClick={() => setFoco(null)}
            nodesConnectable={false} minZoom={0.1} maxZoom={2} fitView proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} color="hsl(var(--border))" />
            <Controls showInteractive={false}>
              <button type="button" className="react-flow__controls-button" title="Ajustar à tela" onClick={() => rf.fitView({ padding: 0.15, duration: 300 })}><Maximize className="h-3 w-3" /></button>
            </Controls>
            <MiniMap pannable zoomable nodeColor={(n) => (n.type === 'card' ? `hsl(var(--org-${(n.data as any).cor}))` : 'transparent')} maskColor="hsl(var(--background) / 0.7)" />
          </ReactFlow>
        </div>
      )}

      {m && <OrgPainel modelo={m as Modelo} selecao={selecao} requisicoes={reqs} podeEditar={podeEditar} editando={editando} onSelecionar={setSelecao} onFechar={() => setSelecao(null)} />}

      <AlertDialog open={!!mover} onOpenChange={(o) => { if (!o) { setMover(null); setNodes(nodesCalc); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar mudança na estrutura</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p><strong>{impacto?.nome}</strong></p>
                <p>{modo === 'setores' ? 'Setor pai' : 'Reporta a'}: <span className="line-through">{impacto?.antes}</span> → <strong>{impacto?.depois}</strong></p>
                <p>Impacto: {impacto?.sub} {modo === 'setores' ? 'subsetor(es)' : 'cargo(s) abaixo'} acompanham a mudança; {impacto?.cargos} cargo(s) e {impacto?.pessoas} pessoa(s) afetados.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={moverMut.isPending} onClick={() => { if (mover) moverMut.mutate({ p_tipo: modo === 'setores' ? 'setor' : 'cargo', p_id: mover.id, p_novo_pai: mover.novoPai }); setMover(null); }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
