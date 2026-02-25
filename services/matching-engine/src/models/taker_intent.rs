use serde::{Deserialize, Serialize};

/// The action a taker wants to perform.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ActionType {
    Borrow,
    Lend,
}

/// A taker's intent to match against available orders.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TakerIntent {
    /// Whether the taker wants to borrow or lend.
    pub action: ActionType,
    /// Desired amount in basis points.
    pub bps: u64,
    /// Which inscription/asset pair to match against.
    pub inscription_id: String,
}

/// A single order with its computed score in a match response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoredOrder {
    pub order_id: uuid::Uuid,
    pub score: u64,
    pub available_bps: u64,
}

/// The result of a match query.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchResult {
    pub matches: Vec<ScoredOrder>,
    pub total_available_bps: u64,
    pub fully_covered: bool,
}
