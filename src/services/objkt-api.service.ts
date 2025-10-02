import { config } from "../config";
import { logger } from "../utils/logger";
import type { ApiResponse } from "../types";

export class ObjktApiService {
    private readonly baseUrl: string;
    private readonly rateLimit: Map<string, number> = new Map();

    constructor() {
        this.baseUrl = config.api.objktBaseUrl;
    }

    /**
     * Checks rate limiting for API calls
     */
    private checkRateLimit(endpoint: string): boolean {
        const now = Date.now();
        const lastCall = this.rateLimit.get(endpoint) || 0;
        const minInterval = 60000 / config.api.rateLimit;

        if (now - lastCall < minInterval) {
            return false;
        }

        this.rateLimit.set(endpoint, now);
        return true;
    }

    /**
     * Makes a GraphQL request to OBJKT API
     */
    private async makeGraphQLRequest(query: string, variables: Record<string, unknown>): Promise<unknown> {
        const url = new URL("/v3/graphql", this.baseUrl);

        const response = await fetch(url.toString(), {
            method: "POST",
            headers: {
                "User-Agent": "Discord-Tezos-Previews-Bot/1.0.0",
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({ query, variables }),
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Gets comprehensive token data including all sales types
     */
    public async getTokenMetadata(contractAddress: string, tokenId: string): Promise<ApiResponse<unknown>> {
        const endpoint = `token/${contractAddress}_${tokenId}`;

        if (!this.checkRateLimit(endpoint)) {
            return {
                success: false,
                error: "Rate limit exceeded. Please try again later.",
            };
        }

        try {
            logger.info(`Fetching comprehensive token data from OBJKT: ${contractAddress}/${tokenId}`);

            const query = `
                query GetToken($fa_contract: String!, $token_id: String!) {
                    token(
                        where: {
                            token_id: { _eq: $token_id }
                            fa_contract: { _eq: $fa_contract }
                        }
                    ) {
                        artifact_uri
                        description
                        display_uri
                        lowest_ask
                        mime
                        name
                        supply
                        thumbnail_uri
                        fa_contract
                        token_id
                        creators {
                            creator_address
                            holder {
                                address
                                alias
                                logo
                                website
                                description
                                discord
                                twitter
                                instagram
                                dns
                                tzdomain
                            }
                        }
                        listings_active {
                            price
                            price_xtz
                            amount_left
                            currency {
                                symbol
                                decimals
                            }
                        }
                        dutch_auctions_active {
                            start_price
                            start_price_xtz
                            end_price
                            end_price_xtz
                            end_time
                            amount_left
                            currency {
                                symbol
                                decimals
                            }
                        }
                        english_auctions_active {
                            reserve
                            reserve_xtz
                            highest_bid
                            highest_bid_xtz
                            end_time
                            currency {
                                symbol
                                decimals
                            }
                        }
                        offers_active {
                            price
                            price_xtz
                            currency {
                                symbol
                                decimals
                            }
                        }
                        open_edition_active {
                            price
                            start_time
                            end_time
                            max_per_wallet
                        }
                        fa {
                            contract
                            name
                            description
                            logo
                            collection_type
                            floor_price
                            items
                            editions
                            owners
                            twitter
                            website
                            verified_creators
                            volume_24h
                            volume_total
                        }
                    }
                }
            `;

            const variables = { fa_contract: contractAddress, token_id: tokenId };

            logger.info(`OBJKT GraphQL Query: ${query.replace(/\s+/g, " ").trim()}`);
            logger.info(`OBJKT Variables: ${JSON.stringify(variables)}`);

            const data = (await this.makeGraphQLRequest(query, variables)) as { data?: { token?: unknown[] } };

            logger.info(`OBJKT API Response: ${JSON.stringify(data, null, 2)}`);

            if (!data?.data?.token || data.data.token.length === 0) {
                return {
                    success: false,
                    error: "Token not found",
                };
            }

            return {
                success: true,
                data: data.data.token[0],
            };
        } catch (error) {
            const errorMessage =
                error instanceof Error
                    ? `OBJKT API error: ${error.message}`
                    : "Unknown error occurred while fetching token metadata";

            logger.error("Failed to fetch token metadata from OBJKT:", error);

            return {
                success: false,
                error: errorMessage,
            };
        }
    }

    /**
     * Resolves a marketplace path to actual contract address
     */
    public async resolveContractFromPath(path: string): Promise<ApiResponse<string>> {
        try {
            logger.info(`Resolving contract for marketplace path: ${path}`);

            const query = `
                query GetContractByPath($path: String!) {
                    fa(where: { path: { _eq: $path } }) {
                        contract
                        name
                    }
                }
            `;

            const variables = { path };
            const response = (await this.makeGraphQLRequest(query, variables)) as {
                data?: { fa?: Array<{ contract: string; name: string }> };
            };

            if (response.data?.fa && response.data.fa.length > 0) {
                const contract = response.data.fa[0]?.contract;
                if (contract) {
                    logger.info(`Resolved ${path} to contract: ${contract}`);
                    return {
                        success: true,
                        data: contract,
                    };
                }
            }

            logger.warn(`No contract found for marketplace path: ${path}`);
            return {
                success: false,
                error: `No contract found for path: ${path}`,
            };
        } catch (error) {
            logger.error(`Failed to resolve contract for path ${path}:`, error);
            return {
                success: false,
                error: `Failed to resolve contract: ${error}`,
            };
        }
    }

    /**
     * Simplified method for backward compatibility
     */
    public async getTokenListings(contractAddress: string, tokenId: string): Promise<ApiResponse<unknown[]>> {
        const metadataResult = await this.getTokenMetadata(contractAddress, tokenId);

        if (!metadataResult.success || !metadataResult.data) {
            return {
                success: false,
                error: metadataResult.error || "Failed to fetch token data",
            };
        }

        const tokenData = metadataResult.data as {
            listings?: unknown[];
            dutch_auctions?: unknown[];
            english_auctions?: unknown[];
            offers?: unknown[];
        };

        const allListings = [
            ...(tokenData.listings || []),
            ...(tokenData.dutch_auctions || []),
            ...(tokenData.english_auctions || []),
            ...(tokenData.offers || []),
        ];

        return {
            success: true,
            data: allListings,
        };
    }

    /**
     * Fetches collection information from OBJKT API
     */
    public async getCollectionInfo(contractAddress: string): Promise<ApiResponse<unknown>> {
        const endpoint = "collection";
        if (!this.checkRateLimit(endpoint)) {
            logger.warn("Rate limit exceeded for OBJKT API - collection info");
            return {
                success: false,
                error: "Rate limit exceeded. Please try again later.",
            };
        }

        try {
            logger.info(`Fetching collection info from OBJKT: ${contractAddress}`);

            const query = `
                query GetCollection($contract: String!) {
                    fa(where: { contract: { _eq: $contract } }) {
                        contract
                        name
                        description
                        logo
                        collection_type
                        floor_price
                        items
                        editions
                        owners
                        twitter
                        website
                        verified_creators
                        volume_24h
                        volume_total
                    }
                }
            `;

            const variables = { contract: contractAddress };

            logger.info(`OBJKT Collection Query: ${query.replace(/\s+/g, " ").trim()}`);
            logger.info(`OBJKT Variables: ${JSON.stringify(variables)}`);

            const data = (await this.makeGraphQLRequest(query, variables)) as { data?: { fa?: unknown[] } };

            logger.info(`OBJKT Collection Response: ${JSON.stringify(data, null, 2)}`);

            if (!data.data?.fa || data.data.fa.length === 0) {
                return {
                    success: false,
                    error: "Collection not found",
                };
            }

            return {
                success: true,
                data: data.data.fa[0],
            };
        } catch (error) {
            logger.error("Error fetching collection info from OBJKT:", error);
            return {
                success: false,
                error: `Failed to fetch collection info: ${error}`,
            };
        }
    }

    /**
     * Fetches collection information by project ID (for fxhash and similar platforms)
     */
    public async getCollectionByProject(platform: string, projectId: string): Promise<ApiResponse<unknown>> {
        const endpoint = "collection-project";
        if (!this.checkRateLimit(endpoint)) {
            logger.warn("Rate limit exceeded for OBJKT API - collection project");
            return {
                success: false,
                error: "Rate limit exceeded. Please try again later.",
            };
        }

        try {
            logger.info(`Fetching collection info from OBJKT by project: ${platform}/${projectId}`);

            // For fxhash projects, try to get tokens from the project to build collection data
            if (platform === "fxhash") {
                return await this.getProjectTokensAsCollection(projectId);
            }

            // For bootloader projects, also try to get tokens to build collection data
            if (platform === "bootloader") {
                return await this.getProjectTokensAsCollection(projectId);
            }

            // For other platforms, use the original collection query approach
            const query = `
                query GetCollectionByProject($platform: String!, $projectId: String!) {
                    fa(
                        where: { 
                            _or: [
                                { 
                                    path: { _eq: $platform }
                                    collection_id: { _eq: $projectId }
                                }
                                {
                                    path: { _eq: $platform }
                                    name: { _ilike: $projectId }
                                }
                                {
                                    name: { _ilike: $projectId }
                                    collection_type: { _eq: "generative" }
                                }
                            ]
                        }
                        limit: 5
                    ) {
                        contract
                        name
                        description
                        logo
                        collection_type
                        collection_id
                        path
                        floor_price
                        items
                        editions
                        owners
                        twitter
                        website
                        verified_creators
                        volume_24h
                        volume_total
                    }
                }
            `;

            const variables = { platform, projectId };

            logger.info(`OBJKT Collection Project Query: ${query.replace(/\s+/g, " ").trim()}`);
            logger.info(`OBJKT Variables: ${JSON.stringify(variables)}`);

            const data = (await this.makeGraphQLRequest(query, variables)) as { data?: { fa?: unknown[] } };

            logger.info(`OBJKT Collection Project Response: ${JSON.stringify(data, null, 2)}`);

            if (!data.data?.fa || data.data.fa.length === 0) {
                return {
                    success: false,
                    error: "Collection project not found",
                };
            }

            return {
                success: true,
                data: data.data.fa[0],
            };
        } catch (error) {
            logger.error("Error fetching collection project from OBJKT:", error);
            return {
                success: false,
                error: `Failed to fetch collection project: ${error}`,
            };
        }
    }

    /**
     * Gets tokens from a fxhash project and builds collection-like data
     */
    private async getProjectTokensAsCollection(projectId: string): Promise<ApiResponse<unknown>> {
        try {
            logger.info(`Building collection data from fxhash project tokens: ${projectId}`);

            // Query the gallery table directly to find the project by gallery_id or slug
            // First try by gallery_id (for numeric project IDs), then by slug (for project names)
            const query = `
                query GetProjectByIdOrSlug($projectId: String!) {
                    gallery(
                        where: {
                            _or: [
                                { gallery_id: { _eq: $projectId } }
                                { slug: { _eq: $projectId } }
                                { name: { _ilike: $projectId } }
                            ]
                        }
                        limit: 1
                    ) {
                        gallery_id
                        slug
                        name
                        description
                        editions
                        items
                        owners
                        logo
                        volume_24h
                        floor_price
                        published_at
                        tokens(limit: 10) {
                            token {
                                token_id
                                name
                                description
                                artifact_uri
                                display_uri
                                thumbnail_uri
                                fa_contract
                                fa {
                                    contract
                                    name
                                    description
                                    logo
                                    collection_type
                                    path
                                }
                            }
                        }
                    }
                }
            `;

            const variables = { projectId };

            logger.info(`OBJKT Gallery Query: ${query.replace(/\s+/g, " ").trim()}`);
            logger.info(`OBJKT Gallery Variables: ${JSON.stringify(variables)}`);

            const data = (await this.makeGraphQLRequest(query, variables)) as {
                data?: {
                    gallery?: Array<{
                        gallery_id: string;
                        name: string;
                        description: string;
                        editions: number;
                        items: number;
                        owners: number;
                        logo?: string;
                        volume_24h?: number;
                        floor_price?: number;
                        published_at?: string;
                        tokens: Array<{
                            token: {
                                token_id: string;
                                name: string;
                                fa_contract: string;
                                fa: {
                                    logo?: string;
                                    [key: string]: unknown;
                                };
                                [key: string]: unknown;
                            };
                        }>;
                    }>;
                };
            };

            if (!data.data?.gallery || data.data.gallery.length === 0) {
                logger.warn(`No gallery found for fxhash project ${projectId}`);
                return {
                    success: false,
                    error: "No gallery found for project",
                };
            }

            const gallery = data.data.gallery[0];
            if (!gallery) {
                return {
                    success: false,
                    error: "No valid gallery data found",
                };
            }

            logger.info(`Found gallery for project ${projectId}: ${gallery.name} (${gallery.items} items)`);

            // Get sample tokens for the project
            const sampleTokens = gallery.tokens.map((t) => t.token);
            const firstToken = sampleTokens[0];

            if (!firstToken) {
                return {
                    success: false,
                    error: "No tokens found in gallery",
                };
            }

            // Build collection data from the gallery information
            const collectionData = {
                contract: firstToken.fa_contract,
                name: gallery.name,
                description: gallery.description,
                logo:
                    gallery.logo ||
                    firstToken.fa?.logo ||
                    "https://assets.objkt.media/file/assets-002/collection-logos/fxhash.jpg",
                collection_type: "generative",
                path: "fxhash",
                items: gallery.items,
                editions: gallery.editions,
                owners: gallery.owners,
                floor_price: gallery.floor_price,
                volume_24h: gallery.volume_24h,
                twitter: "fx_hash_",
                website: `https://www.fxhash.xyz/generative/${projectId}`,
                verified_creators: ["-"],
                volume_total: null,
                // Add project-specific data
                project_id: projectId,
                published_at: gallery.published_at,
                project_tokens: sampleTokens.slice(0, 5),
            };

            logger.info(
                `Built collection data for fxhash project ${projectId}: ${gallery.name} (${gallery.items} items)`
            );
            return {
                success: true,
                data: collectionData,
            };
        } catch (error) {
            logger.error(`Error building project collection for ${projectId}:`, error);
            return {
                success: false,
                error: `Failed to build project collection: ${error}`,
            };
        }
    }
}
