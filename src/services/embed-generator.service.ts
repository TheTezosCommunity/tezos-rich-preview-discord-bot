import { EmbedBuilder, type ColorResolvable, type Client } from "discord.js";
import type { TezosNFT, TezosCollection } from "../types/index.js";
import { logger } from "../utils/logger.js";
import { config } from "../config.js";

export class EmbedGeneratorService {
    private discordClient: Client | undefined;
    private colors = {
        primary: 0x2b2d31,
        success: 0x5cb85c,
        warning: 0xf0ad4e,
        error: 0xd9534f,
        info: 0x5bc0de,
        tezos: 0x0066ff,
    };

    // Discord embed limits
    private limits = {
        title: 256,
        description: 4096,
        fieldName: 256,
        fieldValue: 1024,
        footerText: 2048,
        authorName: 256,
        totalFields: 25,
        totalCharacters: 6000,
    };

    constructor(discordClient?: Client) {
        this.discordClient = discordClient;
    }

    /**
     * Truncates text with ellipses if over limit
     */
    private truncateText(text: string, maxLength: number): string {
        if (!text) return "";
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + "...";
    }

    /**
     * Creates a rich embed for an NFT
     */
    public createNFTEmbed(nft: TezosNFT): EmbedBuilder {
        const embed = new EmbedBuilder().setColor(this.colors.tezos as ColorResolvable).setTimestamp();

        // Set title with collection if available - keep concise
        let title = nft.name || "Unknown NFT";
        if (nft.collection?.name && title.length < 150) {
            title = `${nft.collection.name} - ${title}`;
        }
        embed.setTitle(this.truncateText(title, this.limits.title));

        // Set description - more generous but still limited
        if (nft.description) {
            const description = this.truncateText(nft.description, 200);
            embed.setDescription(description);
        }

        // Set image
        if (nft.imageUrl) {
            embed.setImage(nft.imageUrl);
        } else if (nft.metadata?.displayUri) {
            embed.setImage(this.formatIpfsUrl(nft.metadata.displayUri));
        } else if (nft.metadata?.thumbnailUri) {
            embed.setThumbnail(this.formatIpfsUrl(nft.metadata.thumbnailUri));
        }

        // Add fields
        this.addNFTFields(embed, nft);

        // Set footer
        const iconUrl = this.getMarketplaceIcon(nft.marketplace.name);
        embed.setFooter({
            text: `${nft.marketplace.name} • Tezos NFT Preview • by TheTezosCommunity`,
            ...(iconUrl && { iconURL: iconUrl }),
        });

        // Set URL to marketplace
        if (nft.marketplace.url) {
            embed.setURL(this.processMarketplaceUrl(nft.marketplace.url));
        }

        // Add TTC links as inline fields at the bottom
        embed.addFields(
            {
                name: "\u200b", // Invisible character
                value: "[Join TTC Discord](https://discord.gg/beq5pMzvDY)",
                inline: true,
            },
            {
                name: "\u200b", // Invisible character
                value: "[TTC Hub](https://thetezos.com)",
                inline: true,
            },
            {
                name: "\u200b", // Invisible character
                value: "[Events Calendar](https://thetezos.com/calendar-view/)",
                inline: true,
            }
        );

        return embed;
    }

    /**
     * Creates an error embed
     */
    public createErrorEmbed(message: string, details?: string): EmbedBuilder {
        const embed = new EmbedBuilder()
            .setColor(this.colors.error as ColorResolvable)
            .setTitle("❌ Error")
            .setDescription(this.truncateText(message, 300))
            .setTimestamp();

        if (details) {
            embed.addFields({
                name: "Details",
                value: this.truncateText(details, 500),
                inline: false,
            });
        }

        return embed;
    }

    /**
     * Creates a loading embed
     */
    public createLoadingEmbed(): EmbedBuilder {
        return new EmbedBuilder()
            .setColor(this.colors.info as ColorResolvable)
            .setTitle("🔍 Loading NFT Preview...")
            .setDescription("Fetching data from Tezos APIs...")
            .setTimestamp();
    }

    /**
     * Creates a rich embed for a collection
     */
    public createCollectionEmbed(collection: TezosCollection): EmbedBuilder {
        const embed = new EmbedBuilder().setColor(this.colors.tezos as ColorResolvable).setTimestamp();

        // Collection name and description
        embed.setTitle(`🎨 ${this.truncateText(collection.name, 200)}`);
        if (collection.description) {
            embed.setDescription(this.truncateText(collection.description, 150)); // Much shorter for collections
        }

        // Collection logo
        if (collection.logo) {
            embed.setThumbnail(this.formatIpfsUrl(collection.logo));
        }

        // Collection stats
        const stats = [];
        if (collection.items !== undefined) {
            stats.push(`**Items:** ${collection.items.toLocaleString()}`);
        }
        if (collection.owners !== undefined) {
            stats.push(`**Owners:** ${collection.owners.toLocaleString()}`);
        }
        if (collection.editions !== undefined) {
            stats.push(`**Editions:** ${collection.editions.toLocaleString()}`);
        }

        if (stats.length > 0) {
            embed.addFields({
                name: "📊 Collection Stats",
                value: stats.join(" • "),
                inline: false,
            });
        }

        // Artist/Creator information
        if (collection.verifiedCreators && collection.verifiedCreators.length > 0) {
            const artistList = collection.verifiedCreators
                .slice(0, 3) // Limit to 3 artists for brevity
                .map((address) => this.formatAddress(address))
                .join(", ");

            const artistLabel = collection.verifiedCreators.length === 1 ? "👤 Artist" : "👥 Artists";
            const artistValue =
                collection.verifiedCreators.length > 3
                    ? `${artistList} +${collection.verifiedCreators.length - 3} more`
                    : artistList;

            embed.addFields({
                name: artistLabel,
                value: this.truncateText(artistValue, 100),
                inline: true,
            });
        }

        // Floor price and volume
        const financial = [];
        if (collection.floorPrice !== undefined) {
            financial.push(`**Floor:** ${collection.floorPrice} ꜩ`);
        }
        if (collection.volume24h !== undefined) {
            financial.push(`**24h Volume:** ${collection.volume24h} ꜩ`);
        }
        if (collection.volumeTotal !== undefined) {
            financial.push(`**Total Volume:** ${collection.volumeTotal.toLocaleString()} ꜩ`);
        }

        if (financial.length > 0) {
            embed.addFields({
                name: "💰 Market Data",
                value: financial.join(" • "),
                inline: false,
            });
        }

        // Collection type
        if (collection.collectionType) {
            const typeDisplay = collection.collectionType.replace("_", " ").toUpperCase();
            embed.addFields({
                name: "🏷️ Collection Type",
                value: typeDisplay,
                inline: true,
            });
        }

        // Contract address
        embed.addFields({
            name: "📜 Contract",
            value: `\`${collection.contract}\``,
            inline: true,
        });

        // Set footer
        const iconUrl = this.getMarketplaceIcon(collection.marketplace.name);
        embed.setFooter({
            text: `${collection.marketplace.name} • Tezos Collection Preview • by TheTezosCommunity`,
            ...(iconUrl && { iconURL: iconUrl }),
        });

        // Set URL to marketplace
        if (collection.marketplace.url) {
            embed.setURL(this.processMarketplaceUrl(collection.marketplace.url));
        }

        // Add TTC links as inline fields
        embed.addFields(
            {
                name: "\u200b", // Invisible character
                value: "[Join TTC Discord](https://discord.gg/beq5pMzvDY)",
                inline: true,
            },
            {
                name: "\u200b", // Invisible character
                value: "[TTC Hub](https://thetezos.com)",
                inline: true,
            },
            {
                name: "\u200b", // Invisible character
                value: "[Events Calendar](https://thetezos.com/calendar-view/)",
                inline: true,
            }
        );

        return embed;
    }

    /**
     * Adds NFT-specific fields to the embed
     */
    private addNFTFields(embed: EmbedBuilder, nft: TezosNFT): void {
        // Creator
        if (nft.creator.alias || nft.creator.address) {
            const creatorInfo = this.formatCreatorInfo(nft.creator);
            embed.addFields({
                name: "👤 Creator",
                value: this.truncateText(creatorInfo, 100), // Keep creator info concise
                inline: true,
            });
        }

        // Price with sale type context
        if (nft.price) {
            const priceText = `${nft.price.amount} ${nft.price.symbol || nft.price.currency}`;
            let priceLabel = "💰 Price";

            // Customize label based on sale type
            if (nft.saleType === "open_edition") {
                priceLabel = "🎆 Open Edition Price";
            } else if (nft.saleType === "listing") {
                priceLabel = "💰 Lowest Ask";
            } else if (nft.saleType === "dutch_auction") {
                priceLabel = "🔽 Dutch Auction";
            } else if (nft.saleType === "english_auction") {
                priceLabel = "🔼 English Auction";
            }

            embed.addFields({
                name: priceLabel,
                value: priceText,
                inline: true,
            });
        }

        // Open Edition specific info - keep minimal
        if (nft.saleType === "open_edition" && nft.openEditionInfo) {
            const oeDetails = [];

            // Only show minted count and time left (most important)
            if (nft.openEditionInfo.mintedCount !== undefined) {
                oeDetails.push(`**Minted:** ${nft.openEditionInfo.mintedCount.toLocaleString()}`);
            }

            if (nft.openEditionInfo.endTime) {
                const endTime = new Date(nft.openEditionInfo.endTime);
                const now = new Date();
                const timeLeft = endTime.getTime() - now.getTime();

                if (timeLeft > 0) {
                    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

                    let timeString = "";
                    if (days > 0) timeString = `${days}d`;
                    else if (hours > 0) timeString = `${hours}h`;
                    else timeString = "<1h";

                    oeDetails.push(`**Ends:** ${timeString}`);
                } else {
                    oeDetails.push(`**Status:** Ended`);
                }
            }

            if (oeDetails.length > 0) {
                embed.addFields({
                    name: "🎆 Open Edition",
                    value: oeDetails.join("\n"),
                    inline: true,
                });
            }
        }

        // Edition info (not for Open Editions)
        if (nft.edition && nft.saleType !== "open_edition") {
            let editionLabel = "🔢 Edition";
            if (nft.saleType === "listing") {
                editionLabel = "🔢 Available";
            }

            embed.addFields({
                name: editionLabel,
                value: `${nft.edition.current}/${nft.edition.total}`,
                inline: true,
            });
        }

        // Token ID (always show if available)
        embed.addFields({
            name: "🆔 Token ID",
            value: nft.id,
            inline: true,
        });

        // Attributes (limit to 2 for brevity)
        if (nft.attributes && nft.attributes.length > 0) {
            const attributesToShow = nft.attributes.slice(0, 2);
            const attributeText = attributesToShow
                .map((attr) => {
                    const traitType = this.truncateText(attr.trait_type, 20);
                    const value = this.truncateText(String(attr.value), 15);
                    return `**${traitType}:** ${value}`;
                })
                .join("\n");

            embed.addFields({
                name: "✨ Attributes",
                value: attributeText,
                inline: false,
            });

            if (nft.attributes.length > 2) {
                embed.addFields({
                    name: "\u200B",
                    value: `*+${nft.attributes.length - 2} more*`,
                    inline: false,
                });
            }
        }

        // Collection info - prioritize most useful stats
        if (nft.collection?.name) {
            const collectionDetails = [];

            // Only show the most important: floor price and items count
            if (nft.collection.floorPrice !== undefined) {
                collectionDetails.push(`**Floor:** ${nft.collection.floorPrice} ꜩ`);
            }

            if (nft.collection.items !== undefined) {
                collectionDetails.push(`**Items:** ${nft.collection.items.toLocaleString()}`);
            }

            if (collectionDetails.length > 0) {
                embed.addFields({
                    name: `🎨 ${this.truncateText(nft.collection.name, 30)}`,
                    value: collectionDetails.join(" • "),
                    inline: false,
                });
            }

            // Add collection social links if available
            const socialLinks = [];
            if (nft.collection.website) {
                const websiteUrl = nft.collection.website.startsWith("http")
                    ? nft.collection.website
                    : `https://${nft.collection.website}`;
                socialLinks.push(`[🌐 Website](${websiteUrl})`);
            }
            if (nft.collection.twitter) {
                const twitterHandle = nft.collection.twitter.replace(/^@/, "");
                socialLinks.push(`[🐦 @${twitterHandle}](https://twitter.com/${twitterHandle})`);
            }

            if (socialLinks.length > 0) {
                embed.addFields({
                    name: "\u200b", // Invisible character
                    value: socialLinks.join(" • "),
                    inline: false,
                });
            }
        }
    }

    /**
     * Formats IPFS URLs to use a gateway
     */
    private formatIpfsUrl(url: string): string {
        if (url.startsWith("ipfs://")) {
            return url.replace("ipfs://", "https://ipfs.io/ipfs/");
        }
        return url;
    }

    /**
     * Formats a Tezos address for display
     */
    private formatAddress(address: string): string {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    /**
     * Formats creator information with Discord and social links
     */
    private formatCreatorInfo(creator: {
        address: string;
        alias?: string | undefined;
        discord?: string | undefined;
        twitter?: string | undefined;
        website?: string | undefined;
        description?: string | undefined;
    }): string {
        const name = creator.alias || this.formatAddress(creator.address);
        const links: string[] = [];

        // Add Discord mention if available
        if (creator.discord) {
            const discordMention = this.formatDiscordMention(creator.discord);
            links.push(`💬 ${discordMention}`);
        }

        // Add social links
        if (creator.twitter) {
            // Handle both full URLs and usernames
            let twitterHandle: string;
            if (creator.twitter.includes("twitter.com/") || creator.twitter.includes("x.com/")) {
                // Extract username from URL
                const match = creator.twitter.match(/(?:twitter\.com\/|x\.com\/)([^\/\?]+)/);
                twitterHandle = match?.[1] || creator.twitter;
            } else {
                // Remove @ if present
                twitterHandle = creator.twitter.replace(/^@/, "");
            }
            links.push(`🐦 [@${twitterHandle}](https://twitter.com/${twitterHandle})`);
        }

        if (creator.website) {
            const websiteUrl = creator.website.startsWith("http") ? creator.website : `https://${creator.website}`;
            links.push(`🌐 [Website](${websiteUrl})`);
        }

        // Combine name and links
        if (links.length > 0) {
            return `**${name}**\n${links.join(" • ")}`;
        }

        return name;
    }

    /**
     * Processes marketplace URLs to add referral parameters
     */
    private processMarketplaceUrl(url: string): string {
        if (!config.referral.address) {
            return url;
        }

        try {
            const urlObj = new URL(url);

            // Remove any existing ref parameter
            urlObj.searchParams.delete("ref");

            // Add our referral address
            urlObj.searchParams.set("ref", config.referral.address);

            return urlObj.toString();
        } catch (error) {
            logger.warn(`Failed to process URL: ${url}`, error);
            return url;
        }
    }

    /**
     * Formats Discord mention, attempting to resolve username to user ID for proper mentions
     * Note: This only works for users in the bot's cache (shared guilds, recent activity)
     * Falls back to plain text @username if user not found
     */
    private formatDiscordMention(discordHandle: string): string {
        // If we have a Discord client, try to find the user
        if (this.discordClient) {
            try {
                // Extract username from handle (remove #discriminator if present)
                const username = discordHandle.split("#")[0];

                if (username) {
                    // Search for user in cached guilds
                    const user = this.discordClient.users.cache.find(
                        (u) =>
                            u.username.toLowerCase() === username.toLowerCase() ||
                            u.globalName?.toLowerCase() === username.toLowerCase()
                    );

                    if (user) {
                        return `<@${user.id}>`; // Proper Discord mention
                    }
                }
            } catch (error) {
                logger.debug(`Failed to resolve Discord user: ${discordHandle}`, error);
            }
        }

        // Fallback to displaying username
        return `@${discordHandle}`;
    }

    /**
     * Gets marketplace icon URL
     */
    private getMarketplaceIcon(marketplace: string): string {
        const icons: Record<string, string> = {
            OBJKT: "https://objkt.com/favicon.ico",
            fxhash: "https://www.fxhash.xyz/favicon.ico",
            Teia: "https://teia.art/favicon.ico",
            Versum: "https://versum.xyz/favicon.ico",
            EditArt: "https://www.editart.xyz/favicon.ico",
            Bootloader: "https://bootloader.art/favicon.ico",
        };

        return icons[marketplace] || "";
    }

    /**
     * Validates embed before sending
     */
    public validateEmbed(embed: EmbedBuilder): boolean {
        try {
            const data = embed.toJSON();

            // Check embed limits
            if (data.title && data.title.length > 256) {
                logger.warn("Embed title too long, truncating");
                return false;
            }

            if (data.description && data.description.length > 4096) {
                logger.warn("Embed description too long, truncating");
                return false;
            }

            if (data.fields && data.fields.length > 25) {
                logger.warn("Too many embed fields");
                return false;
            }

            return true;
        } catch (error) {
            logger.error("Error validating embed:", error);
            return false;
        }
    }
}
