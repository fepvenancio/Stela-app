use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{OrderRecord, SubmitOrderRequest};
use crate::services::order_store;
use crate::state::AppState;

/// POST /orders — Submit a signed order with signature verification.
pub async fn submit_order(
    State(state): State<AppState>,
    Json(req): Json<SubmitOrderRequest>,
) -> Result<(StatusCode, Json<OrderRecord>), AppError> {
    let record = order_store::submit_order(&state, &req.order, &req.signature).await?;
    Ok((StatusCode::CREATED, Json(record)))
}

/// GET /orders/:id — Retrieve an order by UUID.
pub async fn get_order(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<OrderRecord>, AppError> {
    let record = order_store::get_order(&state, id).await?;
    Ok(Json(record))
}

/// Request body for soft-cancel.
#[derive(Debug, Deserialize)]
pub struct CancelRequest {
    pub maker: String,
}

/// POST /orders/:id/cancel — Soft-cancel an order (maker only).
pub async fn soft_cancel_order(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<CancelRequest>,
) -> Result<StatusCode, AppError> {
    order_store::cancel_order(&state, id, &req.maker).await?;
    Ok(StatusCode::NO_CONTENT)
}
