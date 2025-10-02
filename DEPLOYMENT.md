# Production Deployment Guide

## Prerequisites

-   **Bun Runtime**: Install from [bun.sh](https://bun.sh)

    ```bash
    # Install Bun
    curl -fsSL https://bun.sh/install | bash

    # Verify installation
    bun --version
    ```

-   **PM2 Process Manager**:

    ```bash
    # With npm
    npm install -g pm2

    # With bun
    bun install -g pm2

    # Verify installation
    pm2 --version
    ```

-   Discord bot token and client ID

## Deployment Steps

### 1. Clone and Setup

```bash
git clone https://github.com/TheTezosCommunity/tezos-rich-preview-discord-bot.git
cd tezos-rich-preview-discord-bot
bun install
```

### 2. Install PM2

```bash
# Install PM2 globally
npm install -g pm2

# Or if you prefer using bun
bun install -g pm2
```

### 3. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
# Edit .env with your production values
```

Find your Bun path and update PM2 config:

```bash
which bun
# Copy the output path (e.g., /home/user/.bun/bin/bun)
# Edit ecosystem.config.cjs and replace interpreter value with your bun path
```

### 4. Build and Deploy

```bash
# Build the application
bun run build

# Start with PM2
bun run pm2:start

# Check status
bun run pm2:status
```

## PM2 Commands

-   **Start**: `bun run pm2:start` - Start the bot
-   **Stop**: `bun run pm2:stop` - Stop the bot
-   **Restart**: `bun run pm2:restart` - Restart the bot
-   **Delete**: `bun run pm2:delete` - Remove from PM2
-   **Logs**: `bun run pm2:logs` - View logs
-   **Status**: `bun run pm2:status` - Check status
-   **Deploy**: `bun run deploy` - Build and restart

## Log Management

Logs are stored in the `./logs/` directory:

-   `err.log` - Error logs
-   `out.log` - Standard output
-   `combined.log` - Combined logs

## Monitoring

PM2 provides built-in monitoring:

```bash
pm2 monit
```

## Auto-restart on Server Boot

To auto-start the bot on server restart:

```bash
pm2 startup
pm2 save
```

## Memory and Performance

The bot is configured with:

-   Memory limit: 512MB (auto-restart if exceeded)
-   Max restarts: 10 in case of crashes
-   Minimum uptime: 10s before considering stable

## Environment Variables for Production

Make sure to set in your `.env`:

```
NODE_ENV=production
LOG_LEVEL=info
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
```

## Updating

To update the bot:

```bash
git pull
bun install
bun run deploy
```
