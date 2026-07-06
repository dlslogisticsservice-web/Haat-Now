// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Invoices & Downloads (Wave 4, Part 7).
// Pure invoice generation from an order — the customer portal's "Invoices" +
// "Downloads". Structural input (no app coupling) → fully testable + isomorphic.
// Reusable by every tenant (brand/currency configurable).
// ─────────────────────────────────────────────────────────────────────────────

export interface InvoiceOrderItem { name: string; quantity: number; price: number }
export interface InvoiceOrder {
  id: string;
  createdAt?: string;
  totalAmount: number;
  deliveryFee?: number;
  items?: InvoiceOrderItem[];
  customerName?: string;
}
export interface InvoiceBrand { name: string; currency: string; supportEmail?: string; taxNote?: string }

export interface InvoiceLine { name: string; quantity: number; price: number; lineTotal: number }
export interface Invoice {
  number: string;
  orderId: string;
  issuedAt: string;
  brand: string;
  currency: string;
  customerName: string | null;
  lines: InvoiceLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

/** Build a structured invoice from an order. Pure. */
export function buildInvoice(order: InvoiceOrder, brand: InvoiceBrand): Invoice {
  const lines: InvoiceLine[] = (order.items ?? []).map(i => ({ name: i.name, quantity: i.quantity, price: i.price, lineTotal: round2(i.price * i.quantity) }));
  const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const deliveryFee = round2(order.deliveryFee ?? Math.max(0, round2(order.totalAmount - subtotal)));
  const total = round2(order.totalAmount || subtotal + deliveryFee);
  return {
    number: `INV-${order.id.slice(0, 8).toUpperCase()}`,
    orderId: order.id,
    issuedAt: order.createdAt ?? '',
    brand: brand.name,
    currency: brand.currency,
    customerName: order.customerName ?? null,
    lines, subtotal, deliveryFee, total,
  };
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** Render a printable HTML invoice (downloadable / print-to-PDF). Pure. */
export function renderInvoiceHtml(invoice: Invoice, brand: InvoiceBrand): string {
  const money = (n: number) => `${invoice.currency} ${n.toFixed(2)}`;
  const rows = invoice.lines.map(l => `<tr><td>${esc(l.name)}</td><td style="text-align:right">${l.quantity}</td><td style="text-align:right">${money(l.price)}</td><td style="text-align:right">${money(l.lineTotal)}</td></tr>`).join('');
  return [
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(invoice.number)}</title>`,
    `<style>body{font-family:system-ui,sans-serif;color:#111;max-width:720px;margin:24px auto;padding:0 16px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #eee}tfoot td{font-weight:700;border:none}</style></head><body>`,
    `<h1>${esc(invoice.brand)}</h1>`,
    `<p><strong>Invoice ${esc(invoice.number)}</strong>${invoice.issuedAt ? ` · ${esc(invoice.issuedAt)}` : ''}${invoice.customerName ? ` · ${esc(invoice.customerName)}` : ''}</p>`,
    `<table><thead><tr><th style="text-align:left">Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>`,
    `<tbody>${rows}</tbody>`,
    `<tfoot><tr><td colspan="3" style="text-align:right">Subtotal</td><td style="text-align:right">${money(invoice.subtotal)}</td></tr>`,
    `<tr><td colspan="3" style="text-align:right">Delivery</td><td style="text-align:right">${money(invoice.deliveryFee)}</td></tr>`,
    `<tr><td colspan="3" style="text-align:right">Total</td><td style="text-align:right">${money(invoice.total)}</td></tr></tfoot></table>`,
    brand.taxNote ? `<p style="color:#666;font-size:12px">${esc(brand.taxNote)}</p>` : '',
    brand.supportEmail ? `<p style="color:#666;font-size:12px">Questions? ${esc(brand.supportEmail)}</p>` : '',
    `</body></html>`,
  ].join('');
}
