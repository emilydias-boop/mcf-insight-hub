import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBUStrategicDocuments, StrategicDocument } from "@/hooks/useBUStrategicDocuments";
import { BusinessUnit, BU_OPTIONS } from "@/hooks/useMyBU";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FileText, Upload, Trash2, Download, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const MESES = [
  { value: 1, label: "Janeiro" }, { value: 2, label: "Fevereiro" }, { value: 3, label: "Março" },
  { value: 4, label: "Abril" }, { value: 5, label: "Maio" }, { value: 6, label: "Junho" },
  { value: 7, label: "Julho" }, { value: 8, label: "Agosto" }, { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" }, { value: 11, label: "Novembro" }, { value: 12, label: "Dezembro" },
];

const SEMANAS = [1, 2, 3, 4, 5];

interface Props {
  bu: BusinessUnit;
}

export default function DocumentosEstrategicos({ bu: defaultBU }: Props) {
  const { role, user } = useAuth();
  const isAdminOrManager = role === "admin" || role === "manager";

  const currentDate = new Date();
  const [selectedBU, setSelectedBU] = useState<BusinessUnit>(defaultBU);
  const [ano, setAno] = useState(currentDate.getFullYear());
  const [mes, setMes] = useState<number | null>(currentDate.getMonth() + 1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadMes, setUploadMes] = useState<number>(currentDate.getMonth() + 1);
  const [uploadSemana, setUploadSemana] = useState<number>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeBU = isAdminOrManager ? selectedBU : defaultBU;
  const { documents, isLoading, upload, isUploading, deleteDoc, isDeleting, getSignedUrl } = useBUStrategicDocuments(activeBU, ano, mes);

  const handleUpload = async () => {
    if (!selectedFile) return;
    await upload({ file: selectedFile, bu: activeBU, mes: uploadMes, ano, semana: uploadSemana });
    setSelectedFile(null);
    setUploadOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleView = async (doc: StrategicDocument) => {
    try {
      const url = await getSignedUrl(doc.storage_path);
      window.open(url, "_blank");
    } catch {
      // toast handled in hook
    }
  };

  // Group by semana
  const grouped = documents.reduce<Record<number, StrategicDocument[]>>((acc, doc) => {
    if (!acc[doc.semana]) acc[doc.semana] = [];
    acc[doc.semana].push(doc);
    return acc;
  }, {});

  const buLabel = BU_OPTIONS.find(b => b.value === activeBU)?.label || activeBU;
  const currentYear = currentDate.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Documentos Estratégicos</h1>
          <p className="text-muted-foreground">{buLabel}</p>
        </div>

        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button><Upload className="h-4 w-4 mr-2" /> Enviar Documento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Enviar Documento PDF</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Arquivo (PDF, máx 20MB)</Label>
                <Input ref={fileInputRef} type="file" accept=".pdf" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Mês</Label>
                  <Select value={String(uploadMes)} onValueChange={v => setUploadMes(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MESES.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Semana</Label>
                  <Select value={String(uploadSemana)} onValueChange={v => setUploadSemana(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SEMANAS.map(s => <SelectItem key={s} value={String(s)}>Semana {s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleUpload} disabled={!selectedFile || isUploading} className="w-full">
                {isUploading ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        {isAdminOrManager && (
          <div>
            <Label className="text-xs text-muted-foreground">BU</Label>
            <Select value={selectedBU} onValueChange={v => setSelectedBU(v as BusinessUnit)}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BU_OPTIONS.filter(b => b.value).map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Mês</Label>
          <Select value={mes ? String(mes) : "all"} onValueChange={v => setMes(v === "all" ? null : Number(v))}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {MESES.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Documents grouped by week */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FolderOpen className="h-12 w-12 mb-3" />
            <p>Nenhum documento encontrado para o período selecionado.</p>
          </CardContent>
        </Card>
      ) : (
        SEMANAS.filter(s => grouped[s]?.length).map(semana => (
          <Card key={semana}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Semana {semana}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {grouped[semana].map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => handleView(doc)}>
                    <FileText className="h-8 w-8 text-red-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{doc.nome_arquivo}</p>
                      <p className="text-xs text-muted-foreground">
                        Enviado por {doc.uploaded_by_name} ({doc.uploaded_by_role}) •{" "}
                        {format(new Date(doc.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button variant="ghost" size="icon" onClick={() => handleView(doc)} title="Visualizar">
                      <Download className="h-4 w-4" />
                    </Button>
                    {(doc.uploaded_by === user?.id || isAdminOrManager) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover documento?</AlertDialogTitle>
                            <AlertDialogDescription>
                              "{doc.nome_arquivo}" será removido permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteDoc(doc)} disabled={isDeleting}>
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
