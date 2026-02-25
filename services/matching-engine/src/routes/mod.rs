pub mod health;
pub mod match_intent;
pub mod orders;
pub mod webhooks;

use axum::{
    routing::{get, post},
    Router,
};
use tower_http::trace::TraceLayer;

use crate::state::AppState;

/// Build the application router with all route groups.
pub fn router(state: AppState) -> Router {
    Router::new()
        // Health
        .route("/health", get(health::health))
        // Order management (Plan 03)
        .route("/orders", post(orders::submit_order))
        .route("/orders/{id}", get(orders::get_order))
        .route("/orders/{id}/cancel", post(orders::soft_cancel_order))
        // Match intent (Plan 04)
        .route("/match", post(match_intent::match_intent))
        // Webhooks (Plan 04)
        .route("/webhooks/events", post(webhooks::handle_webhook))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
