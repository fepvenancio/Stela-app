use serde::{Deserialize, Serialize};

/// Maximum basis points (100%).
pub const MAX_BPS: u64 = 10_000;

/// Lightweight input for scoring — avoids depending on DB types.
#[derive(Debug, Clone)]
pub struct OrderScoreInput {
    pub rate_bps: u64,
    pub total_bps: u64,
    pub filled_bps: u64,
}

/// A scored order with its index in the candidate list.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoredOrderResult {
    pub index: usize,
    pub score: u64,
    pub available_bps: u64,
}

/// Action type for scoring context (local to avoid coupling with models).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ScoringAction {
    Borrow,
    Lend,
}

/// Compute a composite score for an order relative to a taker intent.
///
/// Score range: [0, 10_000]. Higher is better for the taker.
/// - Rate component (80% weight): Borrow prefers lower rates, Lend prefers higher.
/// - Fill-fit component (20% weight): Perfect fit scores max, partial proportional.
pub fn score_order(order: &OrderScoreInput, action: &ScoringAction, intent_bps: u64) -> u64 {
    let available = order.total_bps.saturating_sub(order.filled_bps);

    if available == 0 || intent_bps == 0 {
        return 0;
    }

    let rate_score = match action {
        ScoringAction::Borrow => MAX_BPS.saturating_sub(order.rate_bps),
        ScoringAction::Lend => order.rate_bps,
    };

    let fill_fit = if available >= intent_bps {
        MAX_BPS
    } else {
        available.saturating_mul(MAX_BPS) / intent_bps
    };

    (rate_score * 8 + fill_fit * 2) / 10
}

/// Greedily aggregate orders by score until the intent amount is covered.
///
/// Returns the minimal prefix of sorted candidates that covers `intent_bps`.
/// If all candidates combined are insufficient, returns all of them (best effort).
pub fn aggregate_orders(
    mut candidates: Vec<ScoredOrderResult>,
    intent_bps: u64,
) -> Vec<ScoredOrderResult> {
    if intent_bps == 0 {
        return vec![];
    }

    candidates.sort_by(|a, b| b.score.cmp(&a.score));

    let mut accumulated: u64 = 0;
    let mut result = Vec::new();

    for candidate in candidates {
        if accumulated >= intent_bps {
            break;
        }
        accumulated = accumulated.saturating_add(candidate.available_bps);
        result.push(candidate);
    }

    result
}
