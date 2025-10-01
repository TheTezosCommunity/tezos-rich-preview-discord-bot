import { DiscordTezosBot } from "./bot";
import { logger } from "./utils/logger";

async function main(): Promise<void> {
    try {
        // Create bot instance
        const bot = new DiscordTezosBot();

        // Setup graceful shutdown handlers
        const shutdown = async (signal: string): Promise<void> => {
            logger.info(`Received ${signal}, shutting down gracefully...`);
            await bot.shutdown();
            process.exit(0);
        };

        process.on("SIGINT", () => void shutdown("SIGINT"));
        process.on("SIGTERM", () => void shutdown("SIGTERM"));
        process.on("SIGUSR2", () => void shutdown("SIGUSR2")); // Bun restart

        // Handle uncaught exceptions
        process.on("uncaughtException", (error) => {
            logger.error("Uncaught Exception:", error);
            void shutdown("uncaughtException");
        });

        process.on("unhandledRejection", (reason, promise) => {
            logger.error("Unhandled Rejection at:", promise, "reason:", reason);
            void shutdown("unhandledRejection");
        });

        // Start the bot
        await bot.start();
    } catch (error) {
        logger.error("Failed to start application:", error);
        process.exit(1);
    }
}

// Start the application
void main();
