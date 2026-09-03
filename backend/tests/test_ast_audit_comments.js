const assert = require('assert');
const { AstAuditService } = require('../dist/services/astAuditService');

const codeWithComments = `
package com.example.service;

import java.time.Clock;
import java.math.BigDecimal;

/**
 * Service to calculate fees.
 * Note: do not use double amount or float balance here.
 * Note: this is not synchronized on carrier threads.
 */
public class PaymentService {
    private final Clock clock;

    public PaymentService(Clock clock) {
        this.clock = clock;
    }

    public BigDecimal process(BigDecimal amount) {
        // System.currentTimeMillis() was previously used here
        // double cost = 100.0;
        String logMsg = "synchronized lock acquired for double fee";
        return amount;
    }
}
`;

const result = AstAuditService.audit(codeWithComments);
console.log('Violations count:', result.violations.length);
if (result.violations.length > 0) {
    console.error('Unexpected violations:', result.violations);
}
assert.strictEqual(result.violations.length, 0, 'Expected 0 violations in commented code');
assert.strictEqual(result.isClean, true, 'Expected code to be clean');
console.log('✅ PASS: AstAuditService successfully stripped comments and strings without false positives!');
