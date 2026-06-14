export type OBAccount = {
  externalId: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
};

export type OBTransaction = {
  externalId: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
};

export type ConsentUrl = { url: string; sessionId: string };

export abstract class OpenBankingPort {
  abstract initiateConsent(redirectUri: string): Promise<ConsentUrl>;
  abstract getAccounts(accessToken: string): Promise<OBAccount[]>;
  abstract getTransactions(
    accessToken: string,
    from: string,
    to: string,
  ): Promise<OBTransaction[]>;
  abstract exchangeCode(code: string): Promise<{ accessToken: string }>;
}

export const OPEN_BANKING_PORT = "OPEN_BANKING_PORT";
