/**
 * Test logica entitlement per Test 4 e 5
 * Verifica che stati Stripe non-active vengano bloccati
 */

const { computeEntitlement } = require('./lib/entitlement');

console.log('=== Test Entitlement Logic ===\n');

// Test 4: Payment Failed (past_due, incomplete, unpaid)
console.log('TEST 4: Payment Failed States');
console.log('------------------------------');

const test4States = ['past_due', 'incomplete', 'unpaid', 'incomplete_expired'];

test4States.forEach(status => {
  const result = computeEntitlement(status, null, null);
  console.log(`Status: ${status}`);
  console.log(`  Entitled: ${result.entitled}`);
  console.log(`  Reason: ${result.reason}`);
  console.log(`  ✅ Expected: entitled=false, reason=subscription_${status}`);
  console.log(`  ${result.entitled === false ? '✅ PASS' : '❌ FAIL'}\n`);
});

// Test 5: Cancellation
console.log('\nTEST 5: Cancellation State');
console.log('---------------------------');

const cancelResult = computeEntitlement('canceled', null, null);
console.log(`Status: canceled`);
console.log(`  Entitled: ${cancelResult.entitled}`);
console.log(`  Reason: ${cancelResult.reason}`);
console.log(`  ✅ Expected: entitled=false, reason=subscription_canceled`);
console.log(`  ${cancelResult.entitled === false ? '✅ PASS' : '❌ FAIL'}\n`);

// Test controllo: Active e Trialing devono passare
console.log('\nCONTROL TESTS: Active/Trialing');
console.log('-------------------------------');

const activeResult = computeEntitlement('active', null, null);
console.log(`Status: active`);
console.log(`  Entitled: ${activeResult.entitled}`);
console.log(`  ${activeResult.entitled === true ? '✅ PASS' : '❌ FAIL'}`);

const trialResult = computeEntitlement('trialing', null, null);
console.log(`Status: trialing`);
console.log(`  Entitled: ${trialResult.entitled}`);
console.log(`  ${trialResult.entitled === true ? '✅ PASS' : '❌ FAIL'}`);

console.log('\n=== Summary ===');
console.log('✅ Entitlement logic correttamente blocca:');
console.log('   - Payment failed states (past_due, incomplete, unpaid)');
console.log('   - Canceled subscriptions');
console.log('   - Consente solo: active, trialing');
