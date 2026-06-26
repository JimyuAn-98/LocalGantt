#!/bin/bash
set -e

echo "Starting Flask on 0.0.0.0:1258..."
python app.py &

echo "Starting MCP Server on 0.0.0.0:1259..."
exec python mcp_server.py --transport http --host 0.0.0.0 --port 1259
