import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";
import { FX_FIELD_SPECS } from "../fx/fx-field-specs";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FxInputService } from "../fx/fx-input.service";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateLiabilityDto } from "./dto/create-liability.dto";
import {
  LiabilityPaymentPreviewResponseDto,
  LiabilityPrepaymentPreviewResponseDto,
  LiabilityResponseDto,
  LiabilityScheduleResponseDto,
  type LiabilitySummaryResponseDto,
} from "./dto/liability-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PayLiabilityDto } from "./dto/pay-liability.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaymentPreviewQueryDto } from "./dto/payment-preview-query.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrepaymentPreviewQueryDto } from "./dto/prepayment-preview-query.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PurchaseLiabilityDto } from "./dto/purchase-liability.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateLiabilityDto } from "./dto/update-liability.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LiabilitiesService } from "./liabilities.service";

import type { Request } from "express";

@ApiTags("liabilities")
@ApiBearerAuth()
@PageAccess("liabilities")
@Controller("family-groups/:familyGroupId/liabilities")
export class LiabilitiesController {
  constructor(
    private readonly liabilitiesService: LiabilitiesService,
    private readonly fxInputs: FxInputService,
  ) {}

  @Get()
  @CheckAbility((ab: AppAbility) => ab.can("read", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "List all liabilities for a family group" })
  @ApiResponse({ status: 200, type: [LiabilityResponseDto] })
  findAll(
    @Param("familyGroupId") familyGroupId: string,
  ): Promise<LiabilityResponseDto[]> {
    return this.liabilitiesService.findAll(familyGroupId);
  }

  @Get("summary")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary: "Get total remaining balance and debt for a family group",
  })
  @ApiResponse({ status: 200, description: "Liability summary" })
  getSummary(
    @Param("familyGroupId") familyGroupId: string,
  ): Promise<LiabilitySummaryResponseDto> {
    return this.liabilitiesService.getSummary(familyGroupId);
  }

  @Get(":id/schedule")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({
    summary:
      "Projected installment schedule from the liability's current state (read-only, max 600 rows)",
  })
  @ApiResponse({ status: 200, type: LiabilityScheduleResponseDto })
  @ApiResponse({ status: 404, description: "Liability not found" })
  getSchedule(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ): Promise<LiabilityScheduleResponseDto> {
    return this.liabilitiesService.getSchedule(familyGroupId, id);
  }

  @Get(":id/payment-preview")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({
    summary:
      "Principal/interest split a payment of `amount` would book right now (read-only, same math as pay)",
  })
  @ApiResponse({ status: 200, type: LiabilityPaymentPreviewResponseDto })
  @ApiResponse({ status: 404, description: "Liability not found" })
  @ApiResponse({
    status: 400,
    description: "Invalid amount or amount exceeds what is owed",
  })
  previewPayment(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Query() query: PaymentPreviewQueryDto,
  ): Promise<LiabilityPaymentPreviewResponseDto> {
    return this.liabilitiesService.previewPayment(
      familyGroupId,
      id,
      query.amount,
    );
  }

  @Get(":id/prepayment-preview")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({
    summary:
      "Early-repayment simulation (full / reduce tenor / reduce installment); read-only, records nothing",
  })
  @ApiResponse({ status: 200, type: LiabilityPrepaymentPreviewResponseDto })
  @ApiResponse({ status: 404, description: "Liability not found" })
  @ApiResponse({
    status: 400,
    description: "Not an anuitas loan, invalid amount or penalty",
  })
  previewPrepayment(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Query() query: PrepaymentPreviewQueryDto,
  ): Promise<LiabilityPrepaymentPreviewResponseDto> {
    return this.liabilitiesService.previewPrepayment(familyGroupId, id, query);
  }

  @Post()
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Create a new liability" })
  @ApiResponse({ status: 201, type: LiabilityResponseDto })
  create(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateLiabilityDto,
    @Req() req: Request,
  ): Promise<LiabilityResponseDto> {
    return this.fxInputs.run(
      {
        familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Liability",
        dto,
        spec: FX_FIELD_SPECS.liability,
      },
      (converted) => this.liabilitiesService.create(familyGroupId, converted),
    );
  }

  @Patch(":id")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Update a liability" })
  @ApiResponse({ status: 200, type: LiabilityResponseDto })
  @ApiResponse({ status: 404, description: "Liability not found" })
  update(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: UpdateLiabilityDto,
    @Req() req: Request,
  ): Promise<LiabilityResponseDto> {
    return this.fxInputs.run(
      {
        familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Liability",
        entityId: id,
        dto,
        spec: FX_FIELD_SPECS.liability,
      },
      (converted) =>
        this.liabilitiesService.update(familyGroupId, id, converted),
    );
  }

  @Post(":id/pay")
  @HttpCode(HttpStatus.OK)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({
    summary:
      "Record a payment against a liability, splitting principal and interest",
  })
  @ApiResponse({ status: 200, type: LiabilityResponseDto })
  @ApiResponse({ status: 404, description: "Liability or account not found" })
  @ApiResponse({
    status: 400,
    description: "Invalid amount or amount exceeds what is owed",
  })
  pay(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: PayLiabilityDto,
    @Req() req: Request,
  ): Promise<LiabilityResponseDto> {
    return this.fxInputs.run(
      {
        familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Liability",
        entityId: id,
        fieldPrefix: "pay",
        dto,
        spec: FX_FIELD_SPECS.liabilityPayment,
      },
      (converted) => this.liabilitiesService.pay(familyGroupId, id, converted),
    );
  }

  @Post(":id/purchase")
  @HttpCode(HttpStatus.OK)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({
    summary:
      "Record a credit-card purchase — raises the card's own debt, touches no account (EPIC-023 E3, D12)",
  })
  @ApiResponse({ status: 200, type: LiabilityResponseDto })
  @ApiResponse({ status: 404, description: "Liability or category not found" })
  @ApiResponse({ status: 400, description: "Invalid amount" })
  purchase(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: PurchaseLiabilityDto,
    @Req() req: Request,
  ): Promise<LiabilityResponseDto> {
    return this.fxInputs.run(
      {
        familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Liability",
        entityId: id,
        fieldPrefix: "purchase",
        dto,
        spec: FX_FIELD_SPECS.liabilityPayment,
      },
      (converted) =>
        this.liabilitiesService.purchase(
          familyGroupId,
          id,
          converted,
          req.tenantContext?.member,
        ),
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Delete a liability" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: "Liability not found" })
  remove(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.liabilitiesService.remove(familyGroupId, id);
  }
}
