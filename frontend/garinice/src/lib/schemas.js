// Single source of truth for validation. Used by forms (client-side feedback) AND the
// API layer (authoritative server-side checks). A real backend should import the
// same module (or a generated equivalent) so rules never drift.
import { z } from 'zod'
import { LIMITS } from './constants'

const currentYear = new Date().getFullYear()

export const KENYAN_PHONE = /^(?:\+?254|0)(?:7|1)\d{8}$/

export function normalizePhone(phone = '') {
  const d = phone.replace(/[\s-]/g, '')
  if (d.startsWith('+254')) return d
  if (d.startsWith('254')) return `+${d}`
  if (d.startsWith('0')) return `+254${d.slice(1)}`
  return d
}

// Strips markup; the UI also renders text, never HTML, so this is defence in depth.
export function sanitizeText(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex -- strip control characters intentionally
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
}

const text = (min, max, label) =>
  z
    .string({ error: `${label} is required` })
    .transform(sanitizeText)
    .pipe(z.string().min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`).max(max, `${label} must be at most ${max} characters`))

export const emailSchema = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address'))

export const phoneSchema = z
  .string()
  .trim()
  .regex(KENYAN_PHONE, 'Enter a valid Kenyan phone number, e.g. 0712 345 678')
  .transform(normalizePhone)

export const passwordSchema = z
  .string({ error: 'Password is required' })
  .min(8, 'Use at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

export const registerSchema = z
  .object({
    name: text(2, 80, 'Full name'),
    email: emailSchema,
    phone: phoneSchema.optional().or(z.literal('').transform(() => undefined)),
    accountType: z.enum(['BUYER', 'PRIVATE_SELLER', 'DEALER']),
    dealerName: z.string().optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { error: 'You must accept the terms to continue' }),
  })
  .superRefine((v, ctx) => {
    if (v.password !== v.confirmPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' })
    }
    if (v.accountType === 'DEALER' && (!v.dealerName || sanitizeText(v.dealerName).length < 2)) {
      ctx.addIssue({ code: 'custom', path: ['dealerName'], message: 'Dealership name is required' })
    }
  })

export const forgotPasswordSchema = z.object({ email: emailSchema })

export const resetPasswordSchema = z
  .object({ token: z.string().min(10), password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, 'Current password is required'), password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })

export const profileSchema = z.object({
  name: text(2, 80, 'Full name'),
  phone: phoneSchema.optional().or(z.literal('').transform(() => undefined)),
  location: z.string().max(80).optional(),
  bio: z.string().max(500).transform(sanitizeText).optional(),
  notifyEmail: z.boolean().optional(),
  notifySms: z.boolean().optional(),
  notifyWhatsapp: z.boolean().optional(),
})

export const imageRefSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  thumb: z.string().optional(),
  alt: z.string().max(160).optional(),
  width: z.number().optional(),
  height: z.number().optional(),
})

export const contactSchema = z
  .object({
    inApp: z.boolean(),
    phone: z.boolean(),
    whatsapp: z.boolean(),
    email: z.boolean(),
    phoneNumber: z.string().optional(),
    whatsappNumber: z.string().optional(),
  })
  .superRefine((c, ctx) => {
    if (!c.inApp && !c.phone && !c.whatsapp && !c.email) {
      ctx.addIssue({ code: 'custom', path: ['inApp'], message: 'Choose at least one way for buyers to contact you' })
    }
    if (c.phone && !KENYAN_PHONE.test((c.phoneNumber || '').replace(/[\s-]/g, ''))) {
      ctx.addIssue({ code: 'custom', path: ['phoneNumber'], message: 'Enter a valid phone number to show on the listing' })
    }
    if (c.whatsapp && !KENYAN_PHONE.test((c.whatsappNumber || '').replace(/[\s-]/g, ''))) {
      ctx.addIssue({ code: 'custom', path: ['whatsappNumber'], message: 'Enter a valid WhatsApp number' })
    }
  })

const int = (label, min, max) =>
  z.coerce
    .number({ error: `${label} is required` })
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min.toLocaleString()}`)
    .max(max, `${label} must be at most ${max.toLocaleString()}`)

const optionalInt = (label, min, max) =>
  z.preprocess((v) => (v === '' || v == null ? undefined : v), int(label, min, max).optional())

// Base object without cross-field refinements so the wizard can `.pick()` per step.
export const vehicleBaseSchema = z.object({
  sellerType: z.enum(['PRIVATE', 'DEALER', 'AGENT'], { error: 'Choose who is selling' }),
  authorityDocUrl: z.string().nullable().optional(),
  brandId: z.string({ error: 'Select a make' }).min(1, 'Select a make'),
  modelId: z.string({ error: 'Select a model' }).min(1, 'Select a model'),
  variant: z.string().max(40).transform(sanitizeText).optional(),
  year: int('Year', LIMITS.minYear, currentYear + 1),
  bodyTypeId: z.string({ error: 'Select a body type' }).min(1, 'Select a body type'),
  condition: z.enum(['KENYAN_USED', 'FOREIGN_USED', 'BRAND_NEW'], { error: 'Select the condition' }),
  importStatus: z.enum(['LOCAL', 'DIRECT_IMPORT', 'IN_TRANSIT'], { error: 'Select the import status' }),
  engineCc: int('Engine capacity', 600, 10000),
  fuelTypeId: z.string({ error: 'Select fuel type' }).min(1, 'Select fuel type'),
  transmissionId: z.string({ error: 'Select transmission' }).min(1, 'Select transmission'),
  driveType: z.enum(['2WD', '4WD', 'AWD'], { error: 'Select drive type' }),
  powerHp: optionalInt('Power', 40, 1500),
  mileageKm: int('Mileage', 0, LIMITS.maxMileage),
  seats: optionalInt('Seats', 2, 60),
  airbags: optionalInt('Airbags', 0, 16),
  interiorMaterial: z.string().max(40).optional(),
  colour: z.string().max(40).optional(),
  features: z.array(z.string().max(60)).max(80).default([]),
  price: int('Price', 50_000, LIMITS.maxPrice),
  negotiable: z.boolean().default(false),
  county: text(2, 60, 'County'),
  town: text(2, 60, 'Town'),
  area: z.string().max(80).transform(sanitizeText).optional(),
  images: z
    .array(imageRefSchema)
    .min(LIMITS.minImages, 'Add at least one photo')
    .max(LIMITS.maxImages, `You can add up to ${LIMITS.maxImages} photos`),
  description: text(30, 5000, 'Description'),
  contact: contactSchema,
})

export function refineVehicle(v, ctx) {
  if (v.sellerType === 'AGENT' && !v.authorityDocUrl) {
    ctx.addIssue({ code: 'custom', path: ['authorityDocUrl'], message: 'Upload an Authority to Sell document from the owner' })
  }
  if (v.condition === 'BRAND_NEW' && v.mileageKm > 1000) {
    ctx.addIssue({ code: 'custom', path: ['mileageKm'], message: 'Brand new vehicles should have under 1,000 km' })
  }
}

export const vehicleSchema = vehicleBaseSchema.superRefine(refineVehicle)

// Drafts may be incomplete; only types are checked.
export const vehicleDraftSchema = vehicleBaseSchema.partial()

export const LISTING_STEPS = [
  { id: 'seller', title: 'Seller type', fields: ['sellerType', 'authorityDocUrl'] },
  { id: 'basics', title: 'Vehicle basics', fields: ['brandId', 'modelId', 'variant', 'year', 'bodyTypeId', 'condition', 'importStatus'] },
  { id: 'technical', title: 'Technical', fields: ['engineCc', 'fuelTypeId', 'transmissionId', 'mileageKm', 'driveType', 'powerHp', 'seats', 'airbags', 'interiorMaterial', 'colour'] },
  { id: 'features', title: 'Features', fields: ['features'] },
  { id: 'pricing', title: 'Pricing', fields: ['price', 'negotiable'] },
  { id: 'location', title: 'Location', fields: ['county', 'town', 'area'] },
  { id: 'images', title: 'Photos', fields: ['images'] },
  { id: 'description', title: 'Description', fields: ['description'] },
  { id: 'contact', title: 'Contact', fields: ['contact'] },
  { id: 'preview', title: 'Preview', fields: [] },
  { id: 'publish', title: 'Publish', fields: [] },
]

export function validateStep(stepId, values) {
  const step = LISTING_STEPS.find((s) => s.id === stepId)
  if (!step || step.fields.length === 0) return { success: true, data: values }
  const shape = Object.fromEntries(step.fields.map((f) => [f, true]))
  const result = vehicleBaseSchema.pick(shape).safeParse(values)
  const issues = result.success ? [] : [...result.error.issues]
  // Apply cross-field rules relevant to this step.
  const ctx = { addIssue: (i) => step.fields.includes(i.path[0]) && issues.push(i) }
  refineVehicle({ ...values, mileageKm: Number(values.mileageKm) || 0 }, ctx)
  return issues.length ? { success: false, errors: issuesToErrors(issues) } : { success: true, data: result.data }
}

export const messageSchema = z.object({
  body: text(1, 2000, 'Message'),
})

export const startConversationSchema = z.object({
  vehicleId: z.string().min(1),
  body: text(2, 2000, 'Message'),
})

export const reportSchema = z.object({
  vehicleId: z.string().min(1),
  reason: z.enum(['FRAUD', 'INCORRECT_INFO', 'WRONG_PRICE', 'DUPLICATE', 'ALREADY_SOLD', 'INAPPROPRIATE', 'OTHER'], { error: 'Choose a reason' }),
  details: z.string().max(1000).transform(sanitizeText).optional(),
  email: z.string().optional(),
})

export const paymentInitSchema = z.object({
  packageId: z.string().min(1, 'Choose a package'),
  vehicleId: z.string().optional(),
  method: z.enum(['MPESA', 'CARD', 'BANK']),
  phone: phoneSchema,
  idempotencyKey: z.string().min(8),
})

export const packageSchema = z.object({
  name: text(2, 60, 'Name'),
  description: z.string().max(300).transform(sanitizeText).optional(),
  price: int('Price', 0, 10_000_000),
  durationDays: int('Duration', 1, 365),
  listingLimit: int('Number of listings', 1, 10_000),
  featured: z.boolean().default(false),
  boostDays: int('Boost duration', 0, 365),
  analytics: z.boolean().default(false),
  audience: z.enum(['ALL', 'PRIVATE', 'DEALER']).default('ALL'),
  active: z.boolean().default(true),
})

export const brandSchema = z.object({
  name: text(2, 60, 'Brand name'),
  popular: z.boolean().default(false),
  active: z.boolean().default(true),
})

export const modelSchema = z.object({
  brandId: z.string().min(1, 'Select a brand'),
  name: text(1, 60, 'Model name'),
  bodyTypeId: z.string().optional(),
  active: z.boolean().default(true),
})

export const bodyTypeSchema = z.object({
  name: text(2, 40, 'Name'),
  description: z.string().max(600).transform(sanitizeText).optional(),
})

export const dealerProfileSchema = z.object({
  name: text(2, 80, 'Dealership name'),
  tagline: z.string().max(120).transform(sanitizeText).optional(),
  description: z.string().max(3000).transform(sanitizeText).optional(),
  phone: phoneSchema,
  whatsapp: phoneSchema.optional().or(z.literal('').transform(() => undefined)),
  email: emailSchema,
  website: z.string().max(200).optional(),
  county: text(2, 60, 'County'),
  town: text(2, 60, 'Town'),
  address: z.string().max(200).transform(sanitizeText).optional(),
  openingHours: z.string().max(200).transform(sanitizeText).optional(),
  logoUrl: z.string().optional(),
  coverUrl: z.string().optional(),
})

export const staffInviteSchema = z.object({
  name: text(2, 80, 'Name'),
  email: emailSchema,
})

export const promotionSchema = z.object({
  title: text(2, 80, 'Title'),
  placement: z.enum(['HOMEPAGE_FEATURED', 'SEARCH_TOP', 'HOMEPAGE_BANNER']),
  vehicleId: z.string().optional(),
  dealerId: z.string().optional(),
  startsAt: z.string().min(1, 'Start date is required'),
  endsAt: z.string().min(1, 'End date is required'),
  active: z.boolean().default(true),
})

export const cmsPageSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and dashes'),
  title: text(2, 120, 'Title'),
  body: z.string().max(50_000),
  published: z.boolean().default(true),
})

export const seoRecordSchema = z.object({
  path: z.string().regex(/^\/[a-z0-9\-/]*$/, 'Must be a site path starting with /'),
  title: text(5, 70, 'Meta title'),
  description: text(20, 170, 'Meta description'),
  intro: z.string().max(3000).optional(),
  noindex: z.boolean().default(false),
})

export const contactFormSchema = z.object({
  name: text(2, 80, 'Name'),
  email: emailSchema,
  subject: text(3, 120, 'Subject'),
  message: text(10, 3000, 'Message'),
})

// Converts Zod issues into { fieldPath: message } for forms and API errors.
export function issuesToErrors(issues = []) {
  const out = {}
  for (const issue of issues) {
    const key = issue.path.join('.') || '_form'
    if (!out[key]) out[key] = issue.message
  }
  return out
}
