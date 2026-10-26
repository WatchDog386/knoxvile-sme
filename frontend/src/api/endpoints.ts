import { api, client, API_BASE_URL, type Paginated } from './client';
import type {
  AuthResult,
  CategoryType,
  PinDeviceResult,
  CallDue,
  CallLog,
  CallOutcome,
  DocKind,
  DocumentShare,
  SubscriberStats,
  SubscriberInput,
  SubscriberRow,
  CustomerOptions,
  Subscription,
  SubscriptionStatus,
  MfaChallenge,
  TwoFactorEnabled,
  TwoFactorSetup,
  Budget,
  BudgetStatus,
  Business,
  BusinessMember,
  Category,
  Customer,
  DashboardData,
  DailySummaryRow,
  Expense,
  ExpenseStatus,
  InventoryTransaction,
  Payment,
  Product,
  ProductPerformanceRow,
  ProfitLoss,
  RecurringExpense,
  Sale,
  SaleDetail,
  Service,
  User,
  UserRole,
} from './types';

// ---- Auth ----

export const authApi = {
  /**
   * Checks the password; always answers with a two-factor step, never a session.
   * `identifier` is a subscriber's username or account number, or a staff email.
   */
  login: (identifier: string, password: string) =>
    // A session straight away, or a code challenge when two-factor is on
    api<MfaChallenge | AuthResult>({ method: 'POST', url: '/auth/login', data: { identifier, password } }),
  /** Settings: start, confirm or turn off two-factor sign-in for the signed-in person. */
  twoFactorSetupMe: () => api<TwoFactorSetup>({ method: 'POST', url: '/auth/2fa/me/setup' }),
  twoFactorEnableMe: (code: string) =>
    api<{ recoveryCodes: string[] }>({ method: 'POST', url: '/auth/2fa/me/enable', data: { code } }),
  twoFactorDisableMe: (password: string) =>
    api<{ twoFactorEnabled: boolean }>({ method: 'POST', url: '/auth/2fa/me/disable', data: { password } }),
  twoFactorSetup: (mfaToken: string) =>
    api<TwoFactorSetup>({ method: 'POST', url: '/auth/2fa/setup', data: { mfaToken } }),
  twoFactorEnable: (mfaToken: string, code: string) =>
    api<TwoFactorEnabled>({ method: 'POST', url: '/auth/2fa/enable', data: { mfaToken, code } }),
  twoFactorVerify: (mfaToken: string, code: string) =>
    api<AuthResult>({ method: 'POST', url: '/auth/2fa/verify', data: { mfaToken, code } }),
  me: () => api<User>({ method: 'GET', url: '/auth/me' }),
  /** PIN sign-in on a device that was trusted earlier. */
  pinLogin: (deviceId: string, deviceToken: string, pin: string) =>
    api<AuthResult>({ method: 'POST', url: '/auth/pin/login', data: { deviceId, deviceToken, pin } }),
  /** "Not you?": this device stops offering PIN sign-in. */
  pinForget: (deviceId: string, deviceToken: string) =>
    api<{ forgotten: boolean }>({ method: 'POST', url: '/auth/pin/forget', data: { deviceId, deviceToken } }),
  /** First PIN, after the person has their own password; trusts this device. */
  pinSetup: (pin: string, deviceName: string) =>
    api<PinDeviceResult>({ method: 'POST', url: '/auth/pin/setup', data: { pin, deviceName } }),
  /** New PIN from the profile page (needs the password). */
  pinChange: (password: string, pin: string, deviceName: string) =>
    api<PinDeviceResult>({ method: 'POST', url: '/auth/pin/change', data: { password, pin, deviceName } }),
  /** Turns on PIN sign-in on this device using the existing PIN. */
  pinTrustDevice: (pin: string, deviceName: string) =>
    api<PinDeviceResult>({ method: 'POST', url: '/auth/pin/device', data: { pin, deviceName } }),
  forgotPassword: (email: string) =>
    api<{ resetToken?: string }>({
      method: 'POST',
      url: '/auth/forgot-password',
      data: { email },
    }),
  resetPassword: (token: string, newPassword: string) =>
    api<{ success: boolean }>({
      method: 'POST',
      url: '/auth/reset-password',
      data: { token, newPassword },
    }),
  // Signs out every other device; the fresh session returned keeps this one in
  changePassword: (currentPassword: string, newPassword: string) =>
    api<AuthResult>({
      method: 'POST',
      url: '/auth/change-password',
      data: { currentPassword, newPassword },
    }),
  updateProfile: (data: { fullName?: string; phone?: string; avatarUrl?: string | null }) =>
    api<User>({ method: 'PATCH', url: '/auth/profile', data }),
};

// ---- Businesses ----

export const businessesApi = {
  create: (data: {
    name: string;
    businessType: string;
    phone?: string;
    address?: string;
    county?: string;
    currency?: string;
    timezone?: string;
    logoUrl?: string;
  }) => api<Business>({ method: 'POST', url: '/businesses', data }),
  mine: () => api<Business[]>({ method: 'GET', url: '/businesses/mine' }),
  current: () => api<Business>({ method: 'GET', url: '/businesses/current' }),
  update: (data: Partial<Business>) =>
    api<Business>({ method: 'PATCH', url: '/businesses/current', data }),
  members: () =>
    api<BusinessMember[]>({ method: 'GET', url: '/businesses/current/members' }),
  addMember: (data: {
    email: string;
    role: UserRole;
    fullName?: string;
    phone?: string;
    password?: string;
  }) =>
    api<{ email: string; role: UserRole }>({
      method: 'POST',
      url: '/businesses/current/members',
      data,
    }),
  /** Owner only: clears a member's two-factor so they set it up again (lost phone). */
  resetMemberTwoFactor: (memberId: string) =>
    api<{ success: boolean }>({
      method: 'POST',
      url: `/businesses/current/members/${memberId}/reset-2fa`,
    }),
};

// ---- Categories ----

export const categoriesApi = {
  list: (type?: CategoryType) =>
    api<Category[]>({
      method: 'GET',
      url: '/categories',
      params: type ? { type } : {},
    }),
  create: (data: { name: string; type: CategoryType }) =>
    api<Category>({ method: 'POST', url: '/categories', data }),
};

// ---- Customers ----

export const customersApi = {
  list: (params: { page?: number; limit?: number; search?: string }) =>
    api<Paginated<Customer>>({ method: 'GET', url: '/customers', params }),
  get: (id: string) => api<Customer>({ method: 'GET', url: `/customers/${id}` }),
  create: (data: SubscriberInput & { name: string }) => api<Customer>({ method: 'POST', url: '/customers', data }),
  update: (id: string, data: SubscriberInput) => api<Customer>({ method: 'PATCH', url: `/customers/${id}`, data }),
  /** Known locations, SMS groups, routers and the next free account number. */
  options: () => api<CustomerOptions>({ method: 'GET', url: '/customers/options' }),
  remove: (id: string) =>
    api<{ success: boolean }>({ method: 'DELETE', url: `/customers/${id}` }),
};

// ---- Products & Services ----

export const productsApi = {
  list: (params: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    stockStatus?: string;
  }) => api<Paginated<Product>>({ method: 'GET', url: '/products', params }),
  get: (id: string) => api<Product>({ method: 'GET', url: `/products/${id}` }),
  create: (data: {
    name: string;
    sku?: string;
    categoryId?: string;
    costPrice: number;
    sellingPrice: number;
    stockQuantity?: number;
    lowStockThreshold?: number;
    trackInventory?: boolean;
    billingDays?: number | null;
    speedMbps?: number | null;
    description?: string | null;
  }) => api<Product>({ method: 'POST', url: '/products', data }),
  update: (
    id: string,
    data: Partial<{
      name: string;
      sku: string;
      categoryId: string;
      costPrice: number;
      sellingPrice: number;
      lowStockThreshold: number;
      trackInventory: boolean;
      active: boolean;
      billingDays: number | null;
      speedMbps: number | null;
      description: string | null;
    }>,
  ) => api<Product>({ method: 'PATCH', url: `/products/${id}`, data }),
  remove: (id: string) =>
    api<{ success: boolean }>({ method: 'DELETE', url: `/products/${id}` }),
  restock: (id: string, quantity: number, reason?: string) =>
    api<Product>({
      method: 'POST',
      url: `/products/${id}/restock`,
      data: { quantity, reason },
    }),
  adjust: (id: string, quantity: number, reason?: string) =>
    api<Product>({
      method: 'POST',
      url: `/products/${id}/adjust`,
      data: { quantity, reason },
    }),
  damage: (id: string, quantity: number, reason?: string) =>
    api<Product>({
      method: 'POST',
      url: `/products/${id}/damage`,
      data: { quantity, reason },
    }),
  history: (id: string) =>
    api<InventoryTransaction[]>({
      method: 'GET',
      url: `/products/${id}/transactions`,
    }),
};

export const servicesApi = {
  list: (params: { search?: string; categoryId?: string; active?: boolean }) =>
    api<Service[]>({ method: 'GET', url: '/services', params }),
  get: (id: string) => api<Service>({ method: 'GET', url: `/services/${id}` }),
  create: (data: {
    name: string;
    description?: string;
    price: number;
    durationMinutes?: number;
    categoryId?: string;
  }) => api<Service>({ method: 'POST', url: '/services', data }),
  update: (
    id: string,
    data: Partial<{
      name: string;
      description: string;
      price: number;
      durationMinutes: number;
      categoryId: string;
      active: boolean;
    }>,
  ) => api<Service>({ method: 'PATCH', url: `/services/${id}`, data }),
  remove: (id: string) =>
    api<{ success: boolean }>({ method: 'DELETE', url: `/services/${id}` }),
};

// ---- Sales ----

export interface SaleItemInput {
  productId?: string;
  serviceId?: string;
  quantity: number;
}

export interface CreateSaleInput {
  items: SaleItemInput[];
  saleType?: 'GENERAL' | 'PRODUCT' | 'SERVICE' | 'PACKAGE' | 'ADVANCE' | 'OTHER' | 'MIXED';
  applyAdvances?: boolean;
  customerId?: string;
  employeeId?: string;
  discount?: number;
  taxRate?: number;
  paymentMethod: string;
  amountPaid?: number;
  reference?: string;
  notes?: string;
  idempotencyKey: string;
  /** Day the sale happened (YYYY-MM-DD); today or earlier. */
  saleDate?: string;
  categoryId?: string;
  /** New installation: extra charge added to a WiFi package sale. */
  installationFee?: number;
  /** Amount-only express sale (e.g. recorded from a scanned M-Pesa SMS). */
  total?: number;
}

export interface SalePreview {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  items: Array<{
    type: 'PRODUCT' | 'SERVICE';
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

export const salesApi = {
  list: (params: {
    page?: number;
    limit?: number;
    from?: string;
    to?: string;
    customerId?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    saleType?: string;
    categoryId?: string;
    search?: string;
  }) =>
    api<Paginated<Sale>>({ method: 'GET', url: '/sales', params }),
  get: (id: string) => api<SaleDetail>({ method: 'GET', url: `/sales/${id}` }),
  availableAdvances: (customerId: string) =>
    api<{ total: number; advances: Array<{ id: string; number: number | null; total: number; used: number; available: number; purpose: string | null; created_at: string }> }>({ method: 'GET', url: `/sales/customer/${customerId}/advances` }),
  preview: (data: CreateSaleInput) =>
    api<SalePreview>({ method: 'POST', url: '/sales/preview', data }),
  create: (data: CreateSaleInput) =>
    api<SaleDetail>({ method: 'POST', url: '/sales', data }),
  recordPayment: (
    saleId: string,
    data: { amount: number; method: string; reference?: string; notes?: string },
  ) =>
    api<SaleDetail>({
      method: 'POST',
      url: `/sales/${saleId}/payments`,
      data,
    }),
  cancel: (saleId: string) =>
    api<SaleDetail>({ method: 'POST', url: `/sales/${saleId}/cancel` }),
};

// ---- Invoices & receipts ----

export const documentsApi = {
  /** Fetches the PDF (A4, or 80mm till format) for previewing before saving. */
  fetchPdf: async (saleId: string, kind: DocKind, format: 'a4' | 'thermal' = 'a4') => {
    const res = await client.get<Blob>(`/sales/${saleId}/documents/${kind}.pdf`, {
      params: { format },
      responseType: 'blob',
    });
    const disposition = String(res.headers['content-disposition'] ?? '');
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${kind}.pdf`;
    return { blob: res.data, filename };
  },
  /** Saves a fetched PDF to the device. */
  save: (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  },
  share: (saleId: string, kind: DocKind) =>
    api<DocumentShare>({ method: 'POST', url: `/sales/${saleId}/documents/share`, data: { kind } }),
  email: (saleId: string, kind: DocKind, to: string) =>
    api<{ success: boolean; to: string }>({ method: 'POST', url: `/sales/${saleId}/documents/email`, data: { kind, to } }),
  /** Link a client can open without signing in (used for WhatsApp). */
  publicUrl: (token: string, kind: DocKind, format: 'a4' | 'thermal' = 'a4') => {
    const base = /^https?:/.test(API_BASE_URL) ? API_BASE_URL : `${window.location.origin}${API_BASE_URL}`;
    return `${base.replace(/\/$/, '')}/public/documents/${token}/${kind}.pdf${format === 'thermal' ? '?format=thermal' : ''}`;
  },
};

// ---- WiFi subscriptions ----

export const subscriptionsApi = {
  list: (status?: SubscriptionStatus) =>
    api<Subscription[]>({ method: 'GET', url: '/subscriptions', params: status ? { status } : undefined }),
  stats: () => api<SubscriberStats>({ method: 'GET', url: '/subscriptions/stats' }),
  /** Every client with account details and Active / Inactive / Pending status. */
  register: () => api<SubscriberRow[]>({ method: 'GET', url: '/subscriptions/subscribers' }),
  forCustomer: (customerId: string) =>
    api<Subscription | null>({ method: 'GET', url: `/subscriptions/customer/${customerId}` }),
  /** Add an already-connected subscriber without a sale. */
  create: (data: { customerId: string; productId: string; startedAt?: string }) =>
    api<Subscription>({ method: 'POST', url: '/subscriptions', data }),
  /** Set the package a client is on (no sale; creates the plan if missing). */
  setPackage: (customerId: string, productId: string) =>
    api<Subscription>({ method: 'PATCH', url: `/subscriptions/customer/${customerId}`, data: { productId } }),
};

// ---- M-Pesa prompts (STK push) ----

export type StkState = 'pending' | 'paid' | 'cancelled' | 'failed';
export interface StkPush {
  checkoutRequestId: string;
  phone: string;
  amount: number;
  state: StkState;
  message: string;
  receipt: string | null;
}

export const paymentsApi = {
  mpesaStatus: () => api<{ stkPush: boolean; environment: string }>({ method: 'GET', url: '/payments/mpesa/status' }),
  stkPush: (data: { phone: string; amount: number; reference?: string; description?: string }) =>
    api<StkPush>({ method: 'POST', url: '/payments/mpesa/stk-push', data }),
  stkStatus: (checkoutRequestId: string) =>
    api<StkPush>({ method: 'GET', url: '/payments/mpesa/stk-push/' + encodeURIComponent(checkoutRequestId) }),
};

// ---- Client app (a WiFi client's own login) ----

export interface ClientHome {
  business: { name: string; phone: string | null; email: string | null };
  customer: { id: string; name: string; phone: string | null; email: string | null; balance: number; totalSpent: number };
  subscription: Subscription | null;
  packages: Array<{ id: string; name: string; price: number; speedMbps: number | null; billingDays: number | null; description: string | null }>;
  payments: Array<{ id: string; number: number | null; total: number; paid: number; balance: number; advanceCredit: number; advanceUsed: number; advanceAvailable: number; status: string; method: string; at: string; packageName: string | null }>;
}

export const clientApi = {
  me: () => api<ClientHome>({ method: 'GET', url: '/client/me' }),
  pay: (data: { productId?: string; saleId?: string; phone?: string; amount?: number }) =>
    api<StkPush>({ method: 'POST', url: '/client/pay', data }),
  payStatus: (checkoutRequestId: string) =>
    api<StkPush & { saleId: string | null }>({ method: 'GET', url: '/client/pay/' + encodeURIComponent(checkoutRequestId) }),
  /** Downloads the client's own invoice or receipt. */
  document: async (saleId: string, kind: 'invoice' | 'receipt') => {
    const res = await client.get<Blob>(`/client/sales/${saleId}/${kind}.pdf`, { responseType: 'blob' });
    const disposition = String(res.headers['content-disposition'] ?? '');
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${kind}.pdf`;
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

/** Staff give a client their app login from the client's page. */
export interface ClientAccess {
  enabled: boolean;
  /** Real email only; clients without one sign in with the account number. */
  email: string | null;
  /** Subscribers sign in with this. */
  username: string | null;
  accountNumber: string | null;
  createdAt: string | null;
  /** True while the client is still on the password the office generated. */
  mustChangePassword: boolean;
  /** Only on a grant: the temporary password, returned once and never stored. */
  password?: string;
}

export const clientAccessApi = {
  get: (customerId: string) => api<ClientAccess>({ method: 'GET', url: `/customers/${customerId}/app-access` }),
  /** Leave the password out and one is generated: the office sends it to the client. */
  grant: (customerId: string, data: { email?: string; password?: string } = {}) =>
    api<ClientAccess>({ method: 'POST', url: `/customers/${customerId}/app-access`, data }),
  revoke: (customerId: string) => api<ClientAccess>({ method: 'DELETE', url: `/customers/${customerId}/app-access` }),
};

// ---- Client calls ----

export const callsApi = {
  due: () => api<CallDue[]>({ method: 'GET', url: '/calls/due' }),
  history: (customerId: string) => api<CallLog[]>({ method: 'GET', url: `/customers/${customerId}/calls` }),
  log: (
    customerId: string,
    data: { outcome: CallOutcome; channel?: 'PHONE' | 'WHATSAPP' | 'SMS'; notes?: string; followUpAt?: string },
  ) => api<CallLog>({ method: 'POST', url: `/customers/${customerId}/calls`, data }),
  done: (id: string) => api<{ success: boolean }>({ method: 'PATCH', url: `/calls/${id}/done` }),
};

export const smsApi = {
  /** SMS, WhatsApp (Cloud API) and email (SMTP) sending readiness. */
  status: () =>
    api<{ configured: boolean; missing: string[]; whatsapp?: boolean; email?: boolean }>({ method: 'GET', url: '/sms/status' }),
  /** WhatsApp via the Cloud API; `params` fill the approved template ({{1}} name, {{2}} amount, {{3}} account). */
  whatsapp: (customerId: string, message: string, params?: string[]) =>
    api<{ sent: boolean; messageId: string | null; statusDesc: string; to: string }>({
      method: 'POST',
      url: `/customers/${customerId}/whatsapp`,
      data: { message, params },
    }),
  /** Payment reminder by email with the invoice PDFs attached. */
  emailReminder: (customerId: string, data: { saleIds: string[]; message: string; subject?: string }) =>
    api<{ success: boolean; to: string }>({ method: 'POST', url: `/customers/${customerId}/email-reminder`, data }),
  send: (customerId: string, message: string) =>
    api<{ sent: boolean; statusCode: string; statusDesc: string; messageId: string | null; to: string | null }>({
      method: 'POST',
      url: `/customers/${customerId}/sms`,
      data: { message },
    }),
};

// ---- Expenses ----

export const expensesApi = {
  list: (params: {
    page?: number;
    limit?: number;
    from?: string;
    to?: string;
    categoryId?: string;
    search?: string;
    status?: ExpenseStatus;
    paymentMethod?: string;
  }) => api<Paginated<Expense>>({ method: 'GET', url: '/expenses', params }),
  get: (id: string) => api<Expense>({ method: 'GET', url: `/expenses/${id}` }),
  create: (data: {
    description: string;
    amount: number;
    categoryId?: string;
    paymentMethod?: string;
    expenseDate?: string;
    receiptUrl?: string;
  }) => api<Expense>({ method: 'POST', url: '/expenses', data }),
  update: (
    id: string,
    data: Partial<{
      description: string;
      amount: number;
      categoryId: string;
      paymentMethod: string;
      expenseDate: string;
      receiptUrl: string;
    }>,
  ) => api<Expense>({ method: 'PATCH', url: `/expenses/${id}`, data }),
  remove: (id: string) =>
    api<{ success: boolean }>({ method: 'DELETE', url: `/expenses/${id}` }),
  approve: (id: string) =>
    api<Expense>({ method: 'PATCH', url: `/expenses/${id}/approve` }),
  reject: (id: string, reason: string) =>
    api<Expense>({ method: 'PATCH', url: `/expenses/${id}/reject`, data: { reason } }),
};

// ---- Recurring expenses ----

export interface RecurringExpenseInput {
  description: string;
  amount: number;
  categoryId?: string;
  paymentMethod?: string;
  dayOfMonth: number;
  startDate?: string;
  endDate?: string | null;
}

export const recurringExpensesApi = {
  list: () =>
    api<RecurringExpense[]>({ method: 'GET', url: '/recurring-expenses' }),
  create: (data: RecurringExpenseInput) =>
    api<RecurringExpense>({ method: 'POST', url: '/recurring-expenses', data }),
  update: (id: string, data: Partial<Omit<RecurringExpenseInput, 'startDate'>>) =>
    api<RecurringExpense>({ method: 'PATCH', url: `/recurring-expenses/${id}`, data }),
  pause: (id: string) =>
    api<RecurringExpense>({ method: 'POST', url: `/recurring-expenses/${id}/pause` }),
  resume: (id: string) =>
    api<RecurringExpense>({ method: 'POST', url: `/recurring-expenses/${id}/resume` }),
  remove: (id: string) =>
    api<{ success: boolean }>({ method: 'DELETE', url: `/recurring-expenses/${id}` }),
};

// ---- Budgets ----

export const budgetsApi = {
  list: () => api<Budget[]>({ method: 'GET', url: '/budgets' }),
  status: (month?: string) =>
    api<{ month: string; items: BudgetStatus[] }>({
      method: 'GET',
      url: '/budgets/status',
      params: month ? { month } : undefined,
    }),
  create: (data: { categoryId: string; monthlyLimit: number; alertThreshold?: number }) =>
    api<Budget>({ method: 'POST', url: '/budgets', data }),
  update: (id: string, data: { monthlyLimit?: number; alertThreshold?: number }) =>
    api<Budget>({ method: 'PATCH', url: `/budgets/${id}`, data }),
  remove: (id: string) =>
    api<{ success: boolean }>({ method: 'DELETE', url: `/budgets/${id}` }),
};

// ---- Dashboard ----

export const dashboardApi = {
  get: () => api<DashboardData>({ method: 'GET', url: '/dashboard' }),
};

// ---- Reports ----

// ---- Daily report ----

export type ReportPeriod = 'day' | 'week' | 'month' | 'year';

export interface DailyReport {
  period?: ReportPeriod;
  /** First day of the period (YYYY-MM-DD). */
  date: string;
  from: string;
  to: string;
  /** The day has ended (midnight passed): the report is final. */
  closed: boolean;
  generatedAt: string;
  revenue: {
    total: number;
    salesCount: number;
    averageSale: number;
    collected: number;
    unpaid: number;
    byMethod: Array<{ method: string; total: number; count: number }>;
    collectedByMethod: Array<{ method: string; total: number; count: number }>;
  };
  packages: {
    sold: number;
    revenue: number;
    newSubscribers: number;
    renewals: number;
    lines: Array<{ name: string; quantity: number; revenue: number }>;
  };
  products: Array<{ name: string; quantity: number; revenue: number; profit: number }>;
  expenses: {
    total: number;
    count: number;
    pendingCount: number;
    pendingTotal: number;
    byCategory: Array<{ category: string; amount: number }>;
    items: Array<{ id: string; date: string; description: string; category: string; amount: number; status: string; method: string }>;
  };
  profit: { cogs: number; gross: number; net: number; margin: number };
  cash: { moneyIn: number; moneyOut: number; net: number };
  subscribers: { active: number; expiring: number; expired: number; expiredThisDay: number };
  debts: { outstanding: number; debtors: number };
  previous: { revenue: number; salesCount: number; expenses: number; net: number };
  sales: Array<{ id: string; number: number | null; at: string; customer: string; type: string; total: number; method: string; status: string }>;
}

export interface DailyReportDeliverySettings {
  enabled: boolean;
  email: string;
  usingOwnerEmail: boolean;
  emailConfigured: boolean;
  sendTime: string;
  timezone: string;
  lastDelivery: { date: string; status: 'SENDING' | 'SENT' | 'FAILED'; sentAt: string | null } | null;
}

export interface DailyHistoryRow {
  date: string;
  revenue: number;
  expenses: number;
  net: number;
  salesCount: number;
}

export const reportsApi = {
  /** Report for the day, week, month or year containing `date` (today by default). */
  day: (date?: string, period: ReportPeriod = 'day') =>
    api<DailyReport>({ method: 'GET', url: '/reports/day', params: { ...(date ? { date } : {}), period } }),
  deliverySettings: () => api<DailyReportDeliverySettings>({ method: 'GET', url: '/reports/delivery' }),
  updateDeliverySettings: (data: { email: string | null; enabled: boolean }) =>
    api<DailyReportDeliverySettings>({ method: 'PATCH', url: '/reports/delivery', data }),
  /** Totals for each of the last `days` periods (oldest first); `date` is each period's first day. */
  dayHistory: (days: number, until?: string, period: ReportPeriod = 'day') =>
    api<DailyHistoryRow[]>({ method: 'GET', url: '/reports/day/history', params: { days, until, period } }),
  profitLoss: (params: { from?: string; to?: string }) =>
    api<ProfitLoss>({ method: 'GET', url: '/reports/profit-loss', params }),
  dailySummary: (params: { from?: string; to?: string }) =>
    api<DailySummaryRow[]>({
      method: 'GET',
      url: '/reports/daily-summary',
      params,
    }),
  productPerformance: (params: { from?: string; to?: string; limit?: number }) =>
    api<ProductPerformanceRow[]>({
      method: 'GET',
      url: '/reports/products',
      params,
    }),
  customerPerformance: (params: { limit?: number }) =>
    api<Customer[]>({ method: 'GET', url: '/reports/customers', params }),
  expenseSummary: (params: { from?: string; to?: string }) =>
    api<Array<{ category: string; amount: number }>>({
      method: 'GET',
      url: '/reports/expenses',
      params,
    }),
  /** Downloads a server-generated export (e.g. `profit-loss/export.xlsx`). */
  download: async (
    path: string,
    params: { from?: string; to?: string; date?: string; period?: ReportPeriod },
    fallbackName: string,
  ) => {
    const res = await client.get<Blob>(`/reports/${path}`, {
      params,
      responseType: 'blob',
    });
    const disposition = String(res.headers['content-disposition'] ?? '');
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export type { Payment };
