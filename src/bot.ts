import { Client, Events, GatewayIntentBits, type Message } from "discord.js";
import { config, validateConfig } from "./config";
import { logger } from "./utils/logger";
import { NFTService } from "./services/nft.service";
import { EmbedGeneratorService } from "./services/embed-generator.service";

export class DiscordTezosBot {
    private readonly client: Client;
    private readonly nftService: NFTService;
    private readonly embedService: EmbedGeneratorService;

    constructor() {
        // Initialize Discord client with required intents
        this.client = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
        });

        // Initialize services
        this.nftService = new NFTService();
        this.embedService = new EmbedGeneratorService(this.client);

        // Set up event handlers
        this.setupEventHandlers();
    }

    /**
     * Sets up Discord event handlers
     */
    private setupEventHandlers(): void {
        // Client ready event
        this.client.once(Events.ClientReady, (readyClient) => {
            logger.info(`✅ Discord bot ready! Logged in as ${readyClient.user.tag}`);
            logger.info(`🤖 Bot is active in ${readyClient.guilds.cache.size} guild(s)`);
        });

        // Message create event
        this.client.on(Events.MessageCreate, async (message) => {
            await this.handleMessage(message);
        });

        // Guild join event
        this.client.on(Events.GuildCreate, (guild) => {
            logger.info(`🎉 Bot added to new guild: "${guild.name}" (ID: ${guild.id})`);
            logger.info(`📊 Guild stats: ${guild.memberCount} members, Owner: ${guild.ownerId}`);
            logger.info(`🤖 Now active in ${this.client.guilds.cache.size} guild(s)`);
        });

        // Guild leave event
        this.client.on(Events.GuildDelete, (guild) => {
            logger.info(`👋 Bot removed from guild: "${guild.name}" (ID: ${guild.id})`);
            logger.info(`🤖 Now active in ${this.client.guilds.cache.size} guild(s)`);
        });

        // Error handling
        this.client.on(Events.Error, (error) => {
            logger.error("Discord client error:", error);
        });

        // Warning handling
        this.client.on(Events.Warn, (warning) => {
            logger.warn("Discord client warning:", warning);
        });

        // Rate limit handling
        this.client.rest.on("rateLimited", (rateLimitData) => {
            logger.warn("Discord API rate limited:", {
                timeout: rateLimitData.timeToReset,
                limit: rateLimitData.limit,
                method: rateLimitData.method,
                url: rateLimitData.url,
            });
        });
    }

    /**
     * Handles incoming messages
     */
    private async handleMessage(message: Message): Promise<void> {
        try {
            logger.debug(
                `Message received: "${message.content}" from ${message.author.tag} in ${message.guild?.name || "DM"}`
            );

            // Ignore bot messages and messages without content
            if (message.author.bot) {
                logger.debug("Ignoring bot message");
                return;
            }

            if (!message.content.trim()) {
                logger.debug("Ignoring empty message");
                return;
            }

            logger.info(`Processing message: "${message.content}" from ${message.author.tag}`);

            // Check for both NFT and collection links
            const nftResult = await this.nftService.processMessage(message.content);
            const collectionResult = await this.nftService.processCollections(message.content);

            const hasNFTs = nftResult.success && nftResult.data && nftResult.data.length > 0;
            const hasCollections =
                collectionResult.success && collectionResult.data && collectionResult.data.length > 0;

            if (!hasNFTs && !hasCollections) {
                // No links found or error occurred - don't spam the channel
                logger.debug(`No NFT or collection links detected or processing failed`);
                return;
            }

            logger.info(
                `Processing ${hasNFTs ? nftResult.data?.length || 0 : 0} NFT(s) and ${
                    hasCollections ? collectionResult.data?.length || 0 : 0
                } collection(s) for message in ${message.guild?.name || "DM"} by ${message.author.tag}`
            );

            // Send loading message
            const loadingEmbed = this.embedService.createLoadingEmbed();
            const loadingMessage = await message.reply({ embeds: [loadingEmbed] });

            try {
                const embeds = [];

                // Process NFTs
                if (hasNFTs && nftResult.data) {
                    for (const nft of nftResult.data) {
                        const embed = this.embedService.createNFTEmbed(nft);

                        if (this.embedService.validateEmbed(embed)) {
                            embeds.push(embed);
                        } else {
                            logger.warn("Invalid NFT embed generated, skipping");
                        }
                    }
                }

                // Process Collections
                if (hasCollections && collectionResult.data) {
                    for (const collection of collectionResult.data) {
                        const embed = this.embedService.createCollectionEmbed(collection);

                        if (this.embedService.validateEmbed(embed)) {
                            embeds.push(embed);
                        } else {
                            logger.warn("Invalid collection embed generated, skipping");
                        }
                    }
                }

                if (embeds.length === 0) {
                    throw new Error("No valid embeds could be generated");
                }

                // Update the loading message with NFT previews
                // Discord allows up to 10 embeds per message
                const embedsToSend = embeds.slice(0, 10);
                await loadingMessage.edit({ embeds: embedsToSend });

                logger.info(`Successfully sent ${embedsToSend.length} NFT preview(s)`);
            } catch (error) {
                logger.error("Error generating NFT preview:", error);

                // Replace loading message with error
                const errorEmbed = this.embedService.createErrorEmbed(
                    "Failed to generate NFT preview",
                    "Unable to fetch or process NFT data. Please try again later."
                );

                await loadingMessage.edit({ embeds: [errorEmbed] });
            }
        } catch (error) {
            logger.error("Error handling message:", error);

            // Try to send error message if possible
            try {
                const errorEmbed = this.embedService.createErrorEmbed(
                    "An unexpected error occurred",
                    "Please try again later or contact support."
                );
                await message.reply({ embeds: [errorEmbed] });
            } catch (replyError) {
                logger.error("Failed to send error message:", replyError);
            }
        }
    }

    /**
     * Starts the Discord bot
     */
    public async start(): Promise<void> {
        try {
            logger.info("🚀 Starting Discord Tezos Previews Bot...");

            // Validate configuration
            validateConfig();
            logger.info("✅ Configuration validated");

            // Login to Discord
            await this.client.login(config.discord.token);
        } catch (error) {
            logger.error("❌ Failed to start bot:", error);
            process.exit(1);
        }
    }

    /**
     * Gracefully shuts down the bot
     */
    public async shutdown(): Promise<void> {
        logger.info("🛑 Shutting down Discord bot...");

        try {
            this.client.destroy();
            logger.info("✅ Bot shutdown complete");
        } catch (error) {
            logger.error("Error during shutdown:", error);
        }
    }
}
