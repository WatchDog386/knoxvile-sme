/** Knoxville Technologies company details shown across the app. */
export const COMPANY = {
  name: 'Knoxville',
  legalName: 'Knoxville Technologies Ltd',
  supportPhone: '+254726818938',
  supportPhoneDisplay: '+254 726 818 938',
  supportEmail: 'support@knoxville.co.ke',
  website: 'https://knoxvilletechnologies.com',
  websiteLabel: 'knoxvilletechnologies.com',
  /** M-Pesa paybill clients pay to; set VITE_MPESA_PAYBILL in frontend/.env. */
  paybill: (import.meta.env.VITE_MPESA_PAYBILL as string | undefined)?.trim() ?? '',
} as const;
