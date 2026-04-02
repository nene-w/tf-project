import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { Server as SocketIOServer } from "socket.io";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { tqService } from "../services/tqService";
import { signalService } from "../services/signalService";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Initialize Socket.io
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Setup Socket.io events
  io.on("connection", (socket) => {
    console.log("[Socket] Client connected:", socket.id);

    // Send current status
    socket.emit("status", tqService.getStatus());

    socket.on("disconnect", () => {
      console.log("[Socket] Client disconnected:", socket.id);
    });
  });

  // Forward TQ events to all connected clients
  tqService.on("quotes", (quotes) => {
    io.emit("quotes", quotes);
  });

  tqService.on("kline", (kline) => {
    io.emit("kline", kline);
  });

  tqService.on("status", (status) => {
    io.emit("status", status);
  });

  // Start Signal Monitoring
  signalService.start();

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
