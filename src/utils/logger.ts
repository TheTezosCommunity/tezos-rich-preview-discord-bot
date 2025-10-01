import winston from "winston";
import { config } from "../config";

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: "HH:mm:ss" }),
    winston.format.printf(({ level, message, timestamp, stack }) => {
        return `${timestamp} [${level}]: ${stack || message}`;
    })
);

export const logger = winston.createLogger({
    level: config.logging.level,
    format: logFormat,
    defaultMeta: { service: "discord-tezos-bot" },
    transports: [
        new winston.transports.Console({
            format: consoleFormat,
        }),
        new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
        }),
        new winston.transports.File({
            filename: "logs/combined.log",
        }),
    ],
});

// Create logs directory if it doesn't exist
import { promises as fs } from "fs";
import path from "path";

const logsDir = path.join(process.cwd(), "logs");
fs.mkdir(logsDir, { recursive: true }).catch(() => {
    // Directory might already exist, ignore error
});
