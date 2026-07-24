import { Injectable } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { CreateFeedbackDto } from "./dto/create-feedback.dto";

export interface FeedbackDto {
  id: string;
  message: string;
  createdAt: string;
}

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateFeedbackDto): Promise<FeedbackDto> {
    const feedback = await this.prisma.feedback.create({
      data: {
        userId,
        message: dto.message,
      },
      select: { id: true, message: true, createdAt: true },
    });

    return {
      ...feedback,
      createdAt: feedback.createdAt.toISOString(),
    };
  }
}
