import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { InventoryTransaction } from './entities/inventory-transaction.entity';
import { Product } from '../products/entities/product.entity';
import { AuditService } from '../audit/audit.service';

export interface StockMovement {
  productId: string;
  quantity: number; // positive in, negative out
  type: string;
  referenceId?: string;
  reason?: string;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryTransaction)
    private readonly txRepo: Repository<InventoryTransaction>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Applies a stock movement inside the provided (or new) transaction.
   * Stock is never modified without writing an inventory_transactions row.
   */
  async applyMovements(
    businessId: string,
    movements: StockMovement[],
    actorId: string,
    manager?: EntityManager,
  ): Promise<void> {
    if (movements.length === 0) return;
    const run = async (em: EntityManager) => {
      for (const movement of movements) {
        if (movement.quantity === 0) continue;
        const product = await em.getRepository(Product).findOne({
          where: { id: movement.productId, businessId },
        });
        if (!product) {
          throw new NotFoundException({
            code: 'PRODUCT_NOT_FOUND',
            message: 'A product in this sale could not be found.',
          });
        }
        if (!product.track_inventory) continue;

        const newStock = product.stock_quantity + movement.quantity;
        if (newStock < 0) {
          throw new BadRequestException({
            code: 'INSUFFICIENT_STOCK',
            message: `Not enough stock for "${product.name}". Available: ${product.stock_quantity}.`,
          });
        }
        product.stock_quantity = newStock;
        await em.getRepository(Product).save(product);

        const tx = em.getRepository(InventoryTransaction).create({
          businessId,
          productId: movement.productId,
          type: movement.type,
          quantity: movement.quantity,
          reference_id: movement.referenceId ?? null,
          reason: movement.reason ?? null,
        });
        await em.getRepository(InventoryTransaction).save(tx);
      }
    };

    if (manager) {
      await run(manager);
    } else {
      await this.dataSource.transaction(run);
    }

    for (const movement of movements) {
      await this.auditService.log({
        businessId,
        userId: actorId,
        action: 'INVENTORY_MOVEMENT',
        entity: 'product',
        entityId: movement.productId,
        metadata: {
          type: movement.type,
          quantity: movement.quantity,
          referenceId: movement.referenceId,
          reason: movement.reason,
        },
      });
    }
  }

  async history(businessId: string, productId: string) {
    const product = await this.productRepo.findOne({
      where: { id: productId, businessId },
    });
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product not found.',
      });
    }
    return this.txRepo.find({
      where: { businessId, productId },
      order: { created_at: 'DESC' },
      take: 100,
    });
  }
}