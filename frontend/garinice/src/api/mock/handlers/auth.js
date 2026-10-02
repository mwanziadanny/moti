import {
  changePasswordSchema, forgotPasswordSchema, loginSchema, profileSchema, registerSchema, resetPasswordSchema,
} from '../../../lib/schemas'
import { slugify } from '../../../lib/format'
import { hashPassword, randomToken, sha256, verifyPassword } from '../crypto'
import { now, uid } from '../db'
import { ApiError, audit, badRequest, conflict, dealerFor, notify, rateLimit, requireUser, track, validate } from '../http'

const SESSION_DAYS = 30

export function publicUser(db, user) {
  if (!user) return null
  const profile = db.profiles.find((p) => p.userId === user.id) || {}
  const dealer = dealerFor(db, user)
  const link = dealer ? db.dealerStaff.find((s) => s.userId === user.id && s.dealerId === dealer.id) : null
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    verified: !!user.verified,
    emailVerified: !!user.emailVerified,
    createdAt: user.createdAt,
    profile: { location: profile.location || '', bio: profile.bio || '', avatarUrl: profile.avatarUrl || null, notifyEmail: profile.notifyEmail !== false, notifySms: !!profile.notifySms, notifyWhatsapp: !!profile.notifyWhatsapp },
    dealer: dealer ? { id: dealer.id, slug: dealer.slug, name: dealer.name, logoUrl: dealer.logoUrl, verified: dealer.verified, staffRole: link?.role } : null,
  }
}

export async function createSession(db, userId) {
  const token = randomToken(32)
  db.sessions.push({ id: uid(), tokenHash: await sha256(token), userId, createdAt: now(), expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString() })
  return token
}

export default function register(r) {
  r.post('/api/auth/register', async (ctx) => {
    rateLimit(ctx, 'register', 5, 10 * 60_000)
    const data = validate(registerSchema, ctx.body)
    const { db } = ctx
    if (db.users.some((u) => u.email === data.email && !u.deletedAt)) {
      throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists.', { email: 'This email is already registered. Try signing in instead.' })
    }
    const user = {
      id: uid(), name: data.name, email: data.email, phone: data.phone || null, role: data.accountType,
      passwordHash: await hashPassword(data.password), emailVerified: false, phoneVerified: false, verified: false,
      suspended: false, createdAt: now(), lastLoginAt: now(), deletedAt: null,
    }
    db.users.push(user)
    db.profiles.push({ id: uid(), userId: user.id, location: '', bio: '', avatarUrl: null, notifyEmail: true, notifySms: false, notifyWhatsapp: false })
    if (data.accountType === 'DEALER') {
      let slug = slugify(data.dealerName)
      if (db.dealers.some((d) => d.slug === slug)) slug = `${slug}-${randomToken(2)}`
      const dealer = {
        id: uid(), slug, name: data.dealerName.trim(), ownerId: user.id, tagline: '', description: '', phone: user.phone || '', whatsapp: user.phone || '',
        email: user.email, website: '', county: 'Nairobi', town: 'Nairobi', locationSlug: 'nairobi', address: '', openingHours: '',
        logoUrl: null, brandColour: '#123b5d', coverUrl: null, verified: false, verifiedAt: null, suspended: false, since: new Date().getFullYear(),
        createdAt: now(), deletedAt: null,
      }
      db.dealers.push(dealer)
      db.dealerStaff.push({ id: uid(), dealerId: dealer.id, userId: user.id, role: 'OWNER', createdAt: now() })
    }
    const token = await createSession(db, user.id)
    ctx.user = user
    audit(ctx, 'USER_REGISTERED', 'user', user.id, { role: user.role })
    track(ctx, 'USER_REGISTERED', { userId: user.id })
    notify(db, user.id, 'ACCOUNT', 'Welcome to GariNice', 'Your account is ready. Save cars, message sellers or list your own vehicle.', '/account')
    return { status: 201, data: { user: publicUser(db, user), token } }
  })

  r.post('/api/auth/login', async (ctx) => {
    rateLimit(ctx, 'login', 10, 5 * 60_000)
    const data = validate(loginSchema, ctx.body)
    const user = ctx.db.users.find((u) => u.email === data.email && !u.deletedAt)
    const ok = user ? await verifyPassword(data.password, user.passwordHash) : false
    if (!ok) throw new ApiError(401, 'INVALID_CREDENTIALS', 'The email or password you entered is incorrect.')
    if (user.suspended) throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended. Contact support if you think this is a mistake.')
    user.lastLoginAt = now()
    const token = await createSession(ctx.db, user.id)
    ctx.user = user
    audit(ctx, 'USER_LOGIN', 'user', user.id)
    return { user: publicUser(ctx.db, user), token }
  })

  r.post('/api/auth/logout', async (ctx) => {
    if (ctx.session) ctx.db.sessions = ctx.db.sessions.filter((s) => s.id !== ctx.session.id)
    return { ok: true }
  })

  r.get('/api/auth/me', async (ctx) => ({ user: publicUser(ctx.db, ctx.user) }))

  r.post('/api/auth/forgot-password', async (ctx) => {
    rateLimit(ctx, 'forgot', 5, 15 * 60_000)
    const { email } = validate(forgotPasswordSchema, ctx.body)
    const user = ctx.db.users.find((u) => u.email === email && !u.deletedAt)
    let demoLink = null
    if (user) {
      const token = randomToken(24)
      ctx.db.passwordResets.push({ id: uid(), userId: user.id, tokenHash: await sha256(token), expiresAt: new Date(Date.now() + 3_600_000).toISOString(), usedAt: null, createdAt: now() })
      demoLink = `/reset-password?token=${token}`
      ctx.db.outbox.unshift({ id: uid(), channel: 'EMAIL', to: user.email, userId: user.id, type: 'PASSWORD_RESET', subject: 'Reset your GariNice password', body: `Use this link within 1 hour: ${demoLink}`, status: 'QUEUED', createdAt: now() })
    }
    // Same response whether or not the account exists (no user enumeration).
    return { ok: true, message: 'If an account exists for that email, we have sent a reset link.', demoLink }
  })

  r.post('/api/auth/reset-password', async (ctx) => {
    rateLimit(ctx, 'reset', 10, 15 * 60_000)
    const data = validate(resetPasswordSchema, ctx.body)
    const hash = await sha256(data.token)
    const reset = ctx.db.passwordResets.find((p) => p.tokenHash === hash)
    if (!reset || reset.usedAt || new Date(reset.expiresAt) < new Date()) {
      throw badRequest('This reset link is invalid or has expired. Please request a new one.')
    }
    const user = ctx.db.users.find((u) => u.id === reset.userId)
    user.passwordHash = await hashPassword(data.password)
    reset.usedAt = now()
    ctx.db.sessions = ctx.db.sessions.filter((s) => s.userId !== user.id)
    ctx.user = user
    audit(ctx, 'PASSWORD_RESET', 'user', user.id)
    return { ok: true }
  })

  r.patch('/api/account', async (ctx) => {
    const user = requireUser(ctx)
    const data = validate(profileSchema, ctx.body)
    user.name = data.name
    if (data.phone !== undefined) user.phone = data.phone || null
    const profile = ctx.db.profiles.find((p) => p.userId === user.id)
    Object.assign(profile, {
      location: data.location ?? profile.location,
      bio: data.bio ?? profile.bio,
      notifyEmail: data.notifyEmail ?? profile.notifyEmail,
      notifySms: data.notifySms ?? profile.notifySms,
      notifyWhatsapp: data.notifyWhatsapp ?? profile.notifyWhatsapp,
    })
    audit(ctx, 'PROFILE_UPDATED', 'user', user.id)
    return { user: publicUser(ctx.db, user) }
  })

  r.post('/api/account/password', async (ctx) => {
    const user = requireUser(ctx)
    rateLimit(ctx, 'change-password', 5, 15 * 60_000)
    const data = validate(changePasswordSchema, ctx.body)
    if (!(await verifyPassword(data.currentPassword, user.passwordHash))) {
      throw new ApiError(422, 'VALIDATION_FAILED', 'Current password is incorrect.', { currentPassword: 'Current password is incorrect' })
    }
    user.passwordHash = await hashPassword(data.password)
    ctx.db.sessions = ctx.db.sessions.filter((s) => s.userId !== user.id || s.id === ctx.session?.id)
    audit(ctx, 'PASSWORD_CHANGED', 'user', user.id)
    return { ok: true }
  })

  r.delete('/api/account', async (ctx) => {
    const user = requireUser(ctx)
    if (!(await verifyPassword(ctx.body?.password || '', user.passwordHash))) {
      throw new ApiError(422, 'VALIDATION_FAILED', 'Password is incorrect.', { password: 'Password is incorrect' })
    }
    const { db } = ctx
    const ownedDealer = db.dealers.find((d) => d.ownerId === user.id && !d.deletedAt)
    if (ownedDealer && db.dealerStaff.some((s) => s.dealerId === ownedDealer.id && s.userId !== user.id)) {
      throw conflict('Remove your staff members or transfer the dealership before deleting your account.')
    }
    for (const v of db.vehicles) {
      if (v.sellerId === user.id && !v.deletedAt) Object.assign(v, { status: 'ARCHIVED', deletedAt: now() })
    }
    if (ownedDealer) ownedDealer.deletedAt = now()
    db.favourites = db.favourites.filter((f) => f.userId !== user.id)
    db.sessions = db.sessions.filter((s) => s.userId !== user.id)
    audit(ctx, 'ACCOUNT_DELETED', 'user', user.id)
    Object.assign(user, { deletedAt: now(), email: `deleted+${user.id}@garinice.invalid`, name: 'Deleted user', phone: null })
    return { ok: true }
  })
}
