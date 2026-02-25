use crate::config::Config;
use sqlx::PgPool;
use starknet::providers::jsonrpc::{HttpTransport, JsonRpcClient};
use std::sync::Arc;

/// Shared application state passed to all route handlers via axum's State extractor.
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub starknet_provider: Arc<JsonRpcClient<HttpTransport>>,
    pub config: Arc<Config>,
}
