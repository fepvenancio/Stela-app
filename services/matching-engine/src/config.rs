use anyhow::{Context, Result};

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub rpc_url: String,
    pub chain_id: String,
    pub port: u16,
    pub webhook_secret: String,
    pub reservation_ttl_secs: u64,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            database_url: std::env::var("DATABASE_URL")
                .context("DATABASE_URL must be set")?,
            rpc_url: std::env::var("RPC_URL")
                .context("RPC_URL must be set")?,
            chain_id: std::env::var("CHAIN_ID")
                .unwrap_or_else(|_| "SN_SEPOLIA".to_string()),
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "3001".to_string())
                .parse()
                .context("PORT must be a valid u16")?,
            webhook_secret: std::env::var("WEBHOOK_SECRET")
                .context("WEBHOOK_SECRET must be set")?,
            reservation_ttl_secs: std::env::var("RESERVATION_TTL_SECS")
                .unwrap_or_else(|_| "120".to_string())
                .parse()
                .context("RESERVATION_TTL_SECS must be a valid u64")?,
        })
    }
}
