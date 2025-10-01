// Simple PM2 config that replicates yarn dev with multiple workers
module.exports = {
  apps: [
    // Backend API Server (Port 3004)
    {
      name: "backend",
      script: "yarn",
      args: ["backend"],
      log_date_format: "HH:mm:ss.SSS",
      env: {
        debug: 1,
        REACT_APP_DEFAULT_HOST_URL: "http://localhost:3005/static/host.html",
        CODEGEN_HOST: "http://localhost:3004",
        SOCKET_HOST: "http://localhost:3020",
        REACT_APP_PUBLIC_URL: "http://localhost:3003",
        INTEGRATIONS_HOST: "http://localhost:3003",
        DISABLE_BWRAP: "1",
        NODE_ENV: "development",
      },
      interpreter: "none",
      instances: 1, // Keep backend as single instance
      exec_mode: "fork",
    },
    
    // Socket Server (Port 3020)
    {
      name: "socket-server",
      script: "npm",
      args: ["run", "run-ts", "--", "src/wab/server/app-socket-backend-real.ts"],
      wait_ready: true,
      time: true,
      env: {
        SOCKET_PORT: 3020,
      },
      node_args: ["--max-old-space-size=2000"],
      interpreter: "none",
      exec_mode: "cluster",
      instances: 2, // Multiple socket server instances
      merge_logs: true,
    },
    
    // Frontend Development Server (Port 3003)
    {
      name: "dev-server",
      script: "yarn",
      args: ["start"],
      exec_mode: "fork",
      autorestart: false,
      interpreter: "none",
      env: {
        PORT: 3003,
        REACT_APP_DEFAULT_HOST_URL: "http://localhost:3005/static/host.html",
        REACT_APP_PUBLIC_URL: "http://localhost:3003",
        PUBLIC_URL: "http://localhost:3003",
        NODE_OPTIONS: "--max-old-space-size=16384",
      },
    },
    
    // Host Server (Port 3005)
    {
      name: "host-server",
      script: "yarn",
      args: ["host-server"],
      exec_mode: "fork",
      autorestart: false,
      interpreter: "none",
      env: {
        HOSTSERVER_PORT: 3005,
      },
    },
    
    // CSS Watcher
    {
      name: "wab-watch-css",
      script: "yarn",
      args: ["watch-css"],
      exec_mode: "fork",
      autorestart: false,
      interpreter: "none",
    },
    
    // Sub Package Watcher
    {
      name: "sub-watch",
      script: "yarn",
      args: ["watch"],
      cwd: "../sub",
      exec_mode: "fork",
      autorestart: false,
      interpreter: "none",
    },
    
    // Canvas Packages Watcher
    {
      name: "canvas-watch",
      script: "yarn",
      args: ["watch"],
      cwd: "../canvas-packages",
      exec_mode: "fork",
      autorestart: false,
      interpreter: "none",
    },
    
    // React Web Bundle Watcher
    {
      name: "react-web-watch",
      script: "yarn",
      args: ["watch"],
      cwd: "../react-web-bundle",
      exec_mode: "fork",
      autorestart: false,
      interpreter: "none",
    },
    
    // Live Frame Watcher
    {
      name: "live-frame-watch",
      script: "yarn",
      args: ["watch"],
      cwd: "../live-frame",
      exec_mode: "fork",
      autorestart: false,
      interpreter: "none",
    },
    
    // Loader HTML Hydrate Builder
    {
      name: "loader-html-build",
      script: "yarn",
      args: ["build"],
      cwd: "../loader-html-hydrate",
      exec_mode: "fork",
      autorestart: false,
      interpreter: "none",
    },
  ],
};
