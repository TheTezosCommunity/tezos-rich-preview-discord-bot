module.exports = {
    apps: [
        {
            name: "tezos-bot",
            script: "dist/index.js",
            interpreter: "bun",
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "512M",
            env: {
                NODE_ENV: "production",
                LOG_LEVEL: "info",
            },
            env_development: {
                NODE_ENV: "development",
                LOG_LEVEL: "debug",
            },
            error_file: "./logs/err.log",
            out_file: "./logs/out.log",
            log_file: "./logs/combined.log",
            time: true,
            merge_logs: true,
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
            min_uptime: "10s",
            max_restarts: 10,
            kill_timeout: 5000,
            wait_ready: true,
            listen_timeout: 8000,
            health_check_grace_period: 3000,
        },
    ],
};
