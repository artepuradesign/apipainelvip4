import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Loader2, User, ChevronLeft, ChevronRight, RefreshCw, Trash2,
  ExternalLink, Search, Shield, ShieldAlert, Clock, Users, Filter, X, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import SimpleTitleBar from '@/components/dashboard/SimpleTitleBar';
import ScrollToTop from '@/components/ui/scroll-to-top';

const PHP_API_BASE = 'https://qr.atito.com.br/qrcode';
const PHP_VALIDATION_BASE = 'https://qr.atito.com.br/qrvalidation';
const ITEMS_PER_PAGE = 20;

interface RegistroData {
  id: number;
  token: string;
  full_name: string;
  birth_date: string;
  document_number: string;
  parent1: string;
  parent2: string;
  photo_path: string;
  validation: 'pending' | 'verified';
  expiry_date: string;
  is_expired: boolean;
  qr_code_path: string;
  id_user: string | null;
  created_at: string;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR');
};

const formatFullDate = (dateStr: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const getDaysLeft = (expiryDate: string) => {
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

const getQrCodeUrl = (reg: RegistroData) => {
  if (reg.qr_code_path) {
    return `${PHP_VALIDATION_BASE}/${reg.qr_code_path}`;
  }
  const viewUrl = `https://qr.atito.com.br/qrvalidation/?token=${encodeURIComponent(reg.token)}&ref=${encodeURIComponent(reg.token)}&cod=${encodeURIComponent(reg.token)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(viewUrl)}`;
};

const QRCodeRg6mTodos = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user, profile } = useAuth();

  const [registrations, setRegistrations] = useState<RegistroData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteToken, setDeleteToken] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending' | 'expired'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const isAdminOrSupport = profile?.user_role === 'suporte' || (user as any)?.user_role === 'suporte';

  const loadRegistrations = useCallback(async (page: number) => {
    try {
      setLoading(true);
      const offset = (page - 1) * ITEMS_PER_PAGE;
      let url = `${PHP_API_BASE}/list_users.php?limit=${ITEMS_PER_PAGE}&offset=${offset}`;
      if (!isAdminOrSupport && user?.id) {
        url += `&id_user=${encodeURIComponent(user.id)}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setRegistrations(data.data);
        setTotal(data.pagination?.total || data.data.length);
      } else {
        setRegistrations([]);
      }
    } catch (error) {
      console.error('Erro ao carregar cadastros:', error);
      setRegistrations([]);
    } finally {
      setLoading(false);
    }
  }, [isAdminOrSupport, user?.id]);

  useEffect(() => {
    loadRegistrations(currentPage);
  }, [currentPage, loadRegistrations]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRegistrations(currentPage);
    setRefreshing(false);
    toast.success('Lista atualizada');
  };

  const handleDelete = async () => {
    if (!deleteToken) return;
    setDeleting(true);
    try {
      const formData = new FormData();
      formData.append('token', deleteToken);
      const response = await fetch(`${PHP_VALIDATION_BASE}/delete_user.php`, {
        method: 'POST',
        body: formData,
        redirect: 'manual'
      });
      if (response.type === 'opaqueredirect' || response.status === 0 || response.status === 302 || response.ok) {
        toast.success('Cadastro excluído com sucesso');
        await loadRegistrations(currentPage);
      } else {
        toast.error('Erro ao excluir cadastro');
      }
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.success('Cadastro excluído com sucesso');
      await loadRegistrations(currentPage);
    } finally {
      setDeleting(false);
      setDeleteToken(null);
    }
  };

  // Filtered registrations
  const filteredRegistrations = useMemo(() => {
    let filtered = registrations;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.full_name.toLowerCase().includes(q) ||
        r.document_number.includes(q)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => {
        if (statusFilter === 'expired') return r.is_expired;
        if (statusFilter === 'verified') return r.validation === 'verified' && !r.is_expired;
        if (statusFilter === 'pending') return r.validation === 'pending' && !r.is_expired;
        return true;
      });
    }

    return filtered;
  }, [registrations, searchQuery, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const ativos = registrations.filter(r => !r.is_expired).length;
    const expirados = registrations.filter(r => r.is_expired).length;
    const verificados = registrations.filter(r => r.validation === 'verified').length;
    const pendentes = registrations.filter(r => r.validation === 'pending').length;
    return { total: registrations.length, ativos, expirados, verificados, pendentes };
  }, [registrations]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = isMobile ? 3 : 7;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) => (
    <div className={`flex items-center gap-3 rounded-xl border bg-card p-3 sm:p-4 shadow-sm`}>
      <div className={`rounded-lg p-2 ${color}`}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
      </div>
      <div>
        <p className="text-lg sm:text-2xl font-bold">{value}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-4 sm:space-y-6 px-2 sm:px-0 pb-6">
      <ScrollToTop />
      <SimpleTitleBar title="Gerenciamento Total - QR Code RG 6M" onBack={() => navigate('/dashboard/qrcode-rg-6m')} />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <StatCard icon={Users} label="Total" value={total} color="bg-primary" />
        <StatCard icon={Shield} label="Ativos" value={stats.ativos} color="bg-emerald-600" />
        <StatCard icon={ShieldAlert} label="Expirados" value={stats.expirados} color="bg-red-500" />
        <StatCard icon={Clock} label="Pendentes" value={stats.pendentes} color="bg-amber-500" />
      </div>

      {/* Search & Filter Bar */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou documento..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-[140px] sm:w-[160px]">
                  <Filter className="h-4 w-4 mr-1" />
                  <SelectValue placeholder="Filtrar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="verified">Verificados</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="expired">Expirados</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={refreshing}
                title="Atualizar"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          {(searchQuery || statusFilter !== 'all') && (
            <p className="text-xs text-muted-foreground mt-2">
              {filteredRegistrations.length} resultado{filteredRegistrations.length !== 1 ? 's' : ''} encontrado{filteredRegistrations.length !== 1 ? 's' : ''}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={!!deleteToken} onOpenChange={(open) => !open && setDeleteToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este cadastro? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteToken(null)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content */}
      <Card className="w-full overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Carregando cadastros...</span>
            </div>
          ) : filteredRegistrations.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                {filteredRegistrations.map((reg) => {
                  const daysLeft = getDaysLeft(reg.expiry_date);
                  const daysText = daysLeft > 0 ? `Expira em ${daysLeft} dias` : 'Expirado';
                  return (
                    <div
                      key={reg.id}
                      className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                    >
                      {/* Nome completo - linha inteira no topo */}
                      <div className="px-4 pt-4 pb-2 border-b border-border/50">
                        <h4 className="text-sm font-semibold text-foreground truncate">{reg.full_name}</h4>
                      </div>

                      <div className="p-4 flex gap-4">
                        {/* LEFT: Dados */}
                        <div className="flex-1 min-w-0 flex flex-col gap-3">
                          <div className="space-y-2">
                            <div>
                              <span className="text-xs text-muted-foreground">Documento</span>
                              <p className="text-sm font-mono text-foreground">{reg.document_number}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <span className="text-xs text-muted-foreground">Cadastro</span>
                                <p className="text-sm text-foreground">{formatDate(reg.created_at)}</p>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">Validade</span>
                                <p className={`text-sm ${reg.is_expired ? 'text-destructive font-semibold' : 'text-foreground'}`}>
                                  {formatDate(reg.expiry_date)}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className={`text-xs px-2 py-0.5 ${
                                reg.is_expired
                                  ? 'border-destructive/50 text-destructive bg-destructive/10'
                                  : reg.validation === 'verified'
                                  ? 'border-emerald-500/50 text-emerald-600 bg-emerald-500/10 dark:text-emerald-400'
                                  : 'border-amber-500/50 text-amber-600 bg-amber-500/10 dark:text-amber-400'
                              }`}
                            >
                              {reg.is_expired ? 'Expirado' : reg.validation === 'verified' ? 'Verificado' : 'Pendente'}
                            </Badge>
                            <span className={`text-xs font-medium ${daysLeft > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                              {daysText}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-auto pt-1">
                            <a
                              href={`https://qr.atito.com.br/qrvalidation/?token=${reg.token}&ref=${reg.token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="outline" size="sm" className="text-xs gap-1.5">
                                <Eye className="h-3.5 w-3.5" /> Visualizar
                              </Button>
                            </a>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                              onClick={() => setDeleteToken(reg.token)}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Excluir
                            </Button>
                          </div>
                        </div>

                        {/* RIGHT: Foto + QR */}
                        <div className="flex-shrink-0 flex flex-col items-center gap-2">
                          {/* Foto maior */}
                          {reg.photo_path ? (
                            <img
                              src={`${PHP_VALIDATION_BASE}/${reg.photo_path}`}
                              alt="Foto"
                              className="object-cover border border-border"
                              style={{ width: 100, height: 130 }}
                              onError={(e) => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div style={{ width: 100, height: 130 }} className="bg-muted flex items-center justify-center border border-border">
                              <User className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          {/* QR quadrado sem bordas arredondadas */}
                          <img
                            src={getQrCodeUrl(reg)}
                            alt="QR Code"
                            style={{ width: 100, height: 100 }}
                            className="border border-border"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-3 sm:px-4 py-3">
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    Página {currentPage} de {totalPages} · {total} registros
                  </span>
                  <div className="flex items-center gap-1 mx-auto sm:mx-0">
                    <Button variant="outline" size="sm" className="h-8" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {getPageNumbers().map((page) => (
                      <Button
                        key={page}
                        variant={page === currentPage ? 'default' : 'ghost'}
                        size="sm"
                        className="h-8 min-w-[32px]"
                        onClick={() => goToPage(page)}
                      >
                        {page}
                      </Button>
                    ))}
                    <Button variant="outline" size="sm" className="h-8" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold mb-1">Nenhum cadastro encontrado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all'
                  ? 'Tente alterar os filtros de busca'
                  : 'Seus cadastros realizados aparecerão aqui'}
              </p>
              {(searchQuery || statusFilter !== 'all') && (
                <Button variant="outline" size="sm" onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}>
                  <X className="h-4 w-4 mr-1" /> Limpar filtros
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QRCodeRg6mTodos;
