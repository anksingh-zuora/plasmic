# PM2 Development Setup

This setup replicates the `yarn dev` environment using PM2 with multiple workers for better performance and process management.

## Quick Start

```bash
# Start all services with PM2
yarn dev:pm2

# Check status
yarn dev:pm2:status

# View logs
yarn dev:pm2:logs

# Stop all services
yarn dev:pm2:stop

# Restart all services
yarn dev:pm2:restart
```

## Services Running

| Service | Port | Instances | Purpose |
|---------|------|-----------|---------|
| backend | 3004 | 1 | API server |
| socket-server | 3020 | 2 | WebSocket server |
| dev-server | 3003 | 1 | Frontend development server |
| host-server | 3005 | 1 | Component preview server |
| wab-watch-css | - | 1 | CSS compilation watcher |
| sub-watch | - | 1 | Sub package watcher |
| canvas-watch | - | 1 | Canvas packages watcher |
| react-web-watch | - | 1 | React web bundle watcher |
| live-frame-watch | - | 1 | Live frame watcher |
| loader-html-build | - | 1 | Loader HTML hydrate builder |

## Key Differences from `yarn dev`

1. **Multiple Socket Server Instances**: 2 instances for better WebSocket handling
2. **Process Management**: PM2 handles process monitoring, restarting, and logging
3. **Better Resource Management**: Each service runs in its own process
4. **Centralized Logging**: All logs available through `pm2 logs`

## Configuration

The configuration is in `pm2-dev-simple.config.js` and can be customized:

- **instances**: Number of worker processes
- **exec_mode**: "fork" for single instances, "cluster" for multiple instances
- **autorestart**: Whether to restart on crash
- **env**: Environment variables for each service

## Troubleshooting

```bash
# Check if PM2 is installed
pm2 --version

# Install PM2 globally if needed
npm install -g pm2

# View detailed logs for specific service
pm2 logs backend

# Monitor resource usage
pm2 monit

# Delete all PM2 processes
pm2 delete all
```

## Next Steps

After verifying this works, we can:
1. Add more backend workers
2. Configure load balancing
3. Add monitoring and metrics
4. Set up auto-scaling based on load
