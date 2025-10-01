import { config } from "../config";
import { logger } from "../utils/logger";
import type { TzktToken, ApiResponse } from "../types";

export class TzktApiService {
    private readonly baseUrl: string;
    private readonly rateLimit: Map<string, number> = new Map();

    constructor() {
        this.baseUrl = config.api.tzktBaseUrl;
    }

    /**
     * Checks rate limiting for API calls
     */
    private checkRateLimit(endpoint: string): boolean {
        const now = Date.now();
        const lastCall = this.rateLimit.get(endpoint) || 0;
        const minInterval = 60000 / config.api.rateLimit; // Convert rate limit to milliseconds

        if (now - lastCall < minInterval) {
            return false;
        }

        this.rateLimit.set(endpoint, now);
        return true;
    }

    /**
     * Gets token information by contract address and token ID
     */
    public async getTokenInfo(contractAddress: string, tokenId: string): Promise<ApiResponse<TzktToken>> {
        const endpoint = `tokens/${contractAddress}_${tokenId}`;

        if (!this.checkRateLimit(endpoint)) {
            return {
                success: false,
                error: "Rate limit exceeded. Please try again later.",
            };
        }

        try {
            logger.info(`Fetching token info from TZKT: ${contractAddress}/${tokenId}`);

            const url = new URL("/v1/tokens", this.baseUrl);
            url.searchParams.set("contract", contractAddress);
            url.searchParams.set("tokenId", tokenId);
            url.searchParams.set("limit", "1");

            const response = await fetch(url.toString(), {
                method: "GET",
                headers: {
                    "User-Agent": "Discord-Tezos-Previews-Bot/1.0.0",
                    Accept: "application/json",
                },
                signal: AbortSignal.timeout(10000),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = (await response.json()) as TzktToken | TzktToken[];

            if (!data || (Array.isArray(data) && data.length === 0)) {
                return {
                    success: false,
                    error: "Token not found",
                };
            }

            const tokenData = Array.isArray(data) ? data[0] : data;

            if (!tokenData) {
                return {
                    success: false,
                    error: "Token not found",
                };
            }

            return {
                success: true,
                data: tokenData,
            };
        } catch (error) {
            const errorMessage =
                error instanceof Error
                    ? `TZKT API error: ${error.message}`
                    : "Unknown error occurred while fetching token info";

            logger.error("Failed to fetch token info from TZKT:", error);

            return {
                success: false,
                error: errorMessage,
            };
        }
    }

    /**
     * Gets contract information
     */
    public async getContractInfo(contractAddress: string): Promise<ApiResponse<unknown>> {
        const endpoint = `contracts/${contractAddress}`;

        if (!this.checkRateLimit(endpoint)) {
            return {
                success: false,
                error: "Rate limit exceeded. Please try again later.",
            };
        }

        try {
            const url = new URL(`/v1/contracts/${contractAddress}`, this.baseUrl);

            const response = await fetch(url.toString(), {
                method: "GET",
                headers: {
                    "User-Agent": "Discord-Tezos-Previews-Bot/1.0.0",
                    Accept: "application/json",
                },
                signal: AbortSignal.timeout(10000),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            return {
                success: true,
                data,
            };
        } catch (error) {
            const errorMessage =
                error instanceof Error
                    ? `TZKT API error: ${error.message}`
                    : "Unknown error occurred while fetching contract info";

            logger.error("Failed to fetch contract info from TZKT:", error);

            return {
                success: false,
                error: errorMessage,
            };
        }
    }
}
