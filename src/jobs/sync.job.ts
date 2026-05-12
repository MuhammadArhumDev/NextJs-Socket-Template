import cron from "node-cron";

export default function registerSyncJob() {
  // Run every 2 hours
  cron.schedule("0 */2 * * *", () => {
    console.log("[Cron] Running sync job...");
    // Sync logic goes here
    console.log("[Cron] Sync job completed.");
  });

  console.log("Sync cron job registered.");
}
