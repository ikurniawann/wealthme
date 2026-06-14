import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
  UseGuards,
} from "@nestjs/common";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from "@nestjs/config";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

import { CheckAbility } from "../common/decorators/check-ability.decorator";

import {
  ConsentUrlDto,
  OBAccountDto,
  OBTransactionDto,
} from "./dto/open-banking-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { OpenBankingPort, OPEN_BANKING_PORT } from "./open-banking.port";

import type { AppAbility } from "../casl/casl-ability.factory";
import type { Env } from "../config/env";

class InitiateConsentDto {
  @IsString()
  @IsOptional()
  redirectUri?: string;
}

class ExchangeCodeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

class GetAccountsDto {
  @IsString()
  @IsNotEmpty()
  accessToken!: string;
}

class GetTransactionsDto {
  @IsString()
  @IsNotEmpty()
  accessToken!: string;

  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}

@ApiTags("open-banking")
@ApiBearerAuth()
@UseGuards(ThrottlerGuard)
@Controller("open-banking")
export class OpenBankingController {
  constructor(
    @Inject(OPEN_BANKING_PORT) private readonly ob: OpenBankingPort,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post("consent")
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @CheckAbility((ab: AppAbility) => ab.can("manage", "FamilyGroup"))
  @ApiOperation({ summary: "Initiate open banking consent flow" })
  @ApiResponse({ status: 201, type: ConsentUrlDto })
  initiateConsent(@Body() dto: InitiateConsentDto): Promise<ConsentUrlDto> {
    const allowedOrigin = this.config.get("WEB_ORIGIN", { infer: true });
    if (dto.redirectUri && !dto.redirectUri.startsWith(allowedOrigin)) {
      throw new BadRequestException("redirectUri not allowed");
    }
    const uri = dto.redirectUri ?? `${allowedOrigin}/ob-callback`;
    return this.ob.initiateConsent(uri);
  }

  @Post("token")
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @CheckAbility((ab: AppAbility) => ab.can("manage", "FamilyGroup"))
  @ApiOperation({ summary: "Exchange auth code for access token" })
  @ApiResponse({ status: 201 })
  exchangeCode(@Body() dto: ExchangeCodeDto): Promise<{ accessToken: string }> {
    return this.ob.exchangeCode(dto.code);
  }

  @Post("accounts")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @CheckAbility((ab: AppAbility) => ab.can("read", "FamilyGroup"))
  @ApiOperation({ summary: "List linked bank accounts" })
  @ApiResponse({ status: 201, type: [OBAccountDto] })
  getAccounts(@Body() dto: GetAccountsDto): Promise<OBAccountDto[]> {
    return this.ob.getAccounts(dto.accessToken);
  }

  @Post("transactions")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @CheckAbility((ab: AppAbility) => ab.can("read", "FamilyGroup"))
  @ApiOperation({ summary: "List transactions from linked account" })
  @ApiResponse({ status: 201, type: [OBTransactionDto] })
  getTransactions(
    @Body() dto: GetTransactionsDto,
  ): Promise<OBTransactionDto[]> {
    return this.ob.getTransactions(dto.accessToken, dto.from, dto.to);
  }
}
