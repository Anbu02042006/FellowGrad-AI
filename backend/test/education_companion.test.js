/**
 * Education-Focused Companion Test Suite
 *
 * Verifies all 12 core product requirements and test cases:
 * 1. "Coimbatore la engineering colleges sollu"
 * 2. "Coimbatore la CSE colleges enna?"
 * 3. "PSG admission open ah?"
 * 4. "CIT 2026 admission details"
 * 5. "KCT courses enna?"
 * 6. "Java OOP explain pannu"
 * 7. "DBMS normalization teach me"
 * 8. "Tomorrow exam iruku enna padikanum?"
 * 9. "What did I study yesterday?"
 * 10. "Coimbatore college fees?"
 * 11. "latest admission information"
 * 12. "weather in Coimbatore" (Strict education redirection)
 */

const assert = require('assert');
const { COIMBATORE_COLLEGES } = require('../src/services/education/coimbatoreData');
const { EducationIntentService, INTENT_CATEGORIES } = require('../src/services/education/educationIntentService');
const CollegeService = require('../src/services/education/collegeService');
const CourseService = require('../src/services/education/courseService');
const AdmissionService = require('../src/services/education/admissionService');
const { EducationSourceService, SOURCE_PRIORITY } = require('../src/services/education/educationSourceService');
const EducationSearchService = require('../src/services/education/educationSearchService');

async function runEducationTestSuite() {
  console.log('=============================================================');
  console.log('🧪 FellowGrad AI Strictly Education-Focused Companion Tests');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  };

  // --------------------------------------------------------------------------
  console.log('--- Phase 1: Section 32 Core Test Cases ---');
  // --------------------------------------------------------------------------

  // Test 1: "Coimbatore la engineering colleges sollu"
  await test('1. Coimbatore engineering colleges query detects intent and returns verified colleges', async () => {
    const query = 'Coimbatore la engineering colleges sollu';
    const analysis = EducationIntentService.analyzeQuery(query);
    assert.strictEqual(analysis.isEducation, true);
    assert.strictEqual(analysis.isCoimbatoreFocus, true);
    assert.strictEqual(analysis.isTanglish, true);
    assert.strictEqual(analysis.intent, INTENT_CATEGORIES.COLLEGE_SEARCH);

    const colleges = CollegeService.getEngineeringColleges();
    assert.ok(colleges.length >= 6, 'Should find multiple verified engineering colleges in Coimbatore');
    const names = colleges.map((c) => c.shortName);
    assert.ok(names.includes('PSG Tech'), 'Includes PSG Tech');
    assert.ok(names.includes('CIT'), 'Includes CIT');
    assert.ok(names.includes('GCT'), 'Includes GCT');
    assert.ok(names.includes('KCT'), 'Includes KCT');

    const result = await EducationSearchService.retrieveContext(query);
    assert.strictEqual(result.isEducation, true);
    assert.ok(result.groundedContext.includes('VERIFIED COIMBATORE INSTITUTIONS'));
  });

  // Test 2: "Coimbatore la CSE colleges enna?"
  await test('2. Coimbatore CSE colleges query matches CSE offerings across verified institutions', async () => {
    const query = 'Coimbatore la CSE colleges enna?';
    const analysis = EducationIntentService.analyzeQuery(query);
    assert.strictEqual(analysis.isEducation, true);
    assert.strictEqual(analysis.isCoimbatoreFocus, true);
    assert.strictEqual(analysis.intent, INTENT_CATEGORIES.COURSE_SEARCH);
    assert.strictEqual(analysis.extractedCourse, 'CSE');

    const cseColleges = CollegeService.findCollegesByCourse('CSE');
    assert.ok(cseColleges.length >= 5, 'Should identify colleges with CSE');
    const cseNames = cseColleges.map((r) => r.college.shortName);
    assert.ok(cseNames.includes('PSG Tech'));
    assert.ok(cseNames.includes('CIT'));
    assert.ok(cseNames.includes('GCT'));

    const result = await EducationSearchService.retrieveContext(query);
    assert.ok(result.groundedContext.includes('OFFERING CSE IN COIMBATORE'));
  });

  // Test 3: "PSG admission open ah?"
  await test('3. "PSG admission open ah?" grounds in official portal without fabricating dates', async () => {
    const query = 'PSG admission open ah?';
    const analysis = EducationIntentService.analyzeQuery(query);
    assert.strictEqual(analysis.isEducation, true);
    assert.strictEqual(analysis.intent, INTENT_CATEGORIES.ADMISSION);

    const adm = AdmissionService.getAdmissionDetails('PSG Tech');
    assert.strictEqual(adm.found, true);
    assert.strictEqual(adm.shortName, 'PSG Tech');
    assert.ok(adm.applicationUrl.includes('psgtech.edu'));

    const result = await EducationSearchService.retrieveContext(query);
    assert.ok(result.groundedContext.includes('VERIFIED ADMISSION DETAILS FOR PSG Tech'));
    assert.ok(result.groundedContext.includes('official portals'));
  });

  // Test 4: "CIT 2026 admission details"
  await test('4. "CIT 2026 admission details" provides TNEA & official portal info for 2026-27', async () => {
    const query = 'CIT 2026 admission details';
    const analysis = EducationIntentService.analyzeQuery(query);
    assert.strictEqual(analysis.isEducation, true);
    assert.strictEqual(analysis.isCurrentInfoQuery, true);
    assert.strictEqual(analysis.intent, INTENT_CATEGORIES.ADMISSION);

    const adm = AdmissionService.getAdmissionDetails('CIT');
    assert.strictEqual(adm.found, true);
    assert.strictEqual(adm.shortName, 'CIT');
    assert.strictEqual(adm.academicSession, '2026-27');
    assert.ok(adm.admissionMode.includes('TNEA'));

    const result = await EducationSearchService.retrieveContext(query);
    assert.ok(result.groundedContext.includes('CIT'));
    assert.ok(result.groundedContext.includes('2026-27'));
  });

  // Test 5: "KCT courses enna?"
  await test('5. "KCT courses enna?" retrieves verified UG and PG programs of Kumaraguru', async () => {
    const query = 'KCT courses enna?';
    const analysis = EducationIntentService.analyzeQuery(query);
    assert.strictEqual(analysis.isEducation, true);
    assert.strictEqual(analysis.intent, INTENT_CATEGORIES.COURSE_SEARCH);

    const courses = CourseService.getCoursesByCollege('KCT');
    assert.ok(courses !== null);
    assert.strictEqual(courses.shortName, 'KCT');
    assert.ok(courses.ugCourses.some((c) => c.includes('Computer Science and Engineering')));
    assert.ok(courses.ugCourses.some((c) => c.includes('Mechatronics')));

    const result = await EducationSearchService.retrieveContext(query);
    assert.ok(result.groundedContext.includes('COURSES OFFERED AT KCT'));
  });

  // Test 6: "Java OOP explain pannu"
  await test('6. "Java OOP explain pannu" activates conversational tutoring pedagogy', async () => {
    const query = 'Java OOP explain pannu';
    const analysis = EducationIntentService.analyzeQuery(query);
    assert.strictEqual(analysis.isEducation, true);
    assert.strictEqual(analysis.isTanglish, true);
    assert.strictEqual(analysis.intent, INTENT_CATEGORIES.PROGRAMMING_HELP);

    const result = await EducationSearchService.retrieveContext(query);
    assert.ok(result.groundedContext.includes('ACADEMIC TUTORING MODE'));
    assert.ok(result.groundedContext.includes('Explain concept simply'));
  });

  // Test 7: "DBMS normalization teach me"
  await test('7. "DBMS normalization teach me" triggers interactive subject tutoring mode', async () => {
    const query = 'DBMS normalization teach me';
    const analysis = EducationIntentService.analyzeQuery(query);
    assert.strictEqual(analysis.isEducation, true);
    assert.strictEqual(analysis.intent, INTENT_CATEGORIES.SUBJECT_HELP);

    const result = await EducationSearchService.retrieveContext(query);
    assert.ok(result.groundedContext.includes('ACADEMIC TUTORING MODE'));
  });

  // Test 8: "Tomorrow exam iruku enna padikanum?"
  await test('8. "Tomorrow exam iruku enna padikanum?" triggers study plan and exam preparation mode', async () => {
    const query = 'Tomorrow exam iruku enna padikanum?';
    const analysis = EducationIntentService.analyzeQuery(query);
    assert.strictEqual(analysis.isEducation, true);
    assert.strictEqual(analysis.isTanglish, true);
    assert.strictEqual(analysis.intent, INTENT_CATEGORIES.STUDY_PLAN);

    const result = await EducationSearchService.retrieveContext(query);
    assert.ok(result.groundedContext.includes('STUDY PLAN & EXAM PREPARATION'));
  });

  // Test 9: "What did I study yesterday?"
  await test('9. "What did I study yesterday?" detects historical educational recall intent', async () => {
    const query = 'What did I study yesterday?';
    const analysis = EducationIntentService.analyzeQuery(query);
    assert.strictEqual(analysis.isEducation, true);
    assert.strictEqual(analysis.intent, INTENT_CATEGORIES.HISTORICAL_RECALL);
  });

  // Test 10: "Coimbatore college fees?"
  await test('10. "Coimbatore college fees?" strictly avoids hallucinated numbers and explains quota differences', async () => {
    const query = 'Coimbatore college fees?';
    const analysis = EducationIntentService.analyzeQuery(query);
    assert.strictEqual(analysis.isEducation, true);
    assert.strictEqual(analysis.intent, INTENT_CATEGORIES.FEES);

    const feeInfo = AdmissionService.getFeeInformation('Coimbatore');
    assert.strictEqual(feeInfo.isOfficialFeePublished, false);
    assert.ok(feeInfo.message.includes("couldn't verify the current official fee"));
    assert.ok(feeInfo.message.includes('Government Counselling Quota'));
    assert.ok(feeInfo.message.includes('Management Quota'));

    const result = await EducationSearchService.retrieveContext(query);
    assert.ok(result.groundedContext.includes('FEE POLICY & DISCLAIMER'));
    assert.ok(result.groundedContext.includes("couldn't verify the current official fee"));
  });

  // Test 11: "latest admission information"
  await test('11. "latest admission information" retrieves current 2026-27 Tamil Nadu admission overview', async () => {
    const query = 'latest admission information';
    const analysis = EducationIntentService.analyzeQuery(query);
    assert.strictEqual(analysis.isEducation, true);
    assert.strictEqual(analysis.isCurrentInfoQuery, true);
    assert.strictEqual(analysis.intent, INTENT_CATEGORIES.ADMISSION);

    const adm = AdmissionService.getAdmissionDetails();
    assert.strictEqual(adm.session, '2026-27');
    assert.ok(adm.summary.includes('TNEA'));

    const result = await EducationSearchService.retrieveContext(query);
    assert.ok(result.groundedContext.includes('2026-27 TAMIL NADU ADMISSIONS OVERVIEW'));
  });

  // Test 12: "weather in Coimbatore" (Strict non-education redirection)
  await test('12. "weather in Coimbatore" triggers strict education-only redirection', async () => {
    const query = 'weather in Coimbatore';
    const analysis = EducationIntentService.analyzeQuery(query);
    assert.strictEqual(analysis.isEducation, false, 'Weather must NOT be treated as education');
    assert.strictEqual(analysis.intent, INTENT_CATEGORIES.NON_EDUCATION);
    assert.ok(analysis.redirectMessage, 'Must provide redirection message');
    assert.ok(
      analysis.redirectMessage.includes("I'm focused on education and student-related support"),
      'Must contain standard redirection phrase'
    );

    const result = await EducationSearchService.retrieveContext(query);
    assert.strictEqual(result.isEducation, false);
    assert.ok(result.groundedContext.includes('[STRICT NON-EDUCATION REDIRECT RULE]'));
  });

  // --------------------------------------------------------------------------
  console.log('\n--- Phase 2: Edge Cases, Policies & Source Integrity ---');
  // --------------------------------------------------------------------------

  await test('13. Other non-education queries (stocks, gossip, cricket, shopping) are rejected', () => {
    const offTopicQueries = [
      'Who won yesterday IPL cricket match?',
      'Tell me today stock trading tips',
      'What is the latest celebrity gossip?',
      'Can you book cheap flights to Goa?',
    ];

    for (const q of offTopicQueries) {
      const a = EducationIntentService.analyzeQuery(q);
      assert.strictEqual(a.isEducation, false, `"${q}" should be non-education`);
      assert.strictEqual(a.intent, INTENT_CATEGORIES.NON_EDUCATION);
    }
  });

  await test('14. Education-connected questions (e.g. education minister) are accepted', () => {
    const q = 'Who is the current education minister?';
    const a = EducationIntentService.analyzeQuery(q);
    assert.strictEqual(a.isEducation, true, 'Education minister should be accepted as education-connected');
  });

  await test('15. College Comparison policy: Factual comparison with no invented winner', () => {
    const comp = CollegeService.compareColleges('PSG Tech', 'CIT');
    assert.strictEqual(comp.found, true);
    assert.strictEqual(comp.collegeA.shortName, 'PSG Tech');
    assert.strictEqual(comp.collegeB.shortName, 'CIT');
    assert.ok(!comp.factualSummary.includes('better than'), 'Must never claim one is better');
    assert.ok(!comp.factualSummary.includes('winner'), 'Must not declare a winner');
    assert.ok(comp.factualSummary.includes('decide which best matches your academic interests'));
  });

  await test('16. Course verification: Confirms offering or states unverified without assuming', () => {
    // PSG Tech offers CSE
    const psgCse = CourseService.verifyCourseOffering('PSG Tech', 'CSE');
    assert.strictEqual(psgCse.offers, true);
    assert.strictEqual(psgCse.degreeLevel, 'UG');

    // PSG CAS offers BCA
    const psgBca = CourseService.verifyCourseOffering('PSG CAS', 'BCA');
    assert.strictEqual(psgBca.offers, true);

    // GCT does NOT offer BCA
    const gctBca = CourseService.verifyCourseOffering('GCT', 'BCA');
    assert.strictEqual(gctBca.offers, false);
    assert.ok(gctBca.message.includes('does not list'));
  });

  await test('17. Cutoff policy: Never fabricates cutoff marks for 2026', () => {
    const cutoff = AdmissionService.getCutoffInformation('PSG Tech');
    assert.strictEqual(cutoff.year, 2026);
    assert.ok(cutoff.message.includes("couldn't verify the 2026 cutoff"));
    assert.ok(cutoff.message.includes('TNEA'));
    assert.ok(cutoff.message.includes('OC, BC, BCM, MBC/DNC, SC, SCA, ST'));
  });

  await test('18. Official source priority evaluation', () => {
    const officialGov = EducationSourceService.evaluateSource('https://www.tneaonline.org');
    assert.strictEqual(officialGov.isOfficial, true);
    assert.strictEqual(officialGov.priority, SOURCE_PRIORITY.OFFICIAL_ADMISSION_PORTAL);

    const officialPsg = EducationSourceService.evaluateSource('https://www.psgtech.edu/admissions');
    assert.strictEqual(officialPsg.isOfficial, true);
    assert.strictEqual(officialPsg.priority, SOURCE_PRIORITY.OFFICIAL_INSTITUTION_WEBSITE);

    const thirdParty = EducationSourceService.evaluateSource('https://collegedunia-sample.com');
    assert.strictEqual(thirdParty.isOfficial, false);
    assert.strictEqual(thirdParty.priority, SOURCE_PRIORITY.THIRD_PARTY_VERIFIED);

    const voiceCitation = EducationSourceService.formatForVoice('official college website', true);
    assert.strictEqual(voiceCitation, 'According to the official college website');
  });

  await test('19. Verified Coimbatore Knowledge Base schema consistency', () => {
    assert.ok(COIMBATORE_COLLEGES.length >= 10, 'Must have at least 10 verified Coimbatore institutions');

    for (const col of COIMBATORE_COLLEGES) {
      assert.ok(col.collegeName, 'Must have collegeName');
      assert.strictEqual(col.city, 'Coimbatore');
      assert.strictEqual(col.state, 'Tamil Nadu');
      assert.ok(col.officialWebsite.startsWith('https://'), `${col.shortName} official website must use HTTPS`);
      assert.ok(col.affiliation, `${col.shortName} must specify affiliation`);
      assert.ok(Array.isArray(col.ugCourses), `${col.shortName} must have ugCourses array`);
      assert.ok(Array.isArray(col.pgCourses), `${col.shortName} must have pgCourses array`);
      assert.ok(col.admissionMode, `${col.shortName} must specify admissionMode`);
      assert.ok(col.lastVerifiedAt, `${col.shortName} must have lastVerifiedAt timestamp`);
    }
  });

  console.log('\n=============================================================');
  console.log(`📊 Education Companion Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runEducationTestSuite().catch((err) => {
    console.error('Fatal error in education test suite:', err);
    process.exit(1);
  });
}

module.exports = { runEducationTestSuite };
