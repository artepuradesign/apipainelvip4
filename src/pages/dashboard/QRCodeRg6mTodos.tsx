import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Loader2, User, ChevronLeft, ChevronRight, RefreshCw, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
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

const getQrCodeUrl = (reg: RegistroData) => {
  if (reg.qr_code_path) {
    return `${PHP_VALIDATION_BASE}/${reg.qr_code_path}`;
  }
  // Fallback: gerar via API externa
  const viewUrl = `https://qr.atito.com.br/qrvalidation/?token=${encodeURIComponent(reg.token)}&ref=${encodeURIComponent(reg.token)}&cod=${encodeURIComponent(reg.token)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(viewUrl)}`;
};

const QRCodeRg6mTodos = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [registrations, setRegistrations] = useState<RegistroData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteToken, setDeleteToken] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const loadRegistrations = useCallback(async (page: number) => {
    try {
      setLoading(true);
      const offset = (page - 1) * ITEMS_PER_PAGE;
      const response = await fetch(`${PHP_API_BASE}/list_users.php?limit=${ITEMS_PER_PAGE}&offset=${offset}`);
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
  }, []);

  useEffect(() => {
    loadRegistrations(currentPage);
  }, [currentPage, loadRegistrations]);

  const handleDelete = async () => {
    if (!deleteToken) return;
    setDeleting(true);
    try {
      const formData = new FormData();
      formData.append('token', deleteToken);
      const response = await fetch(`${PHP_VALIDATION_BASE}/delete_user.php`, {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        toast.success('Cadastro excluído com sucesso');
        await loadRegistrations(currentPage);
      } else {
        toast.error('Erro ao excluir cadastro');
      }
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir cadastro');
    } finally {
      setDeleting(false);
      setDeleteToken(null);
    }
  };

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
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6 px-2 sm:px-0 pb-6">
      <ScrollToTop />
      <SimpleTitleBar title="Todos os Cadastros - QR Code RG" onBack={() => navigate('/dashboard/qrcode-rg-6m')} />

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/qrcode-rg-6m')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <Button variant="outline" size="sm" onClick={() => loadRegistrations(currentPage)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">
          {total} cadastro{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Modal de confirmação de exclusão */}
      <Dialog open={!!deleteToken} onOpenChange={(open) => !open && setDeleteToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este cadastro? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteToken(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="w-full">
        <CardContent className="p-0 sm:p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Carregando cadastros...</span>
            </div>
          ) : registrations.length > 0 ? (
            <>
              {isMobile ? (
                <div className="space-y-4 p-3">
                  {registrations.map((reg) => (
                    <div key={reg.id} className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
                      {/* Foto + QR Code centralizados */}
                      <div className="flex gap-4 justify-center">
                        {reg.photo_path ? (
                          <img
                            src={`${PHP_VALIDATION_BASE}/${reg.photo_path}`}
                            alt="Foto"
                            className="w-28 h-36 object-cover rounded-lg border shadow-sm"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-28 h-36 bg-muted rounded-lg flex items-center justify-center border">
                            <User className="h-10 w-10 text-muted-foreground" />
                          </div>
                        )}
                        <img
                          src={getQrCodeUrl(reg)}
                          alt="QR Code"
                          className="w-36 h-36 rounded-lg border shadow-sm"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>

                      {/* Nome e documento centralizados */}
                      <div className="text-center space-y-0.5">
                        <div className="font-bold text-base">{reg.full_name}</div>
                        <div className="font-mono text-sm text-muted-foreground">{reg.document_number}</div>
                      </div>

                      {/* Status */}
                      <div className="flex items-center justify-center gap-2">
                        <Badge
                          variant={reg.validation === 'verified' ? 'secondary' : 'outline'}
                          className={
                            reg.validation === 'verified'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          }
                        >
                          {reg.validation === 'verified' ? 'Verificado' : 'Pendente'}
                        </Badge>
                        {reg.is_expired && (
                          <Badge variant="destructive" className="text-xs">Expirado</Badge>
                        )}
                      </div>

                      {/* Detalhes */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                        <div><span className="font-semibold text-foreground">Nasc:</span> {formatDate(reg.birth_date)}</div>
                        <div><span className="font-semibold text-foreground">Cadastro:</span> {formatFullDate(reg.created_at)}</div>
                        <div><span className="font-semibold text-foreground">Validade:</span> <span className={reg.is_expired ? 'text-red-500 font-semibold' : ''}>{formatDate(reg.expiry_date)}</span></div>
                        <div><span className="font-semibold text-foreground">Token:</span> {reg.token.substring(0, 8)}...</div>
                        <div><span className="font-semibold text-foreground">Pai:</span> {reg.parent1 || '-'}</div>
                        <div><span className="font-semibold text-foreground">Mãe:</span> {reg.parent2 || '-'}</div>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        <a
                          href={`https://qr.atito.com.br/qrvalidation/?token=${reg.token}&ref=${reg.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Visualizar
                        </a>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="ml-auto"
                          onClick={() => setDeleteToken(reg.token)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Foto</TableHead>
                        <TableHead>QR Code</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead>Validade</TableHead>
                        <TableHead className="text-center">Validação</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registrations.map((reg) => (
                        <TableRow key={reg.id}>
                          <TableCell className="py-3">
                            {reg.photo_path ? (
                              <img
                                src={`${PHP_VALIDATION_BASE}/${reg.photo_path}`}
                                alt="Foto"
                                className="w-[100px] h-[130px] object-cover rounded-md border shadow-sm"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-[100px] h-[130px] bg-muted rounded-md flex items-center justify-center border">
                                <User className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            <img
                              src={getQrCodeUrl(reg)}
                              alt="QR Code"
                              className="w-[130px] h-[130px] rounded-md border shadow-sm"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-sm">{reg.full_name}</div>
                            <div className="text-xs text-muted-foreground mt-1">Pai: {reg.parent1 || '-'}</div>
                            <div className="text-xs text-muted-foreground">Mãe: {reg.parent2 || '-'}</div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{reg.document_number}</TableCell>
                          <TableCell className="text-xs">{formatFullDate(reg.created_at)}</TableCell>
                          <TableCell className="text-xs">
                            <span className={reg.is_expired ? 'text-red-500 font-semibold' : ''}>
                              {formatDate(reg.expiry_date)}
                              {reg.is_expired && ' (Exp.)'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={reg.validation === 'verified' ? 'secondary' : 'outline'}
                              className={
                                reg.validation === 'verified'
                                  ? 'text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              }
                            >
                              {reg.validation === 'verified' ? 'Verificado' : 'Pendente'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-center gap-2">
                              <a
                                href={`https://qr.atito.com.br/qrvalidation/?token=${reg.token}&ref=${reg.token}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary underline"
                              >
                                Visualizar
                              </a>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setDeleteToken(reg.token)}
                              >
                                <Trash2 className="h-3 w-3 mr-1" /> Excluir
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 py-4 px-2">
                  <Button variant="outline" size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {getPageNumbers().map((page) => (
                    <Button
                      key={page}
                      variant={page === currentPage ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => goToPage(page)}
                      className="min-w-[36px]"
                    >
                      {page}
                    </Button>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Nenhum cadastro encontrado</h3>
              <p className="text-sm">Seus cadastros realizados aparecerão aqui</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QRCodeRg6mTodos;
