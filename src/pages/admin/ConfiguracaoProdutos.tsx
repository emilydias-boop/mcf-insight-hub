import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import {
  useProductConfigurations,
  useSyncProductsFromTransactions,
  TARGET_BU_OPTIONS,
  PRODUCT_CATEGORY_OPTIONS,
  ProductConfiguration,
} from "@/hooks/useProductConfigurations";
import { ProductConfigDrawer } from "@/components/admin/ProductConfigDrawer";

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

  // Filtragem
  const filteredProducts = useMemo(() => {
    if (!products) return [];

    return products.filter((product) => {
      // Busca por nome ou código
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        product.product_name.toLowerCase().includes(searchLower) ||
        product.product_code?.toLowerCase().includes(searchLower) ||
        product.display_name?.toLowerCase().includes(searchLower);

      // Filtro por categoria
      const matchesCategory =
        categoryFilter === "all" || product.product_category === categoryFilter;

      // Filtro por BU
      const matchesBU = buFilter === "all" || product.target_bu === buFilter;

      return matchesSearch && matchesCategory && matchesBU;
    });
  }, [products, search, categoryFilter, buFilter]);

  // Paginação
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const handlePageSizeChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const handleEdit = (product: ProductConfiguration) => {
    setSelectedProduct(product);
    setDrawerOpen(true);
  };

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
    if (!products) return { total: 0, withBU: 0, active: 0 };
    return {
      total: products.length,
      withBU: products.filter((p) => p.target_bu).length,
      active: products.filter((p) => p.is_active).length,
    };
  }, [products]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Configuração de Produtos</h1>
        <p className="text-muted-foreground">
          Gerencie produtos, categorias, valores de referência e defina para qual BU cada produto pertence.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Produtos</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Com BU Definida</CardDescription>
            <CardTitle className="text-2xl">{stats.withBU}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Produtos Ativos</CardDescription>
            <CardTitle className="text-2xl">{stats.active}</CardTitle>
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
                {TARGET_BU_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              Sincronizar
            </Button>
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
          ) : filteredProducts.length === 0 ? (
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
                    {paginatedProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-mono text-sm">
                          {product.product_code || "-"}
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
                      {Math.min(currentPage * itemsPerPage, filteredProducts.length)} de{" "}
                      {filteredProducts.length.toLocaleString("pt-BR")}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-3 text-sm">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Drawer */}
      <ProductConfigDrawer
        product={selectedProduct}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
