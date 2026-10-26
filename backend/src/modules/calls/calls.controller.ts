import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../../common/guards/business.guard';
import { CurrentBusiness, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types/auth-user.interface';
import { CallsService } from './calls.service';
import { CreateCallLogDto } from './calls.dto';

@ApiTags('calls')
@Controller()
@UseGuards(JwtAuthGuard, BusinessGuard)
@ApiBearerAuth()
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Get('calls/due')
  @ApiOperation({ summary: 'Clients to call today: call-backs, expiring/expired packages, balances owed' })
  due(@CurrentBusiness() business: { id: string }) {
    return this.calls.due(business.id);
  }

  @Patch('calls/:id/done')
  @ApiOperation({ summary: 'Mark a scheduled call-back as done' })
  done(@CurrentBusiness() business: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.calls.completeFollowUp(business.id, id);
  }

  @Get('customers/:customerId/calls')
  @ApiOperation({ summary: "A client's call history, newest first" })
  history(
    @CurrentBusiness() business: { id: string },
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.calls.history(business.id, customerId);
  }

  @Post('customers/:customerId/calls')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Log a call with a client, optionally scheduling a call-back' })
  log(
    @CurrentBusiness() business: { id: string },
    @CurrentUser() user: AuthUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateCallLogDto,
  ) {
    return this.calls.log(business.id, customerId, user.id, dto);
  }
}
