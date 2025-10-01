import dotenv from "dotenv";

dotenv.config();

export const config = {
    discord: {
        token: process.env["DISCORD_BOT_TOKEN"] || "",
        clientId: process.env["DISCORD_CLIENT_ID"] || "",
    },
    api: {
        tzktBaseUrl: process.env["TZKT_API_BASE_URL"] || "https://api.tzkt.io",
        objktBaseUrl: process.env["OBJKT_API_BASE_URL"] || "https://data.objkt.com",
        rateLimit: parseInt(process.env["API_RATE_LIMIT"] || "60", 10),
    },
    referral: {
        address: process.env["REFERRAL_ADDRESS"] || "",
    },
    logging: {
        level: process.env["LOG_LEVEL"] || "info",
    },
    environment: process.env["NODE_ENV"] || "development",
} as const;

export const validateConfig = (): void => {
    if (!config.discord.token) {
        throw new Error("DISCORD_BOT_TOKEN is required");
    }

    if (!config.discord.clientId) {
        throw new Error("DISCORD_CLIENT_ID is required");
    }
};
