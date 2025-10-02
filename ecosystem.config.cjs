const { execSync } = require("child_process");

function findBunExecutable() {
    const bunPaths = [
        // Common bun installation paths
        process.env.HOME + "/.bun/bin/bun",
        "/usr/local/bin/bun",
        "/opt/homebrew/bin/bun",
        "bun", // fallback to PATH
    ];

    // Try 'which bun' first
    try {
        return execSync("which bun", { encoding: "utf8" }).trim();
    } catch (e) {
        console.warn("which bun failed, trying common paths...");
    }

    // Try common paths
    for (const bunPath of bunPaths) {
        try {
            execSync(`${bunPath} --version`, { stdio: "ignore" });
            return bunPath;
        } catch (e) {
            continue;
        }
    }

    throw new Error("Bun not found! Please install Bun or update the interpreter path manually.");
}

module.exports = {
    apps: [
        {
            name: "tezos-bot",
            script: "dist/index.js",
            interpreter: findBunExecutable(),
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
