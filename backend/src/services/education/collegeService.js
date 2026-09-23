/**
 * College Search, Information & Factual Comparison Service
 *
 * Provides verified Coimbatore and Tamil Nadu college data without
 * fabricated rankings or artificial winners.
 */

const { COIMBATORE_COLLEGES } = require('./coimbatoreData');

class CollegeService {
  /**
   * Find colleges by query text (name, alias, short name, course)
   * @param {string} query
   * @returns {Array<object>}
   */
  static searchColleges(query = '') {
    if (!query || !query.trim()) {
      return COIMBATORE_COLLEGES;
    }

    const lower = query.toLowerCase().trim();

    // Direct category matches
    if (/\bengineering\b/i.test(lower)) {
      return this.getEngineeringColleges();
    }
    if (/\barts\b/i.test(lower) || /\bscience\b/i.test(lower)) {
      return this.getArtsAndScienceColleges();
    }
    if (/\b(agriculture|agri)\b/i.test(lower)) {
      return COIMBATORE_COLLEGES.filter((c) => c.shortName === 'TNAU' || c.institutionType.includes('Agricultural'));
    }

    // Clean conversational stopwords (Tamil/Tanglish/English)
    const cleanTokens = lower
      .replace(/\b(coimbatore|kovai|cbe|la|enga|sollu|solunga|colleges?|universit(y|ies)|enna|iruku|irukku|top|list|about|details)\b/gi, ' ')
      .trim();

    if (!cleanTokens) {
      return COIMBATORE_COLLEGES;
    }

    return COIMBATORE_COLLEGES.filter((col) => {
      const matchName = col.collegeName.toLowerCase().includes(cleanTokens);
      const matchShort = col.shortName.toLowerCase().includes(cleanTokens);
      const matchAlias = col.aliases && col.aliases.some((a) => a.includes(cleanTokens) || cleanTokens.includes(a));
      const matchType = col.institutionType.toLowerCase().includes(cleanTokens);
      const matchAffiliation = col.affiliation.toLowerCase().includes(cleanTokens);
      const matchCourse =
        col.ugCourses.some((c) => c.toLowerCase().includes(cleanTokens)) ||
        col.pgCourses.some((c) => c.toLowerCase().includes(cleanTokens));

      return matchName || matchShort || matchAlias || matchType || matchAffiliation || matchCourse;
    });
  }

  /**
   * Find colleges offering a specific course in Coimbatore (e.g., 'CSE', 'BCA', 'MBA')
   * @param {string} courseQuery
   * @returns {Array<{ college: object, matchingCourses: string[] }>}
   */
  static findCollegesByCourse(courseQuery) {
    if (!courseQuery) return [];
    const lower = courseQuery.toLowerCase().trim();

    const results = [];
    for (const col of COIMBATORE_COLLEGES) {
      const allCourses = [...col.ugCourses, ...col.pgCourses];
      const matches = allCourses.filter((c) => {
        const cLower = c.toLowerCase();
        if (lower === 'cse') return cLower.includes('computer science');
        if (lower === 'it') return cLower.includes('information technology');
        if (lower === 'ai & ds' || lower === 'ai') return cLower.includes('artificial intelligence');
        if (lower === 'ece') return cLower.includes('electronics and communication');
        if (lower === 'eee') return cLower.includes('electrical and electronics');
        if (lower === 'mech') return cLower.includes('mechanical');
        if (lower === 'bca') return cLower.includes('b.c.a') || cLower.includes('bca');
        if (lower === 'mca') return cLower.includes('m.c.a') || cLower.includes('mca');
        if (lower === 'mba') return cLower.includes('mba');
        if (lower === 'agriculture' || lower === 'agri') return cLower.includes('agriculture');
        return cLower.includes(lower);
      });

      if (matches.length > 0) {
        results.push({
          college: col,
          matchingCourses: matches,
        });
      }
    }

    return results;
  }

  /**
   * Find engineering colleges in Coimbatore
   * @returns {Array<object>}
   */
  static getEngineeringColleges() {
    return COIMBATORE_COLLEGES.filter((col) => {
      const type = col.institutionType.toLowerCase();
      const hasEngCourses = col.ugCourses.some((c) => c.startsWith('B.E.') || c.startsWith('B.Tech'));
      return type.includes('engineering') || hasEngCourses;
    });
  }

  /**
   * Find Arts and Science colleges in Coimbatore
   * @returns {Array<object>}
   */
  static getArtsAndScienceColleges() {
    return COIMBATORE_COLLEGES.filter((col) => {
      const type = col.institutionType.toLowerCase();
      const hasArtsCourses = col.ugCourses.some((c) => c.startsWith('B.Sc.') || c.startsWith('B.C.A.') || c.startsWith('B.Com') || c.startsWith('B.A.'));
      return type.includes('arts') || hasArtsCourses;
    });
  }

  /**
   * Get single verified college by name or alias
   * @param {string} nameOrAlias
   * @returns {object | null}
   */
  static getCollegeByName(nameOrAlias) {
    if (!nameOrAlias) return null;
    const lower = nameOrAlias.toLowerCase().trim();

    return (
      COIMBATORE_COLLEGES.find((col) => {
        if (col.shortName.toLowerCase() === lower) return true;
        if (col.collegeName.toLowerCase() === lower) return true;
        if (col.aliases && col.aliases.some((a) => a === lower || lower.includes(a))) return true;
        return false;
      }) || null
    );
  }

  /**
   * Provide a factual side-by-side comparison between two institutions.
   *
   * CRITICAL POLICY:
   * Do NOT declare an overall winner or state that "College X is better than College Y".
   * Present verified facts: Affiliation, Accreditation, Courses, Admission Mode, Official Site.
   *
   * @param {string} collegeAQuery
   * @param {string} collegeBQuery
   * @returns {object}
   */
  static compareColleges(collegeAQuery, collegeBQuery) {
    const colA = this.getCollegeByName(collegeAQuery) || this.searchColleges(collegeAQuery)[0] || null;
    const colB = this.getCollegeByName(collegeBQuery) || this.searchColleges(collegeBQuery)[0] || null;

    if (!colA || !colB) {
      return {
        found: false,
        message: 'Could not find verified records for one or both requested colleges.',
        collegeA: colA,
        collegeB: colB,
      };
    }

    return {
      found: true,
      collegeA: {
        name: colA.collegeName,
        shortName: colA.shortName,
        type: colA.institutionType,
        affiliation: colA.affiliation,
        accreditation: colA.accreditation,
        admissionMode: colA.admissionMode,
        officialWebsite: colA.officialWebsite,
        totalUGCourses: colA.ugCourses.length,
        sampleCourses: colA.ugCourses.slice(0, 5),
      },
      collegeB: {
        name: colB.collegeName,
        shortName: colB.shortName,
        type: colB.institutionType,
        affiliation: colB.affiliation,
        accreditation: colB.accreditation,
        admissionMode: colB.admissionMode,
        officialWebsite: colB.officialWebsite,
        totalUGCourses: colB.ugCourses.length,
        sampleCourses: colB.ugCourses.slice(0, 5),
      },
      factualSummary: `Here is a factual comparison between ${colA.shortName} and ${colB.shortName}: Both are established institutions in Coimbatore. ${colA.shortName} is a ${colA.institutionType} affiliated with ${colA.affiliation}, while ${colB.shortName} is a ${colB.institutionType} affiliated with ${colB.affiliation}. Please review their respective programs and official websites to decide which best matches your academic interests.`,
    };
  }
}

module.exports = CollegeService;
