import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddPendingRegistrationModal({ open, onOpenChange }: Props) {
  const create = useCreateManualPendingRegistration();
  const [tipoPessoa, setTipoPessoa] = useState<'pf' | 'pj'>('pf');
  const [origem, setOrigem] = useState('');
  const [nome, setNome] = useState('');
  const [doc, setDoc] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [valorCredito, setValorCredito] = useState('');
  const [prazo, setPrazo] = useState('');
  const [empresaPaga, setEmpresaPaga] = useState(false);
  const [tipoContrato, setTipoContrato] = useState<'normal' | 'intercalado' | 'intercalado_impar'>('normal');
  const [qtdParcelas, setQtdParcelas] = useState('');
  const [aceiteDate, setAceiteDate] = useState(new Date().toISOString().split('T')[0]);
  const [obs, setObs] = useState('');

  const reset = () => {
    setTipoPessoa('pf');
    setOrigem('');
    setNome('');
    setDoc('');
    setTelefone('');
    setEmail('');
    setValorCredito('');
    setPrazo('');
    setEmpresaPaga(false);
    setTipoContrato('normal');
    setQtdParcelas('');
    setAceiteDate(new Date().toISOString().split('T')[0]);
    setObs('');
  };

  const handleSubmit = async () => {
    if (!origem.trim() || !nome.trim()) return;
    const input: CreateManualPendingInput = {
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
    };
    await create.mutateAsync(input);
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
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
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