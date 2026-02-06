import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGRWalletEntries } from '@/hooks/useGRWallet';
import { GR_STATUS_LABELS, GR_PRODUCTS, GREntryStatus, GRWalletEntry } from '@/types/gr-types';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Users, Eye, Loader2 } from 'lucide-react';
import { GREntryDrawer } from './GREntryDrawer';

interface GRPartnersTabProps {
  walletId: string;
}

export const GRPartnersTab = ({ walletId }: GRPartnersTabProps) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<GRWalletEntry | null>(null);
  
  const { data: entries = [], isLoading } = useGRWalletEntries(walletId);
  
  const filteredEntries = entries.filter(entry => {
    const matchesSearch = !search || 
      entry.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      entry.customer_email?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
    
    const matchesProduct = productFilter === 'all' || 
      entry.recommended_products?.includes(productFilter) ||
      entry.product_purchased === productFilter;
    
    return matchesSearch && matchesStatus && matchesProduct;
  });
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Parceiros na Carteira
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              {Object.entries(GR_STATUS_LABELS).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Produtos</SelectItem>
              {GR_PRODUCTS.map((product) => (
                <SelectItem key={product.code} value={product.code}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum parceiro encontrado
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última Interação</TableHead>
                  <TableHead>Próxima Ação</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => {
                  const statusInfo = GR_STATUS_LABELS[entry.status as GREntryStatus];
                  const productInfo = entry.product_purchased 
                    ? GR_PRODUCTS.find(p => p.code === entry.product_purchased)
                    : entry.recommended_products?.[0]
                      ? GR_PRODUCTS.find(p => p.code === entry.recommended_products?.[0])
                      : null;
                  
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{entry.customer_name}</p>
                          <p className="text-sm text-muted-foreground">{entry.customer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusInfo?.color}>
                          {statusInfo?.label || entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {entry.last_contact_at 
                          ? formatDistanceToNow(new Date(entry.last_contact_at), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.next_action_date 
                          ? formatDate(entry.next_action_date)
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        {productInfo ? (
                          <Badge variant="secondary">{productInfo.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {entry.purchase_value 
                          ? formatCurrency(entry.purchase_value)
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedEntry(entry)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        
        {/* Summary */}
        <div className="flex justify-between items-center text-sm text-muted-foreground pt-4 border-t">
          <span>Total: {filteredEntries.length} parceiros</span>
          <span>
            Valor Total: {formatCurrency(
              filteredEntries.reduce((sum, e) => sum + (e.purchase_value || 0), 0)
            )}
          </span>
        </div>
      </CardContent>
      
      <GREntryDrawer 
        entry={selectedEntry}
        open={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </Card>
  );
};
