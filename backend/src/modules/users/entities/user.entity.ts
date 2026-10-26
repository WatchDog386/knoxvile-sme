import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('users')
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 320, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 120 })
  full_name: string;

  @Column({ type: 'text', nullable: true })
  avatar_url: string | null;

  @Column({ type: 'varchar', length: 255, select: false })
  password_hash: string;

  @Column({ type: 'boolean', default: false })
  email_verified: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  reset_token_hash: string | null;

  @Column({ type: 'timestamptz', nullable: true, select: false })
  reset_token_expires_at: Date | null;

  /**
   * Set when the office hands someone a password (a subscriber's first app
   * login). They sign in with it, but the app asks for a password of their own
   * before anything else. Cleared once they change it.
   */
  @Column({ type: 'boolean', default: false })
  must_change_password: boolean;

  /**
   * Sign-ins issued before this moment no longer work. Moved forward on every
   * password change, so a stolen or forgotten session dies with the old password.
   */
  @Column({ type: 'timestamptz', nullable: true })
  sessions_valid_after: Date | null;

  // ---- PIN sign-in (set by the person, used on their trusted devices) ----

  /** bcrypt hash of the 4-digit PIN. */
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  pin_hash: string | null;

  /** When the PIN was set; null means no PIN yet. */
  @Column({ type: 'timestamptz', nullable: true })
  pin_set_at: Date | null;

  /** Wrong PINs in a row; at the limit PIN sign-in waits for a password sign-in. */
  @Column({ type: 'integer', default: 0 })
  pin_failed_attempts: number;

  /** A client may change a password once between office-issued resets. */
  @Column({ type: 'boolean', default: false })
  self_service_password_change_used: boolean;

  // ---- Two-factor authentication (authenticator app, required for everyone) ----

  /** On once the user has scanned the secret and confirmed a code. */
  @Column({ type: 'boolean', default: false })
  totp_enabled: boolean;

  /** Authenticator secret, AES-256-GCM encrypted. Set during setup. */
  @Column({ type: 'text', nullable: true, select: false })
  totp_secret_enc: string | null;

  /** Last accepted 30-second step, so a code can't be used twice. */
  @Column({ type: 'integer', nullable: true, select: false })
  totp_last_counter: number | null;

  /** SHA-256 hashes of unused single-use recovery codes (JSON array). */
  @Column({ type: 'text', nullable: true, select: false })
  totp_recovery_hashes: string | null;
}
