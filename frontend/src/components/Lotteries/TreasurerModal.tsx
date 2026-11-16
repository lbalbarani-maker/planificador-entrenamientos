import React, { useEffect, useState } from 'react';
import { lotteryAdminApi } from '../../lib/lotteryAdmin';
import { useAppDialog } from '../AppDialog';

interface TreasurerModalProps {
  lotteryId: string;
  lotteryName: string;
  onClose: () => void;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const TreasurerModal: React.FC<TreasurerModalProps> = ({
  lotteryId,
  lotteryName,
  onClose,
}) => {
  const dialog = useAppDialog();
  const [token, setToken] = useState('');
  const [pinSet, setPinSet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pin, setPin] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    lotteryAdminApi
      .getTreasurerAccess(lotteryId)
      .then((result) => {
        if (!active) return;
        setToken(result.token);
        setPinSet(result.pin_set);
        setError('');
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No se pudo cargar el acceso de tesorería',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [lotteryId]);

  const treasurerUrl = token ? `${window.location.origin}/t/${token}` : '';

  const handleCopy = async () => {
    if (!treasurerUrl) return;
    if (await copyText(treasurerUrl)) {
      await dialog.alert({
        title: 'Enlace copiado',
        message: treasurerUrl,
        variant: 'success',
      });
      return;
    }
    await dialog.alert({
      title: 'Copia este enlace',
      message: (
        <input
          readOnly
          value={treasurerUrl}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      ),
    });
  };

  const handleSavePin = async () => {
    if (!/^\d{6}$/.test(pin)) {
      await dialog.alert({
        title: 'PIN no válido',
        message: 'El PIN debe tener exactamente 6 dígitos.',
        variant: 'danger',
      });
      return;
    }
    setSaving(true);
    try {
      const result = await lotteryAdminApi.setTreasurerPin(lotteryId, pin);
      setToken(result.token);
      setPinSet(result.pin_set);
      setPin('');
      setError('');
      await dialog.alert({
        title: 'PIN guardado',
        message: 'El PIN de tesorería se ha configurado correctamente.',
        variant: 'success',
      });
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : 'No se pudo guardar el PIN';
      setError(message);
      await dialog.alert({ title: 'Error', message, variant: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-xl w-full max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xl font-bold">Tesorero</h3>
            <p className="text-sm text-gray-500">{lotteryName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-2xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Cargando acceso...</p>
        ) : error && !token ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-sm font-medium text-gray-800 mb-2">Enlace público</p>
              <p className="break-all rounded bg-gray-50 p-2 text-xs text-gray-600">
                {treasurerUrl || '—'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!token}
                  className="rounded-lg bg-sanse-blue px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Copiar enlace
                </button>
                <a
                  href={pinSet ? treasurerUrl : undefined}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!pinSet}
                  onClick={(event) => {
                    if (!pinSet) event.preventDefault();
                  }}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    pinSet
                      ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      : 'pointer-events-none border-gray-200 text-gray-400'
                  }`}
                >
                  Ver
                </a>
              </div>
              {!pinSet && (
                <p className="mt-2 text-xs text-amber-700">
                  Configura un PIN para activar el acceso antes de abrir “Ver”.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-sm font-medium text-gray-800 mb-1">PIN de acceso</p>
              <p className="text-xs text-gray-500 mb-3">
                {pinSet
                  ? 'PIN configurado. Puedes cambiarlo introduciendo uno nuevo.'
                  : 'Introduce un PIN de 6 dígitos para proteger el acceso.'}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:w-40"
                />
                <button
                  type="button"
                  onClick={handleSavePin}
                  disabled={saving || pin.length !== 6}
                  className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : pinSet ? 'Cambiar PIN' : 'Guardar PIN'}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default TreasurerModal;
