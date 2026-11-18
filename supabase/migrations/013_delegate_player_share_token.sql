-- Expose each player's seller share_token to the public delegate view so the
-- delegate can share individual selling links (/j/:token) with players/parents.
-- Depends on: 011_lottery_delegate_links.sql

create or replace function public.get_lottery_delegate(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.lottery_delegate_links%rowtype;
  v_lottery public.lotteries%rowtype;
  v_team_name text;
  v_players jsonb;
begin
  select * into v_link
  from public.lottery_delegate_links
  where token = p_token;

  if not found then
    return null;
  end if;

  select * into v_lottery
  from public.lotteries
  where id = v_link.lottery_id;

  if not found then
    return null;
  end if;

  select t.name into v_team_name
  from public.teams t
  where t.id = v_link.team_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'player_id', dp.player_id,
    'player_name', dp.player_name,
    'tickets_assigned', dp.tickets_assigned,
    'tickets_sold', dp.tickets_sold,
    'tickets_unsold', dp.tickets_unsold,
    'lottery_expected', dp.lottery_expected,
    'club_expected', dp.club_expected,
    'expected', dp.expected,
    'lottery_received', dp.lottery_received,
    'club_received', dp.club_received,
    'delivered', dp.delivered,
    'waived_amount', dp.waived_amount,
    'due_amount', dp.due_amount,
    'pending_amount', dp.pending_amount,
    'pending_lottery', dp.pending_lottery,
    'pending_club', dp.pending_club,
    'share_token', ls.share_token
  ) order by dp.player_name, dp.player_id), '[]'::jsonb)
  into v_players
  from public._lottery_delegate_players(v_link.lottery_id, v_link.team_id) dp
  join public.lottery_sellers ls
    on ls.lottery_id = v_link.lottery_id
    and ls.player_id = dp.player_id;

  return jsonb_build_object(
    'lottery', jsonb_build_object(
      'id', v_lottery.id,
      'club_id', v_lottery.club_id,
      'name', v_lottery.name,
      'description', v_lottery.description,
      'draw_date', v_lottery.draw_date,
      'ticket_price', v_lottery.ticket_price,
      'donation_per_ticket', v_lottery.donation_per_ticket,
      'total_tickets', v_lottery.total_tickets,
      'num_tacos', v_lottery.num_tacos,
      'tickets_per_taco', v_lottery.tickets_per_taco,
      'start_number', v_lottery.start_number,
      'end_number', v_lottery.end_number,
      'lottery_number_1', v_lottery.lottery_number_1,
      'lottery_number_2', v_lottery.lottery_number_2,
      'sales_status', v_lottery.sales_status,
      'is_active', v_lottery.is_active
    ),
    'delegate', jsonb_build_object(
      'team_id', v_link.team_id,
      'team_name', coalesce(v_team_name, 'Equipo'),
      'token', v_link.token
    ),
    'players', v_players
  );
end;
$$;

notify pgrst, 'reload schema';
