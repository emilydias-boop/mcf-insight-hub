import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import {
  useConsorcioTipoOptions,
  useCreateConsorcioTipoOption,
  useUpdateConsorcioTipoOption,
  useDeleteConsorcioTipoOption,
  useConsorcioCategoriaOptions,
  useCreateConsorcioCategoriaOption,
  useUpdateConsorcioCategoriaOption,
  useDeleteConsorcioCategoriaOption,
  useConsorcioOrigemOptions,
  useCreateConsorcioOrigemOption,
  useUpdateConsorcioOrigemOption,
  useDeleteConsorcioOrigemOption,
  useConsorcioVendedorOptions,
  useCreateConsorcioVendedorOption,
  useUpdateConsorcioVendedorOption,
  useDeleteConsorcioVendedorOption,
  ConsorcioTipoOption,
  ConsorcioCategoriaOption,
  ConsorcioOrigemOption,
  ConsorcioVendedorOption,
} from '@/hooks/useConsorcioConfigOptions';
import {
  useConsorcioObjetivoOptions,
  useCreateConsorcioObjetivoOption,
  useUpdateConsorcioObjetivoOption,
  useDeleteConsorcioObjetivoOption,
  ConsorcioObjetivoOption,
} from '@/hooks/useConsorcioObjetivoOptions';
import {
  useConsorcioProdutos,
  useCreateConsorcioProduto,
  useUpdateConsorcioProduto,
  useDeleteConsorcioProduto,
} from '@/hooks/useConsorcioProdutos';
import { ConsorcioProduto } from '@/types/consorcioProdutos';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const COLOR_PRESETS = [
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
];

interface ConsorcioConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConsorcioConfigModal({ open, onOpenChange }: ConsorcioConfigModalProps) {
  const [activeTab, setActiveTab] = useState('tipos');

  // Tipo hooks
  const { data: tipos = [] } = useConsorcioTipoOptions();
  const createTipo = useCreateConsorcioTipoOption();
  const updateTipo = useUpdateConsorcioTipoOption();
  const deleteTipo = useDeleteConsorcioTipoOption();

  // Categoria hooks
  const { data: categorias = [] } = useConsorcioCategoriaOptions();
  const createCategoria = useCreateConsorcioCategoriaOption();
  const updateCategoria = useUpdateConsorcioCategoriaOption();
  const deleteCategoria = useDeleteConsorcioCategoriaOption();

  // Origem hooks
  const { data: origens = [] } = useConsorcioOrigemOptions();
  const createOrigem = useCreateConsorcioOrigemOption();
  const updateOrigem = useUpdateConsorcioOrigemOption();
  const deleteOrigem = useDeleteConsorcioOrigemOption();

  // Vendedor hooks
  const { data: vendedores = [] } = useConsorcioVendedorOptions();
  const createVendedor = useCreateConsorcioVendedorOption();
  const updateVendedor = useUpdateConsorcioVendedorOption();
  const deleteVendedor = useDeleteConsorcioVendedorOption();

  // New item states
  const [newTipo, setNewTipo] = useState({ name: '', label: '', color: '#3B82F6' });
  const [newCategoria, setNewCategoria] = useState({ name: '', label: '', color: '#3B82F6' });
  const [newOrigem, setNewOrigem] = useState({ name: '', label: '' });
  const [newVendedor, setNewVendedor] = useState('');

  const handleAddTipo = () => {
    if (!newTipo.name.trim() || !newTipo.label.trim()) return;
    createTipo.mutate({
      name: newTipo.name.toLowerCase().replace(/\s+/g, '_'),
      label: newTipo.label,
      color: newTipo.color,
      display_order: tipos.length
    });
    setNewTipo({ name: '', label: '', color: '#3B82F6' });
  };

  const handleAddCategoria = () => {
    if (!newCategoria.name.trim() || !newCategoria.label.trim()) return;
    createCategoria.mutate({
      name: newCategoria.name.toLowerCase().replace(/\s+/g, '_'),
      label: newCategoria.label,
      color: newCategoria.color,
      display_order: categorias.length
    });
    setNewCategoria({ name: '', label: '', color: '#3B82F6' });
  };

  const handleAddOrigem = () => {
    if (!newOrigem.name.trim() || !newOrigem.label.trim()) return;
    createOrigem.mutate({
      name: newOrigem.name.toLowerCase().replace(/\s+/g, '_'),
      label: newOrigem.label,
      display_order: origens.length
    });
    setNewOrigem({ name: '', label: '' });
  };

  const handleAddVendedor = () => {
    if (!newVendedor.trim()) return;
    createVendedor.mutate({
      name: newVendedor.trim(),
      display_order: vendedores.length
    });
    setNewVendedor('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações do Consórcio</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="tipos">Tipos</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
            <TabsTrigger value="origens">Origens</TabsTrigger>
            <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
            <TabsTrigger value="objetivos">Objetivos</TabsTrigger>
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
          </TabsList>

          {/* Tipos Tab */}
          <TabsContent value="tipos" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Gerencie os tipos de produto (ex: Select, Parcelinha)
            </p>

            <div className="space-y-2">
              {tipos.map((tipo: ConsorcioTipoOption) => (
                <TipoItem
                  key={tipo.id}
                  item={tipo}
                  onUpdate={(data) => updateTipo.mutate({ id: tipo.id, ...data })}
                  onDelete={() => deleteTipo.mutate(tipo.id)}
                />
              ))}
            </div>

            <div className="flex gap-2 items-center pt-4 border-t">
              <Input
                placeholder="Nome interno (ex: premium)"
                value={newTipo.name}
                onChange={(e) => setNewTipo(prev => ({ ...prev, name: e.target.value }))}
                className="flex-1"
              />
              <Input
                placeholder="Label (ex: Premium)"
                value={newTipo.label}
                onChange={(e) => setNewTipo(prev => ({ ...prev, label: e.target.value }))}
                className="flex-1"
              />
              <ColorPicker
                value={newTipo.color}
                onChange={(color) => setNewTipo(prev => ({ ...prev, color }))}
              />
              <Button onClick={handleAddTipo} size="icon" disabled={createTipo.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Categorias Tab */}
          <TabsContent value="categorias" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Gerencie as categorias (ex: Inside Consórcio, Life Consórcio)
            </p>

            <div className="space-y-2">
              {categorias.map((categoria: ConsorcioCategoriaOption) => (
                <CategoriaItem
                  key={categoria.id}
                  item={categoria}
                  onUpdate={(data) => updateCategoria.mutate({ id: categoria.id, ...data })}
                  onDelete={() => deleteCategoria.mutate(categoria.id)}
                />
              ))}
            </div>

            <div className="flex gap-2 items-center pt-4 border-t">
              <Input
                placeholder="Nome interno (ex: gold)"
                value={newCategoria.name}
                onChange={(e) => setNewCategoria(prev => ({ ...prev, name: e.target.value }))}
                className="flex-1"
              />
              <Input
                placeholder="Label (ex: Gold)"
                value={newCategoria.label}
                onChange={(e) => setNewCategoria(prev => ({ ...prev, label: e.target.value }))}
                className="flex-1"
              />
              <ColorPicker
                value={newCategoria.color}
                onChange={(color) => setNewCategoria(prev => ({ ...prev, color }))}
              />
              <Button onClick={handleAddCategoria} size="icon" disabled={createCategoria.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Origens Tab */}
          <TabsContent value="origens" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Gerencie as origens (ex: Sócio, GR, Indicação)
            </p>

            <div className="space-y-2">
              {origens.map((origem: ConsorcioOrigemOption) => (
                <OrigemItem
                  key={origem.id}
                  item={origem}
                  onUpdate={(data) => updateOrigem.mutate({ id: origem.id, ...data })}
                  onDelete={() => deleteOrigem.mutate(origem.id)}
                />
              ))}
            </div>

            <div className="flex gap-2 items-center pt-4 border-t">
              <Input
                placeholder="Nome interno (ex: parceiro)"
                value={newOrigem.name}
                onChange={(e) => setNewOrigem(prev => ({ ...prev, name: e.target.value }))}
                className="flex-1"
              />
              <Input
                placeholder="Label (ex: Parceiro)"
                value={newOrigem.label}
                onChange={(e) => setNewOrigem(prev => ({ ...prev, label: e.target.value }))}
                className="flex-1"
              />
              <Button onClick={handleAddOrigem} size="icon" disabled={createOrigem.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Vendedores Tab */}
          <TabsContent value="vendedores" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Gerencie os vendedores responsáveis (ex: Grimaldo Neto, Diego Carielo)
            </p>

            <div className="space-y-2">
              {vendedores.map((vendedor: ConsorcioVendedorOption) => (
                <VendedorItem
                  key={vendedor.id}
                  item={vendedor}
                  onUpdate={(data) => updateVendedor.mutate({ id: vendedor.id, ...data })}
                  onDelete={() => deleteVendedor.mutate(vendedor.id)}
                />
              ))}
            </div>

            <div className="flex gap-2 items-center pt-4 border-t">
              <Input
                placeholder="Nome do vendedor"
                value={newVendedor}
                onChange={(e) => setNewVendedor(e.target.value)}
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddVendedor())}
              />
              <Button onClick={handleAddVendedor} size="icon" disabled={createVendedor.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Objetivos Tab */}
          <TabsContent value="objetivos" className="space-y-4">
            <ObjetivosTab />
          </TabsContent>

          {/* Produtos Tab */}
          <TabsContent value="produtos" className="space-y-4">
            <ProdutosTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ============ Objetivos Tab ============

function ObjetivosTab() {
  const { data: objetivos = [] } = useConsorcioObjetivoOptions();
  const create = useCreateConsorcioObjetivoOption();
  const update = useUpdateConsorcioObjetivoOption();
  const remove = useDeleteConsorcioObjetivoOption();
  const [novo, setNovo] = useState({ name: '', label: '' });

  const handleAdd = () => {
    if (!novo.name.trim() || !novo.label.trim()) return;
    create.mutate({
      name: novo.name.toLowerCase().replace(/\s+/g, '_'),
      label: novo.label,
      display_order: objetivos.length,
    });
    setNovo({ name: '', label: '' });
  };

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Gerencie os objetivos da carta (ex: Imóvel, Auto, Pesado). Os produtos cadastrados serão filtrados por objetivo.
      </p>
      <div className="space-y-2">
        {objetivos.map((o: ConsorcioObjetivoOption) => (
          <ObjetivoItem
            key={o.id}
            item={o}
            onUpdate={(data) => update.mutate({ id: o.id, ...data })}
            onDelete={() => remove.mutate(o.id)}
          />
        ))}
      </div>
      <div className="flex gap-2 items-center pt-4 border-t">
        <Input
          placeholder="Nome interno (ex: pesado)"
          value={novo.name}
          onChange={(e) => setNovo((p) => ({ ...p, name: e.target.value }))}
          className="flex-1"
        />
        <Input
          placeholder="Label (ex: Pesado)"
          value={novo.label}
          onChange={(e) => setNovo((p) => ({ ...p, label: e.target.value }))}
          className="flex-1"
        />
        <Button onClick={handleAdd} size="icon" disabled={create.isPending}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}

function ObjetivoItem({
  item,
  onUpdate,
  onDelete,
}: {
  item: ConsorcioObjetivoOption;
  onUpdate: (data: Partial<ConsorcioObjetivoOption>) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(item.label);
  return (
    <div className="flex gap-2 items-center p-2 bg-muted/50 rounded-lg">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => label !== item.label && onUpdate({ label })}
        className="flex-1"
      />
      <Button variant="ghost" size="icon" onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

// ============ Produtos Tab ============

function ProdutosTab() {
  const { data: produtos = [] } = useConsorcioProdutos();
  const { data: objetivos = [] } = useConsorcioObjetivoOptions();
  const create = useCreateConsorcioProduto();
  const update = useUpdateConsorcioProduto();
  const remove = useDeleteConsorcioProduto();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ConsorcioProduto | null>(null);

  const handleSave = (data: any) => {
    if (editing) {
      update.mutate({ id: editing.id, ...data }, {
        onSuccess: () => { setEditing(null); setShowForm(false); }
      });
    } else {
      create.mutate(data, {
        onSuccess: () => setShowForm(false)
      });
    }
  };

  const objetivoLabel = (id?: string | null) =>
    objetivos.find((o) => o.id === id)?.label || '—';

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Cadastre produtos por objetivo. O sistema usará automaticamente o produto correto conforme objetivo + valor de crédito + tipo.
        </p>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo produto
        </Button>
      </div>

      {showForm && (
        <ProdutoForm
          objetivos={objetivos}
          initial={editing}
          onCancel={() => { setEditing(null); setShowForm(false); }}
          onSave={handleSave}
          isPending={create.isPending || update.isPending}
        />
      )}

      <div className="space-y-2">
        {produtos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto cadastrado.</p>
        )}
        {produtos.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg text-sm">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {p.codigo} — {p.nome}
              </div>
              <div className="text-xs text-muted-foreground">
                Objetivo: <strong>{objetivoLabel(p.objetivo_option_id)}</strong> ·
                Faixa: R$ {p.faixa_credito_min.toLocaleString('pt-BR')} – R$ {p.faixa_credito_max.toLocaleString('pt-BR')} ·
                Taxa antecipada: {p.taxa_antecipada_percentual}% ({p.taxa_antecipada_tipo === 'dividida_12' ? 'dividida em 12' : '1ª parcela'}) ·
                Prazo máx: {p.prazo_maximo_venda ?? '—'}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setEditing(p); setShowForm(true); }}>
              Editar
            </Button>
            <Button variant="ghost" size="icon" onClick={() => {
              if (confirm(`Remover produto ${p.codigo}?`)) remove.mutate(p.id);
            }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </>
  );
}

function ProdutoForm({
  objetivos,
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  objetivos: ConsorcioObjetivoOption[];
  initial: ConsorcioProduto | null;
  onSave: (data: any) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    codigo: initial?.codigo || '',
    nome: initial?.nome || '',
    objetivo_option_id: initial?.objetivo_option_id || objetivos[0]?.id || '',
    faixa_credito_min: initial?.faixa_credito_min ?? 0,
    faixa_credito_max: initial?.faixa_credito_max ?? 0,
    taxa_antecipada_percentual: initial?.taxa_antecipada_percentual ?? 1.2,
    taxa_antecipada_tipo: (initial?.taxa_antecipada_tipo || 'dividida_12') as 'primeira_parcela' | 'dividida_12',
    taxa_adm_200: initial?.taxa_adm_200 ?? 20,
    taxa_adm_220: initial?.taxa_adm_220 ?? 22,
    taxa_adm_240: initial?.taxa_adm_240 ?? 25,
    fundo_reserva: initial?.fundo_reserva ?? 2,
    seguro_vida_percentual: initial?.seguro_vida_percentual ?? 0.0610,
    prazo_maximo_venda: initial?.prazo_maximo_venda ?? 240,
  });

  const set = (k: keyof typeof form, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const submit = () => {
    if (!form.codigo.trim() || !form.nome.trim() || !form.objetivo_option_id) return;
    onSave(form);
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Código">
          <Input value={form.codigo} onChange={(e) => set('codigo', e.target.value)} />
        </Field>
        <Field label="Nome">
          <Input value={form.nome} onChange={(e) => set('nome', e.target.value)} />
        </Field>
        <Field label="Objetivo">
          <Select value={form.objetivo_option_id} onValueChange={(v) => set('objetivo_option_id', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {objetivos.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Tipo de taxa antecipada">
          <Select value={form.taxa_antecipada_tipo} onValueChange={(v: any) => set('taxa_antecipada_tipo', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="primeira_parcela">Cobrar na 1ª parcela</SelectItem>
              <SelectItem value="dividida_12">Diluída em 12</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Faixa crédito mínimo (R$)">
          <Input type="number" value={form.faixa_credito_min} onChange={(e) => set('faixa_credito_min', Number(e.target.value))} />
        </Field>
        <Field label="Faixa crédito máximo (R$)">
          <Input type="number" value={form.faixa_credito_max} onChange={(e) => set('faixa_credito_max', Number(e.target.value))} />
        </Field>
        <Field label="Taxa antecipada (%)">
          <Input type="number" step="0.01" value={form.taxa_antecipada_percentual} onChange={(e) => set('taxa_antecipada_percentual', Number(e.target.value))} />
        </Field>
        <Field label="Prazo máximo de venda (meses)">
          <Input type="number" value={form.prazo_maximo_venda} onChange={(e) => set('prazo_maximo_venda', Number(e.target.value))} />
        </Field>
        <Field label="Taxa adm 200m (%)">
          <Input type="number" step="0.01" value={form.taxa_adm_200} onChange={(e) => set('taxa_adm_200', Number(e.target.value))} />
        </Field>
        <Field label="Taxa adm 220m (%)">
          <Input type="number" step="0.01" value={form.taxa_adm_220} onChange={(e) => set('taxa_adm_220', Number(e.target.value))} />
        </Field>
        <Field label="Taxa adm 240m (%)">
          <Input type="number" step="0.01" value={form.taxa_adm_240} onChange={(e) => set('taxa_adm_240', Number(e.target.value))} />
        </Field>
        <Field label="Fundo reserva (%)">
          <Input type="number" step="0.01" value={form.fundo_reserva} onChange={(e) => set('fundo_reserva', Number(e.target.value))} />
        </Field>
        <Field label="Seguro vida (%)">
          <Input type="number" step="0.0001" value={form.seguro_vida_percentual} onChange={(e) => set('seguro_vida_percentual', Number(e.target.value))} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={submit} disabled={isPending}>
          {initial ? 'Salvar alterações' : 'Criar produto'}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

// ============ Item Components ============

interface TipoItemProps {
  item: ConsorcioTipoOption;
  onUpdate: (data: Partial<ConsorcioTipoOption>) => void;
  onDelete: () => void;
}

function TipoItem({ item, onUpdate, onDelete }: TipoItemProps) {
  const [label, setLabel] = useState(item.label);

  return (
    <div className="flex gap-2 items-center p-2 bg-muted/50 rounded-lg">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => label !== item.label && onUpdate({ label })}
        className="flex-1"
      />
      <ColorPicker
        value={item.color}
        onChange={(color) => onUpdate({ color })}
      />
      <Button variant="ghost" size="icon" onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

interface CategoriaItemProps {
  item: ConsorcioCategoriaOption;
  onUpdate: (data: Partial<ConsorcioCategoriaOption>) => void;
  onDelete: () => void;
}

function CategoriaItem({ item, onUpdate, onDelete }: CategoriaItemProps) {
  const [label, setLabel] = useState(item.label);

  return (
    <div className="flex gap-2 items-center p-2 bg-muted/50 rounded-lg">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => label !== item.label && onUpdate({ label })}
        className="flex-1"
      />
      <ColorPicker
        value={item.color}
        onChange={(color) => onUpdate({ color })}
      />
      <Button variant="ghost" size="icon" onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

interface OrigemItemProps {
  item: ConsorcioOrigemOption;
  onUpdate: (data: Partial<ConsorcioOrigemOption>) => void;
  onDelete: () => void;
}

function OrigemItem({ item, onUpdate, onDelete }: OrigemItemProps) {
  const [label, setLabel] = useState(item.label);

  return (
    <div className="flex gap-2 items-center p-2 bg-muted/50 rounded-lg">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => label !== item.label && onUpdate({ label })}
        className="flex-1"
      />
      <Button variant="ghost" size="icon" onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

interface VendedorItemProps {
  item: ConsorcioVendedorOption;
  onUpdate: (data: Partial<ConsorcioVendedorOption>) => void;
  onDelete: () => void;
}

function VendedorItem({ item, onUpdate, onDelete }: VendedorItemProps) {
  const [name, setName] = useState(item.name);

  return (
    <div className="flex gap-2 items-center p-2 bg-muted/50 rounded-lg">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== item.name && onUpdate({ name })}
        className="flex-1"
      />
      <Button variant="ghost" size="icon" onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

// ============ Color Picker ============

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="w-8 h-8 rounded-md border shadow-sm cursor-pointer"
        style={{ backgroundColor: value }}
        onClick={() => setIsOpen(!isOpen)}
      />
      {isOpen && (
        <>
          <div className="fixed inset-0" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-10 z-50 bg-popover border rounded-lg shadow-lg p-2 grid grid-cols-4 gap-1">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                className="w-6 h-6 rounded cursor-pointer hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                onClick={() => {
                  onChange(color);
                  setIsOpen(false);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
