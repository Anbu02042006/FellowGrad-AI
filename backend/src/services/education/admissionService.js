/**
 * Admission, Fees & Cutoff Information Service
 *
 * Current Academic Year: 2026 / 2026-27
 *
 * Enforces strict non-hallucination policies for admission deadlines,
 * fees, and category-wise cutoffs.
 */

const { COIMBATORE_COLLEGES } = require('./coimbatoreData');
const CollegeService = require('./collegeService');

class AdmissionService {
  /**
   * Get admission information for a specific college or general Coimbatore admissions
   * @param {string} [collegeName]
   * @returns {object}
   */
  static getAdmissionDetails(collegeName = '') {
    const currentYear = '2026';
    const academicSession = '2026-27';

    if (!collegeName || !collegeName.trim()) {
      return {
        session: academicSession,
        summary: `For the ${academicSession} academic session in Tamil Nadu, engineering admissions (B.E./B.Tech) are conducted through TNEA (https://www.tneaonline.org) based on Class 12 PCM marks. Arts and Science government college admissions are conducted through TNGASA (https://www.tngasa.in). Private and autonomous colleges accept direct online applications on their official portals.`,
        generalRoutes: [
          { system: 'TNEA (Tamil Nadu Engineering Admissions)', website: 'https://www.tneaonline.org', for: 'Government & Aided Engineering Quota' },
          { system: 'TNGASA', website: 'https://www.tngasa.in', for: 'Government Arts & Science Colleges' },
          { system: 'TANCET / CEETA-PG', website: 'https://tancet.annauniv.edu', for: 'M.E., M.Tech, MBA, MCA' },
        ],
      };
    }

    const college = CollegeService.getCollegeByName(collegeName) || CollegeService.searchColleges(collegeName)[0];
    if (!college) {
      return {
        found: false,
        message: `I could not find official admission records for "${collegeName}". Please verify the college name.`,
      };
    }

    return {
      found: true,
      college: college.collegeName,
      shortName: college.shortName,
      academicSession,
      admissionMode: college.admissionMode,
      eligibility: college.eligibility,
      applicationUrl: college.applicationUrl,
      officialWebsite: college.officialWebsite,
      officialAdmissionNote: `Official application information for ${college.shortName} is available at ${college.applicationUrl}. For government quota seats, candidates must participate in Tamil Nadu single window counselling (TNEA for engineering / TNGASA for arts).`,
    };
  }

  /**
   * Handle fee queries with strict anti-hallucination rules.
   * Never fabricate numbers. Separate Government Quota vs Management Quota vs Hostel.
   * @param {string} collegeName
   * @param {string} [courseName]
   * @returns {object}
   */
  static getFeeInformation(collegeName = '', courseName = '') {
    const college = collegeName ? CollegeService.getCollegeByName(collegeName) || CollegeService.searchColleges(collegeName)[0] : null;

    return {
      college: college ? college.shortName : 'Requested Institution',
      isOfficialFeePublished: false,
      message:
        "I couldn't verify the current official fee from the available source. College fees in Tamil Nadu vary significantly depending on whether you join through the Government Counselling Quota (governed by the State Fee Committee) or Management Quota, and additional components like hostel and transport are billed separately. Please consult the official institution fee schedule directly.",
      officialWebsite: college ? college.officialWebsite : 'https://www.tneaonline.org',
    };
  }

  /**
   * Handle cutoff inquiries with strict anti-hallucination rules.
   * Reminds students that cutoffs depend on Year, Category (OC/BC/BCM/MBC/SC/SCA/ST), and Counselling round.
   * @param {string} collegeName
   * @param {string} [courseName]
   * @returns {object}
   */
  static getCutoffInformation(collegeName = '', courseName = '') {
    const college = collegeName ? CollegeService.getCollegeByName(collegeName) || CollegeService.searchColleges(collegeName)[0] : null;

    return {
      college: college ? college.shortName : 'Requested Institution',
      year: 2026,
      message:
        "I couldn't verify the 2026 cutoff from an official source. In Tamil Nadu TNEA engineering admissions, cutoffs are determined annually based on Class 12 board marks and normalized counselling ranks across categories (OC, BC, BCM, MBC/DNC, SC, SCA, ST). Cutoffs are finalized only during live counselling rounds by the Directorate of Technical Education (DOTE).",
      officialSource: 'https://www.tneaonline.org',
    };
  }
}

module.exports = AdmissionService;
