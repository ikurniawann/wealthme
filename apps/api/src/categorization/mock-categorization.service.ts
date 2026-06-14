import { CategorizationPort } from "./categorization.port";

import type { CategoryInfo } from "./categorization.port";

export class MockCategorizationService extends CategorizationPort {
  async suggest(
    _description: string,
    _amount: number,
    _type: string,
    _categories: CategoryInfo[],
  ): Promise<string | null> {
    return null;
  }
}
