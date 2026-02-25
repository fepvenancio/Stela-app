use axum::{
    extract::State,
    http::HeaderMap,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::db::queries;
use crate::error::AppError;
use crate::state::AppState;

/// Incoming webhook payload from Apibara indexer.
#[derive(Debug, Deserialize)]
pub struct WebhookPayload {
    pub events: Vec<WebhookEvent>,
}

/// A single on-chain event.
#[derive(Debug, Deserialize)]
pub struct WebhookEvent {
    pub event_type: String,
    pub order_hash: Option<String>,
    pub maker: Option<String>,
    pub fill_bps: Option<String>,
    pub total_filled: Option<String>,
    pub min_nonce: Option<String>,
}

/// Response for webhook processing.
#[derive(Debug, Serialize)]
pub struct WebhookResponse {
    pub ok: bool,
    pub processed: usize,
}

/// POST /webhooks/events — Receive on-chain events from Apibara indexer.
pub async fn handle_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<WebhookPayload>,
) -> Result<Json<WebhookResponse>, AppError> {
    // 1. Authenticate via Bearer token (constant-time comparison)
    let auth_header = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let expected = format!("Bearer {}", state.config.webhook_secret);
    if !constant_time_eq(auth_header.as_bytes(), expected.as_bytes()) {
        return Err(AppError::Unauthorized);
    }

    // 2. Process events
    let mut processed: usize = 0;

    for event in &payload.events {
        match event.event_type.as_str() {
            "order_filled" => {
                if let (Some(order_hash), Some(total_filled)) =
                    (&event.order_hash, &event.total_filled)
                {
                    // Update filled_bps
                    if let Err(e) =
                        queries::update_filled_bps(&state.db, order_hash, total_filled).await
                    {
                        tracing::warn!(
                            order_hash = %order_hash,
                            error = %e,
                            "Failed to update filled_bps for order_filled event"
                        );
                        continue;
                    }

                    // Check if fully filled: compare total_filled with the order's bps
                    if let Ok(Some(record)) =
                        queries::get_order_by_hash(&state.db, order_hash).await
                    {
                        if total_filled == &record.bps {
                            if let Err(e) =
                                queries::update_order_status(&state.db, order_hash, "filled").await
                            {
                                tracing::warn!(
                                    order_hash = %order_hash,
                                    error = %e,
                                    "Failed to update status to filled"
                                );
                            }
                        }
                    }

                    processed += 1;
                } else {
                    tracing::warn!(
                        "order_filled event missing required fields (order_hash, total_filled)"
                    );
                }
            }

            "order_cancelled" => {
                if let Some(order_hash) = &event.order_hash {
                    if let Err(e) =
                        queries::update_order_status(&state.db, order_hash, "cancelled").await
                    {
                        tracing::warn!(
                            order_hash = %order_hash,
                            error = %e,
                            "Failed to update status for order_cancelled event"
                        );
                        continue;
                    }
                    processed += 1;
                } else {
                    tracing::warn!("order_cancelled event missing order_hash field");
                }
            }

            "orders_bulk_cancelled" => {
                if let (Some(maker), Some(min_nonce)) = (&event.maker, &event.min_nonce) {
                    match queries::bulk_cancel_by_maker_nonce(&state.db, maker, min_nonce).await {
                        Ok(count) => {
                            tracing::info!(
                                maker = %maker,
                                min_nonce = %min_nonce,
                                cancelled = count,
                                "Bulk cancelled orders"
                            );
                            processed += 1;
                        }
                        Err(e) => {
                            tracing::warn!(
                                maker = %maker,
                                error = %e,
                                "Failed to bulk cancel orders"
                            );
                        }
                    }
                } else {
                    tracing::warn!(
                        "orders_bulk_cancelled event missing required fields (maker, min_nonce)"
                    );
                }
            }

            unknown => {
                tracing::warn!(event_type = %unknown, "Unknown webhook event type, skipping");
            }
        }
    }

    Ok(Json(WebhookResponse {
        ok: true,
        processed,
    }))
}

/// Constant-time byte comparison to prevent timing attacks on the webhook secret.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }

    let mut result: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        result |= x ^ y;
    }
    result == 0
}
