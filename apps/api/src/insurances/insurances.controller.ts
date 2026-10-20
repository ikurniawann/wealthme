import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
  ApiHeader,
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
import { CreateInsuranceDto } from "./dto/create-insurance.dto";
import {
  InsurancePayResponseDto,
  InsuranceResponseDto,
  type InsuranceSummaryResponseDto,
} from "./dto/insurance-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  CreateInsuranceFundDto,
  CreateInsuranceValuationDto,
  UpdateInsuranceFundDto,
  UpdateInsuranceValuationDto,
} from "./dto/insurance-valuation.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  InsuranceSummaryQueryDto,
  ListInsurancesQueryDto,
} from "./dto/list-insurances-query.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PayInsuranceDto } from "./dto/pay-insurance.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateInsuranceDto } from "./dto/update-insurance.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InsurancePaymentsService } from "./insurance-payments.service";
import { viewerFromTenant } from "./insurance-scope.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InsuranceValuationsService } from "./insurance-valuations.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InsurancesService } from "./insurances.service";

import type {
  InsuranceFundDto,
  InsurancePaymentDto,
  InsuranceValuationDto,
} from "@wealthme/contracts";
import type { Request } from "express";

const canRead = (ab: AppAbility) => ab.can("read", "Insurance");
const canManage = (ab: AppAbility) => ab.can("manage", "Insurance");
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_.:-]{8,64}$/;

/**
 * Asuransi Task 22. EVERY route carries @CheckAbility (AbilitiesGuard fails
 * open on ungated routes) and every :id route checks S9 row visibility in
 * the service (404 when the viewer may not see the policy).
 */
@ApiTags("insurances")
@ApiBearerAuth()
@PageAccess("insurances")
@Controller("family-groups/:familyGroupId/insurances")
export class InsurancesController {
  constructor(
    private readonly insurancesService: InsurancesService,
    private readonly payments: InsurancePaymentsService,
    private readonly valuations: InsuranceValuationsService,
    private readonly fxInputs: FxInputService,
  ) {}

  @Get()
  @CheckAbility(canRead)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "List policies visible to the viewer (filters)" })
  @ApiResponse({ status: 200, type: [InsuranceResponseDto] })
  findAll(
    @Param("familyGroupId") familyGroupId: string,
    @Query() query: ListInsurancesQueryDto,
    @Req() req: Request,
  ): Promise<InsuranceResponseDto[]> {
    return this.insurancesService.findAll(
      familyGroupId,
      query,
      viewerFromTenant(req.tenantContext),
    );
  }

  @Get("summary")
  @CheckAbility(canRead)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary:
      "Premium due in a period, overdue, active count, benefits by kind+currency, confirmed values",
  })
  @ApiResponse({ status: 200, description: "Insurance summary" })
  getSummary(
    @Param("familyGroupId") familyGroupId: string,
    @Query() query: InsuranceSummaryQueryDto,
    @Req() req: Request,
  ): Promise<InsuranceSummaryResponseDto> {
    return this.insurancesService.getSummary(
      familyGroupId,
      query,
      viewerFromTenant(req.tenantContext),
    );
  }

  @Get(":id")
  @CheckAbility(canRead)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiResponse({ status: 200, type: InsuranceResponseDto })
  findOne(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<InsuranceResponseDto> {
    return this.insurancesService.findOne(
      familyGroupId,
      id,
      viewerFromTenant(req.tenantContext),
    );
  }

  @Post()
  @CheckAbility(canManage)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Create a policy" })
  @ApiResponse({ status: 201, type: InsuranceResponseDto })
  create(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateInsuranceDto,
    @Req() req: Request,
  ): Promise<InsuranceResponseDto> {
    return this.fxInputs.run(
      {
        familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Insurance",
        dto,
        spec: FX_FIELD_SPECS.insurance,
      },
      (converted) =>
        this.insurancesService.create(
          familyGroupId,
          converted,
          viewerFromTenant(req.tenantContext),
        ),
    );
  }

  @Patch(":id")
  @CheckAbility(canManage)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiResponse({ status: 200, type: InsuranceResponseDto })
  update(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: UpdateInsuranceDto,
    @Req() req: Request,
  ): Promise<InsuranceResponseDto> {
    return this.fxInputs.run(
      {
        familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Insurance",
        entityId: id,
        dto,
        spec: FX_FIELD_SPECS.insurance,
      },
      (converted) =>
        this.insurancesService.update(
          familyGroupId,
          id,
          converted,
          viewerFromTenant(req.tenantContext),
        ),
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility(canManage)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 409, description: "Budget line or history exists" })
  remove(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<void> {
    return this.insurancesService.remove(
      familyGroupId,
      id,
      viewerFromTenant(req.tenantContext),
    );
  }

  // ── Payments (S7) ──────────────────────────────────────────────────────

  @Post(":id/pay")
  @HttpCode(HttpStatus.OK)
  @CheckAbility(canManage)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiHeader({ name: "Idempotency-Key", required: false })
  @ApiOperation({
    summary:
      "Record a premium payment: one expense transaction + one payment row; advances nextPremiumDueDate. Idempotent per key.",
  })
  @ApiResponse({ status: 200, type: InsurancePayResponseDto })
  @ApiResponse({ status: 409, description: "Due already paid" })
  async pay(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: PayInsuranceDto,
    @Headers("idempotency-key") headerKey: string | undefined,
    @Req() req: Request,
  ): Promise<InsurancePayResponseDto> {
    await this.visible(req, familyGroupId, id);
    const key = dto.idempotencyKey ?? headerKey;
    if (key !== undefined && !IDEMPOTENCY_KEY_RE.test(key)) {
      throw new BadRequestException(
        "Idempotency-Key must be 8-64 chars of [A-Za-z0-9_.:-]",
      );
    }
    // A retry with fxInputs is matched on the recorded FOREIGN input, not a
    // re-conversion at today's rate (which would differ after a rate move).
    if (key && dto.fxInputs?.length) {
      const replay = await this.payments.replayForeignInput(
        familyGroupId,
        id,
        key,
        dto,
      );
      if (replay) return replay;
    }
    return this.fxInputs.run(
      {
        familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "InsurancePayment",
        fieldPrefix: "pay",
        // The audit row is keyed to the PAYMENT (so a retry can be matched
        // on its foreign input); an idempotent replay wrote nothing.
        locate: (result) => ({
          entity: "InsurancePayment",
          entityId: result.replayed ? null : result.payment.id,
        }),
        dto: { ...dto, idempotencyKey: key },
        spec: FX_FIELD_SPECS.insurancePayment,
      },
      (converted) =>
        this.payments.pay(
          familyGroupId,
          id,
          converted,
          req.tenantContext?.userId ?? null,
        ),
    );
  }

  @Get(":id/payments")
  @CheckAbility(canRead)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Payment history of a policy (newest first)" })
  async listPayments(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<InsurancePaymentDto[]> {
    await this.visible(req, familyGroupId, id);
    return this.payments.listPayments(familyGroupId, id);
  }

  // ── Funds & valuations (S5) ────────────────────────────────────────────

  @Post(":id/funds")
  @CheckAbility(canManage)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  async createFund(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: CreateInsuranceFundDto,
    @Req() req: Request,
  ): Promise<InsuranceFundDto> {
    await this.visible(req, familyGroupId, id);
    return this.valuations.createFund(familyGroupId, id, dto);
  }

  @Patch(":id/funds/:fundId")
  @CheckAbility(canManage)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiParam({ name: "fundId", type: String })
  async updateFund(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Param("fundId") fundId: string,
    @Body() dto: UpdateInsuranceFundDto,
    @Req() req: Request,
  ): Promise<InsuranceFundDto> {
    await this.visible(req, familyGroupId, id);
    return this.valuations.updateFund(familyGroupId, id, fundId, dto);
  }

  @Delete(":id/funds/:fundId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility(canManage)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiParam({ name: "fundId", type: String })
  async removeFund(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Param("fundId") fundId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.visible(req, familyGroupId, id);
    return this.valuations.removeFund(familyGroupId, id, fundId);
  }

  @Get(":id/valuations")
  @CheckAbility(canRead)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  async listValuations(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<InsuranceValuationDto[]> {
    await this.visible(req, familyGroupId, id);
    return this.valuations.list(familyGroupId, id);
  }

  @Post(":id/valuations")
  @CheckAbility(canManage)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  async createValuation(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: CreateInsuranceValuationDto,
    @Req() req: Request,
  ): Promise<InsuranceValuationDto> {
    await this.visible(req, familyGroupId, id);
    return this.valuations.create(
      familyGroupId,
      id,
      dto,
      req.tenantContext?.userId ?? null,
    );
  }

  @Patch(":id/valuations/:valuationId")
  @CheckAbility(canManage)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiParam({ name: "valuationId", type: String })
  async updateValuation(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Param("valuationId") valuationId: string,
    @Body() dto: UpdateInsuranceValuationDto,
    @Req() req: Request,
  ): Promise<InsuranceValuationDto> {
    await this.visible(req, familyGroupId, id);
    return this.valuations.update(
      familyGroupId,
      id,
      valuationId,
      dto,
      req.tenantContext?.userId ?? null,
    );
  }

  @Post(":id/valuations/:valuationId/confirm")
  @HttpCode(HttpStatus.OK)
  @CheckAbility(canManage)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiParam({ name: "valuationId", type: String })
  @ApiOperation({ summary: "Mark a value statement as confirmed by the user" })
  async confirmValuation(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Param("valuationId") valuationId: string,
    @Req() req: Request,
  ): Promise<InsuranceValuationDto> {
    await this.visible(req, familyGroupId, id);
    return this.valuations.confirm(
      familyGroupId,
      id,
      valuationId,
      req.tenantContext?.userId ?? null,
    );
  }

  @Delete(":id/valuations/:valuationId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility(canManage)
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiParam({ name: "valuationId", type: String })
  async removeValuation(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Param("valuationId") valuationId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.visible(req, familyGroupId, id);
    return this.valuations.remove(familyGroupId, id, valuationId);
  }

  private visible(req: Request, familyGroupId: string, id: string) {
    return this.insurancesService.assertVisible(
      familyGroupId,
      id,
      viewerFromTenant(req.tenantContext),
    );
  }
}
