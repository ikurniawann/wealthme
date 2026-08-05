import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { type Request as ExpressRequest } from "express";

import { Public } from "../common/decorators/public.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DevicesService } from "./devices.service";
import { DeviceResponseDto } from "./dto/device-response.dto";
import { RegisterDeviceResponseDto } from "./dto/register-device-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RegisterDeviceDto } from "./dto/register-device.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SetDevicePinDto } from "./dto/set-device-pin.dto";
import { UnlockDeviceResponseDto } from "./dto/unlock-device-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UnlockDeviceDto } from "./dto/unlock-device.dto";

import type { JwtPayload } from "../auth/strategies/jwt.strategy";

interface AuthRequest extends ExpressRequest {
  user: JwtPayload;
}

/**
 * EPIC-023 D2 (US-FAM-13, D7) — device-bound PIN unlock. Every route here
 * except `unlock` requires a real authenticated session — device
 * registration and PIN setup are deliberately NOT reachable before a
 * head-created account's forced first-login password change clears
 * (`ForcePasswordChangeGuard` — these routes are intentionally absent from
 * both its legacy allowlist and `@SkipPasswordCheck()`; see
 * `force-password-change.guard.spec.ts` for the test proving this). `unlock`
 * itself is `@Public()` since there is no session yet at that point — that
 * is the whole point of the flow.
 */
@ApiTags("auth")
@Controller("auth/devices")
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Register a device for the current user (returns the raw deviceSecret ONCE)",
  })
  @ApiResponse({ status: 201, type: RegisterDeviceResponseDto })
  register(
    @Request() req: AuthRequest,
    @Body() dto: RegisterDeviceDto,
  ): Promise<RegisterDeviceResponseDto> {
    return this.devices.registerDevice(req.user.sub, dto);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: "List the current user's registered devices" })
  @ApiResponse({ status: 200, type: [DeviceResponseDto] })
  list(@Request() req: AuthRequest): Promise<DeviceResponseDto[]> {
    return this.devices.listDevices(req.user.sub);
  }

  @Post(":deviceId/pin")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Set/replace the PIN for one of the current user's devices",
  })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: "Device not found" })
  setPin(
    @Request() req: AuthRequest,
    @Param("deviceId") deviceId: string,
    @Body() dto: SetDevicePinDto,
  ): Promise<void> {
    return this.devices.setPin(req.user.sub, deviceId, dto);
  }

  @Delete(":deviceId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Revoke/forget one of the current user's devices" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: "Device not found" })
  revoke(
    @Request() req: AuthRequest,
    @Param("deviceId") deviceId: string,
  ): Promise<void> {
    return this.devices.revokeDevice(req.user.sub, deviceId);
  }

  @Post(":deviceId/unlock")
  @Public()
  @HttpCode(HttpStatus.OK)
  // Tighter than the global 100/min default — this is exactly the kind of
  // endpoint brute-force protection matters most for (repeated PIN
  // guessing), matching the login endpoint's own 5/min throttle.
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary:
      "Unlock a device with its deviceSecret + PIN, minting a real session on success",
  })
  @ApiResponse({ status: 200, type: UnlockDeviceResponseDto })
  @ApiResponse({ status: 401, description: "Unlock failed" })
  @ApiResponse({ status: 403, description: "Device locked out" })
  unlock(
    @Param("deviceId") deviceId: string,
    @Body() dto: UnlockDeviceDto,
  ): Promise<UnlockDeviceResponseDto> {
    return this.devices.unlock(deviceId, dto);
  }
}
