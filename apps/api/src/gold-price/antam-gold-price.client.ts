import { Injectable, Logger } from "@nestjs/common";

import { fetchWithTimeout } from "../common/utils/external-fetch.util";

import { parseAntamGoldPricePerKg } from "./antam-gold-price.parser";

export const EMASANTAM_SOURCE = "emasantam";
const EMASANTAM_URL = "https://emasantam.id/harga-emas-antam-harian/";
const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; WealthMeGoldPriceBot/1.0; +https://wealthme.app)";

/**
 * B9 — fetches and parses emasantam.id's live page. Split out from the
 * caching/fallback service below so that service's tests can substitute a
 * fake client instead of hitting the network, matching
 * `FrankfurterFxService`/`FrankfurterClient`'s precedent.
 */
@Injectable()
export class AntamGoldPriceClient {
  private readonly logger = new Logger(AntamGoldPriceClient.name);

  async fetchPricePerKg(): Promise<bigint | null> {
    const res = await fetchWithTimeout(
      EMASANTAM_URL,
      {
        headers: { "User-Agent": USER_AGENT },
      },
      FETCH_TIMEOUT_MS,
      "emasantam.id gold price",
    );
    if (!res.ok) {
      this.logger.warn(
        `emasantam.id responded ${res.status} ${res.statusText}`,
      );
      return null;
    }
    const html = await res.text();
    return parseAntamGoldPricePerKg(html);
  }
}
