import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  RefreshCw,
  Package,
  Edit2,
  Plus,
} from "lucide-react";
import {
  useProductConfigurations,
  useSyncProductsFromTransactions,
  TARGET_BU_OPTIONS,
  PRODUCT_CATEGORY_OPTIONS,
  ProductConfiguration,
} from "@/hooks/useProductConfigurations";
import { ProductConfigDrawer } from "@/components/admin/ProductConfigDrawer";
import { ProductBulkActionsBar } from "@/components/admin/ProductBulkActionsBar";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40];

export default function ConfiguracaoProdutos() {
  const { data: products, isLoading } = useProductConfigurations();
  const syncMutation = useSyncProductsFromTransactions();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [buFilter, setBuFilter] = useState<string>("all");
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<ProductConfiguration | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filtragem
  const filteredProducts = useMemo(() => {
    if (!products) return [];

    return products.filter((product) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        product.product_name.toLowerCase().includes(searchLower) ||
        product.product_code?.toLowerCase().includes(searchLower) ||
        product.display_name?.toLowerCase().includes(searchLower);

      const matchesCategory =
        categoryFilter === "all" || product.product_category === categoryFilter;

      // Filtros especiais
      if (buFilter === "__no_bu") return matchesSearch && matchesCategory && !product.target_bu;
      if (buFilter === "__no_code") return matchesSearch && matchesCategory && !product.product_code;
      const matchesBU = buFilter === "all" || product.target_bu === buFilter;

      return matchesSearch && matchesCategory && matchesBU;
    });
  }, [products, search, categoryFilter, buFilter]);

  // Agrupamento por product_code
  const groupedProducts = useMemo(() => {
    const groups = new Map<string, ProductConfiguration[]>();
    const ungrouped: ProductConfiguration[] = [];

    for (const p of filteredProducts) {
      if (p.product_code) {
        const existing = groups.get(p.product_code) || [];
        existing.push(p);
        groups.set(p.product_code, existing);
      } else {
        ungrouped.push(p);
      }
    }

    // Flatten: groups with 2+ items get a visual group header concept, singles go flat
    const result: { product: ProductConfiguration; groupCode: string | null; groupSize: number; isFirstInGroup: boolean }[] = [];

    for (const [code, items] of groups.entries()) {
      items.forEach((item, i) => {
        result.push({
          product: item,
          groupCode: items.length > 1 ? code : null,
          groupSize: items.length,
          isFirstInGroup: i === 0 && items.length > 1,
        });
      });
    }
    for (const item of ungrouped) {
      result.push({ product: item, groupCode: null, groupSize: 1, isFirstInGroup: false });
    }

    return result;
  }, [filteredProducts]);

  // Paginação
  const totalPages = Math.ceil(groupedProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return groupedProducts.slice(start, start + itemsPerPage);
  }, [groupedProducts, currentPage, itemsPerPage]);

  const handlePageSizeChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const handleEdit = (product: ProductConfiguration) => {
    setSelectedProduct(product);
    setIsCreateMode(false);
    setDrawerOpen(true);
  };

  const handleCreate = () => {
    setSelectedProduct(null);
    setIsCreateMode(true);
    setDrawerOpen(true);
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const currentIds = paginatedProducts.map((g) => g.product.id);
    setSelectedIds((prev) => {
      const allSelected = currentIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        currentIds.forEach((id) => next.delete(id));
      } else {
        currentIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [paginatedProducts]);

  const allCurrentSelected = paginatedProducts.length > 0 && paginatedProducts.every((g) => selectedIds.has(g.product.id));

  const getBUBadge = (bu: string | null) => {
    if (!bu) return <Badge variant="outline">Não definido</Badge>;
    const option = TARGET_BU_OPTIONS.find((o) => o.value === bu);
    const colors: Record<string, string> = {
      incorporador: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      consorcio: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      credito: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      projetos: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    };
    return (
      <Badge className={colors[bu] || ""} variant="secondary">
        {option?.label || bu}
      </Badge>
    );
  };

  const getCategoryBadge = (category: string) => {
    const option = PRODUCT_CATEGORY_OPTIONS.find((o) => o.value === category);
    return <Badge variant="outline">{option?.label || category}</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Estatísticas
  const stats = useMemo(() => {
    if (!products) return { total: 0, withBU: 0, active: 0, noBU: 0, noCode: 0 };
    return {
      total: products.length,
      withBU: products.filter((p) => p.target_bu).length,
      active: products.filter((p) => p.is_active).length,
      noBU: products.filter((p) => !p.target_bu).length,
      noCode: products.filter((p) => !p.product_code).length,
    };
  }, [products]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Configuração de Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie produtos, categorias, valores de referência e defina para qual BU cada produto pertence.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Com BU</CardDescription>
            <CardTitle className="text-2xl">{stats.withBU}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ativos</CardDescription>
            <CardTitle className="text-2xl">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { setBuFilter("__no_bu"); setCurrentPage(1); }}>
          <CardHeader className="pb-2">
            <CardDescription>Sem BU</CardDescription>
            <CardTitle className="text-2xl text-destructive">{stats.noBU}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { setBuFilter("__no_code"); setCurrentPage(1); }}>
          <CardHeader className="pb-2">
            <CardDescription>Sem Código</CardDescription>
            <CardTitle className="text-2xl text-destructive">{stats.noCode}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>

            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                {PRODUCT_CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={buFilter} onValueChange={(v) => { setBuFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="BU" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas BUs</SelectItem>
                <SelectItem value="__no_bu">⚠️ Sem BU definida</SelectItem>
                <SelectItem value="__no_code">⚠️ Sem código</SelectItem>
                {TARGET_BU_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : groupedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mb-4" />
              <p>Nenhum produto encontrado</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={allCurrentSelected}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-[100px]">Código</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>BU</TableHead>
                      <TableHead className="text-right">Preço Ref.</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProducts.map(({ product, groupCode, groupSize, isFirstInGroup }) => (
                      <TableRow
                        key={product.id}
                        className={groupCode ? "bg-muted/30" : ""}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(product.id)}
                            onCheckedChange={() => toggleSelect(product.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-1.5">
                            {product.product_code || "-"}
                            {isFirstInGroup && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {groupSize}x
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium truncate max-w-[300px]" title={product.product_name}>
                              {product.display_name || product.product_name}
                            </span>
                            {product.display_name && (
                              <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                                {product.product_name}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getCategoryBadge(product.product_category)}</TableCell>
                        <TableCell>{getBUBadge(product.target_bu)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(product.reference_price)}
                        </TableCell>
                        <TableCell className="text-center">
                          {product.is_active ? (
                            <Badge variant="default" className="bg-green-600">Ativo</Badge>
                          ) : (
                            <Badge variant="secondary">Inativo</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(product)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t px-4 py-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Mostrar</span>
                      <Select value={itemsPerPage.toString()} onValueChange={handlePageSizeChange}>
                        <SelectTrigger className="w-[70px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZE_OPTIONS.map((size) => (
                            <SelectItem key={size} value={size.toString()}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-muted-foreground">por página</span>
                    </div>
                    <div className="text-sm text-muted-foreground hidden sm:block">
                      Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
                      {Math.min(currentPage * itemsPerPage, groupedProducts.length)} de{" "}
                      {groupedProducts.length.toLocaleString("pt-BR")}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-3 text-sm">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      <ProductBulkActionsBar
        selectedCount={selectedIds.size}
        selectedIds={Array.from(selectedIds)}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      {/* Edit/Create Drawer */}
      <ProductConfigDrawer
        product={selectedProduct}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        isCreateMode={isCreateMode}
      />
    </div>
  );
}
