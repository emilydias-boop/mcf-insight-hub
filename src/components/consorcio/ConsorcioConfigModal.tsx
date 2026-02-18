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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações do Consórcio</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tipos">Tipos</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
            <TabsTrigger value="origens">Origens</TabsTrigger>
            <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
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
        </Tabs>
      </DialogContent>
    </Dialog>
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
