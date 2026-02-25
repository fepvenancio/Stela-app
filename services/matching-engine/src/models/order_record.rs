use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;
use uuid::Uuid;

/// Database row for a signed order.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OrderRecord {
    pub id: Uuid,
    pub order_hash: String,
    pub maker: String,
    pub allowed_taker: String,
    pub inscription_id: String,
    pub bps: String,
    pub deadline: i64,
    pub nonce: String,
    pub min_fill_bps: String,
    pub signature_r: String,
    pub signature_s: String,
    pub status: String,
    pub filled_bps: String,
    pub reserved_until: Option<chrono::NaiveDateTime>,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

/// The six possible order statuses.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrderStatus {
    Open,
    Reserved,
    SoftCancelled,
    Cancelled,
    Filled,
    Expired,
}

impl fmt::Display for OrderStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            OrderStatus::Open => write!(f, "open"),
            OrderStatus::Reserved => write!(f, "reserved"),
            OrderStatus::SoftCancelled => write!(f, "soft_cancelled"),
            OrderStatus::Cancelled => write!(f, "cancelled"),
            OrderStatus::Filled => write!(f, "filled"),
            OrderStatus::Expired => write!(f, "expired"),
        }
    }
}

impl FromStr for OrderStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "open" => Ok(OrderStatus::Open),
            "reserved" => Ok(OrderStatus::Reserved),
            "soft_cancelled" => Ok(OrderStatus::SoftCancelled),
            "cancelled" => Ok(OrderStatus::Cancelled),
            "filled" => Ok(OrderStatus::Filled),
            "expired" => Ok(OrderStatus::Expired),
            other => Err(format!("Unknown order status: {other}")),
        }
    }
}
