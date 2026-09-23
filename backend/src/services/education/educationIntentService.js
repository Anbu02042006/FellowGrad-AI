/**
 * Education Intent Analysis & Classification Service
 *
 * Classifies student queries into educational intent categories,
 * detects English, Tamil, and Tanglish phrases,
 * identifies local Coimbatore focus,
 * and routes non-educational queries to the standard polite educational redirect.
 */

const INTENT_CATEGORIES = {
  COLLEGE_SEARCH: 'COLLEGE_SEARCH',
  COURSE_SEARCH: 'COURSE_SEARCH',
  ADMISSION: 'ADMISSION',
  FEES: 'FEES',
  ELIGIBILITY: 'ELIGIBILITY',
  CUTOFF: 'CUTOFF',
  COUNSELLING: 'COUNSELLING',
  SCHOLARSHIP: 'SCHOLARSHIP',
  EXAM: 'EXAM',
  RESULT: 'RESULT',
  SYLLABUS: 'SYLLABUS',
  ACADEMIC_CALENDAR: 'ACADEMIC_CALENDAR',
  PLACEMENT: 'PLACEMENT',
  INTERNSHIP: 'INTERNSHIP',
  HACKATHON: 'HACKATHON',
  COLLEGE_EVENT: 'COLLEGE_EVENT',
  COURSE_COMPARISON: 'COURSE_COMPARISON',
  COLLEGE_COMPARISON: 'COLLEGE_COMPARISON',
  CAREER: 'CAREER',
  STUDY_PLAN: 'STUDY_PLAN',
  SUBJECT_HELP: 'SUBJECT_HELP',
  PROGRAMMING_HELP: 'PROGRAMMING_HELP',
  APTITUDE: 'APTITUDE',
  INTERVIEW_PREPARATION: 'INTERVIEW_PREPARATION',
  RESUME: 'RESUME',
  ACADEMIC_PROFILE: 'ACADEMIC_PROFILE',
  HISTORICAL_RECALL: 'HISTORICAL_RECALL',
  NON_EDUCATION: 'NON_EDUCATION',
};

const NON_EDUCATION_PATTERNS = [
  /\bweather\b/i,
  /\btemperature\b/i,
  /\brain\b/i,
  /\bforecast\b/i,
  /\bclimate\b/i,
  /\b(stock|stocks|stock trading|crypto|cryptocurrency|bitcoin|share market|sensex|nifty|share price)\b/i,
  /\b(cricket|ipl|football|fifa|match|sports?|score|scores)\b/i,
  /\b(celebrity|gossip|entertainment|movie review|cinema|box office|actor|actress)\b/i,
  /\b(shopping|buy shoes|buy clothes|cheap flights|hotel booking|flight ticket|tourism|vacation)\b/i,
  /\b(politics|politician|election|elections|political party|mp|mla)\b/i,
];

// Exceptions that appear political or general but have a legitimate education connection
const EDUCATION_CONNECTED_EXCEPTIONS = [
  /education minister/i,
  /higher education minister/i,
  /ugc chairman/i,
  /aicte chairman/i,
  /vice chancellor/i,
  /governor .* university/i,
  /education policy/i,
  /nep 2020/i,
  /education budget/i,
  /school syllabus committee/i,
];

const COIMBATORE_PATTERNS = [
  /\bcoimbatore\b/i,
  /\bkovai\b/i,
  /\bcbe\b/i,
  /\bnear me\b/i,
  /\bhere\b/i,
  /\bpeelamedu\b/i,
  /\bsaravanampatti\b/i,
  /\bkuniamuthur\b/i,
  /\bettimadai\b/i,
  /\bthadagam\b/i,
  /\brace course\b/i,
  /\bgandhipuram\b/i,
];

class EducationIntentService {
  /**
   * Analyze user query to determine education intent, language style, and local routing
   * @param {string} query
   * @returns {{
   *   intent: string,
   *   isEducation: boolean,
   *   isCoimbatoreFocus: boolean,
   *   isTanglish: boolean,
   *   isCurrentInfoQuery: boolean,
   *   extractedCollegeName: string | null,
   *   extractedCourse: string | null,
   *   requiresLiveRetrieval: boolean,
   *   redirectMessage?: string
   * }}
   */
  static analyzeQuery(query) {
    if (!query || typeof query !== 'string') {
      return {
        intent: INTENT_CATEGORIES.NON_EDUCATION,
        isEducation: false,
        isCoimbatoreFocus: false,
        isTanglish: false,
        isCurrentInfoQuery: false,
        extractedCollegeName: null,
        extractedCourse: null,
        requiresLiveRetrieval: false,
      };
    }

    const text = query.trim();
    const lower = text.toLowerCase();

    // 1. Check for Tanglish / Tamil conversational markers
    const isTanglish = /\b(machan|macha|solunga|sollu|iruku|irukku|enna|epdi|evlo|enga|padikalam|padikanum|naan|enaku|naalaikku|pathi|pesinom|kudu|pannu|kooda|seri|kandippa|puriyudhu|super-ah|paakanum)\b/i.test(
      lower
    ) || /[\u0B80-\u0BFF]/.test(text);

    // 2. Check for Non-Education Questions
    const isEducationException = EDUCATION_CONNECTED_EXCEPTIONS.some((pat) => pat.test(lower));
    if (!isEducationException) {
      const isExplicitNonEducation = NON_EDUCATION_PATTERNS.some((pat) => pat.test(lower));
      if (isExplicitNonEducation) {
        return {
          intent: INTENT_CATEGORIES.NON_EDUCATION,
          isEducation: false,
          isCoimbatoreFocus: false,
          isTanglish,
          isCurrentInfoQuery: false,
          extractedCollegeName: null,
          extractedCourse: null,
          requiresLiveRetrieval: false,
          redirectMessage:
            "I'm focused on education and student-related support. I can help with studies, colleges, courses, admissions, exams, scholarships, placements, and academic planning.",
        };
      }
    }

    // 3. Check for Coimbatore priority focus
    const isCoimbatoreFocus = COIMBATORE_PATTERNS.some((pat) => pat.test(lower));

    // 4. Check for Current / Fresh Information markers (Year 2026)
    const isCurrentInfoQuery = /\b(latest|current|now|today|this year|2026|2026-27|admission open|last date|cutoff|cut off|announcement|drive|notifications)\b/i.test(
      lower
    );

    // 5. Check for Historical Conversation Recall
    if (
      /\b(yesterday|last week|2 days ago|two days ago|earlier|what did i study|enna padichen|enna pesinom)\b/i.test(
        lower
      )
    ) {
      return {
        intent: INTENT_CATEGORIES.HISTORICAL_RECALL,
        isEducation: true,
        isCoimbatoreFocus,
        isTanglish,
        isCurrentInfoQuery: false,
        extractedCollegeName: null,
        extractedCourse: null,
        requiresLiveRetrieval: false,
      };
    }

    // 6. Check for College Comparison (e.g., "PSG Tech vs CIT", "KCT vs SKCET")
    if (/\bvs\b|\bcompare\b|\bbetter\b|\bwhich is better\b/i.test(lower) && /\bcollege|tech|arts|campus|institute\b/i.test(lower)) {
      return {
        intent: INTENT_CATEGORIES.COLLEGE_COMPARISON,
        isEducation: true,
        isCoimbatoreFocus,
        isTanglish,
        isCurrentInfoQuery,
        extractedCollegeName: null,
        extractedCourse: null,
        requiresLiveRetrieval: true,
      };
    }

    // 7. Check for Fees
    if (/\b(fee|fees|cost|tuition|evlo|kattanam|charges)\b/i.test(lower)) {
      return {
        intent: INTENT_CATEGORIES.FEES,
        isEducation: true,
        isCoimbatoreFocus,
        isTanglish,
        isCurrentInfoQuery,
        extractedCollegeName: this._extractCollege(lower),
        extractedCourse: this._extractCourse(lower),
        requiresLiveRetrieval: true,
      };
    }

    // 8. Check for Cutoff
    if (/\b(cutoff|cut-off|cut off|marks required|rank)\b/i.test(lower)) {
      return {
        intent: INTENT_CATEGORIES.CUTOFF,
        isEducation: true,
        isCoimbatoreFocus,
        isTanglish,
        isCurrentInfoQuery: true,
        extractedCollegeName: this._extractCollege(lower),
        extractedCourse: this._extractCourse(lower),
        requiresLiveRetrieval: true,
      };
    }

    // 9. Check for Admission
    if (/\b(admission|admissions|apply|application|open ah|tnea|tancet|counselling|seat)\b/i.test(lower)) {
      return {
        intent: INTENT_CATEGORIES.ADMISSION,
        isEducation: true,
        isCoimbatoreFocus,
        isTanglish,
        isCurrentInfoQuery: true,
        extractedCollegeName: this._extractCollege(lower),
        extractedCourse: this._extractCourse(lower),
        requiresLiveRetrieval: true,
      };
    }

    // 10. Check for Programming / Coding Help
    if (
      /\b(java|python|c\+\+|javascript|react|react native|spring boot|html|css|sql|oops?|object oriented|data structures|algorithms|dsa|stack|queue|linked list|tree|graph|hashmap|recursion|pointer|compiler|git)\b/i.test(
        lower
      ) &&
      /\b(explain|teach|learn|code|program|example|purila|solli|help)\b/i.test(lower)
    ) {
      return {
        intent: INTENT_CATEGORIES.PROGRAMMING_HELP,
        isEducation: true,
        isCoimbatoreFocus,
        isTanglish,
        isCurrentInfoQuery: false,
        extractedCollegeName: null,
        extractedCourse: null,
        requiresLiveRetrieval: false,
      };
    }

    // 11. Check for Academic Subject / Theory Help (DBMS, OS, Networks, Math, Physics)
    if (
      /\b(dbms|normalization|operating system|os|computer networks|tcp\/ip|microprocessor|automata|compiler design|digital electronics|maths?|calculus|physics|chemistry)\b/i.test(
        lower
      )
    ) {
      return {
        intent: INTENT_CATEGORIES.SUBJECT_HELP,
        isEducation: true,
        isCoimbatoreFocus,
        isTanglish,
        isCurrentInfoQuery: false,
        extractedCollegeName: null,
        extractedCourse: null,
        requiresLiveRetrieval: false,
      };
    }

    // 12. Check for Exam / Study Plan Preparation
    if (
      /\b(exam|examination|tomorrow exam|naalaikku exam|study plan|revision|how to prepare|enna padikanum|semester|internals)\b/i.test(
        lower
      )
    ) {
      return {
        intent: INTENT_CATEGORIES.STUDY_PLAN,
        isEducation: true,
        isCoimbatoreFocus,
        isTanglish,
        isCurrentInfoQuery: false,
        extractedCollegeName: null,
        extractedCourse: null,
        requiresLiveRetrieval: false,
      };
    }

    // 13. Check for Placement / Internship / Interview
    if (/\b(placement|placements|interview|mock interview|resume|cv|aptitude|internship|hiring|company prep|hcl|tcs|infosys|wipro|zoho)\b/i.test(lower)) {
      return {
        intent: INTENT_CATEGORIES.PLACEMENT,
        isEducation: true,
        isCoimbatoreFocus,
        isTanglish,
        isCurrentInfoQuery: false,
        extractedCollegeName: null,
        extractedCourse: null,
        requiresLiveRetrieval: false,
      };
    }

    // 14. Check for Course Search (e.g. "CSE colleges", "BCA courses", "courses enna")
    const foundCourse = this._extractCourse(lower);
    if (foundCourse || /\b(course|courses|degree|branch|stream|syllabus)\b/i.test(lower)) {
      return {
        intent: INTENT_CATEGORIES.COURSE_SEARCH,
        isEducation: true,
        isCoimbatoreFocus,
        isTanglish,
        isCurrentInfoQuery,
        extractedCollegeName: this._extractCollege(lower),
        extractedCourse: foundCourse,
        requiresLiveRetrieval: true,
      };
    }

    // 15. Check for College Search (e.g. "engineering colleges", "colleges in coimbatore")
    if (/\b(college|colleges|university|universities|institutions?|campus)\b/i.test(lower) || isCoimbatoreFocus) {
      return {
        intent: INTENT_CATEGORIES.COLLEGE_SEARCH,
        isEducation: true,
        isCoimbatoreFocus,
        isTanglish,
        isCurrentInfoQuery,
        extractedCollegeName: this._extractCollege(lower),
        extractedCourse: null,
        requiresLiveRetrieval: true,
      };
    }

    // Default: Educational student support
    return {
      intent: INTENT_CATEGORIES.SUBJECT_HELP,
      isEducation: true,
      isCoimbatoreFocus,
      isTanglish,
      isCurrentInfoQuery,
      extractedCollegeName: null,
      extractedCourse: null,
      requiresLiveRetrieval: false,
    };
  }

  /**
   * Helper to detect known college mentions
   */
  static _extractCollege(lower) {
    if (lower.includes('psg tech') || lower.includes('psg college of technology')) return 'PSG Tech';
    if (lower.includes('psg cas') || lower.includes('psg arts') || lower.includes('psg college of arts')) return 'PSG CAS';
    if (lower.includes('psg')) return 'PSG Tech';
    if (lower.includes('cit') || lower.includes('coimbatore institute of technology')) return 'CIT';
    if (lower.includes('gct') || lower.includes('government college of technology')) return 'GCT';
    if (lower.includes('kct') || lower.includes('kumaraguru')) return 'KCT';
    if (lower.includes('bharathiar') || lower.includes('bharathiyar')) return 'Bharathiar University';
    if (lower.includes('anna university')) return 'Anna University Regional Campus Coimbatore';
    if (lower.includes('amrita')) return 'Amrita Vishwa Vidyapeetham';
    if (lower.includes('karunya')) return 'Karunya Institute of Technology and Sciences';
    if (lower.includes('karpagam')) return 'Karpagam Academy of Higher Education';
    if (lower.includes('skcet') || lower.includes('sri krishna engineering')) return 'SKCET';
    if (lower.includes('skasc') || lower.includes('sri krishna arts')) return 'SKASC';
    if (lower.includes('srec') || lower.includes('sri ramakrishna engineering')) return 'SREC';
    if (lower.includes('tnau') || lower.includes('agricultural university')) return 'TNAU';
    if (lower.includes('avinashilingam')) return 'Avinashilingam Institute';
    if (lower.includes('gac') || lower.includes('govt arts college')) return 'Government Arts College, Coimbatore';
    return null;
  }

  /**
   * Helper to detect courses
   */
  static _extractCourse(lower) {
    if (/\b(cse|computer science and engineering|computer science)\b/i.test(lower)) return 'CSE';
    if (/\b(it|information technology)\b/i.test(lower)) return 'IT';
    if (/\b(ai & ds|ai and ds|artificial intelligence|data science)\b/i.test(lower)) return 'AI & DS';
    if (/\b(ece|electronics and communication)\b/i.test(lower)) return 'ECE';
    if (/\b(eee|electrical and electronics)\b/i.test(lower)) return 'EEE';
    if (/\b(mech|mechanical engineering)\b/i.test(lower)) return 'Mechanical';
    if (/\b(civil|civil engineering)\b/i.test(lower)) return 'Civil';
    if (/\b(bca|b\.c\.a|bachelor of computer applications)\b/i.test(lower)) return 'BCA';
    if (/\b(mca|m\.c\.a|master of computer applications)\b/i.test(lower)) return 'MCA';
    if (/\b(mba|m\.b\.a|master of business administration)\b/i.test(lower)) return 'MBA';
    if (/\b(b\.sc|bsc)\b/i.test(lower)) return 'B.Sc';
    if (/\b(b\.com|bcom)\b/i.test(lower)) return 'B.Com';
    if (/\b(agriculture|agri|horticulture)\b/i.test(lower)) return 'Agriculture';
    return null;
  }
}

module.exports = {
  EducationIntentService,
  INTENT_CATEGORIES,
};
