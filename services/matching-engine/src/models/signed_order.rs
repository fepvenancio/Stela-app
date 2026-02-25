use serde::{Deserialize, Serialize};

/// Rust representation of the Cairo SignedOrder struct.
/// Field order matches the SNIP-12 canonical order exactly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedOrder {
    /// Maker's StarkNet contract address (hex string).
    pub maker: String,
    /// Allowed taker address. "0x0" means any taker can fill.
    pub allowed_taker: String,
    /// Inscription ID as decimal string (u256).
    pub inscription_id: String,
    /// Basis points as decimal string (u256).
    pub bps: String,
    /// Expiry unix timestamp.
    pub deadline: u64,
    /// Unique nonce as hex string (felt252).
    pub nonce: String,
    /// Minimum fill basis points as decimal string (u256).
    pub min_fill_bps: String,
}

/// Request body for POST /orders.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitOrderRequest {
    pub order: SignedOrder,
    /// ECDSA signature as [r, s] hex strings.
    pub signature: [String; 2],
}
