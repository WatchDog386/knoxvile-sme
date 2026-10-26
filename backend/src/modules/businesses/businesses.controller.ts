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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BusinessesService } from './businesses.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../../common/guards/business.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClientAccess } from '../../common/decorators/client-access.decorator';
import {
  CurrentBusiness,
  CurrentMembership,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { AuthUser, UserRole } from '../../common/types/auth-user.interface';
import {
  AddMemberDto,
  CreateBusinessDto,
  UpdateBusinessDto,
  UpdateMemberRoleDto,
} from './dto/business.dto';

@ApiTags('businesses')
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a business and become its owner' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBusinessDto) {
    return this.businessesService.create(user.id, dto);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List businesses the user belongs to' })
  mine(@CurrentUser() user: AuthUser) {
    return this.businessesService.listForUser(user.id);
  }

  @Get('current')
  @UseGuards(JwtAuthGuard, BusinessGuard)
  @ClientAccess()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the active business' })
  current(@CurrentBusiness() business: { id: string }) {
    return this.businessesService.getById(business.id);
  }

  @Patch('current')
  @UseGuards(JwtAuthGuard, BusinessGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update the active business' })
  update(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.businessesService.update(business.id, dto, { userId: user.id });
  }

  @Get('current/members')
  @UseGuards(JwtAuthGuard, BusinessGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List business members' })
  listMembers(@CurrentBusiness() business: { id: string }) {
    return this.businessesService.listMembers(business.id);
  }

  @Post('current/members')
  @UseGuards(JwtAuthGuard, BusinessGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a member to the business' })
  addMember(
    @CurrentBusiness() business: { id: string },
    @CurrentMembership() membership: { role: UserRole },
    @CurrentUser() user: AuthUser,
    @Body() dto: AddMemberDto,
  ) {
    // The caller's role lives on the verified membership, not on the business
    return this.businessesService.addMember(business.id, dto, { userId: user.id, role: membership.role });
  }

  @Patch('current/members/:memberId')
  @UseGuards(JwtAuthGuard, BusinessGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change a member role (owner only)' })
  updateMemberRole(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.businessesService.updateMemberRole(business.id, memberId, dto.role, {
      userId: user.id,
    });
  }

  @Post('current/members/:memberId/reset-2fa')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, BusinessGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Reset a member's two-factor sign-in, e.g. after a lost phone (owner only)" })
  resetMemberTwoFactor(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.businessesService.resetMemberTwoFactor(business.id, memberId, {
      userId: user.id,
    });
  }

  @Delete('current/members/:memberId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, BusinessGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a member (owner only)' })
  removeMember(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.businessesService.removeMember(business.id, memberId, {
      userId: user.id,
    });
  }
}