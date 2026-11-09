# 03: [Tracer-Bullet] Legacy Machine Coding (mc_*) Starter Skeletons & TDD Stubs Remediation

**Archetype:** Tracer-Bullet
**Blocked by:** #01
**Status:** ready-for-agent

## What to Build
Remediate the 13 legacy machine coding challenges in `backend/src/services/additionalChallenges.ts` and `lab_virtual_threads_pinning` in `backend/src/services/challengeSeedData.ts`.
For each challenge, the student-editable starter workspace file must NOT contain the full working implementation.
Replace method bodies with:
`throw new UnsupportedOperationException("Not implemented yet");` (or return empty structures/default values where required for compilation), while preserving:
- Class declarations and package names.
- Public method signatures, parameter names, and return types.
- Required field declarations and constructor shapes.
- Javadoc and `// TODO` implementation instructions.

Challenges to remediate:
1. `mc_key_value_cache_lru` (`LruCache.java`)
2. `mc_discount_promo_engine` (`DiscountEngine.java`)
3. `mc_circuit_breaker_resilience` (`CircuitBreaker.java`)
4. `mc_inventory_reservation_deadlock_free` (`InventoryService.java`)
5. `mc_thread_safe_event_bus` (`EventBus.java`)
6. `mc_notification_dedup_pipeline` (`NotificationDeduplicator.java`)
7. `mc_task_scheduler_priority_queue` (`PriorityTaskScheduler.java`)
8. `mc_parking_lot_manager` (`ParkingLot.java`)
9. `mc_order_state_machine` (`OrderStateMachine.java`)
10. `mc_url_shortener_analytics` (`UrlShortener.java`)
11. `mc_tagged_metric_aggregator` (`MetricAggregator.java`)
12. `mc_concurrent_leaderboard` (`Leaderboard.java`)
13. `mc_elevator_control_system` (`ElevatorController.java`)
14. `lab_virtual_threads_pinning` in `challengeSeedData.ts`

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/additionalChallenges.ts` and `backend/src/services/challengeSeedData.ts`
- **Dependencies**: TypeScript compilation (`npx tsc --noEmit`).
- **Verification Command**: `node backend/tests/verify_starter_workspaces_integrity.js --filter=mc`

## Embedded Contract Slice & Invariants
- Class and method contracts must exactly match the existing unit tests in `src/test/java/`.
- File length of `backend/src/services/additionalChallenges.ts` should be monitored or split if exceeding cognitive limit.

## Acceptance Criteria
- [ ] All 14 challenges have method stubs throwing `UnsupportedOperationException`.
- [ ] TypeScript typecheck passes (`npx tsc --noEmit`).
- [ ] Passes integrity verifier for `mc_*` katas.
