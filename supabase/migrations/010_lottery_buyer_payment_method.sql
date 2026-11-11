-- Track how the buyer paid the seller for each sale.
-- The admin collection method remains in lottery_settlements.payment_method.

alter table public.ticket_purchases
  add column if not exists buyer_payment_method text not null default 'Efectivo';

alter table public.ticket_purchases
  drop constraint if exists ticket_purchases_buyer_payment_method_check;

alter table public.ticket_purchases
  add constraint ticket_purchases_buyer_payment_method_check
  check (buyer_payment_method in ('Efectivo', 'Bizum', 'Transferencia', 'Otro'));

drop function if exists public.create_lottery_sale(uuid, text, uuid[], uuid, boolean);

create or replace function public.create_lottery_sale(
  p_token uuid,
  p_buyer_name text,
  p_ticket_ids uuid[],
  p_client_request_id uuid,
  p_physical_ticket_delivered boolean default false,
  p_buyer_payment_method text default 'Efectivo'
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
  v_buyer_payment_method text;
begin
  v_buyer := nullif(trim(p_buyer_name), '');
  if v_buyer is null or length(v_buyer) > 100 then
    raise exception 'El nombre del comprador es obligatorio';
  end if;

  v_buyer_payment_method := nullif(trim(p_buyer_payment_method), '');
  if v_buyer_payment_method is null then
    raise exception 'Selecciona una forma de pago';
  end if;
  if v_buyer_payment_method not in ('Efectivo', 'Bizum', 'Transferencia', 'Otro') then
    raise exception 'Forma de pago no válida';
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
      'physical_ticket_delivered', v_existing.physical_ticket_delivered,
      'buyer_payment_method', v_existing.buyer_payment_method,
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
    unit_price, donation_per_ticket, total_amount, donation_amount,
    physical_ticket_delivered, buyer_payment_method
  ) values (
    v_lottery.id, v_seller.player_id, gen_random_uuid(), p_client_request_id, v_buyer,
    v_count, v_lottery.ticket_price, v_lottery.donation_per_ticket,
    v_count * v_lottery.ticket_price, v_count * v_lottery.donation_per_ticket,
    coalesce(p_physical_ticket_delivered, false), v_buyer_payment_method
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
    'physical_ticket_delivered', v_purchase.physical_ticket_delivered,
    'buyer_payment_method', v_purchase.buyer_payment_method,
    'tickets', v_numbers
  );
end;
$$;

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
  v_purchases jsonb;
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

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'token', p.token,
    'buyer_name', p.buyer_name,
    'quantity', p.quantity,
    'unit_price', p.unit_price,
    'donation_per_ticket', p.donation_per_ticket,
    'total_amount', p.total_amount,
    'donation_amount', p.donation_amount,
    'status', p.status,
    'created_at', p.created_at,
    'sold_at', p.sold_at,
    'voided_at', p.voided_at,
    'physical_ticket_delivered', p.physical_ticket_delivered,
    'buyer_payment_method', p.buyer_payment_method,
    'ticket_numbers', case
      when coalesce(array_length(p.ticket_numbers, 1), 0) > 0 then
        to_jsonb(p.ticket_numbers)
      else
        coalesce((
          select jsonb_agg(t.number order by t.number)
          from public.tickets t
          where t.purchase_id = p.id
        ), '[]'::jsonb)
    end
  ) order by p.created_at desc, p.id desc), '[]'::jsonb)
  into v_purchases
  from public.ticket_purchases p
  where p.lottery_id = v_seller.lottery_id
    and p.seller_id = v_seller.player_id;

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
    'tacos', v_tacos,
    'purchases', v_purchases
  );
end;
$$;

revoke all on function public.create_lottery_sale(uuid, text, uuid[], uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.create_lottery_sale(uuid, text, uuid[], uuid, boolean, text)
  to anon, authenticated;

notify pgrst, 'reload schema';
