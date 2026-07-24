import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { type Request as ExpressRequest } from "express";

import { type JwtPayload } from "../auth/strategies/jwt.strategy";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateFeedbackDto } from "./dto/create-feedback.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FeedbackService } from "./feedback.service";

interface AuthRequest extends ExpressRequest {
  user: JwtPayload;
}

@ApiTags("feedback")
@ApiBearerAuth()
@Controller("feedback")
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Submit product feedback from the current user" })
  @ApiResponse({ status: 201, description: "Feedback stored" })
  create(@Request() req: AuthRequest, @Body() dto: CreateFeedbackDto) {
    return this.feedbackService.create(req.user.sub, dto);
  }
}
