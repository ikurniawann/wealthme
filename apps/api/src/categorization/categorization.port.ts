export type CategoryInfo = { id: string; name: string; kind: string };

export abstract class CategorizationPort {
  abstract suggest(
    description: string,
    amount: number,
    type: string,
    categories: CategoryInfo[],
  ): Promise<string | null>;
}

export const CATEGORIZATION_PORT = "CATEGORIZATION_PORT";
