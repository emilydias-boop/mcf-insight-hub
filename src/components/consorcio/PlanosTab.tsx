import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Search } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useConsorcioProdutos } from '@/hooks/useConsorcioProdutos';
import {
  useAllConsorcioCreditos,
  useCreateConsorcioCredito,
  useUpdateConsorcioCredito,
  useDeleteConsorcioCredito,
  CONDICOES,
  PRAZOS,
  PARCELA_COLUMNS,
} from '@/hooks/useConsorcioCreditosAdmin';
import { ConsorcioCredito, ConsorcioProduto } from '@/types/consorcioProdutos';
import { formatBRLInput, parseBRLInput, numberToBRLInput } from '@/lib/brlMask';

const brl = (v?: number | null) =>
  typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

export function PlanosTab() {
  const { data: produtos = [] } = useConsorcioProdutos();
  const { data: creditos = [], isLoading } = useAllConsorcioCreditos();
  const create = useCreateConsorcioCredito();
  const update = useUpdateConsorcioCredito();
  const remove = useDeleteConsorcioCredito();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ConsorcioCredito | null>(null);
  const [search, setSearch] = useState('');

  const produtoLabel = (id?: string | null) => {
    const p = produtos.find((x) => x.id === id);
    return p ? `${p.codigo} — ${p.nome}` : '—';
  };

  const ordered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...creditos]
      .sort((a, b) => {
        const pa = produtoLabel(a.produto_id);
        const pb = produtoLabel(b.produto_id);
        if (pa !== pb) return pa.localeCompare(pb);
        return (a.valor_credito || 0) - (b.valor_credito || 0);
      })
      .filter((c) => {
        if (!term) return true;
        return (
          (c.codigo_credito || '').toLowerCase().includes(term) ||
          String(c.valor_credito || '').includes(term.replace(/\D/g, '')) ||
          brl(c.valor_credito).toLowerCase().includes(term)
        );
      });
  }, [creditos, search, produtos]);

  const handleSave = (data: Record<string, any>) => {
    if (editing) {
      update.mutate({ id: editing.id, ...data }, {
        onSuccess: () => { setEditing(null); setShowForm(false); },
      });
    } else {
      create.mutate(data, { onSuccess: () => setShowForm(false) });
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cadastre os planos (créditos) de cada produto com os valores oficiais de parcela por condição e prazo.
        </p>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo plano
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar por código ou valor do crédito..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {showForm && (
        <PlanoForm
          produtos={produtos}
          initial={editing}
          onCancel={() => { setEditing(null); setShowForm(false); }}
          onSave={handleSave}
          isPending={create.isPending || update.isPending}
        />
      )}

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>}
        {!isLoading && ordered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum plano cadastrado.</p>
        )}
        {ordered.map((c) => (
          <div key={c.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg text-sm">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {c.codigo_credito} — {brl(c.valor_credito)}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                Produto: <strong>{produtoLabel(c.produto_id)}</strong> ·
                {' '}Conv. 240: {brl(c.parcela_1a_12a_conv_240)} / {brl(c.parcela_demais_conv_240)}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setShowForm(true); }}>
              Editar
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (confirm(`Remover plano ${c.codigo_credito}?`)) remove.mutate(c.id);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </>
  );
}

function PlanoForm({
  produtos,
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  produtos: ConsorcioProduto[];
  initial: ConsorcioCredito | null;
  onSave: (data: Record<string, any>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [produtoId, setProdutoId] = useState(initial?.produto_id || '');
  const [codigo, setCodigo] = useState(initial?.codigo_credito || '');
  const [valor, setValor] = useState(numberToBRLInput(initial?.valor_credito));
  const [ativo, setAtivo] = useState(initial?.ativo ?? true);
  const [parcelas, setParcelas] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    PARCELA_COLUMNS.forEach((col) => {
      init[col] = numberToBRLInput((initial as any)?.[col]);
    });
    return init;
  });

  const setParcela = (col: string, raw: string) =>
    setParcelas((p) => ({ ...p, [col]: formatBRLInput(raw) }));

  const canSave = !!produtoId && !!codigo.trim() && parseBRLInput(valor) > 0;

  const handleSubmit = () => {
    if (!canSave) return;
    const payload: Record<string, any> = {
      produto_id: produtoId,
      codigo_credito: codigo.trim(),
      valor_credito: parseBRLInput(valor),
      ativo,
    };
    PARCELA_COLUMNS.forEach((col) => {
      const v = parcelas[col];
      payload[col] = v ? parseBRLInput(v) : null;
    });
    onSave(payload);
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <h4 className="font-semibold text-sm">{initial ? 'Editar plano' : 'Novo plano'}</h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Produto *</Label>
          <Select value={produtoId} onValueChange={setProdutoId}>
            <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
            <SelectContent>
              {produtos.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Código do crédito *</Label>
          <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex: C150" />
        </div>
        <div className="space-y-2">
          <Label>Valor do crédito (R$) *</Label>
          <Input
            inputMode="numeric"
            value={valor}
            onChange={(e) => setValor(formatBRLInput(e.target.value))}
            placeholder="150.000,00"
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch checked={ativo} onCheckedChange={setAtivo} />
          <Label>Ativo</Label>
        </div>
      </div>

      <ParcelaGrid title="Parcela 1ª à 12ª" prefix="parcela_1a_12a" values={parcelas} onChange={setParcela} />
      <ParcelaGrid title="Demais parcelas" prefix="parcela_demais" values={parcelas} onChange={setParcela} />

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isPending || !canSave}>
          {isPending ? 'Salvando...' : 'Salvar plano'}
        </Button>
      </div>
    </div>
  );
}

function ParcelaGrid({
  title,
  prefix,
  values,
  onChange,
}: {
  title: string;
  prefix: string;
  values: Record<string, string>;
  onChange: (col: string, raw: string) => void;
}) {
  return (
    <div className="space-y-2">
      <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h5>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="text-left font-medium pb-1">Condição</th>
              {PRAZOS.map((p) => (
                <th key={p} className="text-left font-medium pb-1">{p} meses</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CONDICOES.map((c) => (
              <tr key={c.key}>
                <td className="pr-2 py-1 text-xs whitespace-nowrap">{c.label}</td>
                {PRAZOS.map((p) => {
                  const col = `${prefix}_${c.key}_${p}`;
                  return (
                    <td key={col} className="py-1 pr-2">
                      <Input
                        inputMode="numeric"
                        className="h-8"
                        value={values[col] || ''}
                        onChange={(e) => onChange(col, e.target.value)}
                        placeholder="0,00"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
