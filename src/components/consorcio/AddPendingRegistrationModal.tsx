import { useState } from 'react';
import { Loader2, Search, ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useCreateManualPendingRegistration,
  type CreateManualPendingInput,
} from '@/hooks/useConsorcioPendingRegistrations';
import { useConsorcioVendedorOptions } from '@/hooks/useConsorcioConfigOptions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Origens da BU Consórcio (mesma fonte usada em useConsorcioPostMeeting)
const CONSORCIO_BU = 'consorcio';

function useConsorcioOriginIds() {
  return useQuery({
    queryKey: ['consorcio-bu-origin-ids'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bu_origin_mapping')
        .select('entity_id')
        .eq('bu', CONSORCIO_BU)
        .eq('entity_type', 'origin');
      if (error) throw error;
      return (data || []).map((r: any) => r.entity_id as string);
    },
  });
}

interface DealMatch {
  deal_id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  cpf: string | null;
  cnpj: string | null;
  origin_label: string | null;
  stage_name: string | null;
}

function useConsorcioLeadSearch(query: string, originIds: string[], enabled: boolean) {
  const term = query.trim();
  return useQuery({
    queryKey: ['consorcio-lead-search', term.toLowerCase(), originIds.length],
    enabled: enabled && term.length >= 2 && originIds.length > 0,
    staleTime: 15_000,
    queryFn: async (): Promise<DealMatch[]> => {
      const like = `%${term}%`;
      const digits = term.replace(/\D/g, '');

      // Buscar contatos por nome/email/telefone/cpf/cnpj
      let cq = supabase
        .from('crm_contacts')
        .select('id, name, email, phone')
        .eq('is_archived', false)
        .limit(30);
      if (digits.length >= 4) {
        cq = cq.or(
          `name.ilike.${like},email.ilike.${like},phone.ilike.%${digits}%`,
        );
      } else {
        cq = cq.or(`name.ilike.${like},email.ilike.${like}`);
      }
      const { data: contacts } = await cq;
      const contactIds = (contacts || []).map((c: any) => c.id);
      if (!contactIds.length) return [];

      const contactById = new Map<string, any>();
      (contacts || []).forEach((c: any) => contactById.set(c.id, c));

      const { data: deals } = await supabase
        .from('crm_deals')
        .select('id, contact_id, stage_id, origin_id, created_at')
        .in('contact_id', contactIds)
        .in('origin_id', originIds)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(30);
      if (!deals || deals.length === 0) return [];

      const originIdsUsed = Array.from(new Set(deals.map((d: any) => d.origin_id).filter(Boolean)));
      const stageIdsUsed = Array.from(new Set(deals.map((d: any) => d.stage_id).filter(Boolean)));
      const [{ data: origins }, { data: stages }] = await Promise.all([
        originIdsUsed.length
          ? supabase.from('crm_origins').select('id, display_name, name').in('id', originIdsUsed)
          : Promise.resolve({ data: [] as any[] }),
        stageIdsUsed.length
          ? supabase.from('crm_stages').select('id, name').in('id', stageIdsUsed)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const originById = new Map<string, string>();
      (origins || []).forEach((o: any) => originById.set(o.id, o.display_name || o.name));
      const stageById = new Map<string, string>();
      (stages || []).forEach((s: any) => stageById.set(s.id, s.name));

      // Dedup por contato (manter o deal mais recente)
      const seen = new Set<string>();
      const out: DealMatch[] = [];
      for (const d of deals as any[]) {
        if (seen.has(d.contact_id)) continue;
        seen.add(d.contact_id);
        const c = contactById.get(d.contact_id) || {};
        out.push({
          deal_id: d.id,
          contact_name: c.name || null,
          contact_email: c.email || null,
          contact_phone: c.phone || null,
          cpf: null,
          cnpj: null,
          origin_label: originById.get(d.origin_id) || null,
          stage_name: stageById.get(d.stage_id) || null,
        });
      }
      return out;
    },
  });
}

export function AddPendingRegistrationModal({ open, onOpenChange }: Props) {
  const create = useCreateManualPendingRegistration();
  const { data: vendedorOptions = [] } = useConsorcioVendedorOptions();
  const [tipoPessoa, setTipoPessoa] = useState<'pf' | 'pj'>('pf');
  const [tipoProduto, setTipoProduto] = useState<'select' | 'parcelinha'>('select');
  const [closerId, setCloserId] = useState<string>('');
  const [origem, setOrigem] = useState('');
  const [nome, setNome] = useState('');
  const [doc, setDoc] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [valorCredito, setValorCredito] = useState('');
  const [prazo, setPrazo] = useState('');
  const [qtdCotas, setQtdCotas] = useState('1');
  const [empresaPaga, setEmpresaPaga] = useState(false);
  const [tipoContrato, setTipoContrato] = useState<'normal' | 'intercalado' | 'intercalado_impar'>('normal');
  const [qtdParcelas, setQtdParcelas] = useState('');
  const [aceiteDate, setAceiteDate] = useState(new Date().toISOString().split('T')[0]);
  const [obs, setObs] = useState('');
  const [dealId, setDealId] = useState<string | null>(null);
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const { data: originIds = [] } = useConsorcioOriginIds();
  const { data: leadMatches = [], isFetching: isSearching } = useConsorcioLeadSearch(
    leadSearch,
    originIds,
    leadOpen,
  );

  const reset = () => {
    setTipoPessoa('pf');
    setTipoProduto('select');
    setCloserId('');
    setOrigem('');
    setNome('');
    setDoc('');
    setTelefone('');
    setEmail('');
    setValorCredito('');
    setPrazo('');
    setQtdCotas('1');
    setEmpresaPaga(false);
    setTipoContrato('normal');
    setQtdParcelas('');
    setAceiteDate(new Date().toISOString().split('T')[0]);
    setObs('');
    setDealId(null);
    setLeadSearch('');
  };

  const handleSelectLead = (m: DealMatch) => {
    const isPJ = !!m.cnpj && !m.cpf;
    setTipoPessoa(isPJ ? 'pj' : 'pf');
    setNome(m.contact_name || '');
    setDoc((isPJ ? m.cnpj : m.cpf) || '');
    setTelefone(m.contact_phone || '');
    setEmail(m.contact_email || '');
    if (m.origin_label) setOrigem(m.origin_label);
    setDealId(m.deal_id);
    setLeadOpen(false);
  };

  const handleUseAsNew = () => {
    setNome(leadSearch.trim());
    setDealId(null);
    setLeadOpen(false);
  };

  const handleSubmit = async () => {
    if (!origem.trim() || !nome.trim()) return;
    const closer = vendedorOptions.find((v: any) => v.id === closerId);
    const qtd = Math.max(1, Math.min(50, Number(qtdCotas) || 1));
    const baseInput: CreateManualPendingInput = {
      tipo_pessoa: tipoPessoa,
      vendedor_name: origem.trim(),
      [tipoPessoa === 'pf' ? 'nome_completo' : 'razao_social']: nome.trim(),
      [tipoPessoa === 'pf' ? 'cpf' : 'cnpj']: doc.trim() || undefined,
      telefone: telefone.trim() || undefined,
      email: email.trim() || undefined,
      valor_credito: valorCredito ? Number(valorCredito) : undefined,
      prazo_meses: prazo ? Number(prazo) : undefined,
      empresa_paga_parcelas: empresaPaga ? 'sim' : 'nao',
      tipo_contrato: empresaPaga ? tipoContrato : undefined,
      parcelas_pagas_empresa: empresaPaga && qtdParcelas ? Number(qtdParcelas) : undefined,
      aceite_date: aceiteDate || undefined,
      observacoes: obs.trim() || undefined,
      deal_id: dealId,
      tipo_produto: tipoProduto,
      vendedor_id: closerId || undefined,
      vendedor_name_cota: closer ? ((closer as any).name ?? (closer as any).nome) : undefined,
    };
    for (let i = 0; i < qtd; i++) {
      const note = qtd > 1
        ? `${baseInput.observacoes ? baseInput.observacoes + ' · ' : ''}Cota ${i + 1}/${qtd}`
        : baseInput.observacoes;
      await create.mutateAsync({ ...baseInput, observacoes: note });
    }
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar cadastro pendente manual</DialogTitle>
          <DialogDescription>
            Use para cadastrar cotas que não passaram pelo closer no CRM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tipo de pessoa</Label>
            <Tabs value={tipoPessoa} onValueChange={(v) => setTipoPessoa(v as 'pf' | 'pj')} className="mt-1">
              <TabsList>
                <TabsTrigger value="pf">Pessoa Física</TabsTrigger>
                <TabsTrigger value="pj">Pessoa Jurídica</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Tipo de produto *</Label>
              <Tabs value={tipoProduto} onValueChange={(v) => setTipoProduto(v as 'select' | 'parcelinha')} className="mt-1">
                <TabsList>
                  <TabsTrigger value="select">Select</TabsTrigger>
                  <TabsTrigger value="parcelinha">Parcelinha</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div>
              <Label>Closer responsável</Label>
              <Select value={closerId} onValueChange={setCloserId}>
                <SelectTrigger><SelectValue placeholder="Selecionar closer..." /></SelectTrigger>
                <SelectContent>
                  {vendedorOptions.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>{v.name ?? v.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Origem / Parceiro *</Label>
            <Input
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
              placeholder="Ex.: Parceiro Novembro, Indicação João, Carteira própria"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{tipoPessoa === 'pf' ? 'Nome completo *' : 'Razão social *'}</Label>
              <Popover open={leadOpen} onOpenChange={setLeadOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    <span className={nome ? '' : 'text-muted-foreground'}>
                      {nome || 'Buscar lead Consórcio ou digitar...'}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[360px]" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Buscar por nome, CPF/CNPJ, telefone ou e-mail..."
                      value={leadSearch}
                      onValueChange={setLeadSearch}
                    />
                    <CommandList>
                      {leadSearch.trim().length < 2 ? (
                        <CommandEmpty>Digite ao menos 2 caracteres.</CommandEmpty>
                      ) : isSearching ? (
                        <div className="py-6 flex justify-center">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : leadMatches.length === 0 ? (
                        <CommandEmpty>
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Nenhum lead encontrado.</p>
                            <Button size="sm" variant="secondary" onClick={handleUseAsNew}>
                              Usar "{leadSearch.trim()}" como novo cadastro
                            </Button>
                          </div>
                        </CommandEmpty>
                      ) : (
                        <CommandGroup heading="Leads no CRM Consórcio">
                          {leadMatches.map((m) => (
                            <CommandItem
                              key={m.deal_id}
                              value={m.deal_id}
                              onSelect={() => handleSelectLead(m)}
                              className="flex-col items-start gap-0.5"
                            >
                              <span className="font-medium text-sm">{m.contact_name || '—'}</span>
                              <span className="text-xs text-muted-foreground">
                                {(m.cpf || m.cnpj || 'sem doc')} · {m.contact_phone || 's/ tel'} · {m.origin_label || '—'}
                                {m.stage_name ? ` · ${m.stage_name}` : ''}
                              </span>
                            </CommandItem>
                          ))}
                          <div className="border-t mt-1 pt-1">
                            <CommandItem value="__use_as_new__" onSelect={handleUseAsNew}>
                              <Search className="h-3.5 w-3.5 mr-2" />
                              Usar "{leadSearch.trim()}" como novo cadastro
                            </CommandItem>
                          </div>
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {nome && (
                <Input
                  className="mt-2"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Editar nome..."
                />
              )}
            </div>
            <div>
              <Label>{tipoPessoa === 'pf' ? 'CPF' : 'CNPJ'}</Label>
              <Input value={doc} onChange={(e) => setDoc(e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Valor da cota (R$)</Label>
              <Input
                type="number"
                value={valorCredito}
                onChange={(e) => setValorCredito(e.target.value)}
                placeholder="500000"
              />
            </div>
            <div>
              <Label>Prazo (meses)</Label>
              <Input
                type="number"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                placeholder="240"
              />
            </div>
            <div>
              <Label>Data de aceite</Label>
              <Input type="date" value={aceiteDate} onChange={(e) => setAceiteDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Quantidade de cotas</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={qtdCotas}
                onChange={(e) => setQtdCotas(e.target.value)}
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Cria N cadastros pendentes idênticos (ex.: 5× R$ 120.000 = R$ 600.000 total).
              </p>
            </div>
            {Number(qtdCotas) > 1 && valorCredito && (
              <div className="sm:col-span-2 flex items-end">
                <p className="text-sm text-muted-foreground">
                  Total: <span className="font-medium text-foreground">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                      .format(Number(valorCredito) * Number(qtdCotas))}
                  </span>
                  {' '}({qtdCotas}× {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                    .format(Number(valorCredito))})
                </p>
              </div>
            )}
          </div>

          <div className="border rounded-md p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="cursor-pointer">Empresa paga parcelas?</Label>
                <p className="text-xs text-muted-foreground">Marque para registrar as parcelas que a empresa cobrirá.</p>
              </div>
              <Switch checked={empresaPaga} onCheckedChange={setEmpresaPaga} />
            </div>
            {empresaPaga && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de contrato</Label>
                  <Select value={tipoContrato} onValueChange={(v) => setTipoContrato(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal (primeiras N)</SelectItem>
                      <SelectItem value="intercalado">Intercalado par</SelectItem>
                      <SelectItem value="intercalado_impar">Intercalado ímpar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Qtde de parcelas (empresa)</Label>
                  <Input
                    type="number"
                    value={qtdParcelas}
                    onChange={(e) => setQtdParcelas(e.target.value)}
                    placeholder="Ex.: 2"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={3}
              placeholder="Detalhes adicionais sobre o cadastro..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={!origem.trim() || !nome.trim() || create.isPending}
          >
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar pendente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}