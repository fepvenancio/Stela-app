mod config;
mod db;
mod error;
mod models;
mod routes;
mod services;
mod state;

use config::Config;
use sqlx::postgres::PgPoolOptions;
use starknet::providers::jsonrpc::{HttpTransport, JsonRpcClient};
use starknet::providers::Url;
use std::sync::Arc;
use tracing_subscriber::EnvFilter;

use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env file (optional — not an error if missing)
    let _ = dotenvy::dotenv();

    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,matching_engine=debug")),
        )
        .init();

    // Load configuration
    let config = Config::from_env()?;
    tracing::info!(port = config.port, chain = %config.chain_id, "Loading configuration");

    // Create PostgreSQL connection pool
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await?;

    tracing::info!("Connected to PostgreSQL");

    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await?;
    tracing::info!("Migrations applied");

    // Create StarkNet JSON-RPC provider
    let starknet_provider = JsonRpcClient::new(HttpTransport::new(
        Url::parse(&config.rpc_url)?,
    ));

    // Build application state
    let state = AppState {
        db: pool,
        starknet_provider: Arc::new(starknet_provider),
        config: Arc::new(config.clone()),
    };

    // Build router
    let app = routes::router(state);

    // Bind and serve
    let addr = format!("0.0.0.0:{}", config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("Matching engine listening on {addr}");

    axum::serve(listener, app).await?;

    Ok(())
}
