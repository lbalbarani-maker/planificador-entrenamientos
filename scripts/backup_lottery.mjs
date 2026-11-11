import fs from 'node:fs';
import path from 'node:path';

const envPath = path.join(process.cwd(), 'frontend', '.env.local');
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    })
);

const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const lotteryId = process.argv[2] || 'f67b615a-12ed-4796-8419-dda9c961869a';

if (!url || !key) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en frontend/.env.local');
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
};

async function selectAll(table, query, pageSize = 1000) {
  const rows = [];
  let offset = 0;
  while (true) {
    const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
      headers: {
        ...headers,
        Range: `${offset}-${offset + pageSize - 1}`,
        'Range-Unit': 'items',
      },
    });
    if (!response.ok) {
      throw new Error(`${table}: ${response.status} ${await response.text()}`);
    }
    const page = await response.json();
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

const lottery = (await selectAll('lotteries', `id=eq.${lotteryId}&select=*`))[0];
const blocks = await selectAll('ticket_blocks', `lottery_id=eq.${lotteryId}&select=*&order=id.asc`);
const tickets = await selectAll('tickets', `lottery_id=eq.${lotteryId}&select=*&order=id.asc`);
const players = await selectAll('players', 'select=*&order=id.asc');
const teams = await selectAll('teams', 'select=*&order=id.asc');
const teamPlayers = await selectAll('team_players', 'select=*&order=id.asc');
const clubs = await selectAll('clubs', 'select=*&order=id.asc');
const sponsors = lottery?.club_id
  ? await selectAll('sponsors', `club_id=eq.${lottery.club_id}&select=*&order=id.asc`)
  : [];

const output = {
  exported_at: new Date().toISOString(),
  source: url,
  lottery_id: lotteryId,
  lottery,
  blocks,
  tickets,
  clubs,
  players,
  teams,
  team_players: teamPlayers,
  sponsors,
};

const backupDir = path.join(process.cwd(), 'backups');
fs.mkdirSync(backupDir, { recursive: true });
const fileName = `lottery-${lotteryId}-${new Date().toISOString().slice(0, 10)}.json`;
const outputPath = path.join(backupDir, fileName);
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log(JSON.stringify({
  outputPath,
  lottery: lottery?.name,
  blocks: blocks.length,
  tickets: tickets.length,
  sold: tickets.filter((ticket) => ticket.status === 'sold').length,
  players: players.length,
}, null, 2));
