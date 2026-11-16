-- Public treasurer access for lotteries: single token + 6-digit PIN per lottery,
-- read-only treasury view and treasurer-side reception from delegates.
-- Depends on: 005_lottery_v2, 006_lottery_reconciliation, 007_lottery_split,
-- 011_lottery_delegate_links.

create extension if not exists pgcrypto;

create table if not exists public.lottery_treasurer_links (
  lottery_id uuid primary key references public.lotteries(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  pin_hash text,
  pin_set_at timestamptz,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lottery_treasurer_links enable row level security;

revoke all on public.lottery_treasurer_links from anon, authenticated;
grant all on public.lottery_treasurer_links to service_role;

-- ---------------------------------------------------------------------------
-- Internal: per-player treasury metrics for a whole lottery (all sellers).
-- ---------------------------------------------------------------------------

create or replace function public._lottery_treasurer_players(p_lottery_id uuid)
returns table (
  team_id uuid,
  team_name text,
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
  pending_club numeric,
  tickets_collected integer,
  tickets_pending_collect integer,
  player_pending_amount numeric,
  delegate_pending_amount numeric,
  treasurer_received_amount numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with sellers as (
    select
      ls.player_id,
      greatest(coalesce(ls.waived_amount, 0), 0)::numeric as waived_amount
    from public.lottery_sellers ls
    where ls.lottery_id = p_lottery_id
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
  primary_team as (
    select distinct on (tp.player_id)
      tp.player_id,
      tp.team_id,
      t.name as team_name
    from public.team_players tp
    join public.teams t on t.id = tp.team_id
    where tp.is_active = true
      and tp.is_primary = true
    order by tp.player_id, t.name, tp.team_id
  ),
  assigned as (
    select
      s.player_id,
      coalesce(sum(greatest(b.end_number - b.start_number + 1, 0)), 0)::integer
        as tickets_assigned
    from sellers s
    left join public.ticket_blocks b
      on b.lottery_id = p_lottery_id
      and b.player_id = s.player_id
    group by s.player_id
  ),
  sold as (
    select
      s.player_id,
      count(tk.id)::integer as tickets_sold
    from sellers s
    left join public.ticket_blocks b
      on b.lottery_id = p_lottery_id
      and b.player_id = s.player_id
    left join public.tickets tk
      on tk.ticket_block_id = b.id
      and tk.status = 'sold'
    group by s.player_id
  ),
  settlement_rows as (
    select
      st.player_id,
      coalesce(st.created_via, 'admin') as created_via,
      st.treasurer_delivery_id,
      case
        when coalesce(st.lottery_received, 0) > 0
          or coalesce(st.club_received, 0) > 0
          then coalesce(st.lottery_received, 0)
        when coalesce(st.ticket_price, 0) > 0
          then round(
            coalesce(st.sales_received, 0)
              * greatest(st.ticket_price - coalesce(st.donation_per_ticket, 0), 0)
              / st.ticket_price,
            2
          )
        else 0
      end as lottery_received,
      case
        when coalesce(st.lottery_received, 0) > 0
          or coalesce(st.club_received, 0) > 0
          then coalesce(st.club_received, 0)
        else greatest(
          coalesce(st.delivered_amount, 0)
            - case
                when coalesce(st.ticket_price, 0) > 0
                  then round(
                    coalesce(st.sales_received, 0)
                      * greatest(
                          st.ticket_price - coalesce(st.donation_per_ticket, 0),
                          0
                        )
                      / st.ticket_price,
                    2
                  )
                else 0
              end,
          0
        )
      end as club_received,
      coalesce(st.delivered_amount, 0) as delivered
    from public.lottery_settlements st
    where st.lottery_id = p_lottery_id
      and st.status = 'confirmed'
  ),
  received as (
    select
      sr.player_id,
      round(coalesce(sum(sr.lottery_received), 0), 2) as lottery_received,
      round(coalesce(sum(sr.club_received), 0), 2) as club_received,
      round(coalesce(sum(sr.delivered), 0), 2) as delivered,
      round(coalesce(sum(
        case when sr.created_via = 'delegate' and sr.treasurer_delivery_id is null
          then sr.delivered else 0 end
      ), 0), 2) as delegate_pending_amount,
      round(coalesce(sum(
        case when sr.created_via = 'delegate' and sr.treasurer_delivery_id is null
          then 0 else sr.delivered end
      ), 0), 2) as treasurer_received_amount
    from settlement_rows sr
    group by sr.player_id
  ),
  base as (
    select
      s.player_id,
      coalesce(p.full_name, 'Jugador')::text as player_name,
      pt.team_id,
      coalesce(pt.team_name, 'Sin equipo')::text as team_name,
      coalesce(a.tickets_assigned, 0)::integer as tickets_assigned,
      coalesce(sd.tickets_sold, 0)::integer as tickets_sold,
      greatest(coalesce(a.tickets_assigned, 0) - coalesce(sd.tickets_sold, 0), 0)::integer
        as tickets_unsold,
      lc.ticket_price,
      lc.donation_per_ticket,
      greatest(lc.ticket_price - lc.donation_per_ticket, 0)::numeric as lottery_per_ticket,
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
      s.waived_amount,
      greatest(
        round(
          coalesce(sd.tickets_sold, 0) * lc.ticket_price
            + greatest(coalesce(a.tickets_assigned, 0) - coalesce(sd.tickets_sold, 0), 0)
              * lc.donation_per_ticket,
          2
        ) - s.waived_amount,
        0
      ) as due_amount,
      least(
        greatest(
          round(
            coalesce(sd.tickets_sold, 0) * lc.ticket_price
              + greatest(coalesce(a.tickets_assigned, 0) - coalesce(sd.tickets_sold, 0), 0)
                * lc.donation_per_ticket,
            2
          ) - s.waived_amount - coalesce(r.delivered, 0),
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
      ) as pending_club,
      coalesce(r.delegate_pending_amount, 0)::numeric as delegate_pending_amount,
      coalesce(r.treasurer_received_amount, 0)::numeric as treasurer_received_amount
    from sellers s
    cross join lottery_config lc
    left join public.players p on p.id = s.player_id
    left join primary_team pt on pt.player_id = s.player_id
    left join assigned a on a.player_id = s.player_id
    left join sold sd on sd.player_id = s.player_id
    left join received r on r.player_id = s.player_id
  )
  select
    b.team_id,
    b.team_name,
    b.player_id,
    b.player_name,
    b.tickets_assigned,
    b.tickets_sold,
    b.tickets_unsold,
    b.ticket_price,
    b.donation_per_ticket,
    b.lottery_expected,
    b.club_expected,
    b.expected,
    b.lottery_received,
    b.club_received,
    b.delivered,
    b.waived_amount,
    b.due_amount,
    b.pending_amount,
    b.pending_lottery,
    b.pending_club,
    case
      when b.tickets_sold <= 0 then 0
      when b.lottery_per_ticket > 0 then
        least(floor(b.lottery_received / b.lottery_per_ticket)::integer, b.tickets_sold)
      when b.pending_lottery <= 0.005 then b.tickets_sold
      else 0
    end as tickets_collected,
    greatest(
      b.tickets_sold
      - case
          when b.tickets_sold <= 0 then 0
          when b.lottery_per_ticket > 0 then
            least(floor(b.lottery_received / b.lottery_per_ticket)::integer, b.tickets_sold)
          when b.pending_lottery <= 0.005 then b.tickets_sold
          else 0
        end,
      0
    ) as tickets_pending_collect,
    b.pending_amount as player_pending_amount,
    b.delegate_pending_amount,
    b.treasurer_received_amount
  from base b
  order by b.team_name, b.player_name, b.player_id;
$$;

-- ---------------------------------------------------------------------------
-- Admin: access/link and PIN management (service_role only)
-- ---------------------------------------------------------------------------

create or replace function public.admin_get_lottery_treasurer_access(p_lottery_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
  v_pin_set boolean;
begin
  if not exists (select 1 from public.lotteries where id = p_lottery_id) then
    raise exception 'Lotería no encontrada';
  end if;

  insert into public.lottery_treasurer_links (lottery_id)
  values (p_lottery_id)
  on conflict (lottery_id) do nothing;

  select token, (pin_hash is not null)
  into v_token, v_pin_set
  from public.lottery_treasurer_links
  where lottery_id = p_lottery_id;

  return jsonb_build_object('token', v_token, 'pin_set', v_pin_set);
end;
$$;

create or replace function public.admin_set_lottery_treasurer_pin(
  p_lottery_id uuid,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
begin
  if p_pin is null or p_pin !~ '^\d{6}$' then
    raise exception 'El PIN debe tener exactamente 6 dígitos';
  end if;

  if not exists (select 1 from public.lotteries where id = p_lottery_id) then
    raise exception 'Lotería no encontrada';
  end if;

  insert into public.lottery_treasurer_links (lottery_id)
  values (p_lottery_id)
  on conflict (lottery_id) do nothing;

  update public.lottery_treasurer_links
  set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')),
      pin_set_at = now(),
      failed_attempts = 0,
      locked_until = null,
      updated_at = now()
  where lottery_id = p_lottery_id
  returning token into v_token;

  return jsonb_build_object('token', v_token, 'pin_set', true);
end;
$$;

create or replace function public.admin_clear_lottery_treasurer_pin(p_lottery_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
begin
  if not exists (select 1 from public.lotteries where id = p_lottery_id) then
    raise exception 'Lotería no encontrada';
  end if;

  insert into public.lottery_treasurer_links (lottery_id)
  values (p_lottery_id)
  on conflict (lottery_id) do nothing;

  update public.lottery_treasurer_links
  set pin_hash = null,
      pin_set_at = null,
      failed_attempts = 0,
      locked_until = null,
      updated_at = now()
  where lottery_id = p_lottery_id
  returning token into v_token;

  return jsonb_build_object('token', v_token, 'pin_set', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Public: PIN verification helper (validates token+pin, updates attempts)
-- ---------------------------------------------------------------------------

create or replace function public._verify_lottery_treasurer_pin(
  p_token uuid,
  p_pin text
)
returns public.lottery_treasurer_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.lottery_treasurer_links%rowtype;
begin
  select * into v_link
  from public.lottery_treasurer_links
  where token = p_token
  for update;

  if not found then
    raise exception 'Enlace de tesorería no válido';
  end if;

  if v_link.pin_hash is null then
    raise exception 'PIN no configurado';
  end if;

  if v_link.locked_until is not null and v_link.locked_until > now() then
    raise exception 'Acceso bloqueado temporalmente. Inténtalo más tarde';
  end if;

  if p_pin is null or v_link.pin_hash <> extensions.crypt(p_pin, v_link.pin_hash) then
    update public.lottery_treasurer_links
    set failed_attempts = failed_attempts + 1,
        locked_until = case
          when failed_attempts + 1 >= 10 then now() + interval '15 minutes'
          else null
        end,
        updated_at = now()
    where lottery_id = v_link.lottery_id;
    raise exception 'PIN incorrecto';
  end if;

  update public.lottery_treasurer_links
  set failed_attempts = 0,
      locked_until = null,
      updated_at = now()
  where lottery_id = v_link.lottery_id
  returning * into v_link;

  return v_link;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public: treasurer view (teams + players + totals)
-- ---------------------------------------------------------------------------

create or replace function public.get_lottery_treasurer(
  p_token uuid,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.lottery_treasurer_links%rowtype;
  v_lottery public.lotteries%rowtype;
  v_players jsonb;
  v_teams jsonb;
  v_totals jsonb;
begin
  v_link := public._verify_lottery_treasurer_pin(p_token, p_pin);

  select * into v_lottery
  from public.lotteries
  where id = v_link.lottery_id;

  if not found then
    raise exception 'Lotería no encontrada';
  end if;

  select coalesce(jsonb_agg(to_jsonb(tp) order by tp.team_name, tp.player_name, tp.player_id), '[]'::jsonb)
  into v_players
  from public._lottery_treasurer_players(v_lottery.id) tp;

  select coalesce(jsonb_agg(team_obj order by team_name), '[]'::jsonb)
  into v_teams
  from (
    select
      (p ->> 'team_name')::text as team_name,
      case
        when p ->> 'team_id' is null then null
        else (p ->> 'team_id')::uuid
      end as team_id,
      jsonb_build_object(
        'team_id', case when p ->> 'team_id' is null then null else (p ->> 'team_id')::uuid end,
        'team_name', p ->> 'team_name',
        'player_count', count(*)::integer,
        'tickets_assigned', coalesce(sum((p ->> 'tickets_assigned')::integer), 0),
        'tickets_sold', coalesce(sum((p ->> 'tickets_sold')::integer), 0),
        'tickets_unsold', coalesce(sum((p ->> 'tickets_unsold')::integer), 0),
        'tickets_collected', coalesce(sum((p ->> 'tickets_collected')::integer), 0),
        'tickets_pending_collect', coalesce(sum((p ->> 'tickets_pending_collect')::integer), 0),
        'lottery_expected', round(coalesce(sum((p ->> 'lottery_expected')::numeric), 0), 2),
        'club_expected', round(coalesce(sum((p ->> 'club_expected')::numeric), 0), 2),
        'expected', round(coalesce(sum((p ->> 'expected')::numeric), 0), 2),
        'delivered', round(coalesce(sum((p ->> 'delivered')::numeric), 0), 2),
        'pending_amount', round(coalesce(sum((p ->> 'pending_amount')::numeric), 0), 2),
        'pending_lottery', round(coalesce(sum((p ->> 'pending_lottery')::numeric), 0), 2),
        'pending_club', round(coalesce(sum((p ->> 'pending_club')::numeric), 0), 2),
        'player_pending_amount', round(coalesce(sum((p ->> 'player_pending_amount')::numeric), 0), 2),
        'delegate_pending_amount', round(coalesce(sum((p ->> 'delegate_pending_amount')::numeric), 0), 2),
        'treasurer_received_amount', round(coalesce(sum((p ->> 'treasurer_received_amount')::numeric), 0), 2),
        'players', coalesce(jsonb_agg(p order by p ->> 'player_name', p ->> 'player_id'), '[]'::jsonb)
      ) as team_obj
    from jsonb_array_elements(v_players) as p
    group by (p ->> 'team_name'), (p ->> 'team_id')
  ) grouped;

  select coalesce(jsonb_build_object(
    'player_count', count(*)::integer,
    'tickets_assigned', coalesce(sum((p ->> 'tickets_assigned')::integer), 0),
    'tickets_sold', coalesce(sum((p ->> 'tickets_sold')::integer), 0),
    'tickets_unsold', coalesce(sum((p ->> 'tickets_unsold')::integer), 0),
    'tickets_collected', coalesce(sum((p ->> 'tickets_collected')::integer), 0),
    'tickets_pending_collect', coalesce(sum((p ->> 'tickets_pending_collect')::integer), 0),
    'lottery_expected', round(coalesce(sum((p ->> 'lottery_expected')::numeric), 0), 2),
    'club_expected', round(coalesce(sum((p ->> 'club_expected')::numeric), 0), 2),
    'expected', round(coalesce(sum((p ->> 'expected')::numeric), 0), 2),
    'delivered', round(coalesce(sum((p ->> 'delivered')::numeric), 0), 2),
    'pending_amount', round(coalesce(sum((p ->> 'pending_amount')::numeric), 0), 2),
    'pending_lottery', round(coalesce(sum((p ->> 'pending_lottery')::numeric), 0), 2),
    'pending_club', round(coalesce(sum((p ->> 'pending_club')::numeric), 0), 2),
    'player_pending_amount', round(coalesce(sum((p ->> 'player_pending_amount')::numeric), 0), 2),
    'delegate_pending_amount', round(coalesce(sum((p ->> 'delegate_pending_amount')::numeric), 0), 2),
    'treasurer_received_amount', round(coalesce(sum((p ->> 'treasurer_received_amount')::numeric), 0), 2)
  ), '{}'::jsonb)
  into v_totals
  from jsonb_array_elements(v_players) as p;

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
    'teams', v_teams,
    'totals', v_totals
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Public: treasurer receives money from delegate (by team, optional player filter)
-- ---------------------------------------------------------------------------

create or replace function public.receive_lottery_treasurer_from_delegate(
  p_token uuid,
  p_pin text,
  p_team_id uuid,
  p_player_ids uuid[] default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.lottery_treasurer_links%rowtype;
  v_settlement_ids uuid[];
  v_amount numeric(10,2);
  v_count integer;
  v_player_count integer;
  v_snapshot jsonb;
  v_delivery_id uuid;
begin
  v_link := public._verify_lottery_treasurer_pin(p_token, p_pin);

  select array_agg(id),
         coalesce(round(sum(delivered_amount), 2), 0),
         count(*),
         count(distinct player_id)
  into v_settlement_ids, v_amount, v_count, v_player_count
  from (
    select s.id, s.player_id, s.delivered_amount
    from public.lottery_settlements s
    where s.lottery_id = v_link.lottery_id
      and s.status = 'confirmed'
      and s.treasurer_delivery_id is null
      and coalesce(s.created_via, 'admin') = 'delegate'
      and s.delegate_team_id = p_team_id
      and (
        p_player_ids is null
        or array_length(p_player_ids, 1) is null
        or s.player_id = any(p_player_ids)
      )
    for update
  ) locked_rows;

  if v_count is null or v_count = 0 then
    raise exception 'No hay cobros del delegado pendientes de recepción para la selección indicada';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'settlement_id', s.id,
    'player_id', s.player_id,
    'sales_received', s.sales_received,
    'donation_received', s.donation_received,
    'lottery_received', s.lottery_received,
    'club_received', s.club_received,
    'total_received', s.delivered_amount,
    'created_at', s.created_at,
    'created_via', s.created_via,
    'delegate_team_id', s.delegate_team_id
  ) order by s.created_at, s.id), '[]'::jsonb)
  into v_snapshot
  from public.lottery_settlements s
  where s.id = any(v_settlement_ids);

  insert into public.lottery_treasurer_deliveries (
    lottery_id,
    amount,
    notes,
    snapshot,
    created_by
  ) values (
    v_link.lottery_id,
    v_amount,
    nullif(trim(p_notes), ''),
    jsonb_build_object(
      'amount', v_amount,
      'settlement_count', v_count,
      'player_count', v_player_count,
      'team_id', p_team_id,
      'player_ids', coalesce(p_player_ids, '{}'::uuid[]),
      'source', 'treasurer_public',
      'settlements', v_snapshot
    ),
    null
  ) returning id into v_delivery_id;

  update public.lottery_settlements
  set treasurer_delivery_id = v_delivery_id
  where id = any(v_settlement_ids);

  return jsonb_build_object(
    'ok', true,
    'delivery_id', v_delivery_id,
    'amount', v_amount,
    'settlement_count', v_count,
    'player_count', v_player_count,
    'team_id', p_team_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public._lottery_treasurer_players(uuid)
  from public, anon, authenticated;
grant execute on function public._lottery_treasurer_players(uuid)
  to service_role;

revoke all on function public.admin_get_lottery_treasurer_access(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_get_lottery_treasurer_access(uuid)
  to service_role;

revoke all on function public.admin_set_lottery_treasurer_pin(uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_set_lottery_treasurer_pin(uuid, text)
  to service_role;

revoke all on function public.admin_clear_lottery_treasurer_pin(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_clear_lottery_treasurer_pin(uuid)
  to service_role;

revoke all on function public._verify_lottery_treasurer_pin(uuid, text)
  from public, anon, authenticated;
grant execute on function public._verify_lottery_treasurer_pin(uuid, text)
  to anon, authenticated;

revoke all on function public.get_lottery_treasurer(uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_lottery_treasurer(uuid, text)
  to anon, authenticated;

revoke all on function public.receive_lottery_treasurer_from_delegate(uuid, text, uuid, uuid[], text)
  from public, anon, authenticated;
grant execute on function public.receive_lottery_treasurer_from_delegate(uuid, text, uuid, uuid[], text)
  to anon, authenticated;

notify pgrst, 'reload schema';
