-- Split collections into explicit lottery and club buckets.
-- This keeps the legacy sales_received/donation_received columns as aliases so
-- older reports keep working while the app moves to lottery_received/club_received.

alter table public.lottery_settlements
  add column if not exists lottery_received numeric(10,2) not null default 0
    check (lottery_received >= 0),
  add column if not exists club_received numeric(10,2) not null default 0
    check (club_received >= 0);

-- Keep the sold numbers on the purchase itself. Tickets are released when a sale
-- is annulled, so without this snapshot the history and receipt would lose them.
alter table public.ticket_purchases
  add column if not exists ticket_numbers integer[] not null default '{}';

-- Backfill existing settlements from the legacy split. In the old model
-- sales_received held the full ticket price and donation_received only held the
-- donation for unsold tickets, so the lottery part is the ticket price minus the
-- donation part.
with calculated as (
  select
    s.id,
    coalesce(s.delivered_amount, 0) as total_received,
    coalesce(s.sales_received, 0) as sales_received,
    coalesce(s.ticket_price, l.ticket_price, 0) as ticket_price,
    least(
      greatest(coalesce(s.donation_per_ticket, l.donation_per_ticket, 0), 0),
      greatest(coalesce(s.ticket_price, l.ticket_price, 0), 0)
    ) as donation_per_ticket
  from public.lottery_settlements s
  join public.lotteries l on l.id = s.lottery_id
  where coalesce(s.lottery_received, 0) = 0
    and coalesce(s.club_received, 0) = 0
    and coalesce(s.delivered_amount, 0) > 0
),
split as (
  select
    id,
    total_received,
    case
      when ticket_price > 0 then
        round(
          least(
            greatest(
              sales_received * (ticket_price - donation_per_ticket) / ticket_price,
              0
            ),
            total_received
          ),
          2
        )
      else 0
    end as lottery_received
  from calculated
)
update public.lottery_settlements s
set lottery_received = split.lottery_received,
    club_received = round(greatest(split.total_received - split.lottery_received, 0), 2)
from split
where s.id = split.id;

-- Purchases are only linked to a settlement when the player has been fully
-- collected. This avoids marking every sale as collected after a partial
-- payment. A purchase remains annullable only while the player has no active
-- collections.
create or replace function public._lottery_recompute_purchase_links(
  p_lottery_id uuid,
  p_player_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lottery public.lotteries%rowtype;
  v_assigned integer;
  v_sold integer;
  v_expected numeric(10,2);
  v_collected numeric(10,2);
  v_latest_settlement uuid;
  v_ticket_price numeric(10,2);
  v_donation_per_ticket numeric(10,2);
begin
  select * into v_lottery
  from public.lotteries
  where id = p_lottery_id;

  if not found then
    return;
  end if;

  v_ticket_price := greatest(coalesce(v_lottery.ticket_price, 0), 0);
  v_donation_per_ticket := least(
    greatest(coalesce(v_lottery.donation_per_ticket, 0), 0),
    v_ticket_price
  );

  select coalesce(sum(end_number - start_number + 1), 0)
  into v_assigned
  from public.ticket_blocks
  where lottery_id = p_lottery_id
    and player_id = p_player_id;

  select coalesce(sum(quantity), 0)
  into v_sold
  from public.ticket_purchases
  where lottery_id = p_lottery_id
    and seller_id = p_player_id
    and status = 'confirmed';

  v_expected := (v_sold * v_ticket_price)
    + (greatest(v_assigned - v_sold, 0) * v_donation_per_ticket);

  select
    coalesce(sum(delivered_amount), 0),
    (array_agg(id order by created_at desc, id desc))[1]
  into v_collected, v_latest_settlement
  from public.lottery_settlements
  where lottery_id = p_lottery_id
    and player_id = p_player_id
    and status = 'confirmed';

  if v_expected > 0 and v_collected + 0.005 >= v_expected then
    update public.ticket_purchases
    set settlement_id = v_latest_settlement
    where lottery_id = p_lottery_id
      and seller_id = p_player_id
      and status = 'confirmed';
  else
    update public.ticket_purchases
    set settlement_id = null
    where lottery_id = p_lottery_id
      and seller_id = p_player_id
      and status = 'confirmed';
  end if;
end;
$$;

create or replace function public.admin_register_collection_split(
  p_lottery_id uuid,
  p_player_id uuid,
  p_lottery_received numeric,
  p_club_received numeric,
  p_payment_method text default null,
  p_notes text default null,
  p_admin_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lottery public.lotteries%rowtype;
  v_assigned integer;
  v_sold integer;
  v_unsold integer;
  v_ticket_price numeric(10,2);
  v_donation_per_ticket numeric(10,2);
  v_lottery_per_ticket numeric(10,2);
  v_lottery_expected numeric(10,2);
  v_club_expected numeric(10,2);
  v_total_expected numeric(10,2);
  v_sales_expected numeric(10,2);
  v_donation_expected numeric(10,2);
  v_settlement_id uuid;
  v_delivered_total numeric(10,2);
  v_received numeric(10,2);
begin
  if p_lottery_received is null or p_lottery_received < 0 then
    raise exception 'El importe de Lotería no es válido';
  end if;
  if p_club_received is null or p_club_received < 0 then
    raise exception 'El importe de Club no es válido';
  end if;

  v_received := round(p_lottery_received + p_club_received, 2);
  if v_received <= 0 then
    raise exception 'El importe total del cobro debe ser mayor que 0';
  end if;

  select * into v_lottery
  from public.lotteries
  where id = p_lottery_id;

  if not found then
    raise exception 'Lotería no encontrada';
  end if;

  if not exists (
    select 1 from public.lottery_sellers
    where lottery_id = p_lottery_id and player_id = p_player_id
  ) then
    raise exception 'Jugador no asignado a esta lotería';
  end if;

  perform 1
  from public.lottery_sellers
  where lottery_id = p_lottery_id and player_id = p_player_id
  for update;

  v_ticket_price := greatest(coalesce(v_lottery.ticket_price, 0), 0);
  v_donation_per_ticket := least(
    greatest(coalesce(v_lottery.donation_per_ticket, 0), 0),
    v_ticket_price
  );
  v_lottery_per_ticket := greatest(v_ticket_price - v_donation_per_ticket, 0);

  select coalesce(sum(end_number - start_number + 1), 0)
  into v_assigned
  from public.ticket_blocks
  where lottery_id = p_lottery_id and player_id = p_player_id;

  select coalesce(sum(quantity), 0)
  into v_sold
  from public.ticket_purchases
  where lottery_id = p_lottery_id
    and seller_id = p_player_id
    and status = 'confirmed';

  v_unsold := greatest(v_assigned - v_sold, 0);
  v_lottery_expected := round(v_sold * v_lottery_per_ticket, 2);
  v_club_expected := round(v_assigned * v_donation_per_ticket, 2);
  v_total_expected := round(v_lottery_expected + v_club_expected, 2);
  v_sales_expected := round(v_sold * v_ticket_price, 2);
  v_donation_expected := round(v_unsold * v_donation_per_ticket, 2);

  insert into public.lottery_settlements (
    lottery_id,
    player_id,
    tickets_sold,
    expected_amount,
    delivered_amount,
    notes,
    settled_by,
    sales_received,
    donation_received,
    lottery_received,
    club_received,
    payment_method,
    tickets_assigned,
    tickets_unsold,
    ticket_price,
    donation_per_ticket,
    sales_expected,
    donation_expected,
    total_expected
  ) values (
    p_lottery_id,
    p_player_id,
    v_sold,
    v_total_expected,
    v_received,
    nullif(trim(p_notes), ''),
    p_admin_id,
    p_lottery_received,
    p_club_received,
    p_lottery_received,
    p_club_received,
    nullif(trim(p_payment_method), ''),
    v_assigned,
    v_unsold,
    v_ticket_price,
    v_donation_per_ticket,
    v_sales_expected,
    v_donation_expected,
    v_total_expected
  ) returning id into v_settlement_id;

  perform public._lottery_recompute_purchase_links(p_lottery_id, p_player_id);

  select coalesce(sum(delivered_amount), 0)
  into v_delivered_total
  from public.lottery_settlements
  where lottery_id = p_lottery_id
    and player_id = p_player_id
    and status = 'confirmed';

  return jsonb_build_object(
    'ok', true,
    'settlement_id', v_settlement_id,
    'expected_amount', v_total_expected,
    'delivered_total', v_delivered_total,
    'difference', v_delivered_total - v_total_expected,
    'tickets_sold', v_sold,
    'tickets_assigned', v_assigned,
    'tickets_unsold', v_unsold,
    'lottery_expected', v_lottery_expected,
    'club_expected', v_club_expected,
    'lottery_received', p_lottery_received,
    'club_received', p_club_received,
    'sales_received', p_lottery_received,
    'donation_received', p_club_received
  );
end;
$$;

-- Compatibility wrapper for clients that still send the old two-bucket payload.
-- sales_received used to include the full ticket price; split it back into the
-- lottery part plus the club part, and add the explicit unsold donation.
create or replace function public.admin_register_collection(
  p_lottery_id uuid,
  p_player_id uuid,
  p_sales_received numeric,
  p_donation_received numeric,
  p_payment_method text default null,
  p_notes text default null,
  p_admin_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lottery public.lotteries%rowtype;
  v_ticket_price numeric(10,2);
  v_donation_per_ticket numeric(10,2);
  v_lottery_per_ticket numeric(10,2);
  v_total numeric(10,2);
  v_lottery_received numeric(10,2);
  v_club_received numeric(10,2);
begin
  if p_sales_received is null or p_sales_received < 0 then
    raise exception 'El importe de ventas no es válido';
  end if;
  if p_donation_received is null or p_donation_received < 0 then
    raise exception 'El importe de donativo no es válido';
  end if;

  v_total := round(p_sales_received + p_donation_received, 2);
  if v_total <= 0 then
    raise exception 'El importe total del cobro debe ser mayor que 0';
  end if;

  select * into v_lottery
  from public.lotteries
  where id = p_lottery_id;

  if not found then
    raise exception 'Lotería no encontrada';
  end if;

  v_ticket_price := greatest(coalesce(v_lottery.ticket_price, 0), 0);
  v_donation_per_ticket := least(
    greatest(coalesce(v_lottery.donation_per_ticket, 0), 0),
    v_ticket_price
  );
  v_lottery_per_ticket := greatest(v_ticket_price - v_donation_per_ticket, 0);

  if v_ticket_price > 0 then
    v_lottery_received := round(
      least(
        greatest(
          p_sales_received * v_lottery_per_ticket / v_ticket_price,
          0
        ),
        v_total
      ),
      2
    );
  else
    v_lottery_received := 0;
  end if;

  v_club_received := round(greatest(v_total - v_lottery_received, 0), 2);

  return public.admin_register_collection_split(
    p_lottery_id,
    p_player_id,
    v_lottery_received,
    v_club_received,
    p_payment_method,
    p_notes,
    p_admin_id
  );
end;
$$;

create or replace function public.admin_settle_player(
  p_lottery_id uuid,
  p_player_id uuid,
  p_amount numeric,
  p_notes text default null,
  p_admin_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.admin_register_collection(
    p_lottery_id,
    p_player_id,
    coalesce(p_amount, 0),
    0,
    null,
    p_notes,
    p_admin_id
  );
end;
$$;

create or replace function public.admin_void_collection(
  p_settlement_id uuid,
  p_admin_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement public.lottery_settlements%rowtype;
begin
  select * into v_settlement
  from public.lottery_settlements
  where id = p_settlement_id
  for update;

  if not found then
    raise exception 'Cobro no encontrado';
  end if;

  if v_settlement.status = 'void' then
    return jsonb_build_object('ok', true, 'already_void', true);
  end if;

  if v_settlement.treasurer_delivery_id is not null then
    raise exception 'El cobro ya está incluido en una entrega al tesorero';
  end if;

  update public.lottery_settlements
  set status = 'void',
      voided_at = now(),
      voided_by = p_admin_id,
      void_reason = nullif(trim(p_reason), '')
  where id = p_settlement_id;

  perform public._lottery_recompute_purchase_links(
    v_settlement.lottery_id,
    v_settlement.player_id
  );

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_annul_sale(
  p_purchase_id uuid,
  p_admin_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.ticket_purchases%rowtype;
begin
  select * into v_purchase
  from public.ticket_purchases
  where id = p_purchase_id
  for update;

  if not found then
    raise exception 'Venta no encontrada';
  end if;

  if v_purchase.status = 'void' then
    return jsonb_build_object('ok', true, 'already_void', true);
  end if;

  if v_purchase.settlement_id is not null then
    raise exception 'La venta ya está incluida en una liquidación y no se puede anular';
  end if;

  if exists (
    select 1
    from public.lottery_settlements
    where lottery_id = v_purchase.lottery_id
      and player_id = v_purchase.seller_id
      and status = 'confirmed'
  ) then
    raise exception 'La jugadora tiene cobros registrados. Anula primero los cobros antes de anular la venta';
  end if;

  update public.ticket_purchases
  set ticket_numbers = coalesce((
        select array_agg(t.number order by t.number)
        from public.tickets t
        where t.purchase_id = v_purchase.id
      ), '{}')
  where id = p_purchase_id;

  update public.tickets
  set status = 'available',
      purchase_id = null,
      sold_at = null
  where purchase_id = v_purchase.id;

  update public.ticket_purchases
  set status = 'void',
      voided_at = now(),
      voided_by = p_admin_id
  where id = p_purchase_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_create_treasurer_delivery(
  p_lottery_id uuid,
  p_player_ids uuid[],
  p_notes text default null,
  p_admin_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery_id uuid;
  v_settlement_ids uuid[];
  v_amount numeric(10,2);
  v_count integer;
  v_player_count integer;
  v_snapshot jsonb;
begin
  if p_player_ids is null or array_length(p_player_ids, 1) is null then
    raise exception 'Selecciona al menos un jugador';
  end if;

  select array_agg(id),
         coalesce(sum(delivered_amount), 0),
         count(*),
         count(distinct player_id)
  into v_settlement_ids, v_amount, v_count, v_player_count
  from (
    select id, player_id, delivered_amount
    from public.lottery_settlements
    where lottery_id = p_lottery_id
      and player_id = any(p_player_ids)
      and status = 'confirmed'
      and treasurer_delivery_id is null
    for update
  ) locked_rows;

  if v_count = 0 then
    raise exception 'No hay cobros pendientes de liquidar para los jugadores seleccionados';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'settlement_id', id,
    'player_id', player_id,
    'sales_received', sales_received,
    'donation_received', donation_received,
    'lottery_received', lottery_received,
    'club_received', club_received,
    'total_received', delivered_amount,
    'created_at', created_at
  ) order by created_at, id), '[]'::jsonb)
  into v_snapshot
  from public.lottery_settlements
  where id = any(v_settlement_ids);

  insert into public.lottery_treasurer_deliveries (
    lottery_id,
    amount,
    notes,
    snapshot,
    created_by
  ) values (
    p_lottery_id,
    v_amount,
    nullif(trim(p_notes), ''),
    jsonb_build_object(
      'amount', v_amount,
      'settlement_count', v_count,
      'player_count', v_player_count,
      'player_ids', p_player_ids,
      'settlements', v_snapshot
    ),
    p_admin_id
  ) returning id into v_delivery_id;

  update public.lottery_settlements
  set treasurer_delivery_id = v_delivery_id
  where id = any(v_settlement_ids);

  return jsonb_build_object(
    'ok', true,
    'delivery_id', v_delivery_id,
    'amount', v_amount,
    'settlement_count', v_count,
    'player_count', v_player_count
  );
end;
$$;

revoke all on function public._lottery_recompute_purchase_links(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public._lottery_recompute_purchase_links(uuid, uuid)
  to service_role;

revoke all on function public.admin_register_collection_split(uuid, uuid, numeric, numeric, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_register_collection_split(uuid, uuid, numeric, numeric, text, text, uuid)
  to service_role;

revoke all on function public.admin_register_collection(uuid, uuid, numeric, numeric, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_register_collection(uuid, uuid, numeric, numeric, text, text, uuid)
  to service_role;

revoke all on function public.admin_settle_player(uuid, uuid, numeric, text, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_settle_player(uuid, uuid, numeric, text, uuid)
  to service_role;

revoke all on function public.admin_void_collection(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_void_collection(uuid, uuid, text)
  to service_role;

revoke all on function public.admin_annul_sale(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_annul_sale(uuid, uuid)
  to service_role;

revoke all on function public.admin_create_treasurer_delivery(uuid, uuid[], text, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_create_treasurer_delivery(uuid, uuid[], text, uuid)
  to service_role;
