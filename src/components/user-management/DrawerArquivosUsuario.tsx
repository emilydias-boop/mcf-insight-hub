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
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserFiles, useMyFiles, useUploadUserFile, useDeleteUserFile, getSignedDownloadUrl } from "@/hooks/useUserFiles";
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
  
  // Form state
  const [formData, setFormData] = useState({
    tipo: "outro" as UserFileType,
    titulo: "",
    descricao: "",
    visivelParaUsuario: true,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Queries
  const { data: gestorFiles = [], isLoading: loadingGestor } = useUserFiles(mode === "gestor" ? userId || null : null);
  const { data: myFiles = [], isLoading: loadingMy } = useMyFiles();

  // Mutations
  const uploadFile = useUploadUserFile();
  const deleteFile = useDeleteUserFile();

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
    const url = await getSignedDownloadUrl(storagePath);
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleView = async (storagePath: string) => {
    const url = await getSignedDownloadUrl(storagePath);
    if (url) {
      window.open(url, "_blank");
    }
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
                          onClick={() => handleView(file.storage_path)}
                          title="Ver arquivo"
                        >
                          <Eye className="h-4 w-4" />
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
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

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