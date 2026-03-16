#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

mkdir -p llama_model
mkdir -p models/modelscope
mkdir -p models/huggingface
mkdir -p logs
mkdir -p temp

case "$1" in
  start)
    echo "Starting services..."
    docker compose up -d
    echo "Services started successfully"
    echo ""
    echo "FunASR API: http://localhost:17000"
    echo "Llama Server: http://localhost:17001"
    ;;

  stop)
    echo "Stopping services..."
    docker compose down
    echo "Services stopped successfully"
    ;;

  restart)
    echo "Restarting services..."
    docker compose restart
    echo "Services restarted successfully"
    ;;

  logs)
    if [ -z "$2" ]; then
      docker compose logs -f
    else
      docker compose logs -f "$2"
    fi
    ;;

  status)
    docker compose ps
    ;;

  shell)
    if [ -z "$2" ]; then
      echo "Usage: $0 shell <funasr-api|llama-server>"
      exit 1
    fi
    docker compose exec "$2" /bin/bash
    ;;

  update)
    echo "Pulling latest images..."
    docker compose pull
    echo "Images updated. Restart services with: $0 restart"
    ;;

  *)
    echo "Usage: $0 {start|stop|restart|logs|status|shell|update}"
    echo ""
    echo "Commands:"
    echo "  start    - Start all services"
    echo "  stop     - Stop all services"
    echo "  restart  - Restart all services"
    echo "  logs     - View logs (all services or specify service: logs funasr-api)"
    echo "  status   - Show service status"
    echo "  shell    - Enter container shell (specify service: shell llama-server)"
    echo "  update   - Pull latest images"
    echo ""
    echo "Services:"
    echo "  funasr-api   - FunASR API service on port 17000"
    echo "  llama-server - Llama.cpp server on port 17001"
    exit 1
    ;;
esac
