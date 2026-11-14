import {
  DelegateLinksResult,
  Lottery,
  LotteryAdminData,
  CreateLotteryInput,
} from '../types/lottery';

const TOKEN_KEY = 'lotteryAdminToken';

interface AdminSession {
  token: string;
  expiresAt: number;
}

interface AdminSessionUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  clubId?: string | null;
}

export interface AdminSessionResponse extends AdminSession {
  user: AdminSessionUser;
}

export interface CollectionResult {
  settlement_id: string;
  expected_amount: number;
  delivered_total: number;
  difference: number;
  tickets_sold: number;
  tickets_assigned: number;
  tickets_unsold: number;
  lottery_expected: number;
  club_expected: number;
  lottery_received: number;
  club_received: number;
  sales_received: number;
  donation_received: number;
}

export interface TreasurerDeliveryResult {
  delivery_id: string;
  amount: number;
  settlement_count: number;
  player_count: number;
}

function readStoredSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminSession;
    if (!parsed?.token || !parsed?.expiresAt) return null;
    if (parsed.expiresAt <= Math.floor(Date.now() / 1000)) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getLotteryAdminSession(): AdminSession | null {
  return readStoredSession();
}

export function clearLotteryAdminSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('lotteryAdminUser');
}

export async function requestLotteryAdminSession(
  credentials: { email: string; password?: string; pin?: string },
): Promise<AdminSessionResponse | null> {
  try {
    const response = await fetch('/api/lottery/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      clearLotteryAdminSession();
      return null;
    }

    const data = (await response.json()) as AdminSessionResponse;
    if (!data?.token || !data?.expiresAt) return null;

    localStorage.setItem(
      TOKEN_KEY,
      JSON.stringify({ token: data.token, expiresAt: data.expiresAt }),
    );
    localStorage.setItem('lotteryAdminUser', JSON.stringify(data.user ?? null));
    return data;
  } catch {
    return null;
  }
}

async function adminRequest<T>(
  action: string,
  payload: object = {},
): Promise<T> {
  const session = readStoredSession();
  if (!session) {
    throw new Error('Sesión de administración caducada. Vuelve a iniciar sesión.');
  }

  const response = await fetch('/api/lottery/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    clearLotteryAdminSession();
    throw new Error(
      data?.error ?? 'Sesión de administración caducada. Vuelve a iniciar sesión.',
    );
  }
  if (!response.ok) {
    throw new Error(data?.error ?? 'No se pudo completar la operación');
  }

  return data as T;
}

export const lotteryAdminApi = {
  async list(): Promise<Lottery[]> {
    const data = await adminRequest<{ lotteries: Lottery[] }>('list');
    return data.lotteries;
  },

  async get(lotteryId: string): Promise<LotteryAdminData> {
    return adminRequest<LotteryAdminData>('get', { lotteryId });
  },

  async create(input: CreateLotteryInput): Promise<{ lottery_id: string; assigned_tacos: number }> {
    const data = await adminRequest<{ result: { lottery_id: string; assigned_tacos: number } }>(
      'create',
      input,
    );
    return data.result;
  },

  async update(input: {
    lotteryId: string;
    name: string;
    description?: string;
    drawDate?: string;
    lotteryNumber1?: string;
    lotteryNumber2?: string;
    salesStatus?: string;
  }): Promise<void> {
    await adminRequest('update', input);
  },

  async remove(lotteryId: string): Promise<void> {
    await adminRequest('delete', { lotteryId });
  },

  async assign(blockId: string, playerId: string | null): Promise<void> {
    await adminRequest('assign', { blockId, playerId });
  },

  async autoAssign(lotteryId: string, clubId: string, teamId?: string): Promise<number> {
    const data = await adminRequest<{ result: { assigned: number } }>('auto-assign', {
      lotteryId,
      clubId,
      teamId: teamId || null,
    });
    return data.result.assigned;
  },

  async annulSale(purchaseId: string): Promise<void> {
    await adminRequest('annul-sale', { purchaseId });
  },

  async getDelegateLinks(lotteryId: string): Promise<DelegateLinksResult> {
    return adminRequest<DelegateLinksResult>('delegate-links', { lotteryId });
  },

  async registerCollection(input: {
    lotteryId: string;
    playerId: string;
    lotteryReceived: number;
    clubReceived: number;
    paymentMethod?: string;
    notes?: string;
  }): Promise<CollectionResult> {
    const data = await adminRequest<{ result: CollectionResult }>('register-collection', input);
    return data.result;
  },

  async settlePlayer(input: {
    lotteryId: string;
    playerId: string;
    amount: number;
    notes?: string;
  }): Promise<CollectionResult> {
    return this.registerCollection({
      lotteryId: input.lotteryId,
      playerId: input.playerId,
      lotteryReceived: input.amount,
      clubReceived: 0,
      notes: input.notes,
    });
  },

  async voidCollection(settlementId: string, reason: string): Promise<void> {
    await adminRequest('void-collection', { settlementId, reason });
  },

  async setWaiver(input: {
    lotteryId: string;
    playerId: string;
    amount: number;
    reason?: string;
  }): Promise<{ waived_amount: number; max_waiver: number }> {
    const data = await adminRequest<{
      result: { waived_amount: number; max_waiver: number };
    }>('set-waiver', input);
    return data.result;
  },

  async voidWaiver(lotteryId: string, playerId: string): Promise<void> {
    await adminRequest('void-waiver', { lotteryId, playerId });
  },

  async createTreasurerDelivery(input: {
    lotteryId: string;
    playerIds: string[];
    notes?: string;
  }): Promise<TreasurerDeliveryResult> {
    const data = await adminRequest<{ result: TreasurerDeliveryResult }>(
      'create-treasurer-delivery',
      input,
    );
    return data.result;
  },

  async voidTreasurerDelivery(deliveryId: string, reason: string): Promise<void> {
    await adminRequest('void-treasurer-delivery', { deliveryId, reason });
  },

  async setStatus(lotteryId: string, salesStatus: string): Promise<void> {
    await adminRequest('set-status', { lotteryId, salesStatus });
  },
};
