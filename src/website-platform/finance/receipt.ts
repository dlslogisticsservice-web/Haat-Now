// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Receipt engine (Launch Sprint 3, Part 5).
// Renders an order receipt from a PriceBreakdown (the single pricing engine) — every
// line, discount, fee, tax and tip shown transparently. Pure + isomorphic (print / email /
// download). The Invoice engine (../invoices/invoice.ts) covers the formal tax invoice;
// this is the customer-facing receipt. No duplicated pricing logic — both read the breakdown.
// ─────────────────────────────────────────────────────────────────────────────

import type { PriceBreakdown } from './pricing';

export interface ReceiptBrand { name: string; supportEmail?: string; taxId?: string }
export interface ReceiptMeta { orderId: string; issuedAt?: string; customerName?: string | null; merchantName?: string | null }

export interface Receipt {
  number: string;
  orderId: string;
  issuedAt: string;
  brand: string;
  merchant: string | null;
  customer: string | null;
  breakdown: PriceBreakdown;
}

/** Structured receipt from an order's price breakdown. Pure. */
export function buildReceipt(breakdown: PriceBreakdown, brand: ReceiptBrand, meta: ReceiptMeta): Receipt {
  return {
    number: `RCP-${meta.orderId.slice(0, 8).toUpperCase()}`,
    orderId: meta.orderId,
    issuedAt: meta.issuedAt ?? '',
    brand: brand.name,
    merchant: meta.merchantName ?? null,
    customer: meta.customerName ?? null,
    breakdown,
  };
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** Printable/emailable HTML receipt (print-to-PDF friendly). Pure. */
export function renderReceiptHtml(receipt: Receipt, brand: ReceiptBrand): string {
  const b = receipt.breakdown;
  const money = (n: number) => `${b.currency} ${n.toFixed(2)}`;
  const rows = b.lines.map(l => `<tr><td>${esc(l.name)}</td><td style="text-align:right">${l.quantity}×</td><td style="text-align:right">${money(l.unitPrice)}</td><td style="text-align:right">${money(l.lineTotal)}</td></tr>`).join('');
  const totalRow = (label: string, value: number, strong = false, muted = false) =>
    `<tr><td colspan="3" style="text-align:right${strong ? ';font-weight:700' : ''}${muted ? ';color:#666' : ''}">${esc(label)}</td><td style="text-align:right${strong ? ';font-weight:700' : ''}${muted ? ';color:#666' : ''}">${money(value)}</td></tr>`;
  const taxLabel = b.taxMode === 'inclusive' ? 'Tax (incl.)' : 'Tax';
  return [
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(receipt.number)}</title>`,
    `<style>body{font-family:system-ui,sans-serif;color:#111;max-width:520px;margin:24px auto;padding:0 16px}table{width:100%;border-collapse:collapse}th,td{padding:7px;border-bottom:1px solid #eee;font-size:14px}tfoot td{border:none}h1{font-size:20px}</style></head><body>`,
    `<h1>${esc(receipt.brand)}</h1>`,
    `<p><strong>Receipt ${esc(receipt.number)}</strong>${receipt.merchant ? ` · ${esc(receipt.merchant)}` : ''}${receipt.issuedAt ? ` · ${esc(receipt.issuedAt)}` : ''}${receipt.customer ? ` · ${esc(receipt.customer)}` : ''}</p>`,
    `<table><thead><tr><th style="text-align:left">Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>`,
    `<tbody>${rows}</tbody>`,
    `<tfoot>`,
    totalRow('Subtotal', b.subtotal),
    b.discount > 0 ? totalRow('Discount', -b.discount, false, true) : '',
    totalRow('Delivery', b.deliveryFee),
    b.serviceFee > 0 ? totalRow('Service fee', b.serviceFee) : '',
    b.taxMode !== 'none' && b.tax > 0 ? totalRow(taxLabel, b.tax, false, b.taxMode === 'inclusive') : '',
    b.tip > 0 ? totalRow('Tip', b.tip) : '',
    totalRow('Total', b.total, true),
    `</tfoot></table>`,
    brand.taxId ? `<p style="color:#666;font-size:12px">Tax ID: ${esc(brand.taxId)}</p>` : '',
    brand.supportEmail ? `<p style="color:#666;font-size:12px">Questions? ${esc(brand.supportEmail)}</p>` : '',
    `</body></html>`,
  ].join('');
}
