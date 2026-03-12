import React, { useMemo } from 'react';
import { useRolePermissions } from '../../../hooks/useRolePermissions';
import { Player } from '../../../types/teams';

interface BirthdaysSectionProps {
  players: Player[];
}

export const BirthdaysSection: React.FC<BirthdaysSectionProps> = ({ players }) => {
  const { can } = useRolePermissions();

  const birthdaysThisWeek = useMemo(() => {
    if (!players || players.length === 0) return [];
    
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    return players.filter(player => {
      if (!player.birth_date) return false;
      const birthDate = new Date(player.birth_date);
      const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
      return thisYearBirthday >= startOfWeek && thisYearBirthday < endOfWeek;
    }).sort((a, b) => {
      const dateA = new Date(a.birth_date!);
      const dateB = new Date(b.birth_date!);
      return dateA.getDate() - dateB.getDate();
    });
  }, [players]);

  if (!can.view('sections.birthdays')) return null;
  if (birthdaysThisWeek.length === 0) return null;

  const formatBirthday = (birthDate: string) => {
    const date = new Date(birthDate);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800">🎂 Cumpleaños esta semana</h3>
      </div>
      <div className="space-y-2">
        {birthdaysThisWeek.map((player) => (
          <div key={player.id} className="flex items-center gap-3 p-3 bg-pink-50 rounded-xl">
            <div className="w-10 h-10 bg-pink-200 rounded-full flex items-center justify-center text-xl">
              🎉
            </div>
            <div>
              <p className="font-medium text-gray-800">{player.full_name}</p>
              <p className="text-sm text-pink-600">🎂 {formatBirthday(player.birth_date!)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BirthdaysSection;
