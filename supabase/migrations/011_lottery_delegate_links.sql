-- Public delegate links for lottery teams. A delegate can only collect for the
-- players whose primary team matches the link, and only up to the pending
-- amount after waivers.

create table if not exists public.lottery_delegate_links (
  id uuid primary key default gen_random_uuid(),
  lottery_id uuid not null references public.lotteries(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (lottery_id, team_id)
);

create index if not exists lottery_delegate_links_lottery_idx
  on public.lottery_delegate_links (lottery_id, team_id);

alter table public.lottery_delegate_links enable row level security;

revoke all on public.lottery_delegate_links from anon, authenticated;
grant all on public.lottery_delegate_links to service_role;

alter table public.lottery_settlements
  add column if not exists created_via text not null default 'admin'
    check (created_via in ('admin', 'delegate')),
  add column if not exists delegate_team_id uuid references public.teams(id) on delete set null;

create index if not exists lottery_settlements_delegate_team_idx
  on public.lottery_settlements (delegate_team_id)
  where delegate_team_id is not null;

create or replace function public._lottery_delegate_players(
  p_lottery_id uuid,
  p_team_id uuid
)
returns table (
  player_id uuid,
  player_name text,
  tickets_assigned integer,
  tickets_sold integer,
  tickets_unsold integer,
  ticket_price numeric,
  donation_per_ticket numeric,
  lottery_expected numeric,
  club_expected numeric,
  expected numeric,
  lottery_received numeric,
  club_received numeric,
  delivered numeric,
  waived_amount numeric,
  due_amount numeric,
  pending_amount numeric,
  pending_lottery numeric,
  pending_club numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with delegate_sellers as (
    select
      ls.player_id,
      greatest(coalesce(ls.waived_amount, 0), 0)::numeric as waived_amount
    from public.lottery_sellers ls
    where ls.lottery_id = p_lottery_id
      and exists (
        select 1
        from public.team_players tp
        where tp.player_id = ls.player_id
          and tp.team_id = p_team_id
          and tp.is_active = true
          and tp.is_primary = true
      )
  ),
  lottery_config as (
    select
      greatest(coalesce(l.ticket_price, 0), 0)::numeric as ticket_price,
      least(
        greatest(coalesce(l.donation_per_ticket, 0), 0),
        greatest(coalesce(l.ticket_price, 0), 0)
      )::numeric as donation_per_ticket
    from public.lotteries l
    where l.id = p_lottery_id
  ),
  assigned as (
    select
      ds.player_id,
      coalesce(sum(greatest(b.end_number - b.start_number + 1, 0)), 0)::integer
        as tickets_assigned
    from delegate_sellers ds
    left join public.ticket_blocks b
      on b.lottery_id = p_lottery_id
      and b.player_id = ds.player_id
    group by ds.player_id
  ),
  sold as (
    select
      ds.player_id,
      count(t.id)::integer as tickets_sold
    from delegate_sellers ds
    left join public.ticket_blocks b
      on b.lottery_id = p_lottery_id
      and b.player_id = ds.player_id
    left join public.tickets t
      on t.ticket_block_id = b.id
      and t.status = 'sold'
    group by ds.player_id
  ),
  settlement_rows as (
    select
      s.player_id,
      case
        when coalesce(s.lottery_received, 0) > 0
          or coalesce(s.club_received, 0) > 0
          then coalesce(s.lottery_received, 0)
        when coalesce(s.ticket_price, 0) > 0
          then round(
            coalesce(s.sales_received, 0)
              * greatest(s.ticket_price - coalesce(s.donation_per_ticket, 0), 0)
              / s.ticket_price,
            2
          )
        else 0
      end as lottery_received,
      case
        when coalesce(s.lottery_received, 0) > 0
          or coalesce(s.club_received, 0) > 0
          then coalesce(s.club_received, 0)
        else greatest(
          coalesce(s.delivered_amount, 0)
            - case
                when coalesce(s.ticket_price, 0) > 0
                  then round(
                    coalesce(s.sales_received, 0)
                      * greatest(
                          s.ticket_price - coalesce(s.donation_per_ticket, 0),
                          0
                        )
                      / s.ticket_price,
                    2
                  )
                else 0
              end,
          0
        )
      end as club_received,
      coalesce(s.delivered_amount, 0) as delivered
    from public.lottery_settlements s
    where s.lottery_id = p_lottery_id
      and s.status <> 'void'
  ),
  received as (
    select
      sr.player_id,
      round(coalesce(sum(sr.lottery_received), 0), 2) as lottery_received,
      round(coalesce(sum(sr.club_received), 0), 2) as club_received,
      round(coalesce(sum(sr.delivered), 0), 2) as delivered
    from settlement_rows sr
    group by sr.player_id
  )
  select
    ds.player_id,
    coalesce(p.full_name, 'Jugador')::text as player_name,
    coalesce(a.tickets_assigned, 0)::integer as tickets_assigned,
    coalesce(sd.tickets_sold, 0)::integer as tickets_sold,
    greatest(coalesce(a.tickets_assigned, 0) - coalesce(sd.tickets_sold, 0), 0)::integer
      as tickets_unsold,
    lc.ticket_price,
    lc.donation_per_ticket,
    round(
      coalesce(sd.tickets_sold, 0)
        * greatest(lc.ticket_price - lc.donation_per_ticket, 0),
      2
    ) as lottery_expected,
    round(
      coalesce(a.tickets_assigned, 0) * lc.donation_per_ticket,
      2
    ) as club_expected,
    round(
      coalesce(sd.tickets_sold, 0) * lc.ticket_price
        + greatest(coalesce(a.tickets_assigned, 0) - coalesce(sd.tickets_sold, 0), 0)
          * lc.donation_per_ticket,
      2
    ) as expected,
    coalesce(r.lottery_received, 0)::numeric as lottery_received,
    coalesce(r.club_received, 0)::numeric as club_received,
    coalesce(r.delivered, 0)::numeric as delivered,
    ds.waived_amount,
    greatest(
      round(
        coalesce(sd.tickets_sold, 0) * lc.ticket_price
          + greatest(coalesce(a.tickets_assigned, 0) - coalesce(sd.tickets_sold, 0), 0)
            * lc.donation_per_ticket,
        2
      ) - ds.waived_amount,
      0
    ) as due_amount,
    least(
      greatest(
        round(
          coalesce(sd.tickets_sold, 0) * lc.ticket_price
            + greatest(coalesce(a.tickets_assigned, 0) - coalesce(sd.tickets_sold, 0), 0)
              * lc.donation_per_ticket,
          2
        ) - ds.waived_amount - coalesce(r.delivered, 0),
        0
      ),
      greatest(
        greatest(
          round(
            coalesce(sd.tickets_sold, 0)
              * greatest(lc.ticket_price - lc.donation_per_ticket, 0),
            2
          ) - coalesce(r.lottery_received, 0),
          0
        )
        + greatest(
          round(
            coalesce(a.tickets_assigned, 0) * lc.donation_per_ticket,
            2
          ) - coalesce(r.club_received, 0),
          0
        ),
        0
      )
    ) as pending_amount,
    greatest(
      round(
        coalesce(sd.tickets_sold, 0)
          * greatest(lc.ticket_price - lc.donation_per_ticket, 0),
        2
      ) - coalesce(r.lottery_received, 0),
      0
    ) as pending_lottery,
    greatest(
      round(
        coalesce(a.tickets_assigned, 0) * lc.donation_per_ticket,
        2
      ) - coalesce(r.club_received, 0),
      0
    ) as pending_club
  from delegate_sellers ds
  cross join lottery_config lc
  left join public.players p on p.id = ds.player_id
  left join assigned a on a.player_id = ds.player_id
  left join sold sd on sd.player_id = ds.player_id
  left join received r on r.player_id = ds.player_id
  order by coalesce(p.full_name, 'Jugador'), ds.player_id;
$$;

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
    'pending_club', dp.pending_club
  ) order by dp.player_name, dp.player_id), '[]'::jsonb)
  into v_players
  from public._lottery_delegate_players(v_link.lottery_id, v_link.team_id) dp;

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

create or replace function public.create_lottery_delegate_collection(
  p_token uuid,
  p_player_id uuid,
  p_lottery_received numeric,
  p_club_received numeric,
  p_payment_method text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.lottery_delegate_links%rowtype;
  v_player record;
  v_total numeric(10,2);
  v_result jsonb;
begin
  if p_lottery_received is null or p_lottery_received < 0 then
    raise exception 'El importe de Lotería no es válido';
  end if;
  if p_club_received is null or p_club_received < 0 then
    raise exception 'El importe de Club no es válido';
  end if;

  v_total := round(p_lottery_received + p_club_received, 2);
  if v_total <= 0 then
    raise exception 'El importe total del cobro debe ser mayor que 0';
  end if;

  select * into v_link
  from public.lottery_delegate_links
  where token = p_token;

  if not found then
    raise exception 'Enlace de delegado no válido';
  end if;

  perform 1
  from public.lottery_sellers
  where lottery_id = v_link.lottery_id
    and player_id = p_player_id
  for update;

  if not found then
    raise exception 'Jugadora no asignada a esta lotería';
  end if;

  select * into v_player
  from public._lottery_delegate_players(v_link.lottery_id, v_link.team_id)
  where player_id = p_player_id;

  if not found then
    raise exception 'La jugadora no pertenece a este equipo';
  end if;

  if v_player.pending_amount <= 0.005 then
    raise exception 'La jugadora no tiene importe pendiente';
  end if;

  if v_total > v_player.pending_amount + 0.005 then
    raise exception 'El importe supera el pendiente de %', round(v_player.pending_amount, 2);
  end if;

  v_result := public.admin_register_collection_split(
    v_link.lottery_id,
    p_player_id,
    p_lottery_received,
    p_club_received,
    p_payment_method,
    p_notes,
    null
  );

  update public.lottery_settlements
  set created_via = 'delegate',
      delegate_team_id = v_link.team_id
  where id = (v_result ->> 'settlement_id')::uuid;

  select * into v_player
  from public._lottery_delegate_players(v_link.lottery_id, v_link.team_id)
  where player_id = p_player_id;

  return v_result || jsonb_build_object('player', to_jsonb(v_player));
end;
$$;

create or replace function public.admin_get_lottery_delegate_links(p_lottery_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team record;
  v_token uuid;
  v_links jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from public.lotteries where id = p_lottery_id) then
    raise exception 'Lotería no encontrada';
  end if;

  for v_team in
    select
      t.id,
      t.name,
      count(distinct ls.player_id)::integer as player_count
    from public.lottery_sellers ls
    join public.team_players tp
      on tp.player_id = ls.player_id
      and tp.is_active = true
      and tp.is_primary = true
    join public.teams t on t.id = tp.team_id
    where ls.lottery_id = p_lottery_id
    group by t.id, t.name
    order by t.name, t.id
  loop
    insert into public.lottery_delegate_links (lottery_id, team_id)
    values (p_lottery_id, v_team.id)
    on conflict (lottery_id, team_id) do nothing;

    select token into v_token
    from public.lottery_delegate_links
    where lottery_id = p_lottery_id
      and team_id = v_team.id;

    v_links := v_links || jsonb_build_array(jsonb_build_object(
      'team_id', v_team.id,
      'team_name', v_team.name,
      'player_count', v_team.player_count,
      'token', v_token
    ));
  end loop;

  return jsonb_build_object('teams', v_links);
end;
$$;

revoke all on function public._lottery_delegate_players(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public._lottery_delegate_players(uuid, uuid)
  to service_role;

revoke all on function public.get_lottery_delegate(uuid)
  from public, anon, authenticated;
grant execute on function public.get_lottery_delegate(uuid)
  to anon, authenticated;

revoke all on function public.create_lottery_delegate_collection(uuid, uuid, numeric, numeric, text, text)
  from public, anon, authenticated;
grant execute on function public.create_lottery_delegate_collection(uuid, uuid, numeric, numeric, text, text)
  to anon, authenticated;

revoke all on function public.admin_get_lottery_delegate_links(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_get_lottery_delegate_links(uuid)
  to service_role;

notify pgrst, 'reload schema';
