const assert = require('assert');
const { db } = require('../dist/services/db');
const { 
  getKnowledgeRadarData, 
  resetGapForPractice, 
  getUserProfile, 
  updateUserProfile,
  recordNewErrorGap 
} = require('../dist/services/vectorMemoryService');

async function runTest() {
  console.log('🧪 Starting Multi-Tenant Memory & Radar Isolation Verification...');

  const userA = `test_user_a_${Date.now()}`;
  const userB = `test_user_b_${Date.now()}`;

  try {
    // 1. Record gap for User A
    const gapIdA = await recordNewErrorGap({
      userId: userA,
      questionId: 'q_test_spring_tx',
      topic: 'Spring Framework',
      subtopic: 'Transaction Propagation',
      errorConcept: 'Непонимание REQUIRES_NEW в самовызове метода',
      initialDeficit: 0.95
    });

    console.log(`✅ Created error gap for ${userA}: ${gapIdA}`);

    // 2. Fetch Knowledge Radar for User A
    const radarA = getKnowledgeRadarData(userA);
    assert.strictEqual(radarA.activeDeficits.length, 1, 'User A should have 1 active deficit');
    assert.strictEqual(radarA.activeDeficits[0].id, gapIdA, 'User A should see their own gap');

    // 3. Fetch Knowledge Radar for User B (Must be EMPTY - No IDOR Leak)
    const radarB = getKnowledgeRadarData(userB);
    assert.strictEqual(radarB.activeDeficits.length, 0, 'User B must NOT see User A deficits (IDOR Isolation Failed)');
    console.log('✅ PASS: Knowledge Radar strictly isolated per userId! No IDOR leak.');

    // 4. Test User Profile Isolation
    updateUserProfile(userA, {
      candidateName: 'Алексей Смирнов',
      targetSeniority: 'lead',
      primaryStack: 'Java 21, Spring Boot 3.4, Kafka',
      preferredTone: 'rigorous'
    });

    updateUserProfile(userB, {
      candidateName: 'Мария Иванова',
      targetSeniority: 'middle',
      primaryStack: 'Kotlin, Ktor, PostgreSQL',
      preferredTone: 'supportive'
    });

    const profileA = getUserProfile(userA);
    const profileB = getUserProfile(userB);

    assert.strictEqual(profileA.candidateName, 'Алексей Смирнов');
    assert.strictEqual(profileA.targetSeniority, 'lead');
    assert.strictEqual(profileB.candidateName, 'Мария Иванова');
    assert.strictEqual(profileB.targetSeniority, 'middle');
    console.log('✅ PASS: User profiles strictly isolated per userId!');

    // 5. Test resetGapForPractice isolation
    const resetByWrongUser = resetGapForPractice(gapIdA, userB);
    assert.strictEqual(resetByWrongUser, false, 'User B must NOT be able to reset User A gap');

    const resetByCorrectUser = resetGapForPractice(gapIdA, userA);
    assert.strictEqual(resetByCorrectUser, true, 'User A should be able to reset their own gap');
    console.log('✅ PASS: resetGapForPractice permissions verified!');

  } finally {
    // Cleanup test records
    db.prepare('DELETE FROM candidate_error_vectors WHERE user_id IN (?, ?)').run(userA, userB);
    db.prepare('DELETE FROM user_profile_settings WHERE id IN (?, ?)').run(userA, userB);
    console.log('🧹 Cleaned up test data.');
  }

  console.log('🎉 ALL MULTI-TENANT ISOLATION TESTS PASSED WITH FLYING COLORS!');
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
