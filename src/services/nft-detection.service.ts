import type { MarketplaceMatch, CollectionMatch } from "../types";

// Regular expressions for different Tezos marketplace URLs
const MARKETPLACE_PATTERNS = {
    objkt: {
        name: "OBJKT",
        patterns: [
            /(?:https?:\/\/)?(?:www\.)?objkt\.com\/asset\/([^\/\?]+)\/(\d+)(?:\?[^\s]*)?/i,
            /(?:https?:\/\/)?(?:www\.)?objkt\.com\/tokens\/([^\/\?]+)\/(\d+)(?:\?[^\s]*)?/i,
            /(?:https?:\/\/)?(?:www\.)?objkt\.com\/objkt\/(\d+)(?:\?[^\s]*)?/i, // Simple objkt.com/objkt/ID format
        ],
    },
    fxhash: {
        name: "fxhash",
        patterns: [/(?:https?:\/\/)?(?:www\.)?fxhash\.xyz\/gentk\/(\d+)(?:\?[^\s]*)?/i],
    },
    teia: {
        name: "Teia",
        patterns: [/(?:https?:\/\/)?(?:www\.)?teia\.art\/objkt\/(\d+)(?:\?[^\s]*)?/i],
    },
    versum: {
        name: "Versum",
        patterns: [/(?:https?:\/\/)?(?:www\.)?versum\.xyz\/token\/([^\/\?]+)\/(\d+)(?:\?[^\s]*)?/i],
    },
    bootloader: {
        name: "Bootloader",
        patterns: [/(?:https?:\/\/)?(?:www\.)?bootloader\.art\/token\/(\d+)(?:\?[^\s]*)?/i],
    },
    editart: {
        name: "EditArt",
        patterns: [/(?:https?:\/\/)?(?:www\.)?editart\.xyz\/token-detail\/(KT1[a-zA-Z0-9]{33})\/(\d+)(?:\?[^\s]*)?/i],
    },
} as const;

// Collection URL patterns
const COLLECTION_PATTERNS = {
    objkt: {
        name: "OBJKT",
        patterns: [
            /(?:https?:\/\/)?(?:www\.)?objkt\.com\/collections\/([^\/\?]+)\/projects\/(\d+)(?:\?[^\s]*)?/i, // objkt.com/collections/path/projects/id (more specific first)
            /(?:https?:\/\/)?(?:www\.)?objkt\.com\/collections\/([^\/\?]+)(?!\/projects\/)(?:\?[^\s]*)?/i, // objkt.com/collections/contract (exclude /projects/)
        ],
    },
    fxhash: {
        name: "fxhash",
        patterns: [
            /(?:https?:\/\/)?(?:www\.)?fxhash\.xyz\/generative\/(\d+)(?:\?[^\s]*)?/i, // fxhash.xyz/generative/id
            /(?:https?:\/\/)?(?:www\.)?fxhash\.xyz\/project\/([^\/\?]+)(?:\?[^\s]*)?/i, // fxhash.xyz/project/slug
        ],
    },
    bootloader: {
        name: "Bootloader",
        patterns: [
            /(?:https?:\/\/)?(?:www\.)?bootloader\.art\/generator\/(\d+)(?:\?[^\s]*)?/i, // bootloader.art/generator/id
        ],
    },
    editart: {
        name: "EditArt",
        patterns: [
            /(?:https?:\/\/)?(?:www\.)?editart\.xyz\/series\/(KT1[a-zA-Z0-9]{33})(?:\/[^\s]*)?/i, // editart.xyz/series/contract
        ],
    },
} as const;

export class NFTDetectionService {
    /**
     * Scans a message for Tezos marketplace URLs
     * @param content The message content to scan
     * @returns Array of detected marketplace matches
     */
    public detectNFTLinks(content: string): MarketplaceMatch[] {
        const matches: MarketplaceMatch[] = [];

        for (const [marketplaceKey, marketplace] of Object.entries(MARKETPLACE_PATTERNS)) {
            for (const pattern of marketplace.patterns) {
                const match = content.match(pattern);

                if (match) {
                    let tokenId = "";
                    let contractAddress: string | undefined;

                    switch (marketplaceKey) {
                        case "objkt":
                            if (match.length >= 3 && match[2]) {
                                // Pattern: objkt.com/asset/CONTRACT/ID or objkt.com/tokens/CONTRACT/ID
                                contractAddress = match[1];
                                tokenId = match[2] || "";
                            } else if (match.length >= 2 && match[1]) {
                                // Pattern: objkt.com/objkt/ID
                                tokenId = match[1] || "";
                            }
                            break;
                        case "fxhash":
                            tokenId = match[1] || "";
                            break;
                        case "teia":
                            tokenId = match[1] || "";
                            break;
                        case "versum":
                            contractAddress = match[1];
                            tokenId = match[2] || "";
                            break;
                        case "bootloader":
                            tokenId = match[1] || "";
                            break;
                        case "editart":
                            contractAddress = match[1] || "";
                            tokenId = match[2] || "";
                            break;
                        default:
                            continue;
                    }
                    if (tokenId) {
                        matches.push({
                            marketplace: marketplace.name,
                            tokenId,
                            contractAddress,
                            url: match[0] || "",
                        });
                    }
                }
            }
        }

        return matches;
    }

    /**
     * Detects collection URLs in message content
     */
    public detectCollectionLinks(content: string): CollectionMatch[] {
        const matches: CollectionMatch[] = [];

        for (const [marketplace, config] of Object.entries(COLLECTION_PATTERNS)) {
            for (const pattern of config.patterns) {
                const match = content.match(pattern);
                if (match) {
                    const url = match[0];
                    let contractAddress: string | undefined;
                    let projectId: string | undefined;

                    if (marketplace === "objkt") {
                        contractAddress = match[1];
                        projectId = match[2]; // For collections/path/projects/id format
                    } else if (marketplace === "fxhash") {
                        projectId = match[1];
                    } else if (marketplace === "bootloader") {
                        projectId = match[1]; // Bootloader generator URLs have project ID
                    } else if (marketplace === "editart") {
                        contractAddress = match[1]; // EditArt URLs have contract address directly
                    }

                    matches.push({
                        marketplace: config.name,
                        contractAddress,
                        projectId,
                        url,
                    });
                }
            }
        }

        return matches;
    }

    /**
     * Checks if a message contains any Tezos marketplace links
     * @param content The message content to check
     * @returns True if marketplace links are found
     */
    public hasNFTLinks(content: string): boolean {
        return this.detectNFTLinks(content).length > 0;
    }

    /**
     * Extracts all URLs from a message
     * @param content The message content
     * @returns Array of URLs found in the message
     */
    public extractUrls(content: string): string[] {
        const urlPattern = /https?:\/\/[^\s]+/gi;
        return content.match(urlPattern) || [];
    }
}
