import { Injectable } from "@nestjs/common";

import {
  OpenBankingPort,
  type ConsentUrl,
  type OBAccount,
  type OBTransaction,
} from "./open-banking.port";

@Injectable()
export class MockOpenBankingAdapter extends OpenBankingPort {
  async initiateConsent(_redirectUri: string): Promise<ConsentUrl> {
    return {
      url: "https://sandbox.onebrick.io/mock-consent",
      sessionId: "mock-session-001",
    };
  }

  async exchangeCode(_code: string): Promise<{ accessToken: string }> {
    return { accessToken: "mock-access-token" };
  }

  async getAccounts(_accessToken: string): Promise<OBAccount[]> {
    return [
      {
        externalId: "mock-acc-1",
        name: "BCA Tabungan",
        type: "SAVINGS",
        balance: 15_000_000,
        currency: "IDR",
      },
      {
        externalId: "mock-acc-2",
        name: "Mandiri Giro",
        type: "CHECKING",
        balance: 5_000_000,
        currency: "IDR",
      },
    ];
  }

  async getTransactions(
    _accessToken: string,
    _from: string,
    _to: string,
  ): Promise<OBTransaction[]> {
    return [
      {
        externalId: "mock-tx-1",
        date: new Date().toISOString(),
        description: "Alfamart",
        amount: -45_000,
        currency: "IDR",
      },
      {
        externalId: "mock-tx-2",
        date: new Date().toISOString(),
        description: "Gaji",
        amount: 10_000_000,
        currency: "IDR",
      },
    ];
  }
}
