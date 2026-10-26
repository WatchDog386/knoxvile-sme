import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../../common/types/auth-user.interface';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { ChangePasswordDto } from './dto/auth.dto';
import { JwtPayload } from './auth.strategy';
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateSecret,
  hashRecoveryCode,
  otpauthUrl,
  verifyTotp,
} from './totp';
import { accountKey, accountKeySql } from '../customers/customers.service';

/** Second-step ticket handed out after a correct password; never a session. */
type MfaPurpose = 'mfa-setup' | 'mfa-verify';
interface MfaTicket {
  sub: string;
  purpose: MfaPurpose;
  jti: string;
}

/** Password accepted; the client must now set up or enter a 2FA code. */
export interface MfaChallenge {
  mfa: 'setup' | 'verify';
  mfaToken: string;
  email: string;
}

const MFA_TICKET_TTL = '10m';
const MAX_CODE_ATTEMPTS = 5;
/** Wrong passwords allowed per account before it is paused, and for how long. */
const MAX_LOGIN_FAILURES = 10;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const ISSUER = 'Knoxville';

export interface AuthResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    avatarUrl: string | null;
    emailVerified: boolean;
    /** True while the person is still on a password the office chose for them. */
    mustChangePassword: boolean;
    selfServicePasswordChangeUsed: boolean;
    /** The person has set a PIN; the app asks for one until they do. */
    hasPin: boolean;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Wrong-code count per second-step ticket (tickets expire after 10 minutes). */
  private readonly attempts = new Map<string, { count: number; expires: number }>();
  /** Wrong-password count per sign-in name, so guessing from many addresses still stops. */
  private readonly loginFailures = new Map<string, { count: number; expires: number }>();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(BusinessMember)
    private readonly businessMemberRepo: Repository<BusinessMember>,
  ) {}

  /**
   * Staff sign in with their email. Subscribers sign in with the username or
   * account number the office gave them (e.g. `mary` or `1617`), matched
   * without regard to case.
   */
  async login(identifier: string, password: string): Promise<MfaChallenge | AuthResult> {
    const id = identifier.trim();
    const key = id.toLowerCase();
    const now = Date.now();
    const failures = this.loginFailures.get(key);
    if (failures && failures.expires < now) this.loginFailures.delete(key);
    else if (failures && failures.count >= MAX_LOGIN_FAILURES) {
      throw new HttpException(
        {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Too many wrong passwords. Wait 15 minutes, then try again.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const candidates = id.includes('@')
      ? [await this.usersService.findByEmail(id)].filter((u): u is User => Boolean(u))
      : await this.subscribersByLoginId(id);
    // The same username can exist in two businesses; the password decides
    let user: User | null = null;
    for (const candidate of candidates) {
      if (await bcrypt.compare(password, candidate.password_hash)) {
        user = candidate;
        break;
      }
    }
    if (!user) {
      for (const [k, v] of this.loginFailures) if (v.expires < now) this.loginFailures.delete(k);
      const entry = this.loginFailures.get(key) ?? { count: 0, expires: now + LOGIN_LOCK_MS };
      entry.count += 1;
      this.loginFailures.set(key, entry);
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: id.includes('@') ? 'Wrong email or password.' : 'Wrong username or password.',
      });
    }
    this.loginFailures.delete(key);
    // The password is the way back in after too many wrong PINs
    if (user.pin_failed_attempts) await this.userRepo.update(user.id, { pin_failed_attempts: 0 });
    // Two-factor sign-in is optional: people turn it on in Settings. Only then
    // does sign-in ask for a code; everyone else gets a session straight away.
    if (!user.totp_enabled) return this.buildAuthResult(user);
    return {
      mfa: 'verify',
      mfaToken: this.issueTicket(user.id, 'mfa-verify'),
      email: id.includes('@') ? user.email : id,
    };
  }

  /**
   * Active client logins whose subscriber matches this username or account
   * number. Usernames and account numbers share one lookup: the subscriber
   * form defaults the username to the account number, so either may be typed.
   */
  private async subscribersByLoginId(loginId: string): Promise<User[]> {
    if (!loginId) return [];
    const rows = await this.userRepo
      .createQueryBuilder('u')
      .select('u.email', 'email')
      .innerJoin('business_members', 'm', 'm."userId" = u.id AND m.role = :role AND m.status = :status', {
        role: UserRole.CLIENT,
        status: 'ACTIVE',
      })
      .innerJoin('customers', 'c', 'c.id = m."customerId"')
      .where('LOWER(c.username) = LOWER(:loginId)', { loginId })
      // FBI011, FBI0011 and FBI-011 all find the account
      .orWhere(`${accountKeySql('c.account_number')} = :accountId`, { accountId: accountKey(loginId) })
      .getRawMany<{ email: string }>();
    const users = await Promise.all(rows.map((r) => this.usersService.findByEmail(r.email)));
    return users.filter((u): u is User => Boolean(u));
  }

  // ---- Two-factor from Settings (signed in) ----

  /** Settings: a fresh secret to add to an authenticator app. */
  async startTwoFactorSetupForUser(userId: string) {
    const user = await this.loadTwoFactorUser(userId);
    if (user.totp_enabled) {
      throw new BadRequestException({ code: 'TWO_FACTOR_ALREADY_ON', message: 'Two-factor sign-in is already on.' });
    }
    const secret = generateSecret();
    await this.userRepo.update(user.id, { totp_secret_enc: encryptSecret(secret, this.secretKey()) });
    return { secret, otpauthUrl: otpauthUrl(secret, user.email, ISSUER), account: user.email, issuer: ISSUER };
  }

  /** Settings: confirms the first code and turns two-factor on; returns recovery codes. */
  async enableTwoFactorForUser(userId: string, code: string) {
    const user = await this.loadTwoFactorUser(userId);
    if (user.totp_enabled || !user.totp_secret_enc) {
      throw new BadRequestException({ code: 'TWO_FACTOR_SETUP_MISSING', message: 'Start two-factor setup again.' });
    }
    // Wrong tries are counted per person, like a sign-in ticket
    const ticket: MfaTicket = { sub: user.id, purpose: 'mfa-setup', jti: `settings:${user.id}` };
    const tries = this.attempts.get(ticket.jti);
    if (tries && tries.count >= MAX_CODE_ATTEMPTS && tries.expires > Date.now()) {
      throw new HttpException(
        { code: 'TOO_MANY_ATTEMPTS', message: 'Too many wrong codes. Try again in a few minutes.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const counter = verifyTotp(decryptSecret(user.totp_secret_enc, this.secretKey()), code);
    if (counter === null) this.wrongCode(ticket);

    const recoveryCodes = generateRecoveryCodes();
    await this.userRepo.update(user.id, {
      totp_enabled: true,
      totp_last_counter: counter,
      totp_recovery_hashes: JSON.stringify(recoveryCodes.map(hashRecoveryCode)),
    });
    this.attempts.delete(ticket.jti);
    return { recoveryCodes };
  }

  /** Settings: turns two-factor off after checking the account password. */
  async disableTwoFactorForUser(userId: string, password: string) {
    // The password hash isn't loaded by default
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password_hash')
      .where('user.id = :id', { id: userId })
      .getOne();
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new BadRequestException({ code: 'INVALID_PASSWORD', message: 'That password is not right.' });
    }
    await this.userRepo.update(userId, {
      totp_enabled: false,
      totp_secret_enc: null,
      totp_last_counter: null,
      totp_recovery_hashes: null,
    });
    return { twoFactorEnabled: false };
  }

  // ---- Two-factor authentication ----

  /** Starts setup: a fresh secret to scan (desktop) or add by link/key (phone). */
  async startTwoFactorSetup(mfaToken: string) {
    const ticket = this.readTicket(mfaToken, 'mfa-setup');
    const user = await this.loadTwoFactorUser(ticket.sub);
    if (user.totp_enabled) {
      throw new BadRequestException({
        code: 'TWO_FACTOR_ALREADY_ON',
        message: 'Two-factor sign-in is already set up. Sign in again.',
      });
    }
    const secret = generateSecret();
    await this.userRepo.update(user.id, { totp_secret_enc: encryptSecret(secret, this.secretKey()) });
    return {
      secret,
      otpauthUrl: otpauthUrl(secret, user.email, ISSUER),
      account: user.email,
      issuer: ISSUER,
    };
  }

  /** Finishes setup with the first code from the app; returns recovery codes and a session. */
  async enableTwoFactor(mfaToken: string, code: string) {
    const ticket = this.readTicket(mfaToken, 'mfa-setup');
    const user = await this.loadTwoFactorUser(ticket.sub);
    if (user.totp_enabled || !user.totp_secret_enc) {
      throw new BadRequestException({
        code: 'TWO_FACTOR_SETUP_MISSING',
        message: 'Start two-factor setup again.',
      });
    }
    const counter = verifyTotp(decryptSecret(user.totp_secret_enc, this.secretKey()), code);
    if (counter === null) this.wrongCode(ticket);

    const recoveryCodes = generateRecoveryCodes();
    await this.userRepo.update(user.id, {
      totp_enabled: true,
      totp_last_counter: counter,
      totp_recovery_hashes: JSON.stringify(recoveryCodes.map(hashRecoveryCode)),
    });
    this.attempts.delete(ticket.jti);
    return { recoveryCodes, ...this.buildAuthResult(user) };
  }

  /** Second step of every sign-in: a 6-digit app code or a one-time recovery code. */
  async verifyTwoFactor(mfaToken: string, code: string) {
    const ticket = this.readTicket(mfaToken, 'mfa-verify');
    const user = await this.loadTwoFactorUser(ticket.sub);
    if (!user.totp_enabled || !user.totp_secret_enc) {
      throw new BadRequestException({ code: 'TWO_FACTOR_OFF', message: 'Sign in again to set up two-factor sign-in.' });
    }
    const trimmed = code.trim();

    if (/^\d{3}\s?\d{3}$/.test(trimmed)) {
      const counter = verifyTotp(decryptSecret(user.totp_secret_enc, this.secretKey()), trimmed);
      // A code can only be used once, even within its 30 seconds
      if (counter === null || (user.totp_last_counter !== null && counter <= user.totp_last_counter)) {
        this.wrongCode(ticket);
      }
      await this.userRepo.update(user.id, { totp_last_counter: counter });
    } else {
      const hashes: string[] = JSON.parse(user.totp_recovery_hashes ?? '[]');
      const hash = hashRecoveryCode(trimmed);
      if (!hashes.includes(hash)) this.wrongCode(ticket);
      await this.userRepo.update(user.id, {
        totp_recovery_hashes: JSON.stringify(hashes.filter((h) => h !== hash)),
      });
    }
    this.attempts.delete(ticket.jti);
    return this.buildAuthResult(user);
  }

  private issueTicket(userId: string, purpose: MfaPurpose): string {
    const ticket: MfaTicket = { sub: userId, purpose, jti: randomBytes(12).toString('hex') };
    return this.jwtService.sign(ticket, { expiresIn: MFA_TICKET_TTL });
  }

  private readTicket(token: string, purpose: MfaPurpose): MfaTicket {
    let ticket: MfaTicket;
    try {
      ticket = this.jwtService.verify<MfaTicket>(token);
    } catch {
      throw new UnauthorizedException({
        code: 'MFA_TICKET_EXPIRED',
        message: 'That took too long. Sign in again.',
      });
    }
    if (ticket.purpose !== purpose) {
      throw new UnauthorizedException({ code: 'MFA_TICKET_INVALID', message: 'Sign in again.' });
    }
    const tries = this.attempts.get(ticket.jti);
    if (tries && tries.count >= MAX_CODE_ATTEMPTS) {
      throw new HttpException(
        { code: 'TOO_MANY_ATTEMPTS', message: 'Too many wrong codes. Sign in again.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return ticket;
  }

  /** Records a wrong code against the ticket and rejects the request. */
  private wrongCode(ticket: MfaTicket): never {
    const now = Date.now();
    for (const [key, value] of this.attempts) if (value.expires < now) this.attempts.delete(key);
    const entry = this.attempts.get(ticket.jti) ?? { count: 0, expires: now + 10 * 60 * 1000 };
    entry.count += 1;
    this.attempts.set(ticket.jti, entry);
    const left = MAX_CODE_ATTEMPTS - entry.count;
    throw new BadRequestException({
      code: 'INVALID_2FA_CODE',
      message:
        left > 0
          ? `That code didn't work. Check your authenticator app and try again (${left} ${left === 1 ? 'try' : 'tries'} left).`
          : 'Too many wrong codes. Sign in again.',
    });
  }

  private async loadTwoFactorUser(userId: string): Promise<User> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect(['user.totp_secret_enc', 'user.totp_last_counter', 'user.totp_recovery_hashes'])
      .where('user.id = :id', { id: userId })
      .getOne();
    if (!user) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Sign in again.' });
    }
    return user;
  }

  /** Key for encrypting authenticator secrets; set TOTP_ENCRYPTION_KEY in production. */
  private secretKey(): string {
    return (
      this.config.get<string>('TOTP_ENCRYPTION_KEY') ??
      this.config.get<string>('jwt.secret') ??
      'dev-secret-change-me'
    );
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Your session is no longer valid.',
      });
    }
    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      emailVerified: user.email_verified,
      twoFactorEnabled: user.totp_enabled,
      mustChangePassword: user.must_change_password,
      selfServicePasswordChangeUsed: user.self_service_password_change_used,
      hasPin: Boolean(user.pin_set_at),
    };
  }

  async updateProfile(
    userId: string,
    dto: { fullName?: string; phone?: string; avatarUrl?: string | null },
  ) {
    const patch: Partial<User> = {};
    if (dto.fullName !== undefined) patch.full_name = dto.fullName;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.avatarUrl !== undefined) patch.avatar_url = dto.avatarUrl;

    const user = await this.usersService.update(userId, patch);
    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      emailVerified: user.email_verified,
      mustChangePassword: user.must_change_password,
      selfServicePasswordChangeUsed: user.self_service_password_change_used,
      hasPin: Boolean(user.pin_set_at),
    };
  }

  /** Changes the password, signs out every other device, and returns a fresh session for this one. */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(
      (await this.usersService.findById(userId))?.email ?? '',
    );
    if (!user) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Invalid session.' });
    }
    const isClient = await this.isClientUser(user.id);
    if (isClient && user.self_service_password_change_used) {
      throw this.passwordChangeUsedException();
    }
    const valid = await bcrypt.compare(dto.currentPassword, user.password_hash);
    if (!valid) {
      throw new BadRequestException({
        code: 'WRONG_PASSWORD',
        message: 'Your current password is incorrect.',
      });
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    if (isClient) {
      // Claim the one allowed change atomically so parallel requests cannot both pass.
      const result = await this.userRepo
        .createQueryBuilder()
        .update(User)
        .set({
          password_hash: passwordHash,
          must_change_password: false,
          self_service_password_change_used: true,
          sessions_valid_after: new Date(),
        })
        .where('id = :id AND self_service_password_change_used = :unused', {
          id: user.id,
          unused: false,
        })
        .execute();
      if (!result.affected) throw this.passwordChangeUsedException();
    } else {
      // Staff password policies stay unchanged; this rule is for client accounts.
      await this.usersService.update(user.id, { password_hash: passwordHash, must_change_password: false });
    }
    const updated = await this.usersService.findById(user.id);
    if (!updated) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Invalid session.' });
    return this.buildAuthResult(updated);
  }

  async forgotPassword(email: string): Promise<{ resetToken?: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Do not reveal whether an account exists.
      return {};
    }
    if (user.self_service_password_change_used && await this.isClientUser(user.id)) {
      // Keep the public forgot-password response indistinguishable for privacy.
      return {};
    }
    const token = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.usersService.setResetToken(user.id, hash, expiresAt);

    // The token is a password: it only ever goes to the account's own inbox.
    // Handing it back in the response would let anyone reset any account.
    await this.sendResetEmail(user, token);
    return this.config.get<string>('nodeEnv') === 'development' ? { resetToken: token } : {};
  }

  /** Emails the reset link when SMTP is set up; otherwise the office resets the password. */
  private async sendResetEmail(user: User, token: string): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) return;
    const link = `${this.config.get<string>('frontendUrl')}/reset-password?token=${token}`;
    const transport = nodemailer.createTransport({
      host,
      port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
      secure: this.config.get<string>('SMTP_SECURE') === 'true',
      auth: this.config.get<string>('SMTP_USER')
        ? { user: this.config.get<string>('SMTP_USER'), pass: this.config.get<string>('SMTP_PASS') }
        : undefined,
    });
    try {
      await transport.sendMail({
        from: this.config.get<string>('SMTP_FROM') ?? 'Knoxville <no-reply@knoxville.co.ke>',
        to: user.email,
        subject: 'Reset your Knoxville password',
        text:
          `Hello ${user.full_name},\n\nUse this link within one hour to choose a new password:\n${link}\n\n` +
          'If you did not ask for this, ignore this email; your password stays the same.',
      });
    } catch (err) {
      // Same response either way, so a mail failure can't reveal which accounts exist
      this.logger.error(`Password reset email to ${user.email} failed: ${(err as Error).message}`);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hash = createHash('sha256').update(token).digest('hex');
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.reset_token_hash')
      .addSelect('user.reset_token_expires_at')
      .where('user.reset_token_hash = :hash', { hash })
      .getOne();
    if (!user || !user.reset_token_expires_at) {
      throw new BadRequestException({
        code: 'INVALID_RESET_TOKEN',
        message: 'This reset link is invalid or has expired.',
      });
    }
    if (user.reset_token_expires_at.getTime() < Date.now()) {
      throw new BadRequestException({
        code: 'INVALID_RESET_TOKEN',
        message: 'This reset link has expired. Request a new one.',
      });
    }
    const isClient = await this.isClientUser(user.id);
    if (user.self_service_password_change_used && isClient) {
      throw this.passwordChangeUsedException();
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    if (isClient) {
      // A reset link also consumes the client's one self-service password change.
      const result = await this.userRepo
        .createQueryBuilder()
        .update(User)
        .set({
          password_hash: passwordHash,
          must_change_password: false,
          self_service_password_change_used: true,
          sessions_valid_after: new Date(),
        })
        .where('id = :id AND self_service_password_change_used = :unused', {
          id: user.id,
          unused: false,
        })
        .execute();
      if (!result.affected) throw this.passwordChangeUsedException();
    } else {
      await this.usersService.update(user.id, { password_hash: passwordHash, must_change_password: false });
    }
    await this.usersService.clearResetToken(user.id);
  }

  private async isClientUser(userId: string): Promise<boolean> {
    const member = await this.businessMemberRepo.findOne({
      where: { userId, role: UserRole.CLIENT },
    });
    return Boolean(member);
  }

  private passwordChangeUsedException(): ForbiddenException {
    return new ForbiddenException({
      code: 'PASSWORD_CHANGE_LIMIT_REACHED',
      message: 'You have used your one password change. Contact your administrator for another reset.',
    });
  }

  buildAuthResult(user: User): AuthResult {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.full_name,
      mfa: true,
    };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        avatarUrl: user.avatar_url,
        emailVerified: user.email_verified,
        mustChangePassword: user.must_change_password,
        selfServicePasswordChangeUsed: user.self_service_password_change_used,
        hasPin: Boolean(user.pin_set_at),
      },
    };
  }

}
