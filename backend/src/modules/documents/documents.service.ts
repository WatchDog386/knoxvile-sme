import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import * as nodemailer from 'nodemailer';
import { SalesService } from '../sales/sales.service';
import { Business } from '../businesses/entities/business.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

export type DocKind = 'invoice' | 'receipt';
export type DocFormat = 'a4' | 'thermal';

type SaleDoc = Awaited<ReturnType<SalesService['get']>>;

const BRAND = '#0F2341';
const NAVY = '#0B1642';
const GREEN = '#549913';
const INK = '#17201C';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const TINT = '#F3F6FB';

const money = (n: number) => `KSh ${Math.round(n).toLocaleString('en-KE')}`;
const pad = (n: number | null | undefined) => String(n ?? 0).padStart(6, '0');
export const invoiceNo = (n: number | null | undefined) => `INV-${pad(n)}`;
export const receiptNo = (n: number | null | undefined) => `RCT-${pad(n)}`;
const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' });
const fmtDateTime = (d: Date | string) =>
  new Date(d).toLocaleString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Nairobi',
  });

interface Prepared {
  sale: SaleDoc;
  business: Business;
  paid: number;
  balance: number;
  subscription: Awaited<ReturnType<SubscriptionsService['forCustomer']>>;
}

@Injectable()
export class DocumentsService {
  private readonly logo = [join(process.cwd(), 'assets', 'knoxville-logo.png'), join(__dirname, '..', '..', '..', 'assets', 'knoxville-logo.png')].find(
    (p) => existsSync(p),
  );

  constructor(
    private readonly sales: SalesService,
    private readonly subscriptions: SubscriptionsService,
    private readonly config: ConfigService,
    @InjectRepository(Business) private readonly businessRepo: Repository<Business>,
  ) {}

  /* ---------------- Data ---------------- */

  private async prepare(businessId: string, saleId: string): Promise<Prepared> {
    let sale = await this.sales.get(businessId, saleId);
    if (sale.number == null || sale.payments.some((p) => p.receipt_number == null)) {
      await this.sales.assignMissingNumbers(businessId);
      sale = await this.sales.get(businessId, saleId);
    }
    const business = await this.businessRepo.findOne({ where: { id: businessId } });
    if (!business) throw new NotFoundException({ code: 'BUSINESS_NOT_FOUND', message: 'Business not found.' });
    const paid = sale.payments.filter((p) => p.status === 'SUCCESS').reduce((sum, p) => sum + p.amount, 0);
    const subscription = sale.customerId ? await this.subscriptions.forCustomer(businessId, sale.customerId) : null;
    return { sale, business, paid, balance: Math.max(0, sale.total - paid), subscription };
  }

  async render(
    businessId: string,
    saleId: string,
    kind: DocKind,
    format: DocFormat = 'a4',
    paymentId?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const data = await this.prepare(businessId, saleId);
    if (kind === 'receipt' && data.sale.payments.filter((p) => p.status === 'SUCCESS').length === 0) {
      throw new BadRequestException({
        code: 'NO_PAYMENT',
        message: 'This sale has no payment yet, so there is no receipt. Share the invoice instead.',
      });
    }
    const payment =
      kind === 'receipt'
        ? (paymentId ? data.sale.payments.find((p) => p.id === paymentId) : undefined) ??
          [...data.sale.payments].reverse().find((p) => p.status === 'SUCCESS')
        : undefined;

    const buffer =
      format === 'thermal'
        ? await this.thermal(data, kind, payment)
        : kind === 'invoice'
          ? await this.invoiceA4(data)
          : await this.receiptA4(data, payment!);
    const ref = kind === 'invoice' ? invoiceNo(data.sale.number) : receiptNo(payment?.receipt_number);
    return { buffer, filename: `${ref}${format === 'thermal' ? '-80mm' : ''}.pdf` };
  }

  /* ---------------- Sharing ---------------- */

  /** Unguessable, tamper-proof link token for one sale's documents. */
  shareToken(businessId: string, saleId: string): string {
    const payload = Buffer.from(`${businessId}:${saleId}`).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }

  readShareToken(token: string): { businessId: string; saleId: string } {
    const [payload, sig] = token.split('.');
    const expected = payload ? this.sign(payload) : '';
    if (!payload || !sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'This document link is not valid.' });
    }
    const [businessId, saleId] = Buffer.from(payload, 'base64url').toString().split(':');
    return { businessId, saleId };
  }

  private sign(payload: string): string {
    const secret = this.config.get<string>('jwt.secret') ?? 'dev-secret-change-me';
    return createHmac('sha256', `documents:${secret}`).update(payload).digest('base64url').slice(0, 32);
  }

  /** Short message for WhatsApp / email, with the totals. */
  async summary(businessId: string, saleId: string, kind: DocKind) {
    const { sale, business, paid, balance, subscription } = await this.prepare(businessId, saleId);
    const name = sale.customer?.name ?? 'there';
    const ref = kind === 'invoice' ? invoiceNo(sale.number) : receiptNo(sale.payments.at(-1)?.receipt_number);
    const lines = [
      `Hello ${name},`,
      kind === 'invoice'
        ? `Here is your invoice ${ref} from ${business.name} for ${money(sale.total)}.`
        : `Thank you for your payment. Here is your receipt ${ref} from ${business.name}.`,
      `Paid: ${money(paid)}${balance > 0 ? ` · Balance: ${money(balance)}` : ''}`,
    ];
    if (subscription) lines.push(`Your ${subscription.packageName} is active until ${fmtDate(subscription.expiresAt)}.`);
    return {
      text: lines.join('\n'),
      customer: sale.customer ? { name: sale.customer.name, phone: sale.customer.phone, email: sale.customer.email } : null,
      reference: ref,
    };
  }

  /** Mail transport from SMTP_* settings; refuses clearly when email isn't set up. */
  private mailer() {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      throw new ServiceUnavailableException({
        code: 'EMAIL_NOT_CONFIGURED',
        message: 'Email isn’t set up on the server yet. Share by WhatsApp or download the PDF instead.',
      });
    }
    return nodemailer.createTransport({
      host,
      port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
      secure: this.config.get<string>('SMTP_SECURE') === 'true',
      auth: this.config.get<string>('SMTP_USER')
        ? { user: this.config.get<string>('SMTP_USER'), pass: this.config.get<string>('SMTP_PASS') }
        : undefined,
    });
  }

  private from(businessName?: string | null): string {
    return this.config.get<string>('SMTP_FROM') ?? `${businessName ?? 'Knoxville'} <no-reply@knoxville.co.ke>`;
  }

  /** Whether outgoing email (SMTP) is configured. */
  emailConfigured(): boolean {
    return Boolean(this.config.get<string>('SMTP_HOST'));
  }

  async email(businessId: string, saleId: string, kind: DocKind, to: string) {
    const transport = this.mailer();
    const [{ buffer, filename }, info] = await Promise.all([
      this.render(businessId, saleId, kind, 'a4'),
      this.summary(businessId, saleId, kind),
    ]);
    const business = await this.businessRepo.findOne({ where: { id: businessId } });
    await transport.sendMail({
      from: this.from(business?.name),
      to,
      subject: `${kind === 'invoice' ? 'Invoice' : 'Receipt'} ${info.reference} from ${business?.name ?? 'Knoxville'}`,
      text: `${info.text}\n\nThe ${kind} is attached as a PDF.\n\n${business?.name ?? ''}`,
      attachments: [{ filename, content: buffer, contentType: 'application/pdf' }],
    });
    return { success: true, to };
  }

  /**
   * Payment reminder by email: the staff member's message, with each unpaid
   * invoice attached as a PDF. Every invoice must belong to this client.
   */
  async emailReminder(businessId: string, customerId: string, saleIds: string[], message: string, subject?: string) {
    const transport = this.mailer();
    const sales = await Promise.all(saleIds.map((id) => this.sales.get(businessId, id)));
    if (sales.some((s) => s.customerId !== customerId)) {
      throw new BadRequestException({ code: 'INVOICE_NOT_CLIENTS', message: 'These invoices do not all belong to this client.' });
    }
    const to = sales[0]?.customer?.email?.trim();
    if (!to) {
      throw new BadRequestException({ code: 'CLIENT_HAS_NO_EMAIL', message: 'Add an email address to this subscriber first.' });
    }
    const files = await Promise.all(saleIds.map((id) => this.render(businessId, id, 'invoice', 'a4')));
    const business = await this.businessRepo.findOne({ where: { id: businessId } });
    await transport.sendMail({
      from: this.from(business?.name),
      to,
      subject: subject?.trim() || `Payment reminder from ${business?.name ?? 'Knoxville'}`,
      text: `${message.trim()}\n\n${files.length === 1 ? 'The invoice is' : 'The invoices are'} attached as PDF.\n\n${business?.name ?? ''}`,
      attachments: files.map((f) => ({ filename: f.filename, content: f.buffer, contentType: 'application/pdf' })),
    });
    return { success: true, to };
  }

  /* ---------------- PDF layouts ---------------- */

  private pdf(size: [number, number] | 'A4', margin: number, draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size, margin, info: { Title: 'Knoxville document', Author: 'Knoxville' } });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      draw(doc);
      doc.end();
    });
  }

  /** Logo + company details (left) and the document title block (right). */
  private header(doc: PDFKit.PDFDocument, b: Business, title: string, rows: Array<[string, string]>) {
    const top = 50;
    if (this.logo) doc.image(this.logo, 50, top, { height: 34 });
    else doc.font('Helvetica-Bold').fontSize(20).fillColor(BRAND).text(b.name, 50, top);

    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    const details = [b.name, b.address, b.phone, b.email, b.kra_pin ? `KRA PIN: ${b.kra_pin}` : null].filter(Boolean) as string[];
    let y = top + 44;
    for (const d of details) {
      doc.text(d, 50, y, { width: 250 });
      y += 12;
    }

    doc.font('Helvetica-Bold').fontSize(26).fillColor(NAVY).text(title, 300, top - 2, { width: 245, align: 'right' });
    let ry = top + 36;
    for (const [label, value] of rows) {
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(label, 300, ry, { width: 140, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text(value, 445, ry, { width: 100, align: 'right' });
      ry += 14;
    }
    return Math.max(y, ry) + 18;
  }

  private status(doc: PDFKit.PDFDocument, label: string, color: string, x: number, y: number) {
    const w = doc.font('Helvetica-Bold').fontSize(8).widthOfString(label) + 16;
    doc.roundedRect(x - w, y, w, 16, 8).fill(color);
    doc.fillColor('#FFFFFF').text(label, x - w, y + 4.5, { width: w, align: 'center' });
  }

  private billTo(doc: PDFKit.PDFDocument, sale: SaleDoc, y: number, label = 'BILL TO') {
    doc.roundedRect(50, y, 495, 66, 8).fill(TINT);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(label, 64, y + 12);
    const c = sale.customer;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(c?.name ?? 'Walk-in customer', 64, y + 25);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text([c?.phone, c?.email, c?.address].filter(Boolean).join('  ·  ') || '—', 64, y + 41, { width: 460 });
    return y + 82;
  }

  private itemsTable(doc: PDFKit.PDFDocument, sale: SaleDoc, y: number) {
    const cols = { desc: 64, qty: 330, unit: 380, amount: 465 };
    doc.rect(50, y, 495, 24).fill(NAVY);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF');
    doc.text('DESCRIPTION', cols.desc, y + 8);
    doc.text('QTY', cols.qty, y + 8, { width: 40, align: 'right' });
    doc.text('UNIT PRICE', cols.unit, y + 8, { width: 75, align: 'right' });
    doc.text('AMOUNT', cols.amount, y + 8, { width: 70, align: 'right' });
    y += 24;

    sale.items.forEach((item, i) => {
      const name = item.product_name ?? item.service_name ?? item.item_name ?? 'Item';
      const note =
        item.package_event === 'NEW' ? 'New WiFi subscription' : item.package_event === 'RENEWAL' ? 'WiFi subscription renewal' : null;
      const h = note ? 34 : 24;
      if (i % 2 === 1) doc.rect(50, y, 495, h).fill('#FAFBFC');
      doc.font('Helvetica').fontSize(10).fillColor(INK).text(name, cols.desc, y + 7, { width: 255 });
      if (note) doc.fontSize(8).fillColor(GREEN).text(note, cols.desc, y + 20);
      doc.fontSize(10).fillColor(INK);
      doc.text(String(item.quantity), cols.qty, y + 7, { width: 40, align: 'right' });
      doc.text(money(item.unit_price), cols.unit, y + 7, { width: 75, align: 'right' });
      doc.font('Helvetica-Bold').text(money(item.total), cols.amount, y + 7, { width: 70, align: 'right' });
      y += h;
    });
    if (sale.items.length === 0) {
      doc.font('Helvetica').fontSize(10).fillColor(INK).text(sale.notes || 'Sale', cols.desc, y + 7);
      doc.font('Helvetica-Bold').text(money(sale.total), cols.amount, y + 7, { width: 70, align: 'right' });
      y += 24;
    }
    doc.moveTo(50, y).lineTo(545, y).strokeColor(LINE).lineWidth(1).stroke();
    return y + 12;
  }

  private totals(doc: PDFKit.PDFDocument, rows: Array<[string, string, boolean?]>, y: number) {
    for (const [label, value, strong] of rows) {
      if (strong) {
        doc.roundedRect(330, y - 4, 215, 26, 6).fill(BRAND);
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFFFFF');
        doc.text(label, 342, y + 3);
        doc.text(value, 400, y + 3, { width: 135, align: 'right' });
        y += 32;
      } else {
        doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(label, 342, y);
        doc.font('Helvetica-Bold').fillColor(INK).text(value, 400, y, { width: 135, align: 'right' });
        y += 18;
      }
    }
    return y;
  }

  private footer(doc: PDFKit.PDFDocument, b: Business) {
    // Written inside the bottom margin, so lift it to stop pdfkit adding a blank page
    doc.page.margins.bottom = 0;
    const y = 760;
    doc.moveTo(50, y).lineTo(545, y).strokeColor(LINE).lineWidth(1).stroke();
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
    doc.text(b.invoice_footer || 'Thank you for choosing Knoxville.', 50, y + 10, { width: 495, align: 'center' });
    doc.fontSize(7.5).text(`${b.name}${b.phone ? ' · ' + b.phone : ''}${b.email ? ' · ' + b.email : ''}`, 50, y + 36, {
      width: 495,
      align: 'center',
    });
  }

  private invoiceA4({ sale, business, paid, balance, subscription }: Prepared) {
    return this.pdf('A4', 50, (doc) => {
      let y = this.header(doc, business, 'INVOICE', [
        ['Invoice no.', invoiceNo(sale.number)],
        ['Date', fmtDate(sale.created_at)],
        ['Payment', sale.payment_method],
      ]);
      const state =
        sale.payment_status === 'CANCELLED'
          ? (['CANCELLED', '#DC2626'] as const)
          : balance <= 0
            ? (['PAID', GREEN] as const)
            : paid > 0
              ? (['PART PAID', '#D97706'] as const)
              : (['UNPAID', '#DC2626'] as const);
      this.status(doc, state[0], state[1], 545, y - 14);
      y = this.billTo(doc, sale, y + 8);
      y = this.itemsTable(doc, sale, y);

      const rows: Array<[string, string, boolean?]> = [['Subtotal', money(sale.subtotal)]];
      if (sale.discount > 0) rows.push(['Discount', `−${money(sale.discount)}`]);
      if (sale.tax > 0) rows.push(['VAT', money(sale.tax)]);
      rows.push(['Total', money(sale.total), true], ['Paid', money(paid)], ['Balance due', money(balance)]);
      const endTotals = this.totals(doc, rows, y + 4);

      // Left of totals: package validity and payment instructions
      let ly = y + 4;
      if (subscription) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text('WiFi package', 50, ly);
        doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(
          `${subscription.packageName}${subscription.speedMbps ? ` · ${subscription.speedMbps} Mbps` : ''}\nActive until ${fmtDate(subscription.expiresAt)}`,
          50,
          ly + 13,
          { width: 260 },
        );
        ly += 50;
      }
      if (balance > 0) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text('How to pay', 50, ly);
        doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(business.invoice_footer || 'Pay by M-Pesa, bank transfer or cash at our office.', 50, ly + 13, {
          width: 260,
        });
      }

      // Payments received
      const payments = sale.payments.filter((p) => p.status === 'SUCCESS');
      if (payments.length) {
        let py = Math.max(endTotals, ly + 50) + 10;
        doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text('Payments received', 50, py);
        py += 18;
        for (const p of payments) {
          doc.font('Helvetica').fontSize(9).fillColor(MUTED);
          doc.text(`${fmtDateTime(p.transaction_date)}  ·  ${p.method}${p.reference ? `  ·  ${p.reference}` : ''}  ·  ${receiptNo(p.receipt_number)}`, 50, py, {
            width: 380,
          });
          doc.font('Helvetica-Bold').fillColor(INK).text(money(p.amount), 430, py, { width: 115, align: 'right' });
          py += 16;
        }
      }
      this.footer(doc, business);
    });
  }

  private receiptA4({ sale, business, paid, balance, subscription }: Prepared, payment: SaleDoc['payments'][number]) {
    return this.pdf('A4', 50, (doc) => {
      let y = this.header(doc, business, 'RECEIPT', [
        ['Receipt no.', receiptNo(payment.receipt_number)],
        ['Date', fmtDateTime(payment.transaction_date)],
        ['For invoice', invoiceNo(sale.number)],
      ]);
      y = this.billTo(doc, sale, y + 8, 'RECEIVED FROM');

      // Amount received, front and centre
      doc.roundedRect(50, y, 495, 84, 10).fill(GREEN);
      doc.font('Helvetica').fontSize(10).fillColor('#FFFFFF').text('AMOUNT RECEIVED', 70, y + 16);
      doc.font('Helvetica-Bold').fontSize(30).text(money(payment.amount), 70, y + 32);
      doc.font('Helvetica').fontSize(10).text(
        `${payment.method}${payment.reference ? `  ·  Ref ${payment.reference}` : ''}`,
        300,
        y + 40,
        { width: 225, align: 'right' },
      );
      y += 104;

      y = this.itemsTable(doc, sale, y);
      const rows: Array<[string, string, boolean?]> = [
        ['Invoice total', money(sale.total)],
        ['Total paid', money(paid)],
        [balance > 0 ? 'Balance remaining' : 'Fully paid', balance > 0 ? money(balance) : 'KSh 0', true],
      ];
      this.totals(doc, rows, y + 4);
      if (subscription) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text('WiFi package', 50, y + 4);
        doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(
          `${subscription.packageName}${subscription.speedMbps ? ` · ${subscription.speedMbps} Mbps` : ''}\nActive until ${fmtDate(subscription.expiresAt)}`,
          50,
          y + 17,
          { width: 260 },
        );
      }
      this.footer(doc, business);
    });
  }

  /** 80mm till receipt / invoice for small thermal printers. */
  private thermal({ sale, business, paid, balance, subscription }: Prepared, kind: DocKind, payment?: SaleDoc['payments'][number]) {
    const W = 226; // 80mm in points
    const M = 12;
    const inner = W - M * 2;
    const height = 285 + sale.items.length * 22 + (subscription ? 30 : 0) + (business.invoice_footer ? 36 : 0);
    return this.pdf([W, height], M, (doc) => {
      let y = M;
      if (this.logo) {
        doc.image(this.logo, M + inner / 2 - 60, y, { width: 120 });
        y += 34;
      }
      doc.font('Helvetica').fontSize(7.5).fillColor('#000000');
      for (const line of [business.name, business.address, business.phone, business.kra_pin ? `PIN ${business.kra_pin}` : null].filter(Boolean) as string[]) {
        doc.text(line, M, y, { width: inner, align: 'center' });
        y += 10;
      }
      y += 6;
      const rule = () => {
        doc.moveTo(M, y).lineTo(W - M, y).dash(2, { space: 2 }).strokeColor('#000000').lineWidth(0.6).stroke().undash();
        y += 6;
      };
      rule();
      doc.font('Helvetica-Bold').fontSize(11).text(kind === 'invoice' ? 'INVOICE' : 'RECEIPT', M, y, { width: inner, align: 'center' });
      y += 15;
      doc.font('Helvetica').fontSize(7.5);
      const kv = (k: string, v: string) => {
        doc.text(k, M, y, { width: inner / 2 });
        doc.text(v, M + inner / 2, y, { width: inner / 2, align: 'right' });
        y += 10;
      };
      kv(kind === 'invoice' ? 'Invoice' : 'Receipt', kind === 'invoice' ? invoiceNo(sale.number) : receiptNo(payment?.receipt_number));
      kv('Date', fmtDateTime(payment?.transaction_date ?? sale.created_at));
      kv('Client', sale.customer?.name ?? 'Walk-in');
      if (sale.customer?.phone) kv('Phone', sale.customer.phone);
      y += 2;
      rule();
      for (const item of sale.items) {
        const name = item.product_name ?? item.service_name ?? item.item_name ?? 'Item';
        doc.font('Helvetica-Bold').fontSize(8).text(name, M, y, { width: inner });
        y += 10;
        doc.font('Helvetica').fontSize(7.5);
        kv(`${item.quantity} x ${money(item.unit_price)}`, money(item.total));
      }
      rule();
      if (sale.discount > 0) kv('Discount', `-${money(sale.discount)}`);
      if (sale.tax > 0) kv('VAT', money(sale.tax));
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('TOTAL', M, y, { width: inner / 2 });
      doc.text(money(sale.total), M + inner / 2, y, { width: inner / 2, align: 'right' });
      y += 14;
      doc.font('Helvetica').fontSize(7.5);
      if (payment) kv(`Paid (${payment.method})`, money(payment.amount));
      if (payment?.reference) kv('Ref', payment.reference);
      kv('Total paid', money(paid));
      kv('Balance', money(balance));
      if (subscription) {
        y += 2;
        rule();
        doc.font('Helvetica-Bold').fontSize(8).text(subscription.packageName, M, y, { width: inner, align: 'center' });
        y += 10;
        doc.font('Helvetica').fontSize(7.5).text(`Active until ${fmtDate(subscription.expiresAt)}`, M, y, { width: inner, align: 'center' });
        y += 12;
      }
      rule();
      doc.font('Helvetica').fontSize(7.5).text(business.invoice_footer || 'Thank you for choosing Knoxville!', M, y, {
        width: inner,
        align: 'center',
      });
    });
  }
}
