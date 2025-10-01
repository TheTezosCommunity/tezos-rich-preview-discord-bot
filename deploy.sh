#!/bin/bash

# Discord Tezos NFT Previews Bot - Deployment Script

set -e

echo "🚀 Starting deployment of Discord Tezos NFT Previews Bot..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "📝 Please copy .env.example to .env and configure your settings:"
    echo "   cp .env.example .env"
    exit 1
fi

# Check if required environment variables are set
source .env

if [ -z "$DISCORD_BOT_TOKEN" ]; then
    echo "❌ Error: DISCORD_BOT_TOKEN is not set in .env file"
    exit 1
fi

if [ -z "$DISCORD_CLIENT_ID" ]; then
    echo "❌ Error: DISCORD_CLIENT_ID is not set in .env file"
    exit 1
fi

echo "✅ Environment configuration validated"

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down --remove-orphans

# Build new image
echo "🔨 Building Docker image..."
docker-compose build --no-cache

# Start the bot
echo "🚀 Starting Discord bot..."
docker-compose up -d

# Wait a moment for the container to start
sleep 5

# Check if container is running
if docker-compose ps | grep -q "Up"; then
    echo "✅ Bot deployed successfully!"
    echo "📊 Checking logs..."
    docker-compose logs --tail=20 discord-tezos-bot
    echo ""
    echo "📋 To view live logs: docker-compose logs -f discord-tezos-bot"
    echo "📋 To stop the bot: docker-compose down"
    echo "📋 To restart the bot: docker-compose restart"
else
    echo "❌ Deployment failed!"
    echo "📊 Error logs:"
    docker-compose logs discord-tezos-bot
    exit 1
fi