/**
 * In-memory Meridian Commerce store — enough surface for Skillgate demos.
 */

export type OrderStatus = 'pending' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export interface Order {
  id: string;
  customerEmail: string;
  status: OrderStatus;
  totalUsd: number;
  items: Array<{ sku: string; name: string; qty: number }>;
  carrier?: string;
  trackingNumber?: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  orderId: string;
  subject: string;
  body?: string;
  status: 'open' | 'closed';
  createdAt: string;
}

export interface Refund {
  id: string;
  orderId: string;
  amountUsd: number;
  reason: string;
  status: 'pending' | 'approved' | 'paid';
  createdAt: string;
}

const orders = new Map<string, Order>([
  [
    'ORD-1001',
    {
      id: 'ORD-1001',
      customerEmail: 'ava@example.com',
      status: 'shipped',
      totalUsd: 128,
      items: [{ sku: 'HZL-TEE', name: 'Hazel Tee', qty: 2 }],
      carrier: 'UPS',
      trackingNumber: '1Z999AA10123456784',
      createdAt: '2026-07-28T10:00:00.000Z',
    },
  ],
  [
    'ORD-1002',
    {
      id: 'ORD-1002',
      customerEmail: 'ben@example.com',
      status: 'delivered',
      totalUsd: 64,
      items: [{ sku: 'HZL-MUG', name: 'Hazel Mug', qty: 1 }],
      carrier: 'USPS',
      trackingNumber: '9400111899223344556677',
      createdAt: '2026-07-20T14:30:00.000Z',
    },
  ],
  [
    'ORD-1003',
    {
      id: 'ORD-1003',
      customerEmail: 'cia@example.com',
      status: 'pending',
      totalUsd: 210,
      items: [{ sku: 'HZL-HOOD', name: 'Hazel Hoodie', qty: 1 }],
      createdAt: '2026-08-04T09:15:00.000Z',
    },
  ],
]);

const tickets: Ticket[] = [];
const refunds: Refund[] = [];
let ticketSeq = 1;
let refundSeq = 1;

export const commerceStore = {
  listOrders(): Order[] {
    return [...orders.values()];
  },

  getOrder(id: string): Order | undefined {
    return orders.get(id.toUpperCase());
  },

  getShipment(id: string) {
    const order = this.getOrder(id);
    if (!order) return { found: false as const, error: `No order ${id}` };
    if (!order.trackingNumber) {
      return {
        found: true as const,
        orderId: order.id,
        status: order.status,
        message: 'Not shipped yet — no tracking number.',
      };
    }
    return {
      found: true as const,
      orderId: order.id,
      status: order.status,
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
      trackingUrl: `https://track.example/${order.carrier}/${order.trackingNumber}`,
    };
  },

  deleteOrder(id: string) {
    const key = id.toUpperCase();
    const existing = orders.get(key);
    if (!existing) return { deleted: false, error: `No order ${id}` };
    orders.delete(key);
    return { deleted: true, id: key };
  },

  createTicket(orderId: string, subject: string, body?: string): Ticket | { error: string } {
    const order = this.getOrder(orderId);
    if (!order) return { error: `No order ${orderId}` };
    const ticket: Ticket = {
      id: `TKT-${String(ticketSeq++).padStart(4, '0')}`,
      orderId: order.id,
      subject,
      body,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    tickets.push(ticket);
    return ticket;
  },

  listTickets(orderId?: string): Ticket[] {
    if (!orderId) return [...tickets];
    const id = orderId.toUpperCase();
    return tickets.filter((t) => t.orderId === id);
  },

  createRefund(orderId: string, amountUsd: number, reason: string): Refund | { error: string } {
    const order = this.getOrder(orderId);
    if (!order) return { error: `No order ${orderId}` };
    if (amountUsd <= 0 || amountUsd > order.totalUsd) {
      return { error: `Invalid amount — order total is $${order.totalUsd}` };
    }
    const refund: Refund = {
      id: `RFD-${String(refundSeq++).padStart(4, '0')}`,
      orderId: order.id,
      amountUsd,
      reason,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    refunds.push(refund);
    order.status = 'refunded';
    return refund;
  },

  listRefunds(): Refund[] {
    return [...refunds];
  },

  listCatalog() {
    return [
      { sku: 'HZL-TEE', name: 'Hazel Tee', priceUsd: 32 },
      { sku: 'HZL-MUG', name: 'Hazel Mug', priceUsd: 64 },
      { sku: 'HZL-HOOD', name: 'Hazel Hoodie', priceUsd: 210 },
    ];
  },

  listAdminUsers() {
    return [
      { id: 'usr-1', email: 'ops@meridian.example', role: 'admin' },
      { id: 'usr-2', email: 'support@meridian.example', role: 'agent' },
    ];
  },
};
