export type SearchResultType = "account" | "transaction" | "category";

export interface SearchResultDto {
  type: SearchResultType;
  id: string;
  label: string;
  sub: string;
  href: string;
  icon: string;
}

export interface SearchResponseDto {
  results: SearchResultDto[];
  query: string;
}
