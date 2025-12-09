import { useState, useEffect } from "react";
import { PlaybookDoc, PlaybookRole, PlaybookCategoria, PlaybookTipoConteudo, PLAYBOOK_ROLE_LABELS, PLAYBOOK_CATEGORIA_LABELS, PLAYBOOK_TIPO_LABELS, PLAYBOOK_ROLES_LIST, PLAYBOOK_CATEGORIAS_LIST } from "@/types/playbook";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCreatePlaybookDoc, useUpdatePlaybookDoc, uploadPlaybookFile } from "@/hooks/usePlaybookDocs";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

interface PlaybookDocFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc?: PlaybookDoc | null;
  defaultRole?: PlaybookRole;
}

export function PlaybookDocForm({ open, onOpenChange, doc, defaultRole }: PlaybookDocFormProps) {
  const isEditing = !!doc;
  const createDoc = useCreatePlaybookDoc();
  const updateDoc = useUpdatePlaybookDoc();

  const [formData, setFormData] = useState({
    role: defaultRole || 'sdr' as PlaybookRole,
    titulo: '',
    descricao: '',
    tipo_conteudo: 'arquivo' as PlaybookTipoConteudo,
    storage_url: '',
    storage_path: '',
    link_url: '',
    conteudo_rico: '',
    obrigatorio: false,
    categoria: 'outro' as PlaybookCategoria,
    versao: 'v1',
    ativo: true,
  });

  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (doc) {
      setFormData({
        role: doc.role,
        titulo: doc.titulo,
        descricao: doc.descricao || '',
        tipo_conteudo: doc.tipo_conteudo,
        storage_url: doc.storage_url || '',
        storage_path: doc.storage_path || '',
        link_url: doc.link_url || '',
        conteudo_rico: doc.conteudo_rico || '',
        obrigatorio: doc.obrigatorio,
        categoria: doc.categoria,
        versao: doc.versao,
        ativo: doc.ativo,
      });
    } else {
      setFormData({
        role: defaultRole || 'sdr',
        titulo: '',
        descricao: '',
        tipo_conteudo: 'arquivo',
        storage_url: '',
        storage_path: '',
        link_url: '',
        conteudo_rico: '',
        obrigatorio: false,
        categoria: 'outro',
        versao: 'v1',
        ativo: true,
      });
    }
    setSelectedFile(null);
  }, [doc, defaultRole, open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let finalData = { ...formData };

      // Upload arquivo se necessário
      if (formData.tipo_conteudo === 'arquivo' && selectedFile) {
        setUploading(true);
        const { url, path } = await uploadPlaybookFile(selectedFile, formData.role);
        finalData.storage_url = url;
        finalData.storage_path = path;
        setUploading(false);
      }

      // Limpar campos não usados
      if (formData.tipo_conteudo !== 'arquivo') {
        finalData.storage_url = '';
        finalData.storage_path = '';
      }
      if (formData.tipo_conteudo !== 'link') {
        finalData.link_url = '';
      }
      if (formData.tipo_conteudo !== 'texto') {
        finalData.conteudo_rico = '';
      }

      if (isEditing && doc) {
        await updateDoc.mutateAsync({ id: doc.id, ...finalData });
      } else {
        await createDoc.mutateAsync(finalData);
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar documento:', error);
      toast.error('Erro ao salvar documento');
      setUploading(false);
    }
  };

  const isLoading = createDoc.isPending || updateDoc.isPending || uploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Documento' : 'Novo Documento'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">Cargo</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value as PlaybookRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAYBOOK_ROLES_LIST.map((role) => (
                    <SelectItem key={role} value={role}>
                      {PLAYBOOK_ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData({ ...formData, categoria: value as PlaybookCategoria })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAYBOOK_CATEGORIAS_LIST.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {PLAYBOOK_CATEGORIA_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo_conteudo">Tipo de Conteúdo</Label>
            <Select
              value={formData.tipo_conteudo}
              onValueChange={(value) => setFormData({ ...formData, tipo_conteudo: value as PlaybookTipoConteudo })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="arquivo">Arquivo (PDF, etc.)</SelectItem>
                <SelectItem value="link">Link externo</SelectItem>
                <SelectItem value="texto">Texto rico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.tipo_conteudo === 'arquivo' && (
            <div className="space-y-2">
              <Label>Arquivo</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
                />
                {selectedFile && (
                  <span className="text-sm text-muted-foreground">
                    {selectedFile.name}
                  </span>
                )}
              </div>
              {formData.storage_url && !selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Arquivo atual: {formData.storage_path?.split('/').pop()}
                </p>
              )}
            </div>
          )}

          {formData.tipo_conteudo === 'link' && (
            <div className="space-y-2">
              <Label htmlFor="link_url">URL do Link</Label>
              <Input
                id="link_url"
                type="url"
                value={formData.link_url}
                onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
          )}

          {formData.tipo_conteudo === 'texto' && (
            <div className="space-y-2">
              <Label htmlFor="conteudo_rico">Conteúdo</Label>
              <Textarea
                id="conteudo_rico"
                value={formData.conteudo_rico}
                onChange={(e) => setFormData({ ...formData, conteudo_rico: e.target.value })}
                rows={8}
                placeholder="Digite o conteúdo do documento..."
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="versao">Versão</Label>
              <Input
                id="versao"
                value={formData.versao}
                onChange={(e) => setFormData({ ...formData, versao: e.target.value })}
                placeholder="v1"
              />
            </div>

            <div className="flex items-center justify-between pt-6">
              <Label htmlFor="obrigatorio">Obrigatório</Label>
              <Switch
                id="obrigatorio"
                checked={formData.obrigatorio}
                onCheckedChange={(checked) => setFormData({ ...formData, obrigatorio: checked })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="ativo">Documento ativo</Label>
            <Switch
              id="ativo"
              checked={formData.ativo}
              onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
