use axum::{extract::State, Json};
use serde::Serialize;

use crate::db::queries;
use crate::error::AppError;
use crate::models::{OrderRecord, TakerIntent};
use crate::services::scoring::{
    aggregate_orders, score_order, OrderScoreInput, ScoredOrderResult, ScoringAction,
};
use crate::state::AppState;

/// Response body for POST /match.
#[derive(Debug, Serialize)]
pub struct MatchResponse {
    pub matches: Vec<MatchedOrder>,
    pub total_available_bps: u64,
    pub fully_covered: bool,
}

/// A single matched order in the response.
#[derive(Debug, Serialize)]
pub struct MatchedOrder {
    pub order: OrderRecord,
    pub score: u64,
    pub available_bps: u64,
    /// How much of this order to fill for the intent.
    pub fill_bps: u64,
}

/// POST /match — Match a taker intent against available orders.
pub async fn match_intent(
    State(state): State<AppState>,
    Json(intent): Json<TakerIntent>,
) -> Result<Json<MatchResponse>, AppError> {
    // 1. Validate intent
    if intent.bps == 0 {
        return Err(AppError::BadRequest("bps must be > 0".to_string()));
    }
    if intent.inscription_id.is_empty() {
        return Err(AppError::BadRequest(
            "inscription_id must be non-empty".to_string(),
        ));
    }

    // 2. Query open orders for the inscription
    let now_epoch = chrono::Utc::now().timestamp();
    let candidates =
        queries::query_open_orders(&state.db, &intent.inscription_id, now_epoch).await?;

    if candidates.is_empty() {
        return Ok(Json(MatchResponse {
            matches: vec![],
            total_available_bps: 0,
            fully_covered: false,
        }));
    }

    // 3. Convert to scoring inputs and score each order
    let scoring_action = match intent.action {
        crate::models::ActionType::Borrow => ScoringAction::Borrow,
        crate::models::ActionType::Lend => ScoringAction::Lend,
    };

    let scored: Vec<(usize, ScoredOrderResult)> = candidates
        .iter()
        .enumerate()
        .map(|(idx, record)| {
            let rate_bps = record.bps.parse::<u64>().unwrap_or(0);
            let total_bps = record.bps.parse::<u64>().unwrap_or(0);
            let filled_bps = record.filled_bps.parse::<u64>().unwrap_or(0);

            let input = OrderScoreInput {
                rate_bps,
                total_bps,
                filled_bps,
            };

            let score = score_order(&input, &scoring_action, intent.bps);
            let available_bps = total_bps.saturating_sub(filled_bps);

            (
                idx,
                ScoredOrderResult {
                    index: idx,
                    score,
                    available_bps,
                },
            )
        })
        .collect();

    // 4. Aggregate for coverage
    let scored_results: Vec<ScoredOrderResult> = scored.iter().map(|(_, s)| s.clone()).collect();
    let aggregated = aggregate_orders(scored_results, intent.bps);

    if aggregated.is_empty() {
        return Ok(Json(MatchResponse {
            matches: vec![],
            total_available_bps: 0,
            fully_covered: false,
        }));
    }

    // 5. Reserve selected orders
    let order_ids: Vec<uuid::Uuid> = aggregated
        .iter()
        .map(|s| candidates[s.index].id)
        .collect();

    let reserved_ids =
        queries::reserve_orders(&state.db, &order_ids, state.config.reservation_ttl_secs).await?;

    // 6. Build response — only include orders that were actually reserved
    let mut remaining_intent = intent.bps;
    let mut matches = Vec::new();
    let mut total_available: u64 = 0;

    for scored_order in &aggregated {
        let order = &candidates[scored_order.index];

        // Only include if reservation succeeded
        if !reserved_ids.contains(&order.id) {
            continue;
        }

        let available = scored_order.available_bps;
        let fill_bps = available.min(remaining_intent);
        remaining_intent = remaining_intent.saturating_sub(fill_bps);
        total_available = total_available.saturating_add(available);

        matches.push(MatchedOrder {
            order: order.clone(),
            score: scored_order.score,
            available_bps: available,
            fill_bps,
        });
    }

    let fully_covered = total_available >= intent.bps;

    Ok(Json(MatchResponse {
        matches,
        total_available_bps: total_available,
        fully_covered,
    }))
}
