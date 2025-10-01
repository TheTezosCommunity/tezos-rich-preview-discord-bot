# Discord Tezos NFT Previews Bot

A modern Discord bot that automatically detects Tezos marketplace links in messages and provides rich NFT previews with metadata, pricing, and creator information.

## Features

-   🤖 **Automatic Detection**: Scans all messages for Tezos marketplace URLs
-   🖼️ **Rich Previews**: Displays NFT images, metadata, and pricing information
-   🏪 **Multi-Marketplace Support**:
    -   OBJKT.com
    -   fxhash.xyz
    -   Teia.art
    -   Versum.xyz
-   ⚡ **Fast Response**: Uses TZKT and OBJKT APIs for quick data fetching
-   🛡️ **Error Handling**: Comprehensive error handling and rate limiting
-   📊 **Logging**: Detailed logging with Winston
-   🐳 **Docker Ready**: Full Docker and Docker Compose support

## Requirements

-   [Bun](https://bun.sh/) (>=1.0.0)
-   Discord Bot Token
-   Discord Application Client ID

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd discord-tezos-previews
bun install
```

### 2. Configuration

Copy the environment file and fill in your Discord credentials:

```bash
cp .env.example .env
```

Edit `.env` with your Discord bot credentials:

```env
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
```

### 3. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the bot token to your `.env` file
5. Go to "General Information" and copy the Application ID to your `.env` file

### 4. Bot Permissions

Your bot needs the following permissions to function properly:

#### **Required Permissions:**

-   **View Channels** - Bot needs to see channels to detect messages
-   **Send Messages** - Required to send NFT preview responses
-   **Send Messages in Threads** - Allow bot to respond in thread discussions
-   **Embed Links** - Essential for rich NFT preview embeds
-   **Attach Files** - May be needed for image attachments (optional enhancement)
-   **Read Message History** - Required to read messages containing NFT links
-   **Add Reactions** - Optional, for user interaction feedback
-   **Use External Emojis** - Optional, for enhanced visual responses

#### **CRITICAL: Privileged Gateway Intents**

**You MUST enable these in Discord Developer Portal > Bot > Privileged Gateway Intents:**

-   **MESSAGE CONTENT INTENT** - Required to read message content and detect NFT links

**How to enable:**

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application → "Bot" section
3. Scroll to "Privileged Gateway Intents"
4. Toggle ON "MESSAGE CONTENT INTENT"
5. Save changes

**Without this intent enabled, the bot will fail with "Used disallowed intents" error.**

#### **OAuth2 URL Generator:**

1. In Discord Developer Portal, go to "OAuth2" → "URL Generator"
2. Select **Scopes**: `bot`
3. Select **Bot Permissions**:
    - View Channels
    - Send Messages
    - Send Messages in Threads
    - Embed Links
    - Attach Files
    - Read Message History
    - Add Reactions
    - Use External Emojis

#### **Permission Integer:** `274878286912` (for manual setup)

#### **Invite URL Example:**

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=274878286912&scope=bot
```

**Note:** Replace `YOUR_CLIENT_ID` with your actual Discord Application Client ID from your `.env` file.

### 5. Run the Bot

**Development:**

```bash
bun dev
```

**Production:**

```bash
bun run build
bun start
```

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Copy environment file
cp .env.example .env
# Edit .env with your credentials

# Start the bot
docker-compose up -d

# View logs
docker-compose logs -f discord-tezos-bot

# Stop the bot
docker-compose down
```

### Using Docker

```bash
# Build the image
docker build -t discord-tezos-previews .

# Run the container
docker run -d \
  --name discord-tezos-bot \
  --env-file .env \
  -v $(pwd)/logs:/usr/src/app/logs \
  discord-tezos-previews
```

## Usage

Once the bot is running and added to your Discord server:

1. **Automatic Detection**: Simply post any Tezos marketplace link in a channel where the bot has access
2. **Supported URLs**:

    - `https://objkt.com/asset/KT1*/123`
    - `https://objkt.com/tokens/KT1*/123`
    - `https://fxhash.xyz/gentk/123456`
    - `https://teia.art/objkt/123456`
    - `https://versum.xyz/token/KT1*/123`

3. **Rich Preview**: The bot will automatically respond with a rich embed containing:
    - NFT name and description
    - Creator information
    - Current lowest price (if available)
    - Edition information
    - High-quality image
    - Link to original marketplace

## API Configuration

The bot uses the following APIs:

-   **TZKT API**: `https://api.tzkt.io` (Tezos blockchain data)
-   **OBJKT API**: `https://data.objkt.com` (OBJKT marketplace data)

These are configured by default but can be customized in your `.env` file:

```env
TZKT_API_BASE_URL=https://api.tzkt.io
OBJKT_API_BASE_URL=https://data.objkt.com
API_RATE_LIMIT=60
```

## Project Structure

```
src/
├── bot.ts                 # Main Discord bot class
├── index.ts              # Application entry point
├── config.ts             # Configuration management
├── types/                # TypeScript type definitions
│   └── index.ts
├── services/             # Core services
│   ├── nft.service.ts           # Main NFT processing service
│   ├── nft-detection.service.ts # URL detection and parsing
│   ├── tzkt-api.service.ts      # TZKT API integration
│   ├── objkt-api.service.ts     # OBJKT API integration
│   └── embed-generator.service.ts # Discord embed generation
└── utils/                # Utility functions
    └── logger.ts         # Winston logging configuration
```

## Environment Variables

| Variable             | Description                   | Default                  |
| -------------------- | ----------------------------- | ------------------------ |
| `DISCORD_BOT_TOKEN`  | Discord bot token             | Required                 |
| `DISCORD_CLIENT_ID`  | Discord application client ID | Required                 |
| `TZKT_API_BASE_URL`  | TZKT API base URL             | `https://api.tzkt.io`    |
| `OBJKT_API_BASE_URL` | OBJKT API base URL            | `https://data.objkt.com` |
| `API_RATE_LIMIT`     | API requests per minute       | `60`                     |
| `LOG_LEVEL`          | Logging level                 | `info`                   |
| `NODE_ENV`           | Environment                   | `development`            |

## Development

### Code Style

This project uses:

-   **TypeScript** with strict configuration
-   **ESLint** for code linting
-   **Prettier** for code formatting (recommended)

```bash
# Type checking
bun run type-check

# Linting
bun run lint
bun run lint:fix
```

### Debugging

Enable debug logging:

```env
LOG_LEVEL=debug
```

View logs:

```bash
# Development
tail -f logs/combined.log

# Docker
docker-compose logs -f discord-tezos-bot
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and type checking
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For issues and questions:

1. Check the logs for error messages
2. Ensure your Discord bot has proper permissions
3. Verify your environment variables are set correctly
4. Open an issue on GitHub with details

## Acknowledgments

-   [Discord.js](https://discord.js.org/) - Discord API library
-   [TZKT](https://tzkt.io/) - Tezos blockchain explorer and API
-   [OBJKT](https://objkt.com/) - Tezos NFT marketplace
-   [Bun](https://bun.sh/) - Fast JavaScript runtime
