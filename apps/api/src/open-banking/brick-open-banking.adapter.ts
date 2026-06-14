import { BadGatewayException, Injectable } from "@nestjs/common";
import { z } from "zod";

import {
  OpenBankingPort,
  type ConsentUrl,
  type OBAccount,
  type OBTransaction,
} from "./open-banking.port";

const BRICK_BASE = "https://api.onebrick.io/v2";

const brickConsentSchema = z.object({
  data: z.object({ url: z.string(), sessionId: z.string() }),
});
const brickTokenSchema = z.object({
  data: z.object({ accessToken: z.string() }),
});
const brickAccountSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      accountName: z.string(),
      accountType: z.string(),
      balance: z.number(),
      currency: z.string(),
    }),
  ),
});
const brickTransactionSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      description: z.string(),
      amount: z.number(),
      currency: z.string(),
    }),
  ),
});

async function safeFetch(url: string, init?: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new BadGatewayException(`Open banking unavailable: ${msg}`);
  }
  if (!res.ok) {
    throw new BadGatewayException(`Brick request failed: ${res.status}`);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new BadGatewayException("Brick returned non-JSON response");
  }
  return body;
}

@Injectable()
export class BrickOpenBankingAdapter extends OpenBankingPort {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {
    super();
  }

  async initiateConsent(redirectUri: string): Promise<ConsentUrl> {
    const body = await safeFetch(`${BRICK_BASE}/auth/initiate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "client-id": this.clientId,
        "client-secret": this.clientSecret,
      },
      body: JSON.stringify({ redirectUrl: redirectUri }),
    });
    const parsed = brickConsentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadGatewayException(
        `Brick response invalid: ${parsed.error.message}`,
      );
    }
    return { url: parsed.data.data.url, sessionId: parsed.data.data.sessionId };
  }

  async exchangeCode(code: string): Promise<{ accessToken: string }> {
    const body = await safeFetch(`${BRICK_BASE}/auth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "client-id": this.clientId,
        "client-secret": this.clientSecret,
      },
      body: JSON.stringify({ code }),
    });
    const parsed = brickTokenSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadGatewayException(
        `Brick response invalid: ${parsed.error.message}`,
      );
    }
    return { accessToken: parsed.data.data.accessToken };
  }

  async getAccounts(accessToken: string): Promise<OBAccount[]> {
    const body = await safeFetch(`${BRICK_BASE}/account/list`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "client-id": this.clientId,
      },
    });
    const parsed = brickAccountSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadGatewayException(
        `Brick response invalid: ${parsed.error.message}`,
      );
    }
    return parsed.data.data.map((a) => ({
      externalId: a.id,
      name: a.accountName,
      type: a.accountType,
      balance: a.balance,
      currency: a.currency,
    }));
  }

  async getTransactions(
    accessToken: string,
    from: string,
    to: string,
  ): Promise<OBTransaction[]> {
    const params = new URLSearchParams({ from, to });
    const body = await safeFetch(
      `${BRICK_BASE}/transaction/list?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "client-id": this.clientId,
        },
      },
    );
    const parsed = brickTransactionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadGatewayException(
        `Brick response invalid: ${parsed.error.message}`,
      );
    }
    return parsed.data.data.map((t) => ({
      externalId: t.id,
      date: t.date,
      description: t.description,
      amount: t.amount,
      currency: t.currency,
    }));
  }
}
