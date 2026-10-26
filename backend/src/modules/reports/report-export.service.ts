import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { DateTime } from 'luxon';
import { ReportsService } from './reports.service';
import { DailyReportService, type ReportPeriod } from './daily-report.service';
import { formatMoney } from '../../common/utils/money';

export interface ExportContext {
  businessId: string;
  businessName: string;
  timezone: string;
  currency: string;
  from?: string;
  to?: string;
}

export interface ExportFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

const XLSX_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PDF_TYPE = 'application/pdf';
const BRAND = '#0B2545';
const MUTED = '#6B7280';

type Row = [string, string];
type DailyReportData = Awaited<ReturnType<DailyReportService['report']>>;

/** Words for each report period: titles, "vs the week before", file names. */
const PERIOD_WORDS: Record<ReportPeriod, { title: string; unit: string; file: string }> = {
  day: { title: 'Daily', unit: 'day', file: 'daily' },
  week: { title: 'Weekly', unit: 'week', file: 'weekly' },
  month: { title: 'Monthly', unit: 'month', file: 'monthly' },
  year: { title: 'Yearly', unit: 'year', file: 'yearly' },
};

@Injectable()
export class ReportExportService {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly dailyReports: DailyReportService,
  ) {}

  async profitLossXlsx(ctx: ExportContext): Promise<ExportFile> {
    const pl = await this.reportsService.profitLoss(
      ctx.businessId,
      ctx.from,
      ctx.to,
      ctx.timezone,
    );
    const workbook = this.newWorkbook();
    const sheet = workbook.addWorksheet('Profit & Loss');
    this.writeSheetHeader(sheet, ctx, 'Profit & Loss', pl.from, pl.to);
    const money = this.moneyFormat(ctx.currency);

    sheet.addRow([]);
    const lines: [string, number][] = [
      ['Revenue', pl.revenue],
      ['Cost of goods sold', pl.cogs],
      ['Gross profit', pl.grossProfit],
      ['Operating expenses', pl.operatingExpenses],
      ['Net profit', pl.netProfit],
    ];
    for (const [label, value] of lines) {
      const row = sheet.addRow([label, value]);
      row.getCell(2).numFmt = money;
      if (label === 'Gross profit' || label === 'Net profit') row.font = { bold: true };
    }
    sheet.addRow([]);
    sheet.addRow(['Gross margin', pl.grossMargin / 100]).getCell(2).numFmt = '0%';
    sheet.addRow(['Net margin', pl.netMargin / 100]).getCell(2).numFmt = '0%';
    sheet.addRow(['Number of sales', pl.salesCount]);
    sheet.addRow(['Average sale value', pl.averageSaleValue]).getCell(2).numFmt = money;

    if (pl.revenueByMethod.length > 0) {
      sheet.addRow([]);
      sheet.addRow(['Revenue by payment method']).font = { bold: true };
      for (const m of pl.revenueByMethod) {
        sheet.addRow([m.method, m.total]).getCell(2).numFmt = money;
      }
    }
    sheet.getColumn(1).width = 32;
    sheet.getColumn(2).width = 20;

    return this.xlsxFile(workbook, 'profit-loss', ctx);
  }

  async expensesXlsx(ctx: ExportContext, status?: string): Promise<ExportFile> {
    const [summary, details] = await Promise.all([
      this.reportsService.expenseSummary(ctx.businessId, ctx.from, ctx.to),
      this.reportsService.expenseDetails(ctx.businessId, ctx.from, ctx.to, status),
    ]);
    const { start, end } = this.range(ctx);
    const workbook = this.newWorkbook();
    const money = this.moneyFormat(ctx.currency);

    const byCat = workbook.addWorksheet('By category');
    this.writeSheetHeader(byCat, ctx, 'Expenses by category', start, end);
    byCat.addRow([]);
    byCat.addRow(['Category', 'Amount']).font = { bold: true };
    for (const row of summary) {
      byCat.addRow([row.category, row.amount]).getCell(2).numFmt = money;
    }
    const total = summary.reduce((acc, r) => acc + r.amount, 0);
    const totalRow = byCat.addRow(['Total', total]);
    totalRow.font = { bold: true };
    totalRow.getCell(2).numFmt = money;
    byCat.getColumn(1).width = 32;
    byCat.getColumn(2).width = 20;

    const list = workbook.addWorksheet('Expenses');
    list.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Category', key: 'category', width: 22 },
      { header: 'Payment method', key: 'paymentMethod', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Amount', key: 'amount', width: 16 },
    ];
    list.getRow(1).font = { bold: true };
    for (const d of details) {
      list.addRow({ ...d, date: this.localDate(d.date, ctx.timezone) });
    }
    list.getColumn('amount').numFmt = money;
    const listTotal = list.addRow({
      description: 'Total',
      amount: details.reduce((acc, d) => acc + d.amount, 0),
    });
    listTotal.font = { bold: true };

    return this.xlsxFile(workbook, 'expenses', ctx);
  }

  async profitLossPdf(ctx: ExportContext): Promise<ExportFile> {
    const pl = await this.reportsService.profitLoss(
      ctx.businessId,
      ctx.from,
      ctx.to,
      ctx.timezone,
    );
    const m = (v: number) => formatMoney(v, ctx.currency);
    const buffer = await this.renderPdf((doc) => {
      this.pdfHeader(doc, ctx, 'Profit & Loss', pl.from, pl.to);
      this.pdfTable(doc, 'Summary', [
        ['Revenue', m(pl.revenue)],
        ['Cost of goods sold', m(pl.cogs)],
        ['Gross profit', m(pl.grossProfit)],
        ['Operating expenses', m(pl.operatingExpenses)],
        ['Net profit', m(pl.netProfit)],
      ], ['Gross profit', 'Net profit']);
      this.pdfTable(doc, 'Key figures', [
        ['Gross margin', `${pl.grossMargin}%`],
        ['Net margin', `${pl.netMargin}%`],
        ['Number of sales', String(pl.salesCount)],
        ['Average sale value', m(pl.averageSaleValue)],
      ]);
      if (pl.revenueByMethod.length > 0) {
        this.pdfTable(
          doc,
          'Revenue by payment method',
          pl.revenueByMethod.map((r) => [r.method, m(r.total)]),
        );
      }
    });
    return this.pdfFile(buffer, 'profit-loss', ctx);
  }

  async expensesPdf(ctx: ExportContext, status?: string): Promise<ExportFile> {
    const [summary, details] = await Promise.all([
      this.reportsService.expenseSummary(ctx.businessId, ctx.from, ctx.to),
      this.reportsService.expenseDetails(ctx.businessId, ctx.from, ctx.to, status),
    ]);
    const { start, end } = this.range(ctx);
    const m = (v: number) => formatMoney(v, ctx.currency);
    const total = summary.reduce((acc, r) => acc + r.amount, 0);

    const buffer = await this.renderPdf((doc) => {
      this.pdfHeader(doc, ctx, 'Expense report', start, end);
      this.pdfTable(
        doc,
        'By category',
        [...summary.map((r): Row => [r.category, m(r.amount)]), ['Total', m(total)]],
        ['Total'],
      );
      this.pdfTable(
        doc,
        `Expenses (${details.length})`,
        details.map((d): Row => [
          `${this.localDate(d.date, ctx.timezone)}  ${d.description}  ·  ${d.category}`,
          m(d.amount),
        ]),
      );
    });
    return this.pdfFile(buffer, 'expenses', ctx);
  }

  /** The report for one day, week, month or year, as a PDF to keep or send to the owner. */
  async dailyPdf(ctx: ExportContext, date?: string, data?: DailyReportData, period: ReportPeriod = 'day'): Promise<ExportFile> {
    const r = data ?? await this.dailyReports.report(ctx.businessId, date, ctx.timezone, period);
    const words = PERIOD_WORDS[r.period ?? period];
    const m = (v: number) => formatMoney(v, ctx.currency);
    const change = (now: number, before: number) =>
      before ? `${now >= before ? '+' : ''}${Math.round(((now - before) / before) * 100)}% vs the ${words.unit} before` : '';
    const buffer = await this.renderPdf((doc) => {
      this.pdfHeader(doc, ctx, r.closed ? `${words.title} report` : `${words.title} report (so far)`, r.from, r.to);
      this.pdfTable(doc, 'Summary', [
        ['Revenue', m(r.revenue.total)],
        ['Money collected', m(r.revenue.collected)],
        ['Expenses', m(r.expenses.total)],
        ['Net profit', m(r.profit.net)],
        ['Cash in hand (collected less expenses)', m(r.cash.net)],
      ], ['Net profit']);
      this.pdfTable(doc, 'Sales', [
        ['Number of sales', String(r.revenue.salesCount)],
        ['Average sale', m(r.revenue.averageSale)],
        ['Not fully paid', String(r.revenue.unpaid)],
        ['Change in revenue', change(r.revenue.total, r.previous.revenue) || `No sales the ${words.unit} before`],
        ...r.revenue.collectedByMethod.map((p): Row => [`Collected by ${p.method}`, m(p.total)]),
      ]);
      this.pdfTable(doc, 'WiFi packages', [
        ['Packages sold', String(r.packages.sold)],
        ['New subscribers', String(r.packages.newSubscribers)],
        ['Renewals', String(r.packages.renewals)],
        ...r.packages.lines.map((p): Row => [`${p.quantity} × ${p.name}`, m(p.revenue)]),
      ]);
      if (r.products.length) {
        this.pdfTable(doc, 'Products', r.products.map((p): Row => [`${p.quantity} × ${p.name}`, m(p.revenue)]));
      }
      this.pdfTable(doc, 'Expenses', [
        ...r.expenses.byCategory.map((e): Row => [e.category, m(e.amount)]),
        ['Total approved', m(r.expenses.total)],
        ...(r.expenses.pendingCount ? [[`Waiting for approval (${r.expenses.pendingCount})`, m(r.expenses.pendingTotal)] as Row] : []),
      ], ['Total approved']);
      this.pdfTable(doc, 'Subscribers and balances', [
        ['Active', String(r.subscribers.active)],
        ['Expiring within 7 days', String(r.subscribers.expiring)],
        ['Expired', String(r.subscribers.expired)],
        ['Owed by clients', `${m(r.debts.outstanding)} (${r.debts.debtors} clients)`],
      ]);
    });
    return { buffer, filename: `${words.file}-report-${r.date}.pdf`, contentType: PDF_TYPE };
  }

  /** Full daily workbook with summary and transaction detail for reconciliation. */
  async dailyXlsx(ctx: ExportContext, date?: string, data?: DailyReportData, period: ReportPeriod = 'day'): Promise<ExportFile> {
    const r = data ?? await this.dailyReports.report(ctx.businessId, date, ctx.timezone, period);
    const words = PERIOD_WORDS[r.period ?? period];
    const workbook = this.newWorkbook();
    const money = this.moneyFormat(ctx.currency);
    const summary = workbook.addWorksheet(`${words.title} summary`);
    this.writeSheetHeader(summary, ctx, `${words.title} report`, r.from, r.to);
    summary.addRow([]);
    summary.addRow(['Metric', 'Value']).font = { bold: true };
    const summaryRows: Array<[string, string | number]> = [
      ['Revenue', r.revenue.total],
      ['Money collected', r.revenue.collected],
      ['Approved expenses', r.expenses.total],
      ['Cost of goods sold', r.profit.cogs],
      ['Gross profit', r.profit.gross],
      ['Net profit', r.profit.net],
      ['Cash in (collected less approved expenses)', r.cash.net],
      ['Sales count', r.revenue.salesCount],
      ['Average sale', r.revenue.averageSale],
      ['Sales not fully paid', r.revenue.unpaid],
      ['Pending expenses', r.expenses.pendingCount],
      ['Pending expense amount', r.expenses.pendingTotal],
      ['Outstanding customer balances', r.debts.outstanding],
    ];
    for (const [label, value] of summaryRows) {
      const row = summary.addRow([label, value]);
      if (typeof value === 'number' && !['Sales count', 'Sales not fully paid', 'Pending expenses'].includes(label)) {
        row.getCell(2).numFmt = money;
      }
      if (label === 'Net profit') row.font = { bold: true };
    }
    summary.addRow([]);
    summary.addRow(['Money collected by method']).font = { bold: true };
    summary.addRow(['Method', 'Amount', 'Payments']).font = { bold: true };
    for (const payment of r.revenue.collectedByMethod) {
      const row = summary.addRow([payment.method, payment.total, payment.count]);
      row.getCell(2).numFmt = money;
    }
    summary.getColumn(1).width = 42;
    summary.getColumn(2).width = 20;
    summary.getColumn(3).width = 14;

    const sales = workbook.addWorksheet('Sales');
    sales.columns = [
      { header: 'Time', key: 'time', width: 22 },
      { header: 'Invoice', key: 'invoice', width: 14 },
      { header: 'Customer', key: 'customer', width: 28 },
      { header: 'Sale type', key: 'type', width: 20 },
      { header: 'Payment method', key: 'method', width: 18 },
      { header: 'Payment status', key: 'status', width: 16 },
      { header: `Total (${ctx.currency})`, key: 'total', width: 18 },
    ];
    sales.getRow(1).font = { bold: true };
    for (const sale of r.sales) {
      sales.addRow({
        time: DateTime.fromJSDate(new Date(sale.at), { zone: ctx.timezone }).toFormat('yyyy-LL-dd HH:mm'),
        invoice: sale.number ? `INV-${String(sale.number).padStart(6, '0')}` : sale.id.slice(0, 8).toUpperCase(),
        customer: sale.customer,
        type: sale.type,
        method: sale.method,
        status: sale.status,
        total: sale.total,
      });
    }
    sales.getColumn('total').numFmt = money;
    sales.views = [{ state: 'frozen', ySplit: 1 }];
    sales.autoFilter = { from: 'A1', to: 'G1' };

    const expenses = workbook.addWorksheet('Expenses');
    expenses.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Description', key: 'description', width: 36 },
      { header: 'Category', key: 'category', width: 22 },
      { header: 'Payment method', key: 'method', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: `Amount (${ctx.currency})`, key: 'amount', width: 18 },
    ];
    expenses.getRow(1).font = { bold: true };
    for (const expense of r.expenses.items) {
      expenses.addRow({
        date: DateTime.fromJSDate(new Date(expense.date), { zone: ctx.timezone }).toFormat('yyyy-LL-dd'),
        description: expense.description,
        category: expense.category,
        method: expense.method,
        status: expense.status,
        amount: expense.amount,
      });
    }
    expenses.getColumn('amount').numFmt = money;
    expenses.views = [{ state: 'frozen', ySplit: 1 }];
    expenses.autoFilter = { from: 'A1', to: 'F1' };

    const items = workbook.addWorksheet('Products and packages');
    items.columns = [
      { header: 'Item', key: 'name', width: 32 },
      { header: 'Quantity', key: 'quantity', width: 14 },
      { header: `Revenue (${ctx.currency})`, key: 'revenue', width: 18 },
      { header: `Profit (${ctx.currency})`, key: 'profit', width: 18 },
      { header: 'Type', key: 'type', width: 18 },
    ];
    items.getRow(1).font = { bold: true };
    for (const item of r.products) items.addRow({ ...item, type: 'Product / service' });
    for (const item of r.packages.lines) items.addRow({ ...item, profit: null, type: 'Package' });
    items.getColumn('revenue').numFmt = money;
    items.getColumn('profit').numFmt = money;
    items.views = [{ state: 'frozen', ySplit: 1 }];
    items.autoFilter = { from: 'A1', to: 'E1' };

    const file = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(file as ArrayBuffer),
      filename: `${words.file}-report-${r.date}.xlsx`,
      contentType: XLSX_TYPE,
    };
  }

  // ---- helpers -------------------------------------------------------------

  private range(ctx: ExportContext): { start: Date; end: Date } {
    if (ctx.from && ctx.to) return { start: new Date(ctx.from), end: new Date(ctx.to) };
    const today = DateTime.now().setZone(ctx.timezone).startOf('day');
    return { start: today.toJSDate(), end: today.plus({ days: 1 }).toJSDate() };
  }

  private localDate(date: Date, timezone: string): string {
    return DateTime.fromJSDate(date, { zone: timezone }).toFormat('yyyy-MM-dd');
  }

  /** `to` is exclusive, so the last day shown is the day before it. */
  private rangeLabel(start: Date, end: Date, timezone: string): string {
    const fmt = (d: DateTime) => d.toFormat('d LLL yyyy');
    const s = DateTime.fromJSDate(start, { zone: timezone });
    const e = DateTime.fromJSDate(end, { zone: timezone }).minus({ milliseconds: 1 });
    return s.hasSame(e, 'day') ? fmt(s) : `${fmt(s)} – ${fmt(e)}`;
  }

  private moneyFormat(currency: string): string {
    return `"${currency}" #,##0;[Red]-"${currency}" #,##0`;
  }

  private newWorkbook(): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Knoxville';
    workbook.created = new Date();
    return workbook;
  }

  private writeSheetHeader(
    sheet: ExcelJS.Worksheet,
    ctx: ExportContext,
    title: string,
    start: Date,
    end: Date,
  ): void {
    sheet.addRow([ctx.businessName]).font = { bold: true, size: 14 };
    sheet.addRow([title]).font = { bold: true, size: 12 };
    sheet.addRow([this.rangeLabel(start, end, ctx.timezone)]).font = {
      color: { argb: 'FF6B7280' },
    };
  }

  private async xlsxFile(
    workbook: ExcelJS.Workbook,
    name: string,
    ctx: ExportContext,
  ): Promise<ExportFile> {
    const data = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(data as ArrayBuffer),
      filename: this.filename(name, ctx, 'xlsx'),
      contentType: XLSX_TYPE,
    };
  }

  private pdfFile(buffer: Buffer, name: string, ctx: ExportContext): ExportFile {
    return { buffer, filename: this.filename(name, ctx, 'pdf'), contentType: PDF_TYPE };
  }

  private filename(name: string, ctx: ExportContext, ext: string): string {
    const day = DateTime.now().setZone(ctx.timezone).toFormat('yyyy-MM-dd');
    return `${name}-${day}.${ext}`;
  }

  private renderPdf(draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      draw(doc);
      doc.end();
    });
  }

  private pdfHeader(
    doc: PDFKit.PDFDocument,
    ctx: ExportContext,
    title: string,
    start: Date,
    end: Date,
  ): void {
    doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(10).text('KNOXVILLE');
    doc.moveDown(0.3);
    doc.fillColor('#111827').fontSize(18).text(title);
    doc.font('Helvetica').fontSize(11).fillColor(MUTED);
    doc.text(`${ctx.businessName}  ·  ${this.rangeLabel(start, end, ctx.timezone)}`);
    doc.moveDown(1.2);
  }

  private pdfTable(
    doc: PDFKit.PDFDocument,
    heading: string,
    rows: Row[],
    boldLabels: string[] = [],
  ): void {
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const valueWidth = 130;

    if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(12).fillColor(BRAND).text(heading, left);
    doc.moveDown(0.4);

    if (rows.length === 0) {
      doc.font('Helvetica').fontSize(10).fillColor(MUTED).text('No entries.', left);
      doc.moveDown(1);
      return;
    }

    for (const [label, value] of rows) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 20) doc.addPage();
      const y = doc.y;
      doc
        .font(boldLabels.includes(label) ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(10)
        .fillColor('#111827');
      doc.text(label, left, y, { width: width - valueWidth - 10 });
      const labelBottom = doc.y;
      doc.text(value, left + width - valueWidth, y, { width: valueWidth, align: 'right' });
      doc.y = Math.max(labelBottom, doc.y) + 4;
      doc
        .moveTo(left, doc.y - 2)
        .lineTo(left + width, doc.y - 2)
        .lineWidth(0.5)
        .strokeColor('#E5E7EB')
        .stroke();
    }
    doc.x = left;
    doc.moveDown(1);
  }
}
