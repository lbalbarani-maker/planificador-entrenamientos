create table if not exists public.lottery_treasurer_deliveries (
  id uuid primary key default gen_random_uuid(),
  lottery_id uuid not null references public.lotteries(id) on delete cascade,
  amount numeric(10,2) not null default 0 check (amount >= 0),
  delivered_at timestamptz not null default now(),
  notes text,
  snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'confirmed' check (status in ('confirmed', 'void')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles(id) on delete set null,
  void_reason text
);

alter table public.lottery_sellers
  add column if not exists waived_amount numeric(10,2) not null default 0 check (waived_amount >= 0),
  add column if not exists waiver_reason text,
  add column if not exists waived_at timestamptz,
  add column if not exists waived_by uuid references public.profiles(id) on delete set null;

alter table public.lottery_settlements
  add column if not exists sales_received numeric(10,2) not null default 0 check (sales_received >= 0),
  add column if not exists donation_received numeric(10,2) not null default 0 check (donation_received >= 0),
  add column if not exists payment_method text,
  add column if not exists status text not null default 'confirmed' check (status in ('confirmed', 'void')),
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.profiles(id) on delete set null,
  add column if not exists void_reason text,
  add column if not exists tickets_assigned integer not null default 0 check (tickets_assigned >= 0),
  add column if not exists tickets_unsold integer not null default 0 check (tickets_unsold >= 0),
  add column if not exists ticket_price numeric(10,2) not null default 0 check (ticket_price >= 0),
  add column if not exists donation_per_ticket numeric(10,2) not null default 0 check (donation_per_ticket >= 0),
  add column if not exists sales_expected numeric(10,2) not null default 0 check (sales_expected >= 0),
  add column if not exists donation_expected numeric(10,2) not null default 0 check (donation_expected >= 0),
  add column if not exists total_expected numeric(10,2) not null default 0 check (total_expected >= 0),
  add column if not exists treasurer_delivery_id uuid references public.lottery_treasurer_deliveries(id) on delete set null;

update public.lottery_settlements
set sales_received = coalesce(delivered_amount, 0),
    donation_received = 0,
    sales_expected = coalesce(expected_amount, 0),
    donation_expected = 0,
    total_expected = coalesce(expected_amount, 0)
where coalesce(delivered_amount, 0) > 0
  and coalesce(sales_received, 0) = 0
  and coalesce(donation_received, 0) = 0
  and coalesce(total_expected, 0) = 0;

create index if not exists lottery_settlements_treasurer_delivery_idx
  on public.lottery_settlements (treasurer_delivery_id);

create index if not exists lottery_settlements_status_idx
  on public.lottery_settlements (lottery_id, player_id, status);

create index if not exists lottery_treasurer_deliveries_lottery_idx
  on public.lottery_treasurer_deliveries (lottery_id, delivered_at desc);

alter table public.lottery_treasurer_deliveries enable row level security;

revoke all on public.lottery_treasurer_deliveries from anon, authenticated;
grant all on public.lottery_treasurer_deliveries to service_role;

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
  v_assigned integer;
  v_sold integer;
  v_unsold integer;
  v_sales_expected numeric(10,2);
  v_donation_expected numeric(10,2);
  v_total_expected numeric(10,2);
  v_settlement_id uuid;
  v_delivered_total numeric(10,2);
  v_received numeric(10,2);
begin
  if p_sales_received is null or p_sales_received < 0 then
    raise exception 'El importe de ventas no es válido';
  end if;
  if p_donation_received is null or p_donation_received < 0 then
    raise exception 'El importe de donativo no es válido';
  end if;
  if p_sales_received + p_donation_received <= 0 then
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
  v_sales_expected := v_sold * coalesce(v_lottery.ticket_price, 0);
  v_donation_expected := v_unsold * coalesce(v_lottery.donation_per_ticket, 0);
  v_total_expected := v_sales_expected + v_donation_expected;
  v_received := p_sales_received + p_donation_received;

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
    p_sales_received,
    p_donation_received,
    nullif(trim(p_payment_method), ''),
    v_assigned,
    v_unsold,
    coalesce(v_lottery.ticket_price, 0),
    coalesce(v_lottery.donation_per_ticket, 0),
    v_sales_expected,
    v_donation_expected,
    v_total_expected
  ) returning id into v_settlement_id;

  if p_sales_received > 0 then
    update public.ticket_purchases
    set settlement_id = v_settlement_id
    where lottery_id = p_lottery_id
      and seller_id = p_player_id
      and status = 'confirmed'
      and settlement_id is null;
  end if;

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
    'sales_received', p_sales_received,
    'donation_received', p_donation_received
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
    p_amount,
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

  update public.ticket_purchases
  set settlement_id = null
  where settlement_id = p_settlement_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_set_waiver(
  p_lottery_id uuid,
  p_player_id uuid,
  p_amount numeric,
  p_reason text default null,
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
  v_expected numeric(10,2);
  v_received numeric(10,2);
  v_max_waiver numeric(10,2);
begin
  if p_amount is null or p_amount < 0 then
    raise exception 'El importe condonado no es válido';
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

  select coalesce(sum(delivered_amount), 0)
  into v_received
  from public.lottery_settlements
  where lottery_id = p_lottery_id
    and player_id = p_player_id
    and status = 'confirmed';

  v_unsold := greatest(v_assigned - v_sold, 0);
  v_expected := (v_sold * coalesce(v_lottery.ticket_price, 0))
    + (v_unsold * coalesce(v_lottery.donation_per_ticket, 0));
  v_max_waiver := greatest(v_expected - v_received, 0);

  if p_amount > v_max_waiver + 0.005 then
    raise exception 'La condonación no puede superar el pendiente actual';
  end if;

  if p_amount > 0 and nullif(trim(p_reason), '') is null then
    raise exception 'Indica el motivo de la condonación';
  end if;

  update public.lottery_sellers
  set waived_amount = p_amount,
      waiver_reason = case when p_amount > 0 then nullif(trim(p_reason), '') else null end,
      waived_at = case when p_amount > 0 then now() else null end,
      waived_by = case when p_amount > 0 then p_admin_id else null end
  where lottery_id = p_lottery_id and player_id = p_player_id;

  return jsonb_build_object(
    'ok', true,
    'waived_amount', p_amount,
    'max_waiver', v_max_waiver
  );
end;
$$;

create or replace function public.admin_void_waiver(
  p_lottery_id uuid,
  p_player_id uuid,
  p_admin_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
  from public.lottery_sellers
  where lottery_id = p_lottery_id and player_id = p_player_id
  for update;

  if not found then
    raise exception 'Jugador no asignado a esta lotería';
  end if;

  update public.lottery_sellers
  set waived_amount = 0,
      waiver_reason = null,
      waived_at = null,
      waived_by = null
  where lottery_id = p_lottery_id and player_id = p_player_id;

  return jsonb_build_object('ok', true, 'waived_amount', 0, 'cleared_by', p_admin_id);
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

create or replace function public.admin_void_treasurer_delivery(
  p_delivery_id uuid,
  p_admin_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery public.lottery_treasurer_deliveries%rowtype;
begin
  select * into v_delivery
  from public.lottery_treasurer_deliveries
  where id = p_delivery_id
  for update;

  if not found then
    raise exception 'Entrega al tesorero no encontrada';
  end if;

  if v_delivery.status = 'void' then
    return jsonb_build_object('ok', true, 'already_void', true);
  end if;

  update public.lottery_settlements
  set treasurer_delivery_id = null
  where treasurer_delivery_id = p_delivery_id;

  update public.lottery_treasurer_deliveries
  set status = 'void',
      voided_at = now(),
      voided_by = p_admin_id,
      void_reason = nullif(trim(p_reason), '')
  where id = p_delivery_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_register_collection(uuid, uuid, numeric, numeric, text, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_settle_player(uuid, uuid, numeric, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_void_collection(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_set_waiver(uuid, uuid, numeric, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_void_waiver(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_create_treasurer_delivery(uuid, uuid[], text, uuid) from public, anon, authenticated;
revoke all on function public.admin_void_treasurer_delivery(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.admin_register_collection(uuid, uuid, numeric, numeric, text, text, uuid) to service_role;
grant execute on function public.admin_settle_player(uuid, uuid, numeric, text, uuid) to service_role;
grant execute on function public.admin_void_collection(uuid, uuid, text) to service_role;
grant execute on function public.admin_set_waiver(uuid, uuid, numeric, text, uuid) to service_role;
grant execute on function public.admin_void_waiver(uuid, uuid, uuid) to service_role;
grant execute on function public.admin_create_treasurer_delivery(uuid, uuid[], text, uuid) to service_role;
grant execute on function public.admin_void_treasurer_delivery(uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
