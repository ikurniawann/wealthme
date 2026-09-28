import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { Public } from "../common/decorators/public.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AntamGoldPriceService } from "./antam-gold-price.service";
import { GoldMarketPriceDto } from "./dto/gold-market-price.dto";

/**
 * B9 — public market-data endpoint (mirrors `fx.controller.ts`'s
 * `@Public() GET /fx/rates`): the Antam 1 kg gold price is not
 * family-specific data, unlike `/family-groups/:id/gold-price` (the
 * owner's manual entry, left untouched).
 */
@ApiTags("gold-price")
@Controller("gold-price")
export class GoldPriceController {
  constructor(private readonly antamGoldPrice: AntamGoldPriceService) {}

  @Public()
  @Get("antam")
  @ApiOperation({
    summary:
      "Get the cached/live Antam 1 kg gold bar price (source: emasantam.id)",
  })
  @ApiResponse({ status: 200, type: GoldMarketPriceDto })
  getAntamPrice(): Promise<GoldMarketPriceDto> {
    return this.antamGoldPrice.getSnapshot();
  }
}
