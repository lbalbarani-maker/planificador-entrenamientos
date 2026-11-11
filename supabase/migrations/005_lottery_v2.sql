-- Lottery v2: clean schema, atomic sales and cash settlements.
-- Old lottery data was exported to backups/ and removed before applying this migration.

create extension if not exists pgcrypto;

alter table public.lotteries
  add column if not exists lottery_number_1 text,
  add column if not exists lottery_number_2 text,
  add column if not exists donation_per_ticket numeric(10,2) not null default 0,
  add column if not exists num_tacos integer not null default 1,
  add column if not exists tickets_per_taco integer not null default 25,
  add column if not exists start_number integer not null default 1,
  add column if not exists end_number integer,
  add column if not exists sales_status text not null default 'open',
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'lotteries_sales_status_check'
      and conrelid = 'public.lotteries'::regclass
  ) then
    alter table public.lotteries
      add constraint lotteries_sales_status_check
      check (sales_status in ('open', 'closed', 'drawn', 'settled'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'lotteries_v2_numbers_check'
      and conrelid = 'public.lotteries'::regclass
  ) then
    alter table public.lotteries
      add constraint lotteries_v2_numbers_check
      check (
        num_tacos > 0
        and tickets_per_taco > 0
        and start_number >= 0
        and ticket_price >= 0
        and donation_per_ticket >= 0
        and donation_per_ticket <= ticket_price
      );
  end if;
end $$;

alter table public.ticket_blocks
  add column if not exists block_number integer,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.lottery_sellers (
  id uuid primary key default gen_random_uuid(),
  lottery_id uuid not null references public.lotteries(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  share_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (lottery_id, player_id)
);

create table if not exists public.lottery_settlements (
  id uuid primary key default gen_random_uuid(),
  lottery_id uuid not null references public.lotteries(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  tickets_sold integer not null default 0 check (tickets_sold >= 0),
  expected_amount numeric(10,2) not null default 0 check (expected_amount >= 0),
  delivered_amount numeric(10,2) not null default 0 check (delivered_amount >= 0),
  notes text,
  settled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_purchases (
  id uuid primary key default gen_random_uuid(),
  lottery_id uuid not null references public.lotteries(id) on delete cascade,
  seller_id uuid not null references public.players(id) on delete restrict,
  token uuid not null unique default gen_random_uuid(),
  client_request_id uuid not null,
  buyer_name text not null check (length(trim(buyer_name)) between 1 and 100),
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  donation_per_ticket numeric(10,2) not null default 0 check (donation_per_ticket >= 0),
  total_amount numeric(10,2) not null check (total_amount >= 0),
  donation_amount numeric(10,2) not null default 0 check (donation_amount >= 0),
  status text not null default 'confirmed' check (status in ('confirmed', 'void')),
  settlement_id uuid references public.lottery_settlements(id) on delete set null,
  created_at timestamptz not null default now(),
  sold_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles(id) on delete set null,
  unique (lottery_id, client_request_id)
);

alter table public.tickets
  add column if not exists purchase_id uuid references public.ticket_purchases(id) on delete set null,
  add column if not exists sold_at timestamptz;

create unique index if not exists tickets_lottery_number_unique
  on public.tickets (lottery_id, number);

create index if not exists ticket_blocks_lottery_player_idx
  on public.ticket_blocks (lottery_id, player_id);

create index if not exists tickets_block_status_idx
  on public.tickets (ticket_block_id, status);

create index if not exists tickets_purchase_idx
  on public.tickets (purchase_id);

create index if not exists ticket_purchases_lottery_seller_idx
  on public.ticket_purchases (lottery_id, seller_id, status);

create index if not exists ticket_purchases_settlement_idx
  on public.ticket_purchases (settlement_id);

create index if not exists lottery_settlements_lottery_player_idx
  on public.lottery_settlements (lottery_id, player_id);

-- Remove every legacy policy before locking the tables down.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('lotteries', 'ticket_blocks', 'tickets', 'lottery_sellers', 'ticket_purchases', 'lottery_settlements')
  loop
    execute format('drop policy if exists %I on public.%I', policy_row.policyname, policy_row.tablename);
  end loop;
end $$;

alter table public.lotteries enable row level security;
alter table public.ticket_blocks enable row level security;
alter table public.tickets enable row level security;
alter table public.lottery_sellers enable row level security;
alter table public.ticket_purchases enable row level security;
alter table public.lottery_settlements enable row level security;

revoke all on public.lotteries, public.ticket_blocks, public.tickets,
  public.lottery_sellers, public.ticket_purchases, public.lottery_settlements
  from anon, authenticated;

grant all on public.lotteries, public.ticket_blocks, public.tickets,
  public.lottery_sellers, public.ticket_purchases, public.lottery_settlements
  to service_role;

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

create or replace function public._lottery_refresh_seller(p_lottery_id uuid, p_player_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_block_count integer;
begin
  select count(*) into v_block_count
  from public.ticket_blocks
  where lottery_id = p_lottery_id and player_id = p_player_id;

  if v_block_count = 0 then
    delete from public.lottery_sellers
    where lottery_id = p_lottery_id and player_id = p_player_id;
    return null;
  end if;

  insert into public.lottery_sellers (lottery_id, player_id)
  values (p_lottery_id, p_player_id)
  on conflict (lottery_id, player_id) do update
    set player_id = excluded.player_id
  returning id into v_seller_id;

  return v_seller_id;
end;
$$;

create or replace function public._lottery_auto_assign(
  p_lottery_id uuid,
  p_team_id uuid default null,
  p_club_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_ids uuid[];
  v_block_ids uuid[];
  v_player_id uuid;
  v_block_id uuid;
  v_assigned integer := 0;
  v_index integer := 0;
begin
  if p_team_id is not null then
    select array_agg(p.id order by p.full_name)
    into v_player_ids
    from public.team_players tp
    join public.players p on p.id = tp.player_id
    where tp.team_id = p_team_id
      and tp.is_active = true
      and p.is_active = true;
  else
    select array_agg(p.id order by p.full_name)
    into v_player_ids
    from public.players p
    where p.club_id = p_club_id
      and p.is_active = true;
  end if;

  if coalesce(array_length(v_player_ids, 1), 0) = 0 then
    return 0;
  end if;

  select array_agg(b.id order by b.block_number, b.start_number)
  into v_block_ids
  from public.ticket_blocks b
  where b.lottery_id = p_lottery_id
    and b.player_id is null;

  if coalesce(array_length(v_block_ids, 1), 0) = 0 then
    return 0;
  end if;

  foreach v_block_id in array v_block_ids loop
    v_player_id := v_player_ids[(v_index % array_length(v_player_ids, 1)) + 1];
    v_index := v_index + 1;

    update public.ticket_blocks
    set player_id = v_player_id, updated_at = now()
    where id = v_block_id and player_id is null;

    if found then
      perform public._lottery_refresh_seller(p_lottery_id, v_player_id);
      v_assigned := v_assigned + 1;
    end if;
  end loop;

  return v_assigned;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin RPCs (service_role only)
-- ---------------------------------------------------------------------------

create or replace function public.admin_create_lottery(
  p_club_id uuid,
  p_name text,
  p_description text,
  p_draw_date date,
  p_lottery_number_1 text,
  p_lottery_number_2 text,
  p_ticket_price numeric,
  p_donation_per_ticket numeric,
  p_num_tacos integer,
  p_tickets_per_taco integer,
  p_start_number integer,
  p_auto_assign boolean default false,
  p_team_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lottery_id uuid;
  v_block_id uuid;
  v_total integer;
  v_end integer;
  v_taco integer;
  v_block_start integer;
  v_block_end integer;
  v_numbers text;
  v_assigned integer := 0;
begin
  if nullif(trim(p_name), '') is null then
    raise exception 'El nombre de la lotería es obligatorio';
  end if;
  if p_num_tacos is null or p_num_tacos <= 0 then
    raise exception 'El número de tacos debe ser mayor que cero';
  end if;
  if p_tickets_per_taco is null or p_tickets_per_taco <= 0 then
    raise exception 'Las papeletas por taco deben ser mayores que cero';
  end if;
  if p_start_number is null or p_start_number < 0 then
    raise exception 'El número inicial no es válido';
  end if;
  if p_ticket_price is null or p_ticket_price < 0 then
    raise exception 'El precio de la papeleta no es válido';
  end if;
  if p_donation_per_ticket is null or p_donation_per_ticket < 0
    or p_donation_per_ticket > p_ticket_price then
    raise exception 'El donativo no es válido';
  end if;

  v_total := p_num_tacos * p_tickets_per_taco;
  v_end := p_start_number + v_total - 1;
  v_numbers := concat_ws('-', nullif(trim(p_lottery_number_1), ''), nullif(trim(p_lottery_number_2), ''));

  insert into public.lotteries (
    club_id, name, description, draw_date, ticket_price, total_tickets,
    lottery_number, lottery_number_1, lottery_number_2, donation_per_ticket,
    num_tacos, tickets_per_taco, start_number, end_number, sales_status, is_active
  ) values (
    p_club_id, trim(p_name), nullif(trim(p_description), ''), p_draw_date,
    p_ticket_price, v_total, nullif(v_numbers, ''), nullif(trim(p_lottery_number_1), ''),
    nullif(trim(p_lottery_number_2), ''), p_donation_per_ticket, p_num_tacos,
    p_tickets_per_taco, p_start_number, v_end, 'open', true
  ) returning id into v_lottery_id;

  for v_taco in 1..p_num_tacos loop
    v_block_start := p_start_number + ((v_taco - 1) * p_tickets_per_taco);
    v_block_end := v_block_start + p_tickets_per_taco - 1;

    insert into public.ticket_blocks (
      lottery_id, player_id, start_number, end_number, block_number
    ) values (
      v_lottery_id, null, v_block_start, v_block_end, v_taco
    ) returning id into v_block_id;

    insert into public.tickets (
      lottery_id, ticket_block_id, number, status, payment_status
    )
    select v_lottery_id, v_block_id, n, 'available', 'pending'
    from generate_series(v_block_start, v_block_end) as n;
  end loop;

  if p_auto_assign then
    v_assigned := public._lottery_auto_assign(v_lottery_id, p_team_id, p_club_id);
  end if;

  return jsonb_build_object(
    'lottery_id', v_lottery_id,
    'total_tickets', v_total,
    'start_number', p_start_number,
    'end_number', v_end,
    'assigned_tacos', v_assigned
  );
end;
$$;

create or replace function public.admin_update_lottery(
  p_lottery_id uuid,
  p_name text,
  p_description text,
  p_draw_date date,
  p_lottery_number_1 text,
  p_lottery_number_2 text,
  p_sales_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numbers text;
begin
  if nullif(trim(p_name), '') is null then
    raise exception 'El nombre de la lotería es obligatorio';
  end if;
  if p_sales_status is not null and p_sales_status not in ('open', 'closed', 'drawn', 'settled') then
    raise exception 'Estado de ventas no válido';
  end if;

  v_numbers := concat_ws('-', nullif(trim(p_lottery_number_1), ''), nullif(trim(p_lottery_number_2), ''));

  update public.lotteries
  set name = trim(p_name),
      description = nullif(trim(p_description), ''),
      draw_date = p_draw_date,
      lottery_number_1 = nullif(trim(p_lottery_number_1), ''),
      lottery_number_2 = nullif(trim(p_lottery_number_2), ''),
      lottery_number = nullif(v_numbers, ''),
      sales_status = coalesce(p_sales_status, sales_status),
      updated_at = now()
  where id = p_lottery_id;

  if not found then
    raise exception 'Lotería no encontrada';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_assign_taco(
  p_block_id uuid,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_block public.ticket_blocks%rowtype;
  v_sold integer;
  v_seller_token uuid;
begin
  select * into v_block
  from public.ticket_blocks
  where id = p_block_id
  for update;

  if not found then
    raise exception 'Taco no encontrado';
  end if;

  select count(*) into v_sold
  from public.tickets
  where ticket_block_id = p_block_id and status = 'sold';

  if v_sold > 0 and v_block.player_id is distinct from p_player_id then
    raise exception 'No se puede reasignar un taco con papeletas vendidas';
  end if;

  if p_player_id is not null and not exists (
    select 1 from public.players where id = p_player_id
  ) then
    raise exception 'Jugador no encontrado';
  end if;

  update public.ticket_blocks
  set player_id = p_player_id, updated_at = now()
  where id = p_block_id;

  if v_block.player_id is not null and v_block.player_id is distinct from p_player_id then
    perform public._lottery_refresh_seller(v_block.lottery_id, v_block.player_id);
  end if;

  if p_player_id is not null then
    perform public._lottery_refresh_seller(v_block.lottery_id, p_player_id);
    select share_token into v_seller_token
    from public.lottery_sellers
    where lottery_id = v_block.lottery_id and player_id = p_player_id;
  end if;

  return jsonb_build_object('ok', true, 'share_token', v_seller_token);
end;
$$;

create or replace function public.admin_auto_assign(
  p_lottery_id uuid,
  p_team_id uuid default null,
  p_club_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assigned integer;
begin
  v_assigned := public._lottery_auto_assign(p_lottery_id, p_team_id, p_club_id);
  return jsonb_build_object('assigned', v_assigned);
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
declare
  v_expected numeric(10,2);
  v_delivered_before numeric(10,2);
  v_tickets integer;
  v_settlement_id uuid;
begin
  if p_amount is null or p_amount < 0 then
    raise exception 'El importe entregado no es válido';
  end if;

  select coalesce(sum(total_amount), 0), coalesce(sum(quantity), 0)
  into v_expected, v_tickets
  from public.ticket_purchases
  where lottery_id = p_lottery_id
    and seller_id = p_player_id
    and status = 'confirmed';

  select coalesce(sum(delivered_amount), 0)
  into v_delivered_before
  from public.lottery_settlements
  where lottery_id = p_lottery_id and player_id = p_player_id;

  insert into public.lottery_settlements (
    lottery_id, player_id, tickets_sold, expected_amount, delivered_amount, notes, settled_by
  ) values (
    p_lottery_id, p_player_id, v_tickets, v_expected, p_amount, nullif(trim(p_notes), ''), p_admin_id
  ) returning id into v_settlement_id;

  update public.ticket_purchases
  set settlement_id = v_settlement_id
  where lottery_id = p_lottery_id
    and seller_id = p_player_id
    and status = 'confirmed'
    and settlement_id is null;

  return jsonb_build_object(
    'ok', true,
    'settlement_id', v_settlement_id,
    'expected_amount', v_expected,
    'delivered_total', v_delivered_before + p_amount,
    'difference', (v_delivered_before + p_amount) - v_expected,
    'tickets_sold', v_tickets
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------------

create or replace function public.get_lottery_seller(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller public.lottery_sellers%rowtype;
  v_lottery public.lotteries%rowtype;
  v_player_name text;
  v_team_names text[];
  v_tacos jsonb;
begin
  select * into v_seller
  from public.lottery_sellers
  where share_token = p_token;

  if not found then
    return null;
  end if;

  select * into v_lottery from public.lotteries where id = v_seller.lottery_id;
  if not found then
    return null;
  end if;

  select full_name into v_player_name from public.players where id = v_seller.player_id;

  select array_agg(t.name order by t.name)
  into v_team_names
  from public.team_players tp
  join public.teams t on t.id = tp.team_id
  where tp.player_id = v_seller.player_id and tp.is_active = true;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'block_number', b.block_number,
    'start_number', b.start_number,
    'end_number', b.end_number,
    'tickets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'number', t.number,
        'status', t.status
      ) order by t.number)
      from public.tickets t
      where t.ticket_block_id = b.id
    ), '[]'::jsonb)
  ) order by b.block_number, b.start_number), '[]'::jsonb)
  into v_tacos
  from public.ticket_blocks b
  where b.lottery_id = v_seller.lottery_id
    and b.player_id = v_seller.player_id;

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
      'lottery_number', v_lottery.lottery_number,
      'lottery_number_1', v_lottery.lottery_number_1,
      'lottery_number_2', v_lottery.lottery_number_2,
      'sales_status', v_lottery.sales_status,
      'is_active', v_lottery.is_active
    ),
    'seller', jsonb_build_object(
      'player_id', v_seller.player_id,
      'player_name', v_player_name,
      'team_names', coalesce(to_jsonb(v_team_names), '[]'::jsonb),
      'share_token', v_seller.share_token
    ),
    'tacos', v_tacos
  );
end;
$$;

create or replace function public.create_lottery_sale(
  p_token uuid,
  p_buyer_name text,
  p_ticket_ids uuid[],
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller public.lottery_sellers%rowtype;
  v_lottery public.lotteries%rowtype;
  v_existing public.ticket_purchases%rowtype;
  v_purchase public.ticket_purchases%rowtype;
  v_count integer;
  v_distinct integer;
  v_available integer := 0;
  v_ticket_id uuid;
  v_locked_ids uuid[] := '{}';
  v_numbers jsonb;
  v_buyer text;
begin
  v_buyer := nullif(trim(p_buyer_name), '');
  if v_buyer is null or length(v_buyer) > 100 then
    raise exception 'El nombre del comprador es obligatorio';
  end if;

  if p_client_request_id is null then
    raise exception 'Falta el identificador de la operación';
  end if;

  if p_ticket_ids is null or array_length(p_ticket_ids, 1) is null then
    raise exception 'Selecciona al menos una papeleta';
  end if;

  select * into v_seller
  from public.lottery_sellers
  where share_token = p_token;

  if not found then
    raise exception 'Enlace de vendedor no válido';
  end if;

  select * into v_lottery from public.lotteries where id = v_seller.lottery_id;
  if not found or v_lottery.sales_status <> 'open' then
    raise exception 'La venta de esta lotería está cerrada';
  end if;

  select * into v_existing
  from public.ticket_purchases
  where lottery_id = v_lottery.id and client_request_id = p_client_request_id;

  if found then
    select coalesce(jsonb_agg(t.number order by t.number), '[]'::jsonb)
    into v_numbers
    from public.tickets t
    where t.purchase_id = v_existing.id;

    return jsonb_build_object(
      'id', v_existing.id,
      'token', v_existing.token,
      'buyer_name', v_existing.buyer_name,
      'quantity', v_existing.quantity,
      'unit_price', v_existing.unit_price,
      'donation_per_ticket', v_existing.donation_per_ticket,
      'total_amount', v_existing.total_amount,
      'donation_amount', v_existing.donation_amount,
      'status', v_existing.status,
      'created_at', v_existing.created_at,
      'tickets', v_numbers
    );
  end if;

  select count(*), count(distinct ticket_id)
  into v_count, v_distinct
  from unnest(p_ticket_ids) as ticket_id;

  if v_count <> v_distinct then
    raise exception 'Hay papeletas repetidas en la selección';
  end if;

  for v_ticket_id in
    select t.id
    from public.tickets t
    join public.ticket_blocks b on b.id = t.ticket_block_id
    where t.id = any(p_ticket_ids)
      and t.lottery_id = v_lottery.id
      and b.player_id = v_seller.player_id
      and t.status = 'available'
    for update of t
  loop
    v_available := v_available + 1;
    v_locked_ids := array_append(v_locked_ids, v_ticket_id);
  end loop;

  if v_available <> v_count then
    raise exception 'Algunos números ya no están disponibles. Actualiza la página.';
  end if;

  insert into public.ticket_purchases (
    lottery_id, seller_id, token, client_request_id, buyer_name, quantity,
    unit_price, donation_per_ticket, total_amount, donation_amount
  ) values (
    v_lottery.id, v_seller.player_id, gen_random_uuid(), p_client_request_id, v_buyer,
    v_count, v_lottery.ticket_price, v_lottery.donation_per_ticket,
    v_count * v_lottery.ticket_price, v_count * v_lottery.donation_per_ticket
  ) returning * into v_purchase;

  update public.tickets
  set status = 'sold',
      purchase_id = v_purchase.id,
      sold_at = now()
  where id = any(v_locked_ids);

  select coalesce(jsonb_agg(t.number order by t.number), '[]'::jsonb)
  into v_numbers
  from public.tickets t
  where t.purchase_id = v_purchase.id;

  return jsonb_build_object(
    'id', v_purchase.id,
    'token', v_purchase.token,
    'buyer_name', v_purchase.buyer_name,
    'quantity', v_purchase.quantity,
    'unit_price', v_purchase.unit_price,
    'donation_per_ticket', v_purchase.donation_per_ticket,
    'total_amount', v_purchase.total_amount,
    'donation_amount', v_purchase.donation_amount,
    'status', v_purchase.status,
    'created_at', v_purchase.created_at,
    'tickets', v_numbers
  );
end;
$$;

create or replace function public.get_lottery_receipt(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.ticket_purchases%rowtype;
  v_lottery public.lotteries%rowtype;
  v_player_name text;
  v_team_names text[];
  v_numbers jsonb;
begin
  select * into v_purchase
  from public.ticket_purchases
  where token = p_token;

  if not found then
    return null;
  end if;

  select * into v_lottery from public.lotteries where id = v_purchase.lottery_id;
  select full_name into v_player_name from public.players where id = v_purchase.seller_id;

  select array_agg(t.name order by t.name)
  into v_team_names
  from public.team_players tp
  join public.teams t on t.id = tp.team_id
  where tp.player_id = v_purchase.seller_id and tp.is_active = true;

  select coalesce(jsonb_agg(t.number order by t.number), '[]'::jsonb)
  into v_numbers
  from public.tickets t
  where t.purchase_id = v_purchase.id;

  return jsonb_build_object(
    'purchase', jsonb_build_object(
      'id', v_purchase.id,
      'token', v_purchase.token,
      'buyer_name', v_purchase.buyer_name,
      'quantity', v_purchase.quantity,
      'unit_price', v_purchase.unit_price,
      'donation_per_ticket', v_purchase.donation_per_ticket,
      'total_amount', v_purchase.total_amount,
      'donation_amount', v_purchase.donation_amount,
      'status', v_purchase.status,
      'created_at', v_purchase.created_at,
      'voided_at', v_purchase.voided_at
    ),
    'lottery', jsonb_build_object(
      'id', v_lottery.id,
      'club_id', v_lottery.club_id,
      'name', v_lottery.name,
      'description', v_lottery.description,
      'draw_date', v_lottery.draw_date,
      'ticket_price', v_lottery.ticket_price,
      'donation_per_ticket', v_lottery.donation_per_ticket,
      'lottery_number', v_lottery.lottery_number,
      'lottery_number_1', v_lottery.lottery_number_1,
      'lottery_number_2', v_lottery.lottery_number_2,
      'sales_status', v_lottery.sales_status
    ),
    'seller', jsonb_build_object(
      'player_id', v_purchase.seller_id,
      'player_name', v_player_name,
      'team_names', coalesce(to_jsonb(v_team_names), '[]'::jsonb)
    ),
    'tickets', v_numbers
  );
end;
$$;

create or replace function public.get_lottery_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sold integer;
  v_available integer;
  v_revenue numeric(10,2);
begin
  select count(*) filter (where status = 'sold'),
         count(*) filter (where status = 'available')
  into v_sold, v_available
  from public.tickets;

  select coalesce(sum(total_amount), 0)
  into v_revenue
  from public.ticket_purchases
  where status = 'confirmed';

  return jsonb_build_object(
    'totalSold', v_sold,
    'totalRevenue', v_revenue,
    'totalAvailable', v_available
  );
end;
$$;

create or replace function public.get_lottery_rankings(p_limit integer default 10)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_players jsonb;
  v_teams jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'playerId', ranked.player_id,
    'playerName', ranked.player_name,
    'ticketsSold', ranked.tickets_sold,
    'revenue', ranked.revenue
  ) order by ranked.tickets_sold desc, ranked.revenue desc), '[]'::jsonb)
  into v_players
  from (
    select p.id as player_id,
           p.full_name as player_name,
           coalesce(sum(tp.quantity), 0) as tickets_sold,
           coalesce(sum(tp.total_amount), 0) as revenue
    from public.ticket_purchases tp
    join public.players p on p.id = tp.seller_id
    where tp.status = 'confirmed'
    group by p.id, p.full_name
    order by tickets_sold desc, revenue desc
    limit greatest(p_limit, 1)
  ) ranked;

  select coalesce(jsonb_agg(jsonb_build_object(
    'teamId', ranked.team_id,
    'teamName', ranked.team_name,
    'ticketsSold', ranked.tickets_sold,
    'revenue', ranked.revenue
  ) order by ranked.tickets_sold desc, ranked.revenue desc), '[]'::jsonb)
  into v_teams
  from (
    select coalesce(t.id::text, 'sin-equipo') as team_id,
           coalesce(t.name, 'Sin equipo') as team_name,
           coalesce(sum(tp.quantity), 0) as tickets_sold,
           coalesce(sum(tp.total_amount), 0) as revenue
    from public.ticket_purchases tp
    left join lateral (
      select tm.id, tm.name
      from public.team_players tpl
      join public.teams tm on tm.id = tpl.team_id
      where tpl.player_id = tp.seller_id and tpl.is_active = true
      order by tpl.is_primary desc, tm.name
      limit 1
    ) t on true
    where tp.status = 'confirmed'
    group by t.id, t.name
    order by tickets_sold desc, revenue desc
    limit greatest(p_limit, 1)
  ) ranked;

  return jsonb_build_object('players', v_players, 'teams', v_teams);
end;
$$;

-- Function permissions
revoke all on function public._lottery_refresh_seller(uuid, uuid) from public, anon, authenticated;
revoke all on function public._lottery_auto_assign(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_create_lottery(uuid, text, text, date, text, text, numeric, numeric, integer, integer, integer, boolean, uuid) from public, anon, authenticated;
revoke all on function public.admin_update_lottery(uuid, text, text, date, text, text, text) from public, anon, authenticated;
revoke all on function public.admin_assign_taco(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_auto_assign(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_annul_sale(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_settle_player(uuid, uuid, numeric, text, uuid) from public, anon, authenticated;

grant execute on function public.admin_create_lottery(uuid, text, text, date, text, text, numeric, numeric, integer, integer, integer, boolean, uuid) to service_role;
grant execute on function public.admin_update_lottery(uuid, text, text, date, text, text, text) to service_role;
grant execute on function public.admin_assign_taco(uuid, uuid) to service_role;
grant execute on function public.admin_auto_assign(uuid, uuid, uuid) to service_role;
grant execute on function public.admin_annul_sale(uuid, uuid) to service_role;
grant execute on function public.admin_settle_player(uuid, uuid, numeric, text, uuid) to service_role;

revoke all on function public.get_lottery_seller(uuid) from public;
revoke all on function public.create_lottery_sale(uuid, text, uuid[], uuid) from public;
revoke all on function public.get_lottery_receipt(uuid) from public;
revoke all on function public.get_lottery_dashboard_stats() from public;
revoke all on function public.get_lottery_rankings(integer) from public;

grant execute on function public.get_lottery_seller(uuid) to anon, authenticated;
grant execute on function public.create_lottery_sale(uuid, text, uuid[], uuid) to anon, authenticated;
grant execute on function public.get_lottery_receipt(uuid) to anon, authenticated;
grant execute on function public.get_lottery_dashboard_stats() to anon, authenticated;
grant execute on function public.get_lottery_rankings(integer) to anon, authenticated;

notify pgrst, 'reload schema';
