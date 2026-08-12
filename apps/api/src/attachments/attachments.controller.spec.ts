import { EventEmitter } from "node:stream";

import { HttpStatus } from "@nestjs/common";
import { Role } from "@prisma/client";

import { AttachmentsController } from "./attachments.controller";

import type { Request, Response } from "express";

const FAMILY_ID = "family-a-uuid";
const TX_ID = "tx-uuid";
const ATTACHMENT_ID = "att-1";

function makeService(stream: NodeJS.ReadableStream) {
  return {
    stream: jest.fn().mockResolvedValue({
      stream,
      mimeType: "image/jpeg",
      size: 123,
    }),
  };
}

function makeRequest(): Request {
  return {
    tenantContext: { member: { userId: "owner-user", role: Role.owner } },
  } as unknown as Request;
}

// A minimal fake Response that just tracks what was called on it — a real
// express Response is heavier than this test needs.
function makeResponse() {
  const res = {
    headersSent: false,
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    destroy: jest.fn(),
  };
  return res as unknown as Response & {
    setHeader: jest.Mock;
    status: jest.Mock;
    json: jest.Mock;
    destroy: jest.Mock;
  };
}

describe("AttachmentsController — download stream error handling", () => {
  it("responds 404 (does not crash the process) when the stream errors before headers are sent", async () => {
    // A bare EventEmitter is enough to exercise the controller's `.on("error", ...)`
    // wiring without needing a real fs.ReadStream/disk file.
    const fakeStream =
      new EventEmitter() as unknown as NodeJS.ReadableStream & {
        pipe: jest.Mock;
      };
    (fakeStream as unknown as { pipe: jest.Mock }).pipe = jest.fn();

    const service = makeService(fakeStream);
    const controller = new AttachmentsController(service as never);
    const req = makeRequest();
    const res = makeResponse();

    // `download()` awaits `service.stream()`, wires up the "error" listener,
    // then calls `.pipe()` and returns — all synchronous after that first
    // await, so awaiting the call itself guarantees the listener is attached
    // before we emit.
    await controller.download(FAMILY_ID, TX_ID, ATTACHMENT_ID, req, res);

    // Simulate the disk file having vanished between the DB lookup and the
    // read (the remove()-then-delete-file race described in the review
    // finding) — this must NOT throw/crash the process.
    expect(() => {
      (fakeStream as unknown as EventEmitter).emit(
        "error",
        new Error("ENOENT: no such file or directory"),
      );
    }).not.toThrow();

    expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: HttpStatus.NOT_FOUND }),
    );
    expect(res.destroy).not.toHaveBeenCalled();
  });

  it("destroys the response instead of writing a new status when headers were already sent", async () => {
    const fakeStream =
      new EventEmitter() as unknown as NodeJS.ReadableStream & {
        pipe: jest.Mock;
      };
    (fakeStream as unknown as { pipe: jest.Mock }).pipe = jest.fn();

    const service = makeService(fakeStream);
    const controller = new AttachmentsController(service as never);
    const req = makeRequest();
    const res = makeResponse();
    res.headersSent = true;

    await controller.download(FAMILY_ID, TX_ID, ATTACHMENT_ID, req, res);

    const err = new Error("stream failed mid-flight");
    expect(() => {
      (fakeStream as unknown as EventEmitter).emit("error", err);
    }).not.toThrow();

    expect(res.destroy).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});
