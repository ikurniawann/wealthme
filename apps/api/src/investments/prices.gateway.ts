import { Injectable, Logger } from "@nestjs/common";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { OnGatewayConnection } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

@Injectable()
@WebSocketGateway({
  namespace: "/prices",
  cors: { origin: process.env["WEB_ORIGIN"] ?? "http://localhost:3000" },
})
export class PricesGateway implements OnGatewayConnection {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(PricesGateway.name);

  constructor(private readonly prisma: PrismaService) {}

  handleConnection(client: Socket): void {
    const token = client.handshake.auth["token"] as string | undefined;
    const familyGroupId = client.handshake.query["familyGroupId"] as
      | string
      | undefined;

    if (!token || !familyGroupId) {
      this.logger.warn(
        `Client ${client.id} missing token or familyGroupId — disconnecting`,
      );
      client.disconnect();
      return;
    }

    void this.prisma.baSession
      .findUnique({ where: { token } })
      .then((session) => {
        if (!session || session.expiresAt < new Date()) {
          this.logger.warn(
            `Client ${client.id} invalid session — disconnecting`,
          );
          client.disconnect();
          return;
        }
        void client.join(familyGroupId);
        this.logger.log(
          `Client ${client.id} authenticated and joined room ${familyGroupId}`,
        );
      })
      .catch(() => {
        client.disconnect();
      });
  }

  broadcastPriceUpdate(
    familyGroupId: string,
    ticker: string,
    price: number,
    investmentId: string,
    currency = "IDR",
  ): void {
    this.server
      .to(familyGroupId)
      .emit("priceUpdate", { ticker, price, investmentId, currency });
  }
}
