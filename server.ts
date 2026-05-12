import { createServer, IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import path from "path";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

// Import jobs (tsx resolves .ts files; explicit paths avoid ESM extension issues)
import registerCleanupJob from "./src/jobs/cleanup.job.js";
import registerSyncJob from "./src/jobs/sync.job.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Define a global augmentation for socket.io so it persists across Next.js reloads in dev
declare global {
  var io: SocketIOServer | undefined;
}

app.prepare().then(() => {
  // --- Next.js HTTP Server ---
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  // --- Socket.IO ---
  const io = new SocketIOServer(server);
  global.io = io; // Attach to global object so it can be used in Next.js API routes

  // Shared counter state (in-memory; replace with DB for persistence)
  let counter = 0;

  const broadcastCount = () => {
    io.emit("counter:update", {
      count: counter,
      timestamp: new Date().toISOString(),
    });
  };

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Send current count immediately on connect
    socket.emit("counter:update", {
      count: counter,
      timestamp: new Date().toISOString(),
    });

    socket.on("counter:increment", () => {
      counter += 1;
      broadcastCount();
    });

    socket.on("counter:reset", () => {
      counter = 0;
      broadcastCount();
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // --- Cron Jobs ---
  registerCleanupJob(io);
  registerSyncJob();

  // --- Start Server ---
  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}).catch((err) => {
  console.error("Next.js prepare failed:", err);
  process.exit(1);
});
