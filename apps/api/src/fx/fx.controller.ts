import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";

import { Public } from "../common/decorators/public.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FxPort } from "./fx.port";

@ApiTags("fx")
@Controller("fx")
export class FxController {
  constructor(private readonly fxPort: FxPort) {}

  @Public()
  @Get("rates")
  @ApiOperation({ summary: "Get exchange rates for a base currency" })
  @ApiQuery({ name: "base", required: false, example: "IDR" })
  @ApiResponse({
    status: 200,
    description:
      "Base currency, legacy rates map, and the IDR-per-unit snapshot with rate date, source and staleness",
  })
  async getRates(@Query("base") base = "IDR"): Promise<{
    base: string;
    rates: Record<string, number>;
    rateDate: string;
    source: "frankfurter" | "indicative";
    stale: boolean;
    idrPerUnit: Record<string, string>;
  }> {
    const [rates, snapshot] = await Promise.all([
      this.fxPort.getRates(base),
      this.fxPort.getSnapshot(),
    ]);
    return {
      base,
      rates,
      rateDate: snapshot.rateDate,
      source: snapshot.source,
      stale: snapshot.stale,
      idrPerUnit: snapshot.idrPerUnit,
    };
  }
}
