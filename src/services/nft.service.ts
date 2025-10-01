import { TzktApiService } from "./tzkt-api.service";
import { ObjktApiService } from "./objkt-api.service";
import { NFTDetectionService } from "./nft-detection.service";
import { logger } from "../utils/logger";
import type { TezosNFT, TezosCollection, MarketplaceMatch, CollectionMatch, ApiResponse } from "../types";

// Type definitions for OBJKT API responses
interface ObjktTokenMetadata {
    name?: string;
    description?: string;
    display_uri?: string;
    artifact_uri?: string;
    mime_type?: string;
    thumbnail_uri?: string;
    supply?: number;
    creators?: Array<{
        creator_address: string;
        creator_name?: string;
        holder?: {
            address: string;
            alias?: string;
            discord?: string;
            twitter?: string;
            website?: string;
            description?: string;
            logo?: string;
        };
    }>;
    fa?: {
        name?: string;
        description?: string;
        logo?: string;
        collection_type?: string;
        floor_price?: number;
        items?: number;
        editions?: number;
        owners?: number;
        twitter?: string;
        website?: string;
        volume_24h?: number;
        volume_total?: number;
        verified_creators?: string[];
    };
    listings_active?: unknown[];
    dutch_auctions_active?: unknown[];
    english_auctions_active?: unknown[];
    offers_active?: unknown[];
    open_edition_active?: {
        price: number;
        start_time?: string;
        end_time?: string;
        max_per_wallet?: number;
    };
}

// Known contract mappings for marketplaces that don't include contract in URL
const MARKETPLACE_CONTRACTS = {
    hicetnunc: "KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton", // HicEtNunc 2.0 / Teia
} as const;

/**
 * Checks if a string is a valid Tezos KT contract address
 */
function isKTAddress(address: string): boolean {
    return /^KT1[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
}

export class NFTService {
    private readonly tzktApi: TzktApiService;
    private readonly objktApi: ObjktApiService;
    private readonly detectionService: NFTDetectionService;

    constructor() {
        this.tzktApi = new TzktApiService();
        this.objktApi = new ObjktApiService();
        this.detectionService = new NFTDetectionService();
    }

    /**
     * Processes a message content and returns NFT data if found
     */
    public async processMessage(content: string): Promise<ApiResponse<TezosNFT[]>> {
        try {
            const matches = this.detectionService.detectNFTLinks(content);

            if (matches.length === 0) {
                return {
                    success: false,
                    error: "No Tezos marketplace links found in message",
                };
            }

            logger.info(`Found ${matches.length} NFT link(s) in message`);

            const nftPromises = matches.map((match) => this.fetchNFTData(match));
            const results = await Promise.allSettled(nftPromises);

            const successfulNFTs: TezosNFT[] = [];
            const errors: string[] = [];

            results.forEach((result, index) => {
                if (result.status === "fulfilled" && result.value.success && result.value.data) {
                    successfulNFTs.push(result.value.data);
                } else {
                    const errorMsg =
                        result.status === "rejected" ? result.reason : (result.value as ApiResponse<TezosNFT>).error;
                    errors.push(`Token ${matches[index]?.tokenId}: ${errorMsg}`);
                }
            });

            if (successfulNFTs.length === 0) {
                return {
                    success: false,
                    error: `Failed to fetch NFT data: ${errors.join(", ")}`,
                };
            }

            return {
                success: true,
                data: successfulNFTs,
            };
        } catch (error) {
            logger.error("Error processing message:", error);
            return {
                success: false,
                error: "An unexpected error occurred while processing the message",
            };
        }
    }

    /**
     * Processes a message content and returns collection data if found
     */
    public async processCollections(content: string): Promise<ApiResponse<TezosCollection[]>> {
        try {
            const matches = this.detectionService.detectCollectionLinks(content);

            if (matches.length === 0) {
                return {
                    success: false,
                    error: "No Tezos collection links found in message",
                };
            }

            logger.info(`Found ${matches.length} collection link(s) in message`);

            const results = await Promise.all(
                matches.map(async (match) => {
                    try {
                        return await this.fetchCollectionData(match);
                    } catch (error) {
                        logger.error(`Error fetching collection ${match.contractAddress || match.projectId}:`, error);
                        return {
                            success: false,
                            error: `Failed to fetch collection data: ${error}`,
                        };
                    }
                })
            );

            const successfulCollections: TezosCollection[] = [];
            const errors: string[] = [];

            results.forEach((result, index) => {
                if (result.success && result.data) {
                    successfulCollections.push(result.data);
                } else {
                    const match = matches[index];
                    if (match) {
                        const identifier = match.contractAddress || match.projectId || "unknown";
                        errors.push(`Collection ${identifier}: ${result.error || "Unknown error"}`);
                    } else {
                        errors.push(`Collection unknown: ${result.error || "Unknown error"}`);
                    }
                }
            });

            if (successfulCollections.length === 0) {
                return {
                    success: false,
                    error: `Failed to fetch collection data: ${errors.join(", ")}`,
                };
            }

            return {
                success: true,
                data: successfulCollections,
            };
        } catch (error) {
            logger.error("Error processing collections:", error);
            return {
                success: false,
                error: "An unexpected error occurred while processing collections",
            };
        }
    }

    /**
     * Fetches collection data for a specific marketplace match
     */
    private async fetchCollectionData(match: CollectionMatch): Promise<ApiResponse<TezosCollection>> {
        try {
            logger.info(
                `Fetching collection data for ${match.marketplace}: ${match.contractAddress || match.projectId}`
            );

            // For now, all collection URLs use OBJKT API
            return await this.fetchObjktCollection(match);
        } catch (error) {
            logger.error(`Error fetching collection data:`, error);
            return {
                success: false,
                error: `Failed to fetch collection data: ${error}`,
            };
        }
    }

    /**
     * Fetches collection data from OBJKT API
     */
    private async fetchObjktCollection(match: CollectionMatch): Promise<ApiResponse<TezosCollection>> {
        try {
            // Handle project-based collections (like fxhash projects)
            if (match.projectId) {
                logger.info(`Fetching project collection: ${match.marketplace}/${match.projectId}`);

                const projectResult = await this.objktApi.getCollectionByProject(
                    match.contractAddress || match.marketplace.toLowerCase(),
                    match.projectId
                );

                if (projectResult.success && projectResult.data) {
                    return this.buildCollectionFromData(projectResult.data, match);
                }

                // If project-specific query fails, fall back to general contract query
                logger.warn(`Project collection query failed, falling back to contract query`);
            }

            let contractAddress = match.contractAddress;

            // Handle non-KT addresses by resolving them
            if (contractAddress && !this.isKTAddress(contractAddress)) {
                const resolvedContract = await this.resolveContractAddress(contractAddress);
                if (!resolvedContract) {
                    return {
                        success: false,
                        error: `Could not resolve contract address for: ${contractAddress}`,
                    };
                }
                contractAddress = resolvedContract;
            }

            if (!contractAddress) {
                return {
                    success: false,
                    error: "No contract address available for collection",
                };
            }

            // Fetch collection data using OBJKT API
            const collectionResult = await this.objktApi.getCollectionInfo(contractAddress);

            if (!collectionResult.success || !collectionResult.data) {
                return {
                    success: false,
                    error: "Collection not found or failed to fetch data",
                };
            }

            return this.buildCollectionFromData(collectionResult.data, match);
        } catch (error) {
            logger.error("Error fetching OBJKT collection:", error);
            return {
                success: false,
                error: `Failed to fetch collection data: ${error}`,
            };
        }
    }

    /**
     * Builds TezosCollection object from API data
     */
    private buildCollectionFromData(data: unknown, match: CollectionMatch): ApiResponse<TezosCollection> {
        try {
            const collectionData = data as {
                contract?: string;
                name?: string;
                description?: string;
                logo?: string;
                collection_type?: string;
                collection_id?: string;
                floor_price?: number;
                items?: number;
                editions?: number;
                owners?: number;
                twitter?: string;
                website?: string;
                volume_24h?: number;
                volume_total?: number;
                verified_creators?: string[];
            };

            const collection: TezosCollection = {
                contract: collectionData.contract || match.contractAddress || "Unknown",
                name: collectionData.name || "Unknown Collection",
                description: collectionData.description || undefined,
                logo: collectionData.logo || undefined,
                collectionType: collectionData.collection_type || undefined,
                floorPrice: collectionData.floor_price ? collectionData.floor_price / 1000000 : undefined,
                items: collectionData.items || undefined,
                editions: collectionData.editions || undefined,
                owners: collectionData.owners || undefined,
                twitter: collectionData.twitter || undefined,
                website: collectionData.website || undefined,
                volume24h: collectionData.volume_24h ? collectionData.volume_24h / 1000000 : undefined,
                volumeTotal: collectionData.volume_total ? collectionData.volume_total / 1000000 : undefined,
                verifiedCreators: collectionData.verified_creators || undefined,
                marketplace: {
                    name: match.marketplace,
                    url: match.url,
                },
            };

            return {
                success: true,
                data: collection,
            };
        } catch (error) {
            logger.error("Error building collection from data:", error);
            return {
                success: false,
                error: `Failed to build collection data: ${error}`,
            };
        }
    }

    /**
     * Fetches NFT data for a specific marketplace match
     */
    private async fetchNFTData(match: MarketplaceMatch): Promise<ApiResponse<TezosNFT>> {
        try {
            logger.info(`Fetching NFT data for ${match.marketplace}: ${match.tokenId}`);

            switch (match.marketplace.toLowerCase()) {
                case "objkt":
                    return await this.fetchObjktNFT(match);
                case "bootloader": {
                    // Bootloader tokens are indexed in OBJKT, so treat them as OBJKT tokens
                    // but resolve the contract address first
                    const bootloaderMatch = {
                        ...match,
                        marketplace: "OBJKT",
                        contractAddress: match.contractAddress || "bootloader", // Use bootloader as path to resolve
                    };
                    return await this.fetchObjktNFT(bootloaderMatch);
                }
                case "editart":
                    // EditArt tokens are indexed in OBJKT and URLs include contract address
                    return await this.fetchObjktNFT(match);
                case "fxhash":
                    return await this.fetchFxHashNFT(match);
                case "teia":
                    return await this.fetchTeiaNFT(match);
                case "versum":
                    return await this.fetchVersumNFT(match);
                default:
                    return {
                        success: false,
                        error: `Unsupported marketplace: ${match.marketplace}`,
                    };
            }
        } catch (error) {
            logger.error(`Error fetching NFT data for ${match.marketplace}:`, error);
            return {
                success: false,
                error: "Failed to fetch NFT data",
            };
        }
    }

    /**
     * Fetches NFT data from OBJKT
     */
    private async fetchObjktNFT(match: MarketplaceMatch): Promise<ApiResponse<TezosNFT>> {
        let contractAddress = match.contractAddress;

        // If no contract address provided, or if it's not a KT address, resolve it
        if (!contractAddress || !isKTAddress(contractAddress)) {
            const pathToResolve = contractAddress || match.tokenId;

            // First try hardcoded mappings
            if (contractAddress && contractAddress in MARKETPLACE_CONTRACTS) {
                contractAddress = MARKETPLACE_CONTRACTS[contractAddress as keyof typeof MARKETPLACE_CONTRACTS];
                logger.info(`Mapped ${match.contractAddress} to ${contractAddress}`);
            } else {
                // Use OBJKT API to resolve path to contract
                logger.info(`Resolving contract address for path: ${pathToResolve}`);
                const contractResult = await this.objktApi.resolveContractFromPath(pathToResolve);

                if (!contractResult.success || !contractResult.data) {
                    return {
                        success: false,
                        error: `Could not resolve contract address for path: ${pathToResolve}`,
                    };
                }

                contractAddress = contractResult.data;
                logger.info(`Resolved path ${pathToResolve} to contract: ${contractAddress}`);
            }
        }

        // At this point we should have a valid KT contract address
        if (!contractAddress || !isKTAddress(contractAddress)) {
            return {
                success: false,
                error: `Invalid or missing contract address: ${contractAddress}`,
            };
        }

        // Fetch token metadata from OBJKT
        const metadataResult = await this.objktApi.getTokenMetadata(contractAddress, match.tokenId);

        if (!metadataResult.success || !metadataResult.data) {
            return {
                success: false,
                error: `Failed to fetch token metadata: ${metadataResult.error}`,
            };
        }

        const metadata = metadataResult.data;
        return this.buildObjktNFT(metadata, match);
    }

    private buildObjktNFT(metadata: unknown, match: MarketplaceMatch): ApiResponse<TezosNFT> {
        // Type assertion with validation
        const typedMetadata = metadata as ObjktTokenMetadata;

        // Determine sale type and pricing
        const saleInfo = this.determineSaleType(typedMetadata);

        const nft: TezosNFT = {
            id: match.tokenId,
            name: typedMetadata.name || "Unknown NFT",
            description: typedMetadata.description,
            imageUrl: this.formatImageUrl(
                typedMetadata.display_uri ||
                    typedMetadata.thumbnail_uri ||
                    (typedMetadata.artifact_uri && !typedMetadata.artifact_uri.startsWith("data:")
                        ? typedMetadata.artifact_uri
                        : undefined)
            ),
            creator: {
                address: typedMetadata.creators?.[0]?.creator_address || "Unknown",
                alias: typedMetadata.creators?.[0]?.holder?.alias || typedMetadata.creators?.[0]?.creator_name,
                discord: typedMetadata.creators?.[0]?.holder?.discord,
                twitter: typedMetadata.creators?.[0]?.holder?.twitter,
                website: typedMetadata.creators?.[0]?.holder?.website,
                description: typedMetadata.creators?.[0]?.holder?.description,
            },
            price: saleInfo.price,
            edition: saleInfo.edition,
            saleType: saleInfo.saleType,
            openEditionInfo: saleInfo.openEditionInfo,
            collection: typedMetadata.fa
                ? {
                      name: typedMetadata.fa.name || "Unknown Collection",
                      description: typedMetadata.fa.description,
                      logo: typedMetadata.fa.logo,
                      collectionType: typedMetadata.fa.collection_type,
                      floorPrice: typedMetadata.fa.floor_price ? typedMetadata.fa.floor_price / 1000000 : undefined,
                      items: typedMetadata.fa.items,
                      editions: typedMetadata.fa.editions,
                      owners: typedMetadata.fa.owners,
                      twitter: typedMetadata.fa.twitter,
                      website: typedMetadata.fa.website,
                      volume24h: typedMetadata.fa.volume_24h ? typedMetadata.fa.volume_24h / 1000000 : undefined,
                      volumeTotal: typedMetadata.fa.volume_total ? typedMetadata.fa.volume_total / 1000000 : undefined,
                      verifiedCreators: typedMetadata.fa.verified_creators,
                  }
                : undefined,
            marketplace: {
                name: match.marketplace,
                url: match.url,
            },
            metadata: {
                mimeType: typedMetadata.mime_type,
                artifactUri: typedMetadata.artifact_uri,
                displayUri: typedMetadata.display_uri,
                thumbnailUri: typedMetadata.thumbnail_uri,
            },
        };

        return {
            success: true,
            data: nft,
        };
    }

    /**
     * Fetches NFT data from fxhash (using TZKT as fallback)
     */
    private async fetchFxHashNFT(match: MarketplaceMatch): Promise<ApiResponse<TezosNFT>> {
        // fxhash uses specific contract addresses, we'll need to determine the contract
        const fxhashContract = "KT1KEa8z6vWXDJrVqtMrAeDVzsvxat3kHaCE"; // fx(hash) v2 contract

        return await this.fetchFromTzkt(fxhashContract, match.tokenId, "fxhash", match.url);
    }

    /**
     * Fetches NFT data from Teia (using OBJKT API with HEN contract)
     */
    private async fetchTeiaNFT(match: MarketplaceMatch): Promise<ApiResponse<TezosNFT>> {
        // Teia uses HEN contract - use OBJKT API since it indexes HEN tokens
        const henContract = MARKETPLACE_CONTRACTS.hicetnunc;

        logger.info(`Fetching Teia NFT from OBJKT API: ${henContract}/${match.tokenId}`);

        // Create a new match object with the contract address
        const objktMatch: MarketplaceMatch = {
            ...match,
            marketplace: "Teia", // Keep original marketplace name
            contractAddress: henContract,
        };

        return await this.fetchObjktNFT(objktMatch);
    }

    /**
     * Fetches NFT data from Versum
     */
    private async fetchVersumNFT(match: MarketplaceMatch): Promise<ApiResponse<TezosNFT>> {
        if (!match.contractAddress) {
            return {
                success: false,
                error: "Contract address is required for Versum tokens",
            };
        }

        return await this.fetchFromTzkt(match.contractAddress, match.tokenId, "Versum", match.url);
    }

    /**
     * Generic function to fetch NFT data from TZKT
     */
    private async fetchFromTzkt(
        contractAddress: string,
        tokenId: string,
        marketplace: string,
        url: string
    ): Promise<ApiResponse<TezosNFT>> {
        const tokenResult = await this.tzktApi.getTokenInfo(contractAddress, tokenId);

        if (!tokenResult.success || !tokenResult.data) {
            return {
                success: false,
                error: tokenResult.error || "Failed to fetch token data",
            };
        }

        const token = tokenResult.data;
        const metadata = token.token.metadata;

        const nft: TezosNFT = {
            id: tokenId,
            name: metadata?.name || "Unknown NFT",
            description: metadata?.description,
            imageUrl: this.formatImageUrl(metadata?.displayUri || metadata?.image),
            creator: {
                address: token.account.address,
                alias: token.account.alias,
                // TZKT API doesn't provide Discord/social info
                discord: undefined,
                twitter: undefined,
                website: undefined,
                description: undefined,
            },
            marketplace: {
                name: marketplace,
                url: url,
            },
            metadata: {
                artifactUri: metadata?.artifactUri,
                displayUri: metadata?.displayUri,
                thumbnailUri: metadata?.thumbnailUri,
            },
            attributes: metadata?.attributes?.map((attr) => ({
                trait_type: attr.name,
                value: attr.value,
            })),
        };

        return {
            success: true,
            data: nft,
        };
    }

    /**
     * Formats image URLs (handles IPFS)
     */
    private formatImageUrl(url?: string): string | undefined {
        if (!url) return undefined;

        if (url.startsWith("ipfs://")) {
            return url.replace("ipfs://", "https://ipfs.io/ipfs/");
        }

        return url;
    }

    /**
     * Checks if a string is a KT contract address
     */
    private isKTAddress(address: string): boolean {
        return /^KT1[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
    }

    /**
     * Resolves a marketplace path to contract address
     */
    private async resolveContractAddress(path: string): Promise<string | null> {
        // Check hardcoded mappings first
        if (path in MARKETPLACE_CONTRACTS) {
            return MARKETPLACE_CONTRACTS[path as keyof typeof MARKETPLACE_CONTRACTS];
        }

        // Use OBJKT API to resolve path
        try {
            const result = await this.objktApi.resolveContractFromPath(path);
            return result.success ? (result.data as string) : null;
        } catch (error) {
            logger.error(`Failed to resolve contract for path ${path}:`, error);
            return null;
        }
    }

    /**
     * Determines sale type and returns appropriate pricing and edition info
     * Priority: Open Edition > Listings > Auctions
     */
    private determineSaleType(metadata: ObjktTokenMetadata): {
        price?: { amount: number; currency: string; symbol: string } | undefined;
        edition?: { current: number; total: number } | undefined;
        saleType?: "open_edition" | "listing" | "dutch_auction" | "english_auction" | "none" | undefined;
        openEditionInfo?:
            | { maxPerWallet?: number; endTime?: string; startTime?: string; mintedCount?: number }
            | undefined;
    } {
        // Check for Open Edition first (highest priority)
        if (metadata.open_edition_active) {
            return {
                price: {
                    amount: metadata.open_edition_active.price / 1000000,
                    currency: "XTZ",
                    symbol: "ꜩ",
                },
                edition: undefined as undefined, // OE doesn't show edition numbers
                saleType: "open_edition",
                openEditionInfo: {
                    ...(metadata.open_edition_active.max_per_wallet !== undefined && {
                        maxPerWallet: metadata.open_edition_active.max_per_wallet,
                    }),
                    ...(metadata.open_edition_active.end_time !== undefined && {
                        endTime: metadata.open_edition_active.end_time,
                    }),
                    ...(metadata.open_edition_active.start_time !== undefined && {
                        startTime: metadata.open_edition_active.start_time,
                    }),
                    ...(metadata.supply !== undefined && { mintedCount: metadata.supply }),
                },
            };
        }

        // Check for Active Listings (second priority)
        if (metadata.listings_active && metadata.listings_active.length > 0) {
            const listing = metadata.listings_active[0] as {
                price: string;
                amount_left: number;
            };
            return {
                price: {
                    amount: parseFloat(listing.price) / 1000000,
                    currency: "XTZ",
                    symbol: "ꜩ",
                },
                edition: {
                    current: listing.amount_left,
                    total: metadata.supply || 0,
                },
                saleType: "listing",
                openEditionInfo: undefined as undefined,
            };
        }

        // Check for English Auctions
        if (metadata.english_auctions_active && metadata.english_auctions_active.length > 0) {
            const auction = metadata.english_auctions_active[0] as {
                current_price?: string;
                reserve: string;
            };
            return {
                price: {
                    amount: parseFloat(auction.current_price || auction.reserve) / 1000000,
                    currency: "XTZ",
                    symbol: "ꜩ",
                },
                edition: {
                    current: 1,
                    total: metadata.supply || 1,
                },
                saleType: "english_auction",
                openEditionInfo: undefined as undefined,
            };
        }

        // Check for Dutch Auctions
        if (metadata.dutch_auctions_active && metadata.dutch_auctions_active.length > 0) {
            const auction = metadata.dutch_auctions_active[0] as {
                current_price: string;
            };
            return {
                price: {
                    amount: parseFloat(auction.current_price) / 1000000,
                    currency: "XTZ",
                    symbol: "ꜩ",
                },
                edition: {
                    current: 1,
                    total: metadata.supply || 1,
                },
                saleType: "dutch_auction",
                openEditionInfo: undefined as undefined,
            };
        }

        // Fallback: no active sale, just show supply info
        return {
            price: undefined as undefined,
            edition: metadata.supply
                ? {
                      current: 1,
                      total: metadata.supply,
                  }
                : (undefined as undefined),
            saleType: "none",
            openEditionInfo: undefined as undefined,
        };
    }
}
