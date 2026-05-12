import cron from "node-cron";
import { Server as SocketIOServer } from "socket.io";

export default function registerCleanupJob(io?: SocketIOServer) {
  // Run every hour
  cron.schedule("0 * * * *", () => {
    console.log("[Cron] Running cleanup job...");
    
    // Emitting event to clients if io is available
    if (io) {
      io.emit("notification", { message: "Cleanup job started." });
      console.log("[Cron] Cleanup notification sent to clients.");
    }
  });

  console.log("Cleanup cron job registered.");
}
