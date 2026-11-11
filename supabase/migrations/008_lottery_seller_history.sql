-- Expose the seller purchase history and preserve ticket numbers on receipts.

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

  if coalesce(array_length(v_purchase.ticket_numbers, 1), 0) > 0 then
    v_numbers := to_jsonb(v_purchase.ticket_numbers);
  else
    select coalesce(jsonb_agg(t.number order by t.number), '[]'::jsonb)
    into v_numbers
    from public.tickets t
    where t.purchase_id = v_purchase.id;
  end if;

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
