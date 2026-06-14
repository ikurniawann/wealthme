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
    description: "Base currency and rates map",
  })
  async getRates(
    @Query("base") base = "IDR",
  ): Promise<{ base: string; rates: Record<string, number> }> {
    const rates = await this.fxPort.getRates(base);
    return { base, rates };
  }
}
