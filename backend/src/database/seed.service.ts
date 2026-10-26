import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../modules/users/entities/user.entity';
import { Business } from '../modules/businesses/entities/business.entity';
import { BusinessMember } from '../modules/businesses/entities/business-member.entity';
import { Category } from '../modules/categories/entities/category.entity';
import { UserRole } from '../common/types/auth-user.interface';

/**
 * Knoxville Technologies starts with an empty workspace: one administrator
 * (Owner) and the base categories. Staff, employee and client accounts,
 * packages, customers and sales are all added by the admin in the app.
 */
const COMPANY = {
  name: 'Knoxville Technologies Ltd',
  phone: '+254 726 818 938',
  email: 'support@knoxville.co.ke',
  address: 'Nairobi, Kenya',
  invoiceFooter:
    'Pay via M-Pesa Paybill, Account: your Knoxville account number · Support +254 726 818 938 · Thank you for choosing Knoxville Technologies.',
};

// The password is never kept in code: it comes from ADMIN_PASSWORD in backend/.env
const DEFAULT_ADMIN = {
  email: 'admin@knoxvilletechnologies.com',
  fullName: 'Knoxville Admin',
  phone: '+254726818938',
};

/** Base categories; "Internet Packages" is where the package form files WiFi plans. */
const BASE_CATEGORIES: Array<[Category['type'], string]> = [
  ['PRODUCT', 'Internet Packages'],
  ['PRODUCT', 'Routers & Equipment'],
  ['SERVICE', 'Installation & Setup'],
  ['SERVICE', 'Support & Maintenance'],
  ['EXPENSE', 'Bandwidth (Upstream)'],
  ['EXPENSE', 'Fibre & Infrastructure'],
  ['EXPENSE', 'Equipment Purchase'],
  ['EXPENSE', 'Field Transport'],
  ['EXPENSE', 'Licences & Fees'],
  ['EXPENSE', 'Rent'],
  ['EXPENSE', 'Utilities'],
  ['EXPENSE', 'Salaries'],
  ['EXPENSE', 'Marketing'],
];

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Business) private readonly bizRepo: Repository<Business>,
    @InjectRepository(BusinessMember) private readonly memberRepo: Repository<BusinessMember>,
    @InjectRepository(Category) private readonly catRepo: Repository<Category>,
  ) {}

  async onModuleInit() {
    try {
      const businessId = await this.ensureAdminAndBusiness();
      if (!businessId) return;
      await this.ensureCategories(businessId);
    } catch (err) {
      this.logger.error('Could not set up the admin account', err instanceof Error ? err.stack : String(err));
    }
  }

  /**
   * Creates the admin login and the company on first start. An existing admin
   * keeps the password they set in the app; it is never reset on restart.
   */
  private async ensureAdminAndBusiness(): Promise<string | null> {
    const email = (this.config.get<string>('ADMIN_EMAIL') || DEFAULT_ADMIN.email).trim().toLowerCase();
    const password = this.config.get<string>('ADMIN_PASSWORD') ?? '';

    let user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      if (password.length < 8) {
        this.logger.warn(
          `Admin ${email} not created: set ADMIN_PASSWORD (8+ characters) in backend/.env and restart.`,
        );
        return null;
      }
      user = await this.userRepo.save(
        this.userRepo.create({
          email,
          full_name: DEFAULT_ADMIN.fullName,
          phone: DEFAULT_ADMIN.phone,
          password_hash: await bcrypt.hash(password, 10),
          email_verified: true,
        }),
      );
      this.logger.log(`Created admin account ${email}`);
    }

    const member = await this.memberRepo.findOne({ where: { userId: user.id, role: UserRole.OWNER } });
    if (member) return member.businessId;

    const business = await this.bizRepo.save(
      this.bizRepo.create({
        name: COMPANY.name,
        business_type: 'SERVICE',
        phone: COMPANY.phone,
        email: COMPANY.email,
        address: COMPANY.address,
        county: 'Nairobi',
        invoice_footer: COMPANY.invoiceFooter,
        currency: 'KES',
        timezone: 'Africa/Nairobi',
        ownerId: user.id,
      }),
    );
    await this.memberRepo.save(
      this.memberRepo.create({ userId: user.id, businessId: business.id, role: UserRole.OWNER, status: 'ACTIVE' }),
    );
    this.logger.log(`Created business ${COMPANY.name}`);
    return business.id;
  }

  private async ensureCategories(businessId: string) {
    const existing = await this.catRepo.find({ where: { businessId } });
    const missing = BASE_CATEGORIES.filter(
      ([type, name]) => !existing.some((c) => c.type === type && c.name === name),
    );
    if (missing.length) {
      await this.catRepo.save(missing.map(([type, name]) => this.catRepo.create({ businessId, type, name })));
    }
  }
}
