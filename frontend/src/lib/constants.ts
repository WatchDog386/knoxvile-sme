export const BUSINESS_TYPE_OPTIONS = [
  { value: 'SALON', label: 'Salon', emoji: '💇‍♀️' },
  { value: 'BARBERSHOP', label: 'Barbershop', emoji: '💈' },
  { value: 'BEAUTY', label: 'Beauty / Spa', emoji: '💅' },
  { value: 'RETAIL', label: 'Retail Shop', emoji: '🏪' },
  { value: 'BOUTIQUE', label: 'Boutique', emoji: '👗' },
  { value: 'RESTAURANT', label: 'Restaurant', emoji: '🍽️' },
  { value: 'CAR_WASH', label: 'Car Wash', emoji: '🚗' },
  { value: 'HARDWARE', label: 'Hardware', emoji: '🛠️' },
  { value: 'ELECTRONICS', label: 'Electronics', emoji: '📱' },
  { value: 'WHOLESALE', label: 'Wholesale', emoji: '📦' },
  { value: 'MECHANIC', label: 'Mechanic / Garage', emoji: '🔧' },
  { value: 'FUNDI', label: 'Fundi (Craftsman)', emoji: '🧰' },
  { value: 'SERVICE', label: 'Service Business', emoji: '🤝' },
  { value: 'OTHER', label: 'Other', emoji: '🏢' },
] as const;

export const KENYAN_COUNTIES = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu',
  'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho',
  'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui',
  'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera',
  'Marsabit', 'Meru', 'Migori', 'Mombasa', "Murang'a", 'Nairobi',
  'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri',
  'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi',
  'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir',
  'West Pokot',
] as const;

export const DEFAULT_PAYMENT_METHODS = ['M-PESA', 'CASH', 'BANK', 'CARD', 'CREDIT'] as const;

export const EXPENSE_PAYMENT_METHODS = ['CASH', 'M-PESA', 'BANK', 'CARD'] as const;