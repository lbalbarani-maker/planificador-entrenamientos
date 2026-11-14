import React, { useEffect, useState } from 'react';
import { lotteryAdminApi } from '../../lib/lotteryAdmin';
import { DelegateTeamLink } from '../../types/lottery';
import { useAppDialog } from '../AppDialog';

interface DelegatesModalProps {
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

const DelegatesModal: React.FC<DelegatesModalProps> = ({
  lotteryId,
  lotteryName,
  onClose,
}) => {
  const dialog = useAppDialog();
  const [teams, setTeams] = useState<DelegateTeamLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    lotteryAdminApi
      .getDelegateLinks(lotteryId)
      .then((result) => {
        if (!active) return;
        setTeams(
          [...result.teams].sort((a, b) => a.team_name.localeCompare(b.team_name, 'es')),
        );
        setError('');
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No se pudieron cargar los enlaces de delegado',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [lotteryId]);

  const delegateUrl = (token: string) => `${window.location.origin}/d/${token}`;

  const handleCopy = async (team: DelegateTeamLink) => {
    const url = delegateUrl(team.token);
    if (await copyText(url)) {
      await dialog.alert({
        title: 'Enlace copiado',
        message: url,
        variant: 'success',
      });
      return;
    }
    await dialog.alert({
      title: 'Copia este enlace',
      message: (
        <input
          readOnly
          value={url}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      ),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xl font-bold">Delegados</h3>
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
          <p className="text-sm text-gray-500">Cargando enlaces...</p>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : teams.length === 0 ? (
          <p className="text-sm text-gray-500">
            No hay equipos con jugadoras participantes en esta lotería.
          </p>
        ) : (
          <div className="space-y-2">
            {teams.map((team) => (
              <div
                key={team.team_id}
                className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-gray-800">{team.team_name}</p>
                  <p className="text-xs text-gray-500">
                    {team.player_count} jugadora{team.player_count === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(team)}
                    className="rounded-lg bg-sanse-blue px-3 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    Copiar enlace
                  </button>
                  <a
                    href={delegateUrl(team.token)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Ver
                  </a>
                </div>
              </div>
            ))}
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

export default DelegatesModal;
