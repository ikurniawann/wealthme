import { handlers } from "@/auth";

export const GET = handlers.GET as unknown as (
  req: Request,
) => Promise<Response>;
export const POST = handlers.POST as unknown as (
  req: Request,
) => Promise<Response>;
