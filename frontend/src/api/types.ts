import type { Paginated } from './client';

export type UserRole = 'OWNER' | 'MANAGER' | 'EMPLOYEE' | 'ACCOUNTANT' | 'CLIENT';
/** Everyone who works for the business (a CLIENT login is a WiFi client). */
export type StaffRole = Exclude<UserRole, 'CLIENT'>;

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  /** Two-factor sign-in, turned on by the person in Settings. */
  twoFactorEnabled?: boolean;
  /**
   * The password was chosen by the office (a subscriber's first login). The app
   * asks them for their own before showing anything else.
   */
  mustChangePassword?: boolean;
  /** Client's one permitted self-service password change has been used. */
  selfServicePasswordChangeUsed?: boolean;
  /** The person has set a PIN for quick sign-in; the app asks for one until they do. */
  hasPin?: boolean;
  /** True for the app-owner platform-admin accounts. */
}

export interface AuthResult {
  accessToken: string;
  user: User;
}

/** The secret a trusted device keeps so it can offer PIN sign-in. */
export interface DeviceCredential {
  deviceId: string;
  deviceToken: string;
}

/** A PIN was set or this device was trusted. */
export interface PinDeviceResult {
  device: DeviceCredential;
  user: User;
}

/** Password accepted; a second step (two-factor) is always required. */
export interface MfaChallenge {
  mfa: 'setup' | 'verify';
  mfaToken: string;
  email: string;
}

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  account: string;
  issuer: string;
}

export interface TwoFactorEnabled extends AuthResult {
  /** Single-use backup codes, shown once. */
  recoveryCodes: string[];
}

export interface Business {
  id: string;
  name: string;
  business_type: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  county: string | null;
  currency: string;
  timezone: string;
  subscription_plan: string;
  status: string;
  ownerId: string | null;
  created_at: string;
  updated_at: string;
  /** The signed-in user's role in this business (from /businesses/mine). */
  role?: UserRole;
}

export interface BusinessMember {
  id: string;
  role: UserRole;
  status: string;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    twoFactorEnabled?: boolean;
  };
}

export interface Category {
  id: string;
  businessId: string;
  type: CategoryType;
  name: string;
  created_at: string;
}

export type CategoryType = 'PRODUCT' | 'SERVICE' | 'EXPENSE' | 'SALE';

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  total_spent: number;
  outstanding_balance: number;
  visit_count: number;
  last_visit_at: string | null;
  created_at: string;
  updated_at: string;
  // Subscriber account (ISP billing)
  account_number: string | null;
  username: string | null;
  extra_phones: string[] | null;
  kra_pin: string | null;
  location: string | null;
  sms_group: string | null;
  new_installation: boolean;
  discount: number;
  wallet_balance: number;
  service_type: ServiceType | null;
  router: string | null;
  mac_address: string | null;
  burst_product_id: string | null;
  access_hours: AccessHours | null;
}

export type ServiceType = 'HOTSPOT' | 'PPPOE' | 'STATIC';
/** Allowed hours per weekday (mon…sun); missing day = no limit that day. */
export type AccessHours = Record<string, { from: string; to: string }>;

/** Fields sent when adding or editing a subscriber. */
export interface SubscriberInput {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  accountNumber?: string;
  username?: string;
  extraPhones?: string[];
  kraPin?: string;
  location?: string;
  smsGroup?: string;
  newInstallation?: boolean;
  discount?: number;
  walletBalance?: number;
  serviceType?: ServiceType;
  router?: string;
  macAddress?: string;
  servicePassword?: string;
  burstProductId?: string | null;
  accessHours?: AccessHours | null;
}

export interface CustomerOptions {
  locations: string[];
  smsGroups: string[];
  routers: string[];
  nextAccountNumber: string;
}

/** INCOMPLETE: phone or package still missing. */
export type SubscriberStatus = 'ACTIVE' | 'INACTIVE' | 'INCOMPLETE';

/** One row of the subscriber register. */
export interface SubscriberRow {
  id: string;
  name: string;
  username: string | null;
  accountNumber: string | null;
  phone: string | null;
  location: string | null;
  serviceType: ServiceType | null;
  router: string | null;
  wallet: number;
  createdAt: string;
  packageName: string | null;
  price: number | null;
  expiresAt: string | null;
  daysLeft: number | null;
  /** What still has to be filled in before the subscriber is complete. */
  missing: Array<'phone' | 'package'>;
  status: SubscriberStatus;
}

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface Product {
  id: string;
  businessId: string;
  name: string;
  sku: string | null;
  categoryId: string | null;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  track_inventory: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
  category_name?: string | null;
  stock_status?: StockStatus;
  /** Set when this product is a WiFi package: days of access per unit (e.g. 30). */
  billing_days?: number | null;
  speed_mbps?: number | null;
  /** Optional short description (shown on package cards). */
  description?: string | null;
}

export interface Service {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number | null;
  categoryId: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = 'M-PESA' | 'CASH' | 'BANK' | 'CARD' | 'CREDIT';
export type PaymentStatus =
  | 'PAID'
  | 'PARTIAL'
  | 'UNPAID'
  | 'REFUNDED'
  | 'CANCELLED';

export interface Sale {
  id: string;
  businessId: string;
  /** Sales category chosen when it was recorded. */
  categoryId?: string | null;
  category_name?: string | null;
  customerId: string | null;
  employeeId: string | null;
  sale_type?: 'GENERAL' | 'PRODUCT' | 'SERVICE' | 'PACKAGE' | 'ADVANCE' | 'OTHER' | 'MIXED';
  advance_credit?: number;
  advance_used?: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  notes: string | null;
  idempotency_key: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_at: string;
  updated_at: string;
  customer_name?: string | null;
  item_count?: number;
  /** Collected so far (sales list only). */
  amount_paid?: number;
  /** Invoice number (INV-000123). */
  number?: number | null;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string | null;
  serviceId: string | null;
  quantity: number;
  unit_price: number;
  cost_price: number | null;
  total: number;
  item_name: string | null;
  product_name?: string | null;
  service_name?: string | null;
  package_event?: 'NEW' | 'RENEWAL' | null;
}

export interface Payment {
  id: string;
  businessId: string;
  saleId: string | null;
  customerId: string | null;
  amount: number;
  method: string;
  reference: string | null;
  status: string;
  transaction_date: string;
  created_at: string;
  /** Receipt number (RCT-000045). */
  receipt_number?: number | null;
}

export interface SaleDetail extends Sale {
  customer: Customer | null;
  items: SaleItem[];
  payments: Payment[];
}

export interface Expense {
  id: string;
  businessId: string;
  categoryId: string | null;
  description: string;
  amount: number;
  payment_method: string;
  receipt_url: string | null;
  employeeId: string | null;
  expense_date: string;
  status: ExpenseStatus;
  submittedById: string | null;
  reviewedById: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  recurringExpenseId: string | null;
  created_at: string;
  updated_at: string;
  category_name?: string | null;
}

export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Budget {
  id: string;
  businessId: string;
  categoryId: string;
  monthly_limit: number;
  alert_threshold: number;
  category_name: string;
  created_at: string;
  updated_at: string;
}

export type BudgetLevel = 'OK' | 'WARNING' | 'EXCEEDED';

export interface BudgetStatus {
  id: string;
  categoryId: string;
  category_name: string;
  limit: number;
  alert_threshold: number;
  spent: number;
  remaining: number;
  percent: number;
  level: BudgetLevel;
}

export interface RecurringExpense {
  id: string;
  businessId: string;
  categoryId: string | null;
  description: string;
  amount: number;
  payment_method: string;
  day_of_month: number;
  start_date: string;
  end_date: string | null;
  active: boolean;
  last_generated_month: string | null;
  category_name: string | null;
  next_run_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardData {
  today: {
    sales: number;
    cashReceived: number;
    expenses: number;
    grossProfit: number;
    netProfit: number;
    salesCount: number;
    paymentCount: number;
  };
  weekRevenue: number;
  monthRevenue: number;
  outstandingDebts: number;
  lowStock: number;
  appointmentsToday: number;
  recentCustomers: Customer[];
  recentTransactions: Array<{
    type: 'SALE' | 'PAYMENT' | 'EXPENSE';
    id: string;
    saleId?: string | null;
    amount: number;
    paymentMethod: string;
    status: string;
    description: string;
    customerName: string | null;
    createdAt: string;
  }>;
  /** Payments and unpaid sales recorded in the last 24 hours (for notifications). */
  recentMoney?: DashboardData['recentTransactions'];
  topProducts: Array<{ name: string; quantity: string; revenue: string }>;
  salesSeries: Array<{ date: string; total: string }>;
  /** Budgets at or over their alert threshold this month, worst first. */
  budgetAlerts: BudgetStatus[];
  /** Expenses waiting for an approver. */
  pendingApprovals: number;
  /** WiFi packages sold today: new subscriptions + renewals. */
  packagesToday?: { count: number; new: number; renewals: number; revenue: number };
  subscribers?: SubscriberStats;
  /** Clients to call today (call-backs, expiring/expired packages, balances). */
  callsDue?: number;
}

// ---- Internet provider ----

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRING' | 'EXPIRED';

export interface SubscriberStats {
  active: number;
  expiringSoon: number;
  expired: number;
}

export interface Subscription {
  id: string;
  customerId: string;
  productId: string;
  packageName: string;
  speedMbps: number | null;
  price: number;
  startedAt: string;
  expiresAt: string;
  renewals: number;
  status: SubscriptionStatus;
  daysLeft: number;
  customer?: { id: string; name: string; phone: string | null; email: string | null } | null;
}

export type CallOutcome = 'REACHED' | 'NO_ANSWER' | 'BUSY' | 'PROMISED_TO_PAY' | 'CALL_BACK' | 'WRONG_NUMBER';

export interface CallLog {
  id: string;
  customerId: string;
  channel: 'PHONE' | 'WHATSAPP' | 'SMS';
  outcome: CallOutcome;
  notes: string | null;
  followUpAt: string | null;
  followUpDone: boolean;
  calledAt: string;
  calledBy: string;
}

export interface CallDue {
  customer: { id: string; name: string; phone: string | null; outstandingBalance: number };
  reasons: Array<'FOLLOW_UP' | 'EXPIRING' | 'EXPIRED' | 'BALANCE'>;
  followUp: { id: string; at: string; notes: string | null; outcome: CallOutcome } | null;
  subscription: { packageName: string; expiresAt: string; status: SubscriptionStatus } | null;
}

export type DocKind = 'invoice' | 'receipt';

export interface DocumentShare {
  token: string;
  text: string;
  reference: string;
  customer: { name: string; phone: string | null; email: string | null } | null;
}

export interface ProfitLoss {
  from: string;
  to: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
  salesCount: number;
  averageSaleValue: number;
  revenueByMethod: Array<{ method: string; total: number }>;
}

export interface DailySummaryRow {
  date: string;
  revenue: number;
  cogs: number;
  expenses: number;
  grossProfit: number;
  netProfit: number;
}

export interface ProductPerformanceRow {
  name: string;
  quantity: number;
  revenue: number;
  cogs: number;
  profit: number;
}

export interface InventoryTransaction {
  id: string;
  businessId: string;
  productId: string;
  type: string;
  quantity: number;
  referenceId: string | null;
  reason: string | null;
  created_at: string;
}

export type {
  Paginated,
};
