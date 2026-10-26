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
import { CreateServiceDto, UpdateServiceDto } from './dto/product.dto';

@ApiTags('services')
@Controller('services')
@UseGuards(JwtAuthGuard, BusinessGuard)
@ApiBearerAuth()
export class ServicesController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List services' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  list(
    @CurrentBusiness() business: { id: string },
    @Query() query: { search?: string; categoryId?: string },
  ) {
    return this.productsService.listServices(business.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a service' })
  get(
    @CurrentBusiness() business: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productsService.getService(business.id, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a service' })
  create(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateServiceDto,
  ) {
    return this.productsService.createService(business.id, dto, user.id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a service' })
  update(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.productsService.updateService(business.id, id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a service' })
  remove(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productsService.removeService(business.id, id, user.id);
  }
}