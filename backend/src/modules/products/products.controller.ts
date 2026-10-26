import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../../common/guards/business.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentBusiness,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { AuthUser, UserRole } from '../../common/types/auth-user.interface';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import {
  CreateProductDto,
  StockMovementDto,
  UpdateProductDto,
} from './dto/product.dto';

@ApiTags('products')
@Controller('products')
@UseGuards(JwtAuthGuard, BusinessGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List products with filters' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'stockStatus', enum: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'], required: false })
  list(
    @CurrentBusiness() business: { id: string },
    @Query()
    query: PaginationQueryDto & {
      search?: string;
      categoryId?: string;
      stockStatus?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
    },
  ) {
    return this.productsService.list(business.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product' })
  get(
    @CurrentBusiness() business: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productsService.get(business.id, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a product' })
  create(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create(business.id, dto, user.id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a product' })
  update(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(business.id, id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a product' })
  remove(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productsService.remove(business.id, id, user.id);
  }

  @Post(':id/restock')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Add stock to a product' })
  restock(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StockMovementDto,
  ) {
    return this.productsService.restock(business.id, id, dto, user.id);
  }

  @Post(':id/adjust')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Set a product stock quantity' })
  adjust(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StockMovementDto,
  ) {
    return this.productsService.adjust(business.id, id, dto, user.id);
  }

  @Post(':id/damage')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Record damaged stock' })
  damage(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StockMovementDto,
  ) {
    return this.productsService.damage(business.id, id, dto, user.id);
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Stock movement history' })
  history(
    @CurrentBusiness() business: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productsService.movementHistory(business.id, id);
  }
}