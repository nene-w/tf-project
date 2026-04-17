import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cors from "cors";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { handleUpload, handleGetData } from "../uploadHandler";
import { serveStatic, setupVite } from "./vite";
import { tqService } from "../services/tqService";

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

  // ── Socket.IO 初始化 ──────────────────────────────────────────────────────
  const io = new SocketIOServer(server, {
    path: "/api/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    // 允许轮询 + WebSocket 双通道
    transports: ["polling", "websocket"],
  });

  // 将 tqService 事件桥接到 Socket.IO 广播
  tqService.on("quotes", (data) => {
    io.emit("quotes", data);
  });

  tqService.on("klines", (payload) => {
    // 批量历史 K 线：{ contract, period, data }
    io.emit("klines", payload);
  });

  tqService.on("kline", (payload) => {
    // 单根 K 线实时更新：{ contract, period, data, prev? }
    io.emit("kline", payload);
  });

  tqService.on("error", (err) => {
    io.emit("tq_error", err);
  });

  tqService.on("disconnected", (code) => {
    io.emit("tq_disconnected", code);
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // 新客户端连接时，立即推送当前缓存的行情和 K 线
    const quotes = tqService.getLatestQuotes();
    if (quotes.length > 0) {
      socket.emit("quotes", quotes);
    }

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  console.log("[Socket.IO] Initialized on path /api/socket.io");

  // ── Express 中间件 ────────────────────────────────────────────────────────
  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }));
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Custom REST API for local data upload
  app.post("/api/upload", handleUpload);
  app.get("/api/data", handleGetData);

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
