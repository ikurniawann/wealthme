import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateFeedbackDto } from "./create-feedback.dto";

describe("CreateFeedbackDto", () => {
  it("passes validation with a real, non-empty message", async () => {
    const dto = plainToInstance(CreateFeedbackDto, {
      message: "Aplikasi keren, tapi ada bug di /laporan",
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it("rejects an empty message", async () => {
    const dto = plainToInstance(CreateFeedbackDto, { message: "" });

    const errors = await validate(dto);

    expect(errors).not.toHaveLength(0);
    expect(errors[0]?.property).toBe("message");
  });

  it("rejects a whitespace-only message (trimmed to empty before validation)", async () => {
    const dto = plainToInstance(CreateFeedbackDto, { message: "    " });

    const errors = await validate(dto);

    expect(errors).not.toHaveLength(0);
    expect(errors[0]?.property).toBe("message");
  });

  it("trims leading/trailing whitespace from an otherwise valid message", async () => {
    const dto = plainToInstance(CreateFeedbackDto, {
      message: "  Ada bug di /laporan  ",
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.message).toBe("Ada bug di /laporan");
  });

  it("rejects a missing message field", async () => {
    const dto = plainToInstance(CreateFeedbackDto, {});

    const errors = await validate(dto);

    expect(errors).not.toHaveLength(0);
    expect(errors[0]?.property).toBe("message");
  });

  it("rejects a message longer than 2000 characters", async () => {
    const dto = plainToInstance(CreateFeedbackDto, {
      message: "a".repeat(2001),
    });

    const errors = await validate(dto);

    expect(errors).not.toHaveLength(0);
    expect(errors[0]?.property).toBe("message");
  });

  it("accepts a message at exactly the 2000 character limit", async () => {
    const dto = plainToInstance(CreateFeedbackDto, {
      message: "a".repeat(2000),
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
