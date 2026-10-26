import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { PinService } from './pin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types/auth-user.interface';
import {
  ChangePasswordDto,
  ChangePinDto,
  DeviceDto,
  ForgotPasswordDto,
  LoginDto,
  PinLoginDto,
  ResetPasswordDto,
  SetPinDto,
  TwoFactorCodeDto,
  TwoFactorDisableDto,
  TwoFactorEnableDto,
  TwoFactorTicketDto,
  UpdateProfileDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly pinService: PinService,
  ) {}

  // ---- PIN sign-in on trusted devices ----

  @Post('pin/login')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in on a trusted device with its PIN' })
  pinLogin(@Body() dto: PinLoginDto) {
    return this.pinService.login(dto.deviceId, dto.deviceToken, dto.pin);
  }

  @Post('pin/forget')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Turn PIN sign-in off on this device ("Not you?")' })
  pinForget(@Body() dto: DeviceDto) {
    return this.pinService.forget(dto.deviceId, dto.deviceToken);
  }

  @Post('pin/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set the first PIN; trusts this device for PIN sign-in' })
  pinSetup(@CurrentUser() user: AuthUser, @Body() dto: SetPinDto) {
    return this.pinService.setup(user.id, dto.pin, dto.deviceName);
  }

  @Post('pin/change')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change the PIN (needs the password)' })
  pinChange(@CurrentUser() user: AuthUser, @Body() dto: ChangePinDto) {
    return this.pinService.change(user.id, dto.password, dto.pin, dto.deviceName);
  }

  @Post('pin/device')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Turn on PIN sign-in on this device with the existing PIN' })
  pinDevice(@CurrentUser() user: AuthUser, @Body() dto: SetPinDto) {
    return this.pinService.enableDevice(user.id, dto.pin, dto.deviceName);
  }

  @Post('login')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check username (or email) and password; returns a session, or a two-factor challenge when it is on' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.identifier ?? dto.email ?? '', dto.password);
  }

  @Post('2fa/setup')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'First sign-in: get a new authenticator secret and QR link' })
  startTwoFactorSetup(@Body() dto: TwoFactorTicketDto) {
    return this.authService.startTwoFactorSetup(dto.mfaToken);
  }

  @Post('2fa/enable')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm the first authenticator code; returns recovery codes and a session' })
  enableTwoFactor(@Body() dto: TwoFactorCodeDto) {
    return this.authService.enableTwoFactor(dto.mfaToken, dto.code);
  }

  @Post('2fa/verify')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Second sign-in step: authenticator or recovery code; returns a session' })
  verifyTwoFactor(@Body() dto: TwoFactorCodeDto) {
    return this.authService.verifyTwoFactor(dto.mfaToken, dto.code);
  }

  @Post('2fa/me/setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Settings: start turning on two-factor sign-in' })
  startMyTwoFactor(@CurrentUser() user: AuthUser) {
    return this.authService.startTwoFactorSetupForUser(user.id);
  }

  @Post('2fa/me/enable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Settings: confirm the first code; returns recovery codes' })
  enableMyTwoFactor(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorEnableDto) {
    return this.authService.enableTwoFactorForUser(user.id, dto.code);
  }

  @Post('2fa/me/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Settings: turn two-factor sign-in off (needs the password)' })
  disableMyTwoFactor(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorDisableDto) {
    return this.authService.disableTwoFactorForUser(user.id, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current user' })
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.id, dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change the current user password' })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset link' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with a reset token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }
}