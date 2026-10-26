import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/entities/user.entity';
import { TrustedDevice } from '../users/entities/trusted-device.entity';
import { AuthResult, AuthService } from './auth.service';

/** Wrong PINs in a row before PIN sign-in waits for a password sign-in. */
export const MAX_PIN_ATTEMPTS = 5;
/** Devices one person can keep PIN sign-in on; the oldest drops off. */
const MAX_DEVICES = 5;

/** What the app keeps on the device to offer PIN sign-in next time. */
export interface DeviceCredential {
  deviceId: string;
  deviceToken: string;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** PINs anyone would try first: one digit repeated, or a straight run. */
function isWeakPin(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true;
  const digits = [...pin].map(Number);
  const steps = digits.slice(1).map((d, i) => d - digits[i]);
  return steps.every((s) => s === 1) || steps.every((s) => s === -1);
}

/**
 * PIN sign-in, as in banking apps: the person signs in once with their
 * password on a phone, sets a 4-digit PIN, and from then on that phone opens
 * with the PIN. The PIN alone is useless elsewhere: it only works together
 * with the secret the trusted device holds.
 */
@Injectable()
export class PinService {
  constructor(
    private readonly auth: AuthService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(TrustedDevice) private readonly devices: Repository<TrustedDevice>,
  ) {}

  /** First PIN, right after the person has their own password. */
  async setup(userId: string, pin: string, deviceName?: string) {
    const user = await this.load(userId);
    if (user.must_change_password) {
      throw new ForbiddenException({ code: 'PASSWORD_FIRST', message: 'Set your own password first.' });
    }
    if (user.pin_set_at) {
      throw new ConflictException({ code: 'PIN_ALREADY_SET', message: 'You already have a PIN. Change it from your profile.' });
    }
    await this.savePin(user.id, pin);
    return this.register(user.id, deviceName);
  }

  /** New PIN from the profile page; needs the password, like a bank's "change PIN". */
  async change(userId: string, password: string, pin: string, deviceName?: string) {
    const user = await this.load(userId);
    if (!(await bcrypt.compare(password, user.password_hash))) {
      throw new BadRequestException({ code: 'WRONG_PASSWORD', message: 'Your password is incorrect.' });
    }
    await this.savePin(user.id, pin);
    return this.register(user.id, deviceName);
  }

  /** Signed in with the password on a new phone: the existing PIN turns PIN sign-in on there. */
  async enableDevice(userId: string, pin: string, deviceName?: string) {
    const user = await this.load(userId);
    if (!user.pin_set_at || !user.pin_hash) {
      throw new BadRequestException({ code: 'NO_PIN', message: 'Set a PIN first.' });
    }
    await this.checkPin(user, pin);
    return this.register(user.id, deviceName);
  }

  /** PIN sign-in from a trusted device. */
  async login(deviceId: string, deviceToken: string, pin: string): Promise<AuthResult> {
    const device = await this.findDevice(deviceId, deviceToken);
    const user = await this.load(device.userId);
    if (!user.pin_set_at || !user.pin_hash) {
      // The PIN was cleared (e.g. the office issued a new password): use the password
      await this.devices.delete({ id: device.id });
      throw this.notRecognised();
    }
    await this.checkPin(user, pin);
    await this.devices.update(device.id, { last_used_at: new Date() });
    return this.auth.buildAuthResult(user);
  }

  /** "Not you?": the device stops offering PIN sign-in for this account. */
  async forget(deviceId: string, deviceToken: string) {
    const device = await this.findDevice(deviceId, deviceToken).catch(() => null);
    if (device) await this.devices.delete({ id: device.id });
    return { forgotten: true };
  }

  private async savePin(userId: string, pin: string) {
    if (!/^\d{4}$/.test(pin)) {
      throw new BadRequestException({ code: 'INVALID_PIN', message: 'Your PIN must be exactly 4 digits.' });
    }
    if (isWeakPin(pin)) {
      throw new BadRequestException({
        code: 'WEAK_PIN',
        message: 'That PIN is too easy to guess. Avoid repeated digits and runs like 1234.',
      });
    }
    await this.users.update(userId, {
      pin_hash: await bcrypt.hash(pin, 10),
      pin_set_at: new Date(),
      pin_failed_attempts: 0,
    });
  }

  /** Checks the PIN, counting wrong ones; at the limit only a password sign-in unlocks it. */
  private async checkPin(user: User, pin: string) {
    if (user.pin_failed_attempts >= MAX_PIN_ATTEMPTS) throw this.locked();
    if (/^\d{4}$/.test(pin) && user.pin_hash && (await bcrypt.compare(pin, user.pin_hash))) {
      if (user.pin_failed_attempts) await this.users.update(user.id, { pin_failed_attempts: 0 });
      return;
    }
    // Counted in the database so a restart or many devices can't reset it
    await this.users.increment({ id: user.id }, 'pin_failed_attempts', 1);
    const left = MAX_PIN_ATTEMPTS - (user.pin_failed_attempts + 1);
    if (left <= 0) throw this.locked();
    // 400, not 401: the app treats 401 as "session over" and would sign the person out
    throw new BadRequestException({
      code: 'WRONG_PIN',
      message: `Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left before PIN sign-in is locked.`,
    });
  }

  private async register(userId: string, deviceName?: string) {
    const deviceToken = randomBytes(32).toString('hex');
    const device = await this.devices.save(
      this.devices.create({
        userId,
        token_hash: hashToken(deviceToken),
        name: deviceName?.trim().slice(0, 120) || null,
        last_used_at: new Date(),
      }),
    );
    const all = await this.devices.find({ where: { userId }, order: { created_at: 'DESC' } });
    const stale = all.slice(MAX_DEVICES).map((d) => d.id);
    if (stale.length) await this.devices.delete(stale);
    const user = await this.load(userId);
    return {
      device: { deviceId: device.id, deviceToken } satisfies DeviceCredential,
      user: this.auth.buildAuthResult(user).user,
    };
  }

  private async findDevice(deviceId: string, deviceToken: string): Promise<TrustedDevice> {
    const device = /^[0-9a-f-]{36}$/i.test(deviceId)
      ? await this.devices.findOne({ where: { id: deviceId } })
      : null;
    const given = Buffer.from(hashToken(deviceToken ?? ''), 'hex');
    const stored = Buffer.from(device?.token_hash ?? '', 'hex');
    if (!device || stored.length !== given.length || !timingSafeEqual(stored, given)) throw this.notRecognised();
    return device;
  }

  private async load(userId: string): Promise<User> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect(['user.password_hash', 'user.pin_hash'])
      .where('user.id = :id', { id: userId })
      .getOne();
    if (!user) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Sign in again.' });
    return user;
  }

  private notRecognised() {
    return new UnauthorizedException({
      code: 'DEVICE_NOT_RECOGNISED',
      message: 'PIN sign-in is off on this device. Sign in with your password.',
    });
  }

  private locked() {
    return new HttpException(
      {
        code: 'PIN_LOCKED',
        message: 'Too many wrong PINs. Sign in with your password to unlock your PIN.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
