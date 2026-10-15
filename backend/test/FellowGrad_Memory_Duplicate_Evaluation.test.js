/**
 * FellowGrad AI — initial memory duplicate-detection evaluation
 * Run from the backend folder after placing this file in backend/test:
 *   node test/FellowGrad_Memory_Duplicate_Evaluation.test.js
 *
 * This is a small smoke-test set, not a publication-grade benchmark.
 * It invokes the project's actual MemoryService._isSemanticDuplicate method.
 */
const MemoryService = require('../src/services/memoryService');

const cases = [
  {
    id: 'M01',
    label: 'Exact duplicate',
    a: 'I am learning Java',
    b: 'I am learning Java',
    expected: true,
  },
  {
    id: 'M02',
    label: 'Case and punctuation variation',
    a: 'I prefer short answers!',
    b: 'i prefer short answers',
    expected: true,
  },
  {
    id: 'M03',
    label: 'Phrase extended with extra detail',
    a: 'Preparing for HCL placement interview',
    b: 'Preparing for HCL placement interview next week',
    expected: true,
  },
  {
    id: 'M04',
    label: 'Different programming languages',
    a: 'I am learning Java',
    b: 'I am learning Python',
    expected: false,
  },
  {
    id: 'M05',
    label: 'Clearly unrelated English statements',
    a: 'I prefer concise answers',
    b: 'My goal is to become a doctor',
    expected: false,
  },
  {
    id: 'M06',
    label: 'Different Tamil-script memories must not collapse together',
    a: 'எனக்கு தமிழ் பிடிக்கும்',
    b: 'எனக்கு கணிதம் பிடிக்கும்',
    expected: false,
  },
  {
    id: 'M07',
    label: 'Empty memory text',
    a: '',
    b: 'I am learning Java',
    expected: false,
  },
  {
    id: 'M08',
    label: 'Unrelated technical goals',
    a: 'Build a React Native voice assistant',
    b: 'Prepare for a database exam',
    expected: false,
  },
  {
    id: 'M09',
    label: 'Same core phrase with appended technology',
    a: 'Interested in backend development',
    b: 'Interested in backend development using Java',
    expected: true,
  },
  {
    id: 'M10',
    label: 'Near-overlap should be reviewed as a possible false merge',
    a: 'Java Spring Boot',
    b: 'Java Spring Boot SQL',
    expected: true,
  },
];

let passed = 0;
let failed = 0;
let tp = 0, fp = 0, tn = 0, fn = 0;
console.log('FellowGrad AI — memory duplicate-detection smoke evaluation');
console.log('Uses the actual MemoryService._isSemanticDuplicate implementation.\n');
for (const t of cases) {
  const actual = MemoryService._isSemanticDuplicate(t.a, t.b);
  const ok = actual === t.expected;
  if (ok) passed++; else failed++;
  if (actual && t.expected) tp++;
  else if (actual && !t.expected) fp++;
  else if (!actual && !t.expected) tn++;
  else fn++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${t.id} | expected=${t.expected} actual=${actual} | ${t.label}`);
}
const precision = tp + fp ? tp / (tp + fp) : 0;
const recall = tp + fn ? tp / (tp + fn) : 0;
const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
console.log('\nSummary');
console.log(`Cases: ${cases.length}; passed: ${passed}; failed: ${failed}`);
console.log(`TP=${tp}, FP=${fp}, TN=${tn}, FN=${fn}`);
console.log(`Precision=${precision.toFixed(3)}, Recall=${recall.toFixed(3)}, F1=${f1.toFixed(3)}`);
console.log('\nCaution: these metrics describe only this small, hand-labelled smoke-test set. Do not report them as final research results.');
if (failed > 0) process.exitCode = 1;
