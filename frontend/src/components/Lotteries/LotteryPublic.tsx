import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { lotteryApi } from '../../lib/supabaseLottery';
import { ReceiptData, SaleResult, SellerPageData, Sponsor } from '../../types/lottery';
import { useAppDialog } from '../AppDialog';
import { PhysicalTicketBadge } from './PhysicalTicketBadge';

interface LotteryPublicProps {
  mode?: 'seller' | 'receipt';
}

function pad(value: number): string {
  return Number(value).toString().padStart(4, '0');
}

function money(value: number | null | undefined): string {
  return `${Number(value ?? 0).toFixed(2)}€`;
}

function formatPurchaseDate(value: string): string {
  return new Date(value).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

const QrCode: React.FC<{ value: string; size?: number; className?: string }> = ({
  value,
  size = 220,
  className,
}) => {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc('');
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!src) return null;
  return <img src={src} alt="Código QR" className={className} width={size} height={size} />;
};

async function shareUrl(url: string, text: string): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Sanse Complutense', text, url });
      return;
    } catch {
      return;
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank');
}

const SellerPage: React.FC<{ token: string }> = ({ token }) => {
  const dialog = useAppDialog();
  const [data, setData] = useState<SellerPageData | null>(null);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [physicalTicketDelivered, setPhysicalTicketDelivered] = useState(false);
  const [selling, setSelling] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [saleResult, setSaleResult] = useState<SaleResult | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateOffset = () => {
      const offset = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      setBottomOffset(offset);
    };

    updateOffset();
    viewport.addEventListener('resize', updateOffset);
    viewport.addEventListener('scroll', updateOffset);
    return () => {
      viewport.removeEventListener('resize', updateOffset);
      viewport.removeEventListener('scroll', updateOffset);
    };
  }, []);

  const loadData = async () => {
    try {
      const result = await lotteryApi.getSellerPage(token);
      if (!result) {
        setError('Este enlace de vendedor no es válido o ha caducado.');
        setData(null);
        return;
      }
      setData(result);
      setError('');
      if (result.lottery.club_id) {
        lotteryApi
          .getSponsors(result.lottery.club_id)
          .then(setSponsors)
          .catch(() => setSponsors([]));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la lotería');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [token]);

  const allTickets = useMemo(
    () => data?.tacos.flatMap((taco) => taco.tickets) ?? [],
    [data],
  );
  const purchases = data?.purchases ?? [];
  const sold = allTickets.filter((ticket) => ticket.status === 'sold').length;
  const available = allTickets.length - sold;
  const collected = sold * Number(data?.lottery.ticket_price ?? 0);
  const donation = sold * Number(data?.lottery.donation_per_ticket ?? 0);
  const selectedTotal = selected.length * Number(data?.lottery.ticket_price ?? 0);
  const shareLink = `${window.location.origin}/j/${token}`;
  const isOpen = data?.lottery.sales_status === 'open';

  const toggleTicket = (ticketId: string) => {
    setRequestId(null);
    setSelected((current) =>
      current.includes(ticketId)
        ? current.filter((id) => id !== ticketId)
        : [...current, ticketId],
    );
  };

  const handleSale = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!data || selected.length === 0) return;
    const cleanedName = buyerName.trim();
    if (!cleanedName) {
      await dialog.alert({
        title: 'Falta el nombre',
        message: 'Escribe el nombre del comprador.',
        variant: 'warning',
      });
      return;
    }

    setSelling(true);
    const idempotencyKey = requestId ?? newRequestId();
    if (!requestId) setRequestId(idempotencyKey);

    try {
      const result = await lotteryApi.createSale(
        token,
        cleanedName,
        selected,
        idempotencyKey,
        physicalTicketDelivered,
      );
      setSaleResult(result);
      setShowSaleModal(false);
      setSelected([]);
      setBuyerName('');
      setPhysicalTicketDelivered(false);
      setRequestId(null);
      await loadData();
    } catch (saleError) {
      await dialog.alert({
        title: 'No se pudo completar la venta',
        message:
          saleError instanceof Error ? saleError.message : 'No se pudo completar la venta',
        variant: 'danger',
      });
      await loadData();
    } finally {
      setSelling(false);
    }
  };

  const handleCopyLink = async () => {
    if (await copyText(shareLink)) {
      await dialog.alert({
        title: 'Enlace copiado',
        message: shareLink,
        variant: 'success',
      });
      return;
    }
    await dialog.alert({
      title: 'Copia este enlace',
      message: (
        <input
          readOnly
          value={shareLink}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-700"
        />
      ),
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sanse-blue to-blue-700 flex items-center justify-center p-4">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-xl max-w-md w-full">
          <div className="text-4xl mb-3">🎰</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Enlace no válido</h1>
          <p className="text-gray-600">{error || 'No se encontró la lotería.'}</p>
        </div>
      </div>
    );
  }

  const lottery = data.lottery;
  const lotteryNumbers = [lottery.lottery_number_1, lottery.lottery_number_2].filter(Boolean);

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-sanse-blue to-blue-700 p-3 pb-32 sm:p-4 sm:pb-28">
      <div className="max-w-md mx-auto min-w-0">
        <div className="text-center mb-5">
          <img
            src="/images/logosanse2.png"
            alt="Sanse Complutense"
            className="w-16 h-16 mx-auto mb-2 object-contain"
          />
          <h1 className="text-2xl font-bold text-white">{lottery.name}</h1>
          <p className="text-blue-200 text-sm">Jugadora: {data.seller.player_name}</p>
          {data.seller.team_names.length > 0 && (
            <p className="text-blue-300 text-xs">{data.seller.team_names.join(' · ')}</p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-lg mb-4">
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div>
              <div className="text-xl font-bold text-green-600">{sold}</div>
              <div className="text-[10px] text-gray-500">Vendidos</div>
            </div>
            <div>
              <div className="text-xl font-bold text-blue-600">{available}</div>
              <div className="text-[10px] text-gray-500">Pendientes</div>
            </div>
            <div>
              <div className="text-xl font-bold text-purple-600">{money(collected)}</div>
              <div className="text-[10px] text-gray-500">Cobrado</div>
            </div>
            <div>
              <div className="text-xl font-bold text-orange-600">{money(donation)}</div>
              <div className="text-[10px] text-gray-500">Donativo</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t flex items-center justify-between">
            <span className="text-lg font-bold text-sanse-blue">{money(lottery.ticket_price)} / papeleta</span>
            {!isOpen && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Venta cerrada</span>}
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            Incluye {money(lottery.donation_per_ticket)} de donativo. Las papeletas no vendidas también generan ese donativo.
          </p>
          {lotteryNumbers.length > 0 && (
            <div className="mt-2 flex gap-2 justify-center">
              {lotteryNumbers.map((number) => (
                <span key={number} className="bg-blue-50 text-blue-700 font-bold rounded-lg px-3 py-1">
                  {number}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white/10 rounded-2xl p-3 mb-4 flex gap-2">
          <button
            onClick={handleCopyLink}
            className="flex-1 bg-white/90 text-sanse-blue font-bold py-2 rounded-lg text-sm"
          >
            📋 Copiar
          </button>
          <button
            onClick={() => shareUrl(shareLink, `Compra papeletas de ${lottery.name}:`)}
            className="flex-1 bg-green-500 text-white font-bold py-2 rounded-lg text-sm"
          >
            WhatsApp
          </button>
          <button
            onClick={() => setShowQr(true)}
            className="flex-1 bg-white/90 text-sanse-blue font-bold py-2 rounded-lg text-sm"
          >
            🔳 QR
          </button>
        </div>

        {sponsors.length > 0 && (
          <div className="bg-white/10 rounded-xl p-3 mb-4">
            <p className="text-white text-center text-xs mb-2">Patrocinadores</p>
            <div className="flex flex-wrap justify-center gap-2">
              {sponsors.map((sponsor) => (
                <div key={sponsor.id} className="bg-white rounded p-1.5">
                  {sponsor.logo_url ? (
                    <img src={sponsor.logo_url} alt={sponsor.name} className="h-8 object-contain" />
                  ) : (
                    <span className="text-gray-800 text-xs font-bold">{sponsor.name}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {selected.length > 0 && isOpen && (
          <div className="sticky top-0 z-30 mb-3 flex items-center justify-between gap-2 rounded-xl border border-white/60 bg-white/95 px-3 py-2 text-sm shadow-md backdrop-blur">
            <span className="font-semibold text-sanse-blue">
              {selected.length} seleccionada{selected.length === 1 ? '' : 's'}
            </span>
            <span className="font-bold text-sanse-blue">{money(selectedTotal)}</span>
          </div>
        )}

        <div className="space-y-4">
          {data.tacos.map((taco) => (
            <div key={taco.id} className="bg-white rounded-2xl p-4 shadow-lg">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-bold text-gray-800">Taco {taco.block_number}</h2>
                <span className="text-xs text-gray-500 font-mono">
                  {pad(taco.start_number)} - {pad(taco.end_number)}
                </span>
              </div>
              <div
                data-testid="ticket-grid"
                className="grid grid-cols-4 gap-1.5 min-[380px]:gap-2 sm:grid-cols-5"
              >
                {taco.tickets.map((ticket) => {
                  const isSelected = selected.includes(ticket.id);
                  const isSold = ticket.status === 'sold';
                  return (
                    <button
                      key={ticket.id}
                      data-testid={`ticket-${ticket.number}`}
                      data-status={ticket.status}
                      onClick={() => {
                        if (!isSold && isOpen) toggleTicket(ticket.id);
                      }}
                      disabled={isSold || !isOpen}
                      className={`min-w-0 py-2 rounded-lg text-[11px] font-bold transition-colors sm:py-2.5 sm:text-xs ${
                        isSold
                          ? 'bg-red-100 text-red-500 cursor-not-allowed'
                          : isSelected
                            ? 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {pad(ticket.number)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 bg-white rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-bold text-gray-800">Historial de ventas</h2>
            <button
              type="button"
              onClick={() => void loadData()}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200"
            >
              Actualizar
            </button>
          </div>
          {purchases.length === 0 ? (
            <p className="text-sm text-gray-500">Todavía no hay ventas registradas.</p>
          ) : (
            <div className="space-y-2">
              {purchases.map((purchase) => {
                const isVoid = purchase.status === 'void';
                return (
                  <div
                    key={purchase.id}
                    data-testid="seller-purchase"
                    className={`rounded-xl border p-3 ${
                      isVoid
                        ? 'border-red-200 bg-red-50/60 text-gray-500'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-800">
                          {purchase.buyer_name}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {formatPurchaseDate(purchase.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-800">
                          {money(purchase.total_amount)}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {purchase.quantity} papeleta{purchase.quantity === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {purchase.ticket_numbers.map((number) => (
                        <span
                          key={number}
                          className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-gray-700 ring-1 ring-gray-200"
                        >
                          {pad(number)}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                          isVoid
                            ? 'bg-red-100 text-red-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {isVoid ? 'Anulada' : 'Confirmada'}
                      </span>
                      <PhysicalTicketBadge delivered={purchase.physical_ticket_delivered} />
                      <button
                        type="button"
                        onClick={() => window.open(`/r/${purchase.token}`, '_blank')}
                        className="rounded-lg bg-sanse-blue px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                      >
                        Ver recibo
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          shareUrl(
                            `${window.location.origin}/r/${purchase.token}`,
                            `Recibo de ${purchase.buyer_name}:`,
                          )
                        }
                        className="rounded-lg bg-green-500 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-green-600"
                      >
                        Compartir recibo
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-center gap-4 text-white text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-300 rounded" /> Disponible</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-400 rounded" /> Seleccionada</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded" /> Vendida</span>
        </div>
      </div>

      {selected.length > 0 && isOpen && (
        <div
          className="fixed left-0 right-0 z-40 border-t bg-white p-3 shadow-2xl sm:p-4"
          style={{ bottom: bottomOffset }}
        >
          <div className="max-w-md mx-auto flex items-center justify-between gap-3 pb-[env(safe-area-inset-bottom)]">
            <div className="min-w-0">
              <p className="text-sm text-gray-500">{selected.length} papeleta(s)</p>
              <p className="text-2xl font-bold text-sanse-blue">{money(selectedTotal)}</p>
            </div>
            <button
              onClick={() => {
                setPhysicalTicketDelivered(false);
                setShowSaleModal(true);
              }}
              className="shrink-0 rounded-xl bg-sanse-blue px-6 py-3 text-base font-bold text-white hover:bg-blue-700 sm:px-8 sm:text-lg"
            >
              VENDER
            </button>
          </div>
        </div>
      )}

      {showSaleModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full">
            <h3 className="text-xl font-bold text-center mb-1">Confirmar venta</h3>
            <p className="text-center text-gray-500 text-sm mb-4">
              {selected.length} papeleta(s) · {money(selectedTotal)}
            </p>
            <div className="flex flex-wrap justify-center gap-1 mb-4 max-h-24 overflow-y-auto">
              {selected
                .map((id) => allTickets.find((ticket) => ticket.id === id)?.number)
                .filter((number): number is number => number !== undefined)
                .sort((a, b) => a - b)
                .map((number) => (
                  <span key={number} className="bg-yellow-100 text-yellow-800 text-xs font-mono px-2 py-1 rounded">
                    {pad(number)}
                  </span>
                ))}
            </div>
            <form onSubmit={handleSale} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del comprador *</label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(event) => setBuyerName(event.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-xl text-lg"
                  maxLength={100}
                  autoFocus
                  required
                />
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  data-testid="physical-ticket-checkbox"
                  checked={physicalTicketDelivered}
                  onChange={(event) => setPhysicalTicketDelivered(event.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-sanse-blue focus:ring-sanse-blue"
                />
                Se entrega papeleta física
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={selling}
                  className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50"
                >
                  {selling ? 'Vendiendo...' : 'Confirmar venta'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaleModal(false)}
                  className="bg-gray-400 text-white py-3 px-4 rounded-xl font-bold hover:bg-gray-500"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {saleResult && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl text-green-600">✓</span>
            </div>
            <h3 className="text-xl font-bold mb-1">Venta confirmada</h3>
            <p className="text-gray-600 mb-3">
              {saleResult.buyer_name} · {saleResult.quantity} papeleta(s) · {money(saleResult.total_amount)}
            </p>
            <QrCode value={`${window.location.origin}/r/${saleResult.token}`} size={180} className="mx-auto rounded-lg" />
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={() =>
                  shareUrl(
                    `${window.location.origin}/r/${saleResult.token}`,
                    `Recibo de ${saleResult.buyer_name}:`,
                  )
                }
                className="flex-1 bg-green-500 text-white py-2 rounded-lg font-bold text-sm"
              >
                Compartir recibo
              </button>
              <button
                onClick={() => window.open(`/r/${saleResult.token}`, '_blank')}
                className="flex-1 bg-sanse-blue text-white py-2 rounded-lg font-bold text-sm"
              >
                Ver recibo
              </button>
            </div>
            <button
              onClick={() => setSaleResult(null)}
              className="mt-3 w-full bg-gray-100 text-gray-700 py-2 rounded-lg font-medium"
            >
              Seguir vendiendo
            </button>
          </div>
        </div>
      )}

      {showQr && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <h3 className="text-xl font-bold mb-3">Comparte tu enlace</h3>
            <QrCode value={shareLink} size={240} className="mx-auto rounded-lg" />
            <p className="text-xs text-gray-500 break-all mt-3">{shareLink}</p>
            <button
              onClick={() => setShowQr(false)}
              className="mt-4 w-full bg-sanse-blue text-white py-2 rounded-lg font-bold"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const ReceiptPage: React.FC<{ token: string }> = ({ token }) => {
  const [data, setData] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    lotteryApi
      .getReceipt(token)
      .then((result) => {
        if (!active) return;
        if (!result) {
          setError('Este recibo no es válido.');
          setData(null);
          return;
        }
        setData(result);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el recibo');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sanse-blue to-blue-700 flex items-center justify-center p-4">
        <div className="text-white text-xl">Cargando recibo...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-xl max-w-md w-full">
          <h1 className="text-xl font-bold text-gray-800 mb-2">Recibo no encontrado</h1>
          <p className="text-gray-600">{error || 'Comprueba el enlace.'}</p>
        </div>
      </div>
    );
  }

  const { purchase, lottery, seller, tickets } = data;
  const lotteryNumbers = [lottery.lottery_number_1, lottery.lottery_number_2].filter(Boolean);
  const isVoid = purchase.status === 'void';

  return (
    <div className="min-h-screen bg-gradient-to-br from-sanse-blue to-blue-700 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-sanse-blue to-blue-600 p-6 text-center">
            <img
              src="/images/logosanse2.png"
              alt="Sanse Complutense"
              className="w-16 h-16 mx-auto mb-2 object-contain"
            />
            <h1 className="text-2xl font-bold text-white">{lottery.name}</h1>
            <p className="text-blue-200 text-sm">Recibo de compra</p>
          </div>

          <div className="p-5">
            {isVoid ? (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-center mb-4">
                <p className="font-bold text-lg">VENTA ANULADA</p>
                <p className="text-sm">Este recibo ya no es válido.</p>
              </div>
            ) : (
              <div className="text-center mb-4">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-3xl text-green-600">✓</span>
                </div>
                <h2 className="text-xl font-bold text-gray-800">¡Compra confirmada!</h2>
                <p className="text-gray-600">Gracias, {purchase.buyer_name}</p>
              </div>
            )}

            {lotteryNumbers.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-700 mb-2 text-center">Números de lotería</h3>
                <div className="grid grid-cols-2 gap-2">
                  {lotteryNumbers.map((number) => (
                    <div key={number} className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                      <span className="text-xl font-bold text-blue-700">{number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Papeletas</span>
                <span className="font-bold">{purchase.quantity}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Precio unitario</span>
                <span className="font-bold">{money(purchase.unit_price)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Donativo</span>
                <span className="font-bold">{money(purchase.donation_amount)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Vendido por</span>
                <span className="font-bold">{seller.player_name}</span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span>Papeleta física</span>
                <PhysicalTicketBadge delivered={purchase.physical_ticket_delivered} />
              </div>
              <div className="border-t pt-2 flex justify-between text-lg font-bold text-sanse-blue">
                <span>Total</span>
                <span>{money(purchase.total_amount)}</span>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-bold text-gray-700 mb-2 text-center">Tus números</h3>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {tickets.map((number) => (
                  <div key={number} className="bg-yellow-50 border border-yellow-300 rounded-lg p-2 text-center">
                    <span className="text-sm font-bold text-yellow-800 font-mono">{pad(number)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800 text-center">
              El portador participa con {money(purchase.unit_price - purchase.donation_per_ticket)} por papeleta en cada número indicado para el sorteo de {lottery.draw_date ? new Date(lottery.draw_date).toLocaleDateString('es-ES') : 'la Lotería Nacional'}.
            </div>

            <div className="mt-3 bg-gray-100 rounded-xl p-3 text-[10px] text-gray-600 text-center leading-relaxed">
              Los premios superiores al límite legal tendrán la retención correspondiente.
              Toda papeleta rota, deteriorada, sin numerar o enmendada será nula. Caduca a los 3 meses.
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

const LotteryPublic: React.FC<LotteryPublicProps> = ({ mode = 'seller' }) => {
  const { token } = useParams<{ token: string }>();
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-gray-600">Enlace no válido</div>
      </div>
    );
  }
  return mode === 'receipt' ? <ReceiptPage token={token} /> : <SellerPage token={token} />;
};

export default LotteryPublic;
