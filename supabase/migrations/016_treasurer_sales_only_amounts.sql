-- Treasurer view: compute Club and pending/player amounts from sold tickets only
-- (exclude potential donation from unsold tickets until concreted/collected).
-- Depends on: 012_lottery_treasurer_links.sql

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
      round(coalesce(sd.tickets_sold, 0) * lc.donation_per_ticket, 2) as club_expected,
      round(coalesce(sd.tickets_sold, 0) * lc.ticket_price, 2) as expected,
      coalesce(r.lottery_received, 0)::numeric as lottery_received,
      coalesce(r.club_received, 0)::numeric as club_received,
      coalesce(r.delivered, 0)::numeric as delivered,
      s.waived_amount,
      greatest(round(coalesce(sd.tickets_sold, 0) * lc.ticket_price, 2) - s.waived_amount, 0)
        as due_amount,
      least(
        greatest(
          greatest(round(coalesce(sd.tickets_sold, 0) * lc.ticket_price, 2) - s.waived_amount, 0)
            - coalesce(r.delivered, 0),
          0
        ),
        greatest(
          round(
            coalesce(sd.tickets_sold, 0)
              * greatest(lc.ticket_price - lc.donation_per_ticket, 0),
            2
          ) - coalesce(r.lottery_received, 0),
          0
        ) + greatest(
          round(coalesce(sd.tickets_sold, 0) * lc.donation_per_ticket, 2)
            - coalesce(r.club_received, 0),
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
        round(coalesce(sd.tickets_sold, 0) * lc.donation_per_ticket, 2)
          - coalesce(r.club_received, 0),
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

notify pgrst, 'reload schema';
