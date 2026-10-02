// Domain enums shared by the UI, validation schemas and the API layer.
// Taxonomy (brands, models, body types, fuels, features, locations) is NOT here —
// it is served by the API and managed by admins.

export const SITE = {
  name: 'GariNice',
  tagline: "Kenya's trusted car marketplace",
  url: import.meta.env?.VITE_SITE_URL || 'https://garinice.co.ke',
  supportEmail: 'support@garinice.co.ke',
  supportPhone: '+254 709 000 000',
  whatsapp: '254709000000',
}

export const ROLES = {
  BUYER: 'BUYER',
  PRIVATE_SELLER: 'PRIVATE_SELLER',
  DEALER: 'DEALER',
  DEALER_STAFF: 'DEALER_STAFF',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
}

export const ROLE_LABELS = {
  BUYER: 'Buyer',
  PRIVATE_SELLER: 'Private seller',
  DEALER: 'Dealer',
  DEALER_STAFF: 'Dealer staff',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super admin',
}

export const SELLER_ROLES = ['PRIVATE_SELLER', 'DEALER', 'DEALER_STAFF']
export const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN']

export const CONDITIONS = [
  { value: 'KENYAN_USED', slug: 'kenyan-used', label: 'Kenyan Used' },
  { value: 'FOREIGN_USED', slug: 'foreign-used', label: 'Foreign Used' },
  { value: 'BRAND_NEW', slug: 'brand-new', label: 'Brand New' },
]

export const IMPORT_STATUSES = [
  { value: 'LOCAL', slug: 'in-kenya', label: 'In Kenya' },
  { value: 'DIRECT_IMPORT', slug: 'direct-import', label: 'Direct Import' },
  { value: 'IN_TRANSIT', slug: 'in-transit', label: 'In Transit' },
]

export const DRIVE_TYPES = [
  { value: '2WD', label: '2WD' },
  { value: '4WD', label: '4WD' },
  { value: 'AWD', label: 'AWD' },
]

export const INTERIOR_MATERIALS = ['Fabric', 'Leather', 'Part leather', 'Alcantara', 'Vinyl']

export const COLOURS = [
  { name: 'Pearl White', hex: '#eef0f2' },
  { name: 'Black', hex: '#1b1d21' },
  { name: 'Silver', hex: '#b7bcc3' },
  { name: 'Grey', hex: '#6b7280' },
  { name: 'Dark Blue', hex: '#1e3a5f' },
  { name: 'Red', hex: '#b91c1c' },
  { name: 'Maroon', hex: '#6b1d2a' },
  { name: 'Beige', hex: '#c8b89a' },
  { name: 'Green', hex: '#2f5d3a' },
  { name: 'Bronze', hex: '#8a6a43' },
]

export const SELLER_TYPES = [
  { value: 'PRIVATE', slug: 'private', label: 'Private seller' },
  { value: 'DEALER', slug: 'dealer', label: 'Dealer' },
  { value: 'AGENT', slug: 'agent', label: 'Selling on behalf of owner' },
]

export const LISTING_STATUSES = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  PENDING_REVIEW: { label: 'Pending review', tone: 'warning' },
  PUBLISHED: { label: 'Published', tone: 'success' },
  PAUSED: { label: 'Paused', tone: 'neutral' },
  SOLD: { label: 'Sold', tone: 'info' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
  ARCHIVED: { label: 'Archived', tone: 'neutral' },
}

export const PAYMENT_STATUSES = {
  PENDING: { label: 'Pending', tone: 'warning' },
  PROCESSING: { label: 'Processing', tone: 'info' },
  SUCCESS: { label: 'Successful', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
}

export const PAYMENT_METHODS = [
  { value: 'MPESA', label: 'M-Pesa', enabled: true },
  { value: 'CARD', label: 'Card', enabled: false },
  { value: 'BANK', label: 'Bank transfer', enabled: false },
]

export const REPORT_REASONS = [
  { value: 'FRAUD', label: 'Suspicious or fraudulent' },
  { value: 'INCORRECT_INFO', label: 'Incorrect information' },
  { value: 'WRONG_PRICE', label: 'Wrong price' },
  { value: 'DUPLICATE', label: 'Duplicate listing' },
  { value: 'ALREADY_SOLD', label: 'Already sold' },
  { value: 'INAPPROPRIATE', label: 'Inappropriate content' },
  { value: 'OTHER', label: 'Other' },
]

export const REPORT_STATUSES = {
  OPEN: { label: 'Open', tone: 'warning' },
  DISMISSED: { label: 'Dismissed', tone: 'neutral' },
  ACTIONED: { label: 'Actioned', tone: 'success' },
}

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest listings' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'mileage_asc', label: 'Lowest mileage' },
  { value: 'year_desc', label: 'Newest vehicles' },
  { value: 'popular', label: 'Most viewed' },
]

export const PRICE_PRESETS = [
  { slug: 'under-500k', label: 'Under KES 500K', max: 500_000 },
  { slug: 'under-1m', label: 'Under KES 1M', max: 1_000_000 },
  { slug: '1m-2m', label: 'KES 1M – 2M', min: 1_000_000, max: 2_000_000 },
  { slug: 'under-2m', label: 'Under KES 2M', max: 2_000_000 },
  { slug: '2m-5m', label: 'KES 2M – 5M', min: 2_000_000, max: 5_000_000 },
  { slug: 'above-5m', label: 'Above KES 5M', min: 5_000_000 },
]

export const HERO_PRICE_PRESETS = ['under-1m', '1m-2m', '2m-5m', 'above-5m']

export const YEAR_PRESETS = [
  { slug: '2022-plus', label: '2022 and newer', min: 2022 },
  { slug: '2019-2021', label: '2019 – 2021', min: 2019, max: 2021 },
  { slug: '2015-2018', label: '2015 – 2018', min: 2015, max: 2018 },
  { slug: '2010-2014', label: '2010 – 2014', min: 2010, max: 2014 },
  { slug: '2009-older', label: '2009 and older', max: 2009 },
]

export const MILEAGE_PRESETS = [
  { value: 10_000, label: 'Under 10,000 km' },
  { value: 50_000, label: 'Under 50,000 km' },
  { value: 100_000, label: 'Under 100,000 km' },
  { value: 150_000, label: 'Under 150,000 km' },
  { value: 200_000, label: 'Under 200,000 km' },
]

export const ENGINE_PRESETS = [
  { slug: 'under-1500', label: 'Up to 1,500cc', max: 1500 },
  { slug: '1500-2000', label: '1,501 – 2,000cc', min: 1501, max: 2000 },
  { slug: '2000-3000', label: '2,001 – 3,000cc', min: 2001, max: 3000 },
  { slug: 'above-3000', label: 'Above 3,000cc', min: 3001 },
]

export const CONVERSATION_STARTERS = [
  'Hi, is this vehicle still available?',
  'Can I come and see it this week?',
  'Is the price negotiable?',
  'Has it been serviced regularly? Are records available?',
]

export const FEATURE_GROUP_LABELS = {
  safety: 'Safety',
  interior: 'Interior & comfort',
  exterior: 'Exterior',
  technology: 'Technology',
}

export const LIMITS = {
  maxImages: 20,
  minImages: 1,
  maxImageBytes: 10 * 1024 * 1024,
  maxDocumentBytes: 5 * 1024 * 1024,
  acceptedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  acceptedDocTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  pageSize: 24,
  minYear: 1980,
  maxPrice: 500_000_000,
  maxMileage: 1_500_000,
}

export const NOTIFICATION_TYPES = {
  NEW_MESSAGE: 'New message',
  LISTING_APPROVED: 'Listing approved',
  LISTING_REJECTED: 'Listing rejected',
  LISTING_CHANGES_REQUESTED: 'Changes requested',
  LISTING_EXPIRING: 'Listing expiring',
  PAYMENT_SUCCESS: 'Payment successful',
  PAYMENT_FAILED: 'Payment failed',
  VEHICLE_SOLD: 'Vehicle sold',
  NEW_ENQUIRY: 'New enquiry',
  ACCOUNT: 'Account',
}
