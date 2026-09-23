/**
 * Unified Education Search & Retrieval Service
 *
 * Coordinates intent analysis, verified Coimbatore knowledge retrieval,
 * official source priority, and grounded context synthesis for Gemini.
 */

const { EducationIntentService, INTENT_CATEGORIES } = require('./educationIntentService');
const CollegeService = require('./collegeService');
const CourseService = require('./courseService');
const AdmissionService = require('./admissionService');
const { EducationSourceService } = require('./educationSourceService');

class EducationSearchService {
  /**
   * Analyze query and retrieve grounded educational context
   * @param {string} query
   * @param {object} [userContext]
   * @returns {Promise<{
   *   isEducation: boolean,
   *   intent: string,
   *   groundedContext: string | null,
   *   redirectMessage?: string,
   *   sourceUrls: string[]
   * }>}
   */
  static async retrieveContext(query, userContext = null) {
    const analysis = EducationIntentService.analyzeQuery(query);

    // Non-education query -> Return standard polite redirect
    if (!analysis.isEducation) {
      return {
        isEducation: false,
        intent: INTENT_CATEGORIES.NON_EDUCATION,
        groundedContext: `[STRICT NON-EDUCATION REDIRECT RULE]\nThe user asked an off-topic question ("${query}"). FellowGrad is strictly an education companion. Do NOT answer the non-education question. Politeness rule: Respond briefly with:\n"${analysis.redirectMessage}"`,
        redirectMessage: analysis.redirectMessage,
        sourceUrls: [],
      };
    }

    const sourceUrls = [];
    const contextParts = [];

    contextParts.push(`[EDUCATION QUERY DETECTED: ${analysis.intent}]`);
    if (analysis.isTanglish) {
      contextParts.push('Language Style: User is speaking Tamil/Tanglish. Respond naturally in friendly conversational Tanglish/English code-mix.');
    }
    if (analysis.isCoimbatoreFocus) {
      contextParts.push('Geographic Focus: Coimbatore, Tamil Nadu, India (Year: 2026).');
    }

    // Handle specific intent categories
    switch (analysis.intent) {
      case INTENT_CATEGORIES.COLLEGE_SEARCH: {
        const colleges = CollegeService.searchColleges(analysis.extractedCollegeName || query);
        if (colleges.length > 0) {
          contextParts.push('--- VERIFIED COIMBATORE INSTITUTIONS ---');
          for (const col of colleges.slice(0, 5)) {
            contextParts.push(`• ${col.shortName} (${col.collegeName}): ${col.institutionType}, affiliated with ${col.affiliation}. Website: ${col.officialWebsite}`);
            if (col.officialWebsite) sourceUrls.push(col.officialWebsite);
          }
          contextParts.push('Voice Instruction: Mention 2 to 3 top relevant options concisely. Do not declare any college as "number 1" or "best".');
        }
        break;
      }

      case INTENT_CATEGORIES.COURSE_SEARCH: {
        if (analysis.extractedCourse) {
          const results = CollegeService.findCollegesByCourse(analysis.extractedCourse);
          contextParts.push(`--- VERIFIED INSTITUTIONS OFFERING ${analysis.extractedCourse.toUpperCase()} IN COIMBATORE ---`);
          for (const res of results.slice(0, 6)) {
            contextParts.push(`• ${res.college.shortName}: ${res.matchingCourses.slice(0, 2).join(', ')} (${res.college.affiliation})`);
            if (res.college.officialWebsite) sourceUrls.push(res.college.officialWebsite);
          }
          contextParts.push('Voice Instruction: Give a short, helpful summary of institutions offering this branch in Coimbatore.');
        } else if (analysis.extractedCollegeName) {
          const courses = CourseService.getCoursesByCollege(analysis.extractedCollegeName);
          if (courses) {
            contextParts.push(`--- COURSES OFFERED AT ${courses.shortName} ---`);
            contextParts.push(`UG Courses: ${courses.ugCourses.slice(0, 6).join(', ')}...`);
            contextParts.push(`PG Courses: ${courses.pgCourses.slice(0, 4).join(', ')}...`);
            if (courses.officialWebsite) sourceUrls.push(courses.officialWebsite);
          }
        }
        break;
      }

      case INTENT_CATEGORIES.ADMISSION: {
        const adm = AdmissionService.getAdmissionDetails(analysis.extractedCollegeName || '');
        if (adm.found) {
          contextParts.push(`--- VERIFIED ADMISSION DETAILS FOR ${adm.shortName} (2026-27) ---`);
          contextParts.push(`Mode: ${adm.admissionMode}`);
          contextParts.push(`Application Portal: ${adm.applicationUrl}`);
          contextParts.push(adm.officialAdmissionNote);
          if (adm.applicationUrl) sourceUrls.push(adm.applicationUrl);
        } else {
          contextParts.push(`--- GENERAL 2026-27 TAMIL NADU ADMISSIONS OVERVIEW ---`);
          contextParts.push(adm.summary);
          sourceUrls.push('https://www.tneaonline.org');
        }
        contextParts.push('Voice Instruction: State that 2026-27 admissions are coordinated via official portals. Never make up application deadlines if not published.');
        break;
      }

      case INTENT_CATEGORIES.FEES: {
        const feeInfo = AdmissionService.getFeeInformation(analysis.extractedCollegeName || '');
        contextParts.push(`--- FEE POLICY & DISCLAIMER FOR ${feeInfo.college} ---`);
        contextParts.push(feeInfo.message);
        contextParts.push('Voice Instruction: State clearly: "I couldn\'t verify the current official fee from the available source." Explain that fees differ between government quota and management quota without guessing numbers.');
        if (feeInfo.officialWebsite) sourceUrls.push(feeInfo.officialWebsite);
        break;
      }

      case INTENT_CATEGORIES.CUTOFF: {
        const cutoffInfo = AdmissionService.getCutoffInformation(analysis.extractedCollegeName || '');
        contextParts.push(`--- CUTOFF POLICY & DISCLAIMER (YEAR 2026) ---`);
        contextParts.push(cutoffInfo.message);
        contextParts.push('Voice Instruction: Never fabricate cutoff numbers. Clarify that 2026 cutoffs are determined by TNEA/DOTE based on this year\'s Class 12 board marks and community categories (OC, BC, MBC, SC, ST).');
        sourceUrls.push(cutoffInfo.officialSource);
        break;
      }

      case INTENT_CATEGORIES.COLLEGE_COMPARISON: {
        // Extract both college candidates
        const lower = query.toLowerCase();
        const words = lower.split(/\bvs\b|\band\b/);
        const colA = words[0] ? words[0].trim() : '';
        const colB = words[1] ? words[1].trim() : '';
        const comp = CollegeService.compareColleges(colA, colB);
        if (comp.found) {
          contextParts.push('--- FACTUAL COLLEGE COMPARISON (NO INVENTED WINNER) ---');
          contextParts.push(comp.factualSummary);
          contextParts.push(`College A (${comp.collegeA.shortName}): ${comp.collegeA.type}, Affiliation: ${comp.collegeA.affiliation}, Accreditation: ${comp.collegeA.accreditation.join(', ')}`);
          contextParts.push(`College B (${comp.collegeB.shortName}): ${comp.collegeB.type}, Affiliation: ${comp.collegeB.affiliation}, Accreditation: ${comp.collegeB.accreditation.join(', ')}`);
          contextParts.push('Voice Instruction: Present the factual differences neutrally. Do not declare an overall winner.');
        }
        break;
      }

      case INTENT_CATEGORIES.PROGRAMMING_HELP:
      case INTENT_CATEGORIES.SUBJECT_HELP: {
        contextParts.push('--- ACADEMIC TUTORING MODE ---');
        contextParts.push('Method: 1. Explain concept simply. 2. Give an illustrative example. 3. Ask a brief check question to engage the student. Keep it conversational, not a textbook lecture.');
        break;
      }

      case INTENT_CATEGORIES.STUDY_PLAN: {
        contextParts.push('--- STUDY PLAN & EXAM PREPARATION ---');
        contextParts.push('Action: Help the student organize their study session logically: high-weightage topics first, active recall practice, and short breaks. Ask what specific exam/subject they have tomorrow.');
        break;
      }

      default:
        break;
    }

    return {
      isEducation: true,
      intent: analysis.intent,
      groundedContext: contextParts.join('\n'),
      sourceUrls,
    };
  }
}

module.exports = EducationSearchService;
