/**
 * Education Source Verification & Priority Service
 *
 * Enforces official sources first, transparent third-party attribution,
 * and voice-safe citation formatting.
 */

const SOURCE_PRIORITY = {
  OFFICIAL_INSTITUTION_WEBSITE: 1,
  GOVERNMENT_EDUCATION_PORTAL: 2,
  REGULATORY_BODY: 3, // UGC, AICTE, ICAR
  AFFILIATING_UNIVERSITY: 4, // Anna University, Bharathiar University
  STATE_HIGHER_EDUCATION_DEPARTMENT: 5, // TNDTE, DOTE, TNGASA
  OFFICIAL_ADMISSION_PORTAL: 6, // TNEA, TANCET, CEETA-PG, NTA
  THIRD_PARTY_VERIFIED: 7, // News, education blogs, portals (must be labeled)
};

const OFFICIAL_DOMAINS = [
  '.edu.in',
  '.ac.in',
  '.gov.in',
  '.nic.in',
  'tneaonline.org',
  'tngasa.in',
  'annauniv.edu',
  'b-u.ac.in',
  'psgtech.edu',
  'psgcas.ac.in',
  'cit.edu.in',
  'gct.ac.in',
  'kct.ac.in',
  'amrita.edu',
  'karunya.edu',
  'kahedu.edu.in',
  'skcet.ac.in',
  'skasc.ac.in',
  'srec.ac.in',
  'gacbe.ac.in',
  'tnau.ac.in',
  'avinuty.ac.in',
];

class EducationSourceService {
  /**
   * Determine the trust level and priority of a source URL
   * @param {string} url
   * @returns {{ priority: number, isOfficial: boolean, sourceCategory: string }}
   */
  static evaluateSource(url) {
    if (!url || typeof url !== 'string') {
      return {
        priority: SOURCE_PRIORITY.THIRD_PARTY_VERIFIED,
        isOfficial: false,
        sourceCategory: 'UNVERIFIED',
      };
    }

    const lower = url.toLowerCase();

    // Government / Regulatory bodies
    if (lower.includes('.gov.in') || lower.includes('.nic.in') || lower.includes('ugc.ac.in') || lower.includes('aicte-india.org')) {
      return {
        priority: SOURCE_PRIORITY.GOVERNMENT_EDUCATION_PORTAL,
        isOfficial: true,
        sourceCategory: 'GOVERNMENT_REGULATORY',
      };
    }

    // State Admission Portals
    if (lower.includes('tneaonline.org') || lower.includes('tngasa.in') || lower.includes('nta.ac.in')) {
      return {
        priority: SOURCE_PRIORITY.OFFICIAL_ADMISSION_PORTAL,
        isOfficial: true,
        sourceCategory: 'OFFICIAL_ADMISSION_PORTAL',
      };
    }

    // State Universities
    if (lower.includes('annauniv.edu') || lower.includes('b-u.ac.in') || lower.includes('tnau.ac.in')) {
      return {
        priority: SOURCE_PRIORITY.AFFILIATING_UNIVERSITY,
        isOfficial: true,
        sourceCategory: 'AFFILIATING_UNIVERSITY',
      };
    }

    // Check if matches known official college domains
    const isOfficialDomain = OFFICIAL_DOMAINS.some((domain) => lower.includes(domain));
    if (isOfficialDomain) {
      return {
        priority: SOURCE_PRIORITY.OFFICIAL_INSTITUTION_WEBSITE,
        isOfficial: true,
        sourceCategory: 'OFFICIAL_INSTITUTION_WEBSITE',
      };
    }

    return {
      priority: SOURCE_PRIORITY.THIRD_PARTY_VERIFIED,
      isOfficial: false,
      sourceCategory: 'THIRD_PARTY',
    };
  }

  /**
   * Format source for Voice output: concise, conversational, never reading raw URLs aloud
   * @param {string} sourceName
   * @param {boolean} isOfficial
   * @returns {string}
   */
  static formatForVoice(sourceName = 'official website', isOfficial = true) {
    if (isOfficial) {
      return `According to the ${sourceName}`;
    }
    return `According to third-party reports (which should be verified with the college)`;
  }

  /**
   * Format source for text UI: markdown link with attribution
   * @param {string} title
   * @param {string} url
   * @param {boolean} isOfficial
   * @returns {string}
   */
  static formatForText(title, url, isOfficial = true) {
    const badge = isOfficial ? '[Official Source]' : '[Third-Party Information]';
    if (!url) return `${badge} ${title}`;
    return `${badge} [${title}](${url})`;
  }

  /**
   * Checks if information timestamp is valid for the current academic year 2026
   * @param {string|Date} timestamp
   * @param {number} maxAgeDays
   * @returns {boolean}
   */
  static isFresh(timestamp, maxAgeDays = 90) {
    if (!timestamp) return false;
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays <= maxAgeDays;
    } catch (_) {
      return false;
    }
  }
}

module.exports = {
  EducationSourceService,
  SOURCE_PRIORITY,
  OFFICIAL_DOMAINS,
};
