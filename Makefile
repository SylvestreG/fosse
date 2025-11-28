.PHONY: help install dev dev-classic dev-static build test clean db-migrate db-reset backend-dev frontend-dev frontend-watch

help:
	@echo "Fosse - Makefile commands"
	@echo ""
	@echo "  make install      - Install all dependencies (backend + frontend)"
	@echo "  make dev          - Run in static mode with auto-rebuild (RECOMMENDED)"
	@echo "  make dev-classic  - Run with HMR (can have WebSocket errors)"
	@echo "  make dev-static   - Alias for 'make dev'"
	@echo "  make build        - Build production version"
	@echo "  make backend-dev  - Run backend only"
	@echo "  make frontend-dev - Run frontend with Vite HMR"
	@echo "  make frontend-watch - Run frontend build watcher"
	@echo "  make test         - Run all tests"
	@echo "  make db-migrate   - Run database migrations"
	@echo "  make db-reset     - Reset database and run migrations"
	@echo "  make clean        - Clean build artifacts"

install:
	@echo "Installing backend dependencies..."
	cd backend && cargo build
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "Installation complete!"

backend-dev:
	@echo "Starting backend server..."
	cd backend && RUST_LOG=info cargo run

frontend-dev:
	@echo "Starting frontend development server with HMR..."
	cd frontend && npm run dev

frontend-watch:
	@echo "Starting frontend build watcher..."
	cd frontend && npm run build:watch

dev-classic:
	@echo "Starting both backend and frontend with HMR (can have WebSocket errors)..."
	@make -j2 backend-dev frontend-dev

dev-static:
	@echo "Starting in static mode with auto-rebuild..."
	@echo "Backend serves static files on http://localhost:8080"
	@echo "Frontend rebuilds automatically on changes"
	@./dev-static.sh

dev: dev-static

build:
	@echo "Building production version..."
	@./build-static.sh

test:
	@echo "Running backend tests..."
	cd backend && cargo test
	@echo "All tests passed!"

db-migrate:
	@echo "Running database migrations..."
	cd backend && cargo run

db-reset:
	@echo "Resetting database..."
	@echo "This will drop all tables and re-run migrations"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		echo ""; \
		cd backend && cargo run; \
	fi

clean:
	@echo "Cleaning build artifacts..."
	cd backend && cargo clean
	cd frontend && rm -rf node_modules dist
	@echo "Clean complete!"

.DEFAULT_GOAL := help

