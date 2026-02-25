pub mod health;

use axum::{
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use tower_http::trace::TraceLayer;

use crate::state::AppState;

/// Build the application router with all route groups.
pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health::health))
        // Stubs for routes implemented in Plans 03 and 04
        .route("/orders", post(stub_not_implemented))
        .route("/orders/{id}", get(stub_not_implemented))
        .route("/orders/{id}/cancel", post(stub_not_implemented))
        .route("/match", post(stub_not_implemented))
        .route("/webhooks/events", post(stub_not_implemented))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// Stub handler returning 501 Not Implemented.
async fn stub_not_implemented() -> (StatusCode, Json<Value>) {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({ "error": "Not implemented" })),
    )
}
