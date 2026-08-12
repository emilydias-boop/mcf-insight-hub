import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Search, Merge, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  useArDuplicateAudit,
  useUnifyArCadastros,
  normName,
  type ArDupGroup,
  type ArDupTitulo,
} from '@/hooks/useArDuplicateAudit';

const brl = (v?: number | null) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  try { return format(new Date(d.length <= 10 ? d + 'T00:00:00' : d), 'dd/MM/yyyy'); } catch { return '—'; }
};

function GroupCard({ group }: { group: ArDupGroup }) {
  const [canonicalId, setCanonicalId] = useState<string>(() => {
    // sugestão: o cadastro com o nome mais completo
    return [...group.titulos].sort(
      (a, b) => normName(b.customer_name).length - normName(a.customer_name).length,
    )[0]?.id;
  });
  const unify = useUnifyArCadastros();

  const canonical = group.titulos.find((t) => t.id === canonicalId) as ArDupTitulo | undefined;

  const handleUnify = async () => {
    if (!canonical) return;
    try {
      const n = await unify.mutateAsync({ canonical, targetIds: group.titulos.map((t) => t.id) });
      toast.success(n > 0 ? `${n} título(s) atualizado(s) com o cadastro unificado` : 'Nada a unificar');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao unificar cadastros');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm">{canonical?.customer_name || group.titulos[0].customer_name}</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <Badge variant="secondary" className="text-[10px]">{group.titulos.length} títulos</Badge>
              {group.matchedFields.map((f) => (
                <Badge key={f} variant="outline" className="text-[10px]">match: {f}</Badge>
              ))}
            </div>
          </div>
          <Button size="sm" onClick={handleUnify} disabled={unify.isPending || !canonical}>
            <Merge className="w-4 h-4 mr-1" />
            {unify.isPending ? 'Unificando…' : 'Unificar cadastros'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">Principal</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Venda</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.titulos.map((t) => (
                <TableRow key={t.id} className={t.id === canonicalId ? 'bg-primary/5' : undefined}>
                  <TableCell>
                    <label className="flex items-center gap-1 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name={`canonical-${group.key}`}
                        checked={t.id === canonicalId}
                        onChange={() => setCanonicalId(t.id)}
                      />
                      {t.id === canonicalId && <CheckCircle2 className="w-3 h-3 text-primary" />}
                    </label>
                  </TableCell>
                  <TableCell className="text-xs font-medium">{t.customer_name}</TableCell>
                  <TableCell className="text-xs">{t.customer_email || '—'}</TableCell>
                  <TableCell className="text-xs">{t.customer_phone || '—'}</TableCell>
                  <TableCell className="text-xs">{t.customer_document || '—'}</TableCell>
                  <TableCell className="text-xs">{t.product_name || t.product_code || '—'}</TableCell>
                  <TableCell className="text-xs text-right">{brl(t.valor_total)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(t.sale_date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Ao unificar, os dados do cadastro marcado como <strong>Principal</strong> (nome, e-mail, telefone e documento)
          são aplicados aos demais títulos do grupo. Os títulos e valores são preservados.
        </p>
      </CardContent>
    </Card>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function DuplicidadePanel({ open, onOpenChange }: Props) {
  const { data: groups, isLoading } = useArDuplicateAudit(open);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const s = normName(search);
    if (!s) return groups || [];
    return (groups || []).filter((g) =>
      g.titulos.some(
        (t) =>
          normName(t.customer_name).includes(s) ||
          (t.customer_email || '').toLowerCase().includes(search.trim().toLowerCase()) ||
          (t.customer_phone || '').includes(search.trim()),
      ),
    );
  }, [groups, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" /> Auditoria de Duplicidade
          </DialogTitle>
          <DialogDescription>
            Cadastros com possível duplicidade por nome, e-mail, telefone ou documento. Escolha o cadastro principal e
            unifique — os títulos continuam existindo, apenas os dados do cliente são padronizados.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou telefone…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Analisando cadastros…</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhum cadastro duplicado encontrado.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">{filtered.length} grupo(s) com possível duplicidade</div>
            {filtered.map((g) => (
              <GroupCard key={g.key} group={g} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
