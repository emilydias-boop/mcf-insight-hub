import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  Plus,
  Download,
  Eye,
  Trash2,
  Loader2,
  Upload,
  X,
  FileIcon,
  CheckCircle,
  XCircle,
  FolderOpen,
  Pencil,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserFiles, useMyFiles, useUploadUserFile, useDeleteUserFile, useUpdateUserFile, getSignedDownloadUrl } from "@/hooks/useUserFiles";
import { UserFile } from "@/types/user-management";
import { useAuth } from "@/contexts/AuthContext";
import { UserFileType, USER_FILE_TYPE_LABELS } from "@/types/user-management";

interface DrawerArquivosUsuarioProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "gestor" | "pessoal";
  userId?: string;
  userName?: string;
  userPosition?: string;
}

export function DrawerArquivosUsuario({
  open,
  onOpenChange,
  mode,
  userId,
  userName,
  userPosition,
}: DrawerArquivosUsuarioProps) {
  const { user } = useAuth();
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; fileId: string; storagePath: string } | null>(null);
  const [viewingFile, setViewingFile] = useState<{ url: string; name: string; type: string; storagePath: string } | null>(null);
  const [isLoadingView, setIsLoadingView] = useState(false);
  const [editingFile, setEditingFile] = useState<UserFile | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    tipo: "outro" as UserFileType,
    titulo: "",
    descricao: "",
    visivelParaUsuario: true,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Edit form state
  const [editFormData, setEditFormData] = useState({
    tipo: "outro" as UserFileType,
    titulo: "",
    descricao: "",
    visivelParaUsuario: true,
    substituirArquivo: false,
  });
  const [editSelectedFile, setEditSelectedFile] = useState<File | null>(null);

  // Queries
  const { data: gestorFiles = [], isLoading: loadingGestor } = useUserFiles(mode === "gestor" ? userId || null : null);
  const { data: myFiles = [], isLoading: loadingMy } = useMyFiles();

  // Mutations
  const uploadFile = useUploadUserFile();
  const deleteFile = useDeleteUserFile();
  const updateFile = useUpdateUserFile();

  const files = mode === "gestor" ? gestorFiles : myFiles;
  const isLoading = mode === "gestor" ? loadingGestor : loadingMy;
  const targetUserId = mode === "gestor" ? userId : user?.id;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-preencher título com nome do arquivo se vazio
      if (!formData.titulo) {
        setFormData((prev) => ({ ...prev, titulo: file.name.replace(/\.[^/.]+$/, "") }));
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile || !targetUserId || !formData.titulo) return;

    await uploadFile.mutateAsync({
      userId: targetUserId,
      tipo: formData.tipo,
      titulo: formData.titulo,
      descricao: formData.descricao || undefined,
      file: selectedFile,
      visivelParaUsuario: formData.visivelParaUsuario,
    });

    // Reset form
    setFormData({ tipo: "outro", titulo: "", descricao: "", visivelParaUsuario: true });
    setSelectedFile(null);
    setShowUploadForm(false);
  };

  const handleDownload = async (storagePath: string, fileName: string) => {
    try {
      const url = await getSignedDownloadUrl(storagePath);
      if (!url) return;
      
      // Baixa o arquivo via fetch (não bloqueado por extensões)
      const response = await fetch(url);
      const blob = await response.blob();
      
      // Cria URL local do blob
      const blobUrl = URL.createObjectURL(blob);
      
      // Cria link de download
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Limpa o blob URL
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Erro ao baixar arquivo:", error);
    }
  };

  const handleView = async (storagePath: string, fileName: string) => {
    setIsLoadingView(true);
    try {
      const url = await getSignedDownloadUrl(storagePath);
      if (!url) return;
      
      // Baixa o arquivo via fetch (não bloqueado por extensões)
      const response = await fetch(url);
      const blob = await response.blob();
      
      // Cria URL local do blob
      const blobUrl = URL.createObjectURL(blob);
      
      // Determina o tipo do arquivo
      const mimeType = blob.type || getMimeType(fileName);
      
      setViewingFile({ url: blobUrl, name: fileName, type: mimeType, storagePath });
    } catch (error) {
      console.error("Erro ao visualizar arquivo:", error);
    } finally {
      setIsLoadingView(false);
    }
  };

  const getMimeType = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  };

  const closeViewer = () => {
    if (viewingFile) {
      URL.revokeObjectURL(viewingFile.url);
    }
    setViewingFile(null);
  };

  const handleDelete = () => {
    if (!deleteConfirm || !targetUserId) return;
    deleteFile.mutate({
      fileId: deleteConfirm.fileId,
      storagePath: deleteConfirm.storagePath,
      userId: targetUserId,
    });
    setDeleteConfirm(null);
  };

  const resetForm = () => {
    setFormData({ tipo: "outro", titulo: "", descricao: "", visivelParaUsuario: true });
    setSelectedFile(null);
    setShowUploadForm(false);
  };

  const handleStartEdit = (file: UserFile) => {
    setEditingFile(file);
    setEditFormData({
      tipo: file.tipo,
      titulo: file.titulo,
      descricao: file.descricao || "",
      visivelParaUsuario: file.visivel_para_usuario,
      substituirArquivo: false,
    });
    setEditSelectedFile(null);
  };

  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditSelectedFile(file);
    }
  };

  const handleEditSubmit = async () => {
    if (!editingFile || !targetUserId || !editFormData.titulo) return;
    
    // Se marcou substituir mas não selecionou arquivo
    if (editFormData.substituirArquivo && !editSelectedFile) return;

    await updateFile.mutateAsync({
      fileId: editingFile.id,
      userId: targetUserId,
      tipo: editFormData.tipo,
      titulo: editFormData.titulo,
      descricao: editFormData.descricao || undefined,
      visivelParaUsuario: editFormData.visivelParaUsuario,
      newFile: editFormData.substituirArquivo ? editSelectedFile || undefined : undefined,
      oldStoragePath: editingFile.storage_path,
    });

    setEditingFile(null);
    setEditSelectedFile(null);
  };

  const resetEditForm = () => {
    setEditingFile(null);
    setEditFormData({ tipo: "outro", titulo: "", descricao: "", visivelParaUsuario: true, substituirArquivo: false });
    setEditSelectedFile(null);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {mode === "gestor"
                    ? userName?.[0]?.toUpperCase() || "U"
                    : user?.email?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <SheetTitle className="text-xl">
                  {mode === "gestor" ? "Arquivos pessoais" : "Meus arquivos"}
                </SheetTitle>
                <SheetDescription className="text-sm">
                  {mode === "gestor"
                    ? `Documentos de ${userName || "Usuário"}`
                    : "Seus documentos oficiais, como contrato de trabalho e metas."}
                </SheetDescription>
                {(mode === "gestor" ? userPosition : null) && (
                  <Badge variant="outline" className="mt-1">
                    {userPosition}
                  </Badge>
                )}
              </div>
            </div>
          </SheetHeader>

          <Separator className="my-4" />

          {/* Barra de ações */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Total de arquivos: <span className="font-semibold text-foreground">{files.length}</span>
            </p>
            {mode === "gestor" && !showUploadForm && (
              <Button size="sm" onClick={() => setShowUploadForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar arquivo
              </Button>
            )}
          </div>

          {/* Formulário de upload */}
          {showUploadForm && mode === "gestor" && (
            <Card className="mb-4">
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Novo arquivo</h4>
                  <Button variant="ghost" size="icon" onClick={resetForm}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Tipo *</Label>
                    <Select
                      value={formData.tipo}
                      onValueChange={(value: UserFileType) =>
                        setFormData((prev) => ({ ...prev, tipo: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(USER_FILE_TYPE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Título *</Label>
                    <Input
                      value={formData.titulo}
                      onChange={(e) => setFormData((prev) => ({ ...prev, titulo: e.target.value }))}
                      placeholder="Ex: Contrato CLT - Janeiro 2025"
                    />
                  </div>

                  <div>
                    <Label>Descrição (opcional)</Label>
                    <Textarea
                      value={formData.descricao}
                      onChange={(e) => setFormData((prev) => ({ ...prev, descricao: e.target.value }))}
                      placeholder="Adicione uma descrição..."
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>Arquivo *</Label>
                    <div className="mt-1">
                      {selectedFile ? (
                        <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                          <FileIcon className="h-5 w-5 text-primary" />
                          <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedFile(null)}
                            className="h-6 w-6"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                          <span className="text-sm text-muted-foreground">Clique para selecionar um arquivo</span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={handleFileSelect}
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="visivel"
                      checked={formData.visivelParaUsuario}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, visivelParaUsuario: !!checked }))
                      }
                    />
                    <Label htmlFor="visivel" className="text-sm cursor-pointer">
                      Visível para o usuário
                    </Label>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={resetForm} className="flex-1">
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    className="flex-1"
                    disabled={!selectedFile || !formData.titulo || uploadFile.isPending}
                  >
                    {uploadFile.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      "Salvar arquivo"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de arquivos */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {mode === "gestor"
                  ? "Nenhum arquivo enviado ainda."
                  : "Nenhum arquivo disponível ainda. Assim que o seu gestor enviar documentos, eles aparecerão aqui."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <Card key={file.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{file.titulo}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {USER_FILE_TYPE_LABELS[file.tipo]}
                          </Badge>
                          {mode === "gestor" && (
                            <Badge
                              variant={file.visivel_para_usuario ? "default" : "outline"}
                              className="text-xs"
                            >
                              {file.visivel_para_usuario ? (
                                <>
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Visível
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Oculto
                                </>
                              )}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(file.data_upload), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          {mode === "gestor" && file.uploader_name && (
                            <> • Enviado por {file.uploader_name}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleView(file.storage_path, file.file_name)}
                          title="Ver arquivo"
                          disabled={isLoadingView}
                        >
                          {isLoadingView ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(file.storage_path, file.file_name)}
                          title="Baixar arquivo"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {mode === "gestor" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleStartEdit(file)}
                              title="Editar arquivo"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setDeleteConfirm({
                                  open: true,
                                  fileId: file.id,
                                  storagePath: file.storage_path,
                                })
                              }
                              title="Excluir arquivo"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Visualizador inline de arquivos */}
          {viewingFile && (
            <div className="fixed inset-0 bg-background/95 z-[60] flex flex-col">
              <div className="flex justify-between items-center p-4 border-b bg-background">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="font-medium truncate">{viewingFile.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(viewingFile.storagePath, viewingFile.name)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar
                  </Button>
                  <Button variant="ghost" size="icon" onClick={closeViewer}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
                {viewingFile.type === 'application/pdf' ? (
                  <iframe
                    src={viewingFile.url}
                    className="w-full h-full min-h-[70vh] rounded-lg border"
                    title={viewingFile.name}
                  />
                ) : viewingFile.type.startsWith('image/') ? (
                  <img
                    src={viewingFile.url}
                    alt={viewingFile.name}
                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-lg"
                  />
                ) : (
                  <div className="text-center space-y-4">
                    <FileIcon className="h-16 w-16 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">
                      Visualização não disponível para este tipo de arquivo.
                    </p>
                    <Button onClick={() => handleDownload(viewingFile.storagePath, viewingFile.name)}>
                      <Download className="h-4 w-4 mr-2" />
                      Baixar arquivo
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog de edição de arquivo */}
      <AlertDialog
        open={!!editingFile}
        onOpenChange={(open) => !open && resetEditForm()}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Editar arquivo</AlertDialogTitle>
            <AlertDialogDescription>
              Altere os dados do arquivo ou substitua por um novo.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Tipo *</Label>
              <Select
                value={editFormData.tipo}
                onValueChange={(value: UserFileType) =>
                  setEditFormData((prev) => ({ ...prev, tipo: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(USER_FILE_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Título *</Label>
              <Input
                value={editFormData.titulo}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, titulo: e.target.value }))}
                placeholder="Ex: Contrato CLT - Janeiro 2025"
              />
            </div>

            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={editFormData.descricao}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, descricao: e.target.value }))}
                placeholder="Adicione uma descrição..."
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-visivel"
                checked={editFormData.visivelParaUsuario}
                onCheckedChange={(checked) =>
                  setEditFormData((prev) => ({ ...prev, visivelParaUsuario: !!checked }))
                }
              />
              <Label htmlFor="edit-visivel" className="text-sm cursor-pointer">
                Visível para o usuário
              </Label>
            </div>

            <Separator />

            <div className="flex items-center space-x-2">
              <Checkbox
                id="substituir-arquivo"
                checked={editFormData.substituirArquivo}
                onCheckedChange={(checked) => {
                  setEditFormData((prev) => ({ ...prev, substituirArquivo: !!checked }));
                  if (!checked) setEditSelectedFile(null);
                }}
              />
              <Label htmlFor="substituir-arquivo" className="text-sm cursor-pointer">
                Substituir arquivo
              </Label>
            </div>

            {editFormData.substituirArquivo && (
              <div>
                <Label>Novo arquivo *</Label>
                <div className="mt-1">
                  {editSelectedFile ? (
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                      <FileIcon className="h-5 w-5 text-primary" />
                      <span className="text-sm flex-1 truncate">{editSelectedFile.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditSelectedFile(null)}
                        className="h-6 w-6"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">Clique para selecionar</span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleEditFileSelect}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      />
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetEditForm}>Cancelar</AlertDialogCancel>
            <Button
              onClick={handleEditSubmit}
              disabled={
                !editFormData.titulo ||
                (editFormData.substituirArquivo && !editSelectedFile) ||
                updateFile.isPending
              }
            >
              {updateFile.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar alterações"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog
        open={!!deleteConfirm?.open}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir arquivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O arquivo será permanentemente excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteFile.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}