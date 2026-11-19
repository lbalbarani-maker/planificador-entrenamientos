-- Persist delegate confirmation of taco delivery (physical/virtual) per player/seller.
-- Depends on: 014_delegate_team_gender.sql

alter table public.lottery_sellers
  add column if not exists taco_fisico_entregado boolean not null default false,
  add column if not exists taco_virtual_entregado boolean not null default false;

drop function if exists public._lottery_delegate_players(uuid, uuid);

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
  pending_club numeric,
  taco_fisico_entregado boolean,
  taco_virtual_entregado boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with delegate_sellers as (
    select
      ls.player_id,
      greatest(coalesce(ls.waived_amount, 0), 0)::numeric as waived_amount,
      coalesce(ls.taco_fisico_entregado, false) as taco_fisico_entregado,
      coalesce(ls.taco_virtual_entregado, false) as taco_virtual_entregado
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
    ) as pending_club,
    ds.taco_fisico_entregado,
    ds.taco_virtual_entregado
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
  v_team_gender text;
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

  select t.name, t.gender into v_team_name, v_team_gender
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
    'taco_fisico_entregado', dp.taco_fisico_entregado,
    'taco_virtual_entregado', dp.taco_virtual_entregado,
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
      'team_gender', v_team_gender,
      'token', v_link.token
    ),
    'players', v_players
  );
end;
$$;

create or replace function public.set_lottery_delegate_taco_delivery(
  p_token uuid,
  p_player_id uuid,
  p_taco_fisico boolean,
  p_taco_virtual boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.lottery_delegate_links%rowtype;
  v_exists boolean;
begin
  select * into v_link
  from public.lottery_delegate_links
  where token = p_token;

  if not found then
    raise exception 'Enlace de delegado no válido';
  end if;

  select exists (
    select 1
    from public._lottery_delegate_players(v_link.lottery_id, v_link.team_id)
    where player_id = p_player_id
  ) into v_exists;

  if not v_exists then
    raise exception 'La jugadora no pertenece a este equipo';
  end if;

  update public.lottery_sellers
  set taco_fisico_entregado = coalesce(p_taco_fisico, false),
      taco_virtual_entregado = coalesce(p_taco_virtual, false)
  where lottery_id = v_link.lottery_id
    and player_id = p_player_id;

  if not found then
    raise exception 'Jugadora no asignada a esta lotería';
  end if;

  return jsonb_build_object(
    'ok', true,
    'player_id', p_player_id,
    'taco_fisico_entregado', coalesce(p_taco_fisico, false),
    'taco_virtual_entregado', coalesce(p_taco_virtual, false)
  );
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

revoke all on function public.set_lottery_delegate_taco_delivery(uuid, uuid, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.set_lottery_delegate_taco_delivery(uuid, uuid, boolean, boolean)
  to anon, authenticated;

notify pgrst, 'reload schema';
