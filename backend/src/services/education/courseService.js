/**
 * Course Information & Verification Service
 *
 * Provides accurate course information, eligibility criteria, degree levels,
 * and verifies whether specific colleges actually offer the requested course.
 */

const { COIMBATORE_COLLEGES } = require('./coimbatoreData');

class CourseService {
  /**
   * Check if a specific college offers a particular course
   * @param {string} collegeName
   * @param {string} courseQuery
   * @returns {{ offers: boolean, matchingCourseName?: string, degreeLevel?: string, admissionRoute?: string }}
   */
  static verifyCourseOffering(collegeName, courseQuery) {
    if (!collegeName || !courseQuery) return { offers: false };

    const lowerCollege = collegeName.toLowerCase();
    const targetCol = COIMBATORE_COLLEGES.find(
      (c) =>
        c.collegeName.toLowerCase().includes(lowerCollege) ||
        c.shortName.toLowerCase().includes(lowerCollege) ||
        (c.aliases && c.aliases.some((a) => a.includes(lowerCollege)))
    );

    if (!targetCol) {
      return { offers: false, reason: 'College not found in verified database' };
    }

    const lowerCourse = courseQuery.toLowerCase();
    const ugMatch = targetCol.ugCourses.find((c) => this._isMatch(c, lowerCourse));
    if (ugMatch) {
      return {
        offers: true,
        college: targetCol.shortName,
        courseName: ugMatch,
        degreeLevel: 'UG',
        admissionRoute: targetCol.admissionMode,
        officialApplicationUrl: targetCol.applicationUrl,
      };
    }

    const pgMatch = targetCol.pgCourses.find((c) => this._isMatch(c, lowerCourse));
    if (pgMatch) {
      return {
        offers: true,
        college: targetCol.shortName,
        courseName: pgMatch,
        degreeLevel: 'PG',
        admissionRoute: targetCol.admissionMode,
        officialApplicationUrl: targetCol.applicationUrl,
      };
    }

    return {
      offers: false,
      college: targetCol.shortName,
      message: `${targetCol.shortName} does not list "${courseQuery}" in its officially verified courses.`,
    };
  }

  /**
   * Get all courses offered by a specific institution
   * @param {string} collegeName
   * @returns {{ college: string, ugCourses: string[], pgCourses: string[], phdPrograms: string[] } | null}
   */
  static getCoursesByCollege(collegeName) {
    if (!collegeName) return null;
    const lower = collegeName.toLowerCase();
    const col = COIMBATORE_COLLEGES.find(
      (c) =>
        c.collegeName.toLowerCase().includes(lower) ||
        c.shortName.toLowerCase().includes(lower) ||
        (c.aliases && c.aliases.some((a) => a.includes(lower)))
    );

    if (!col) return null;

    return {
      college: col.collegeName,
      shortName: col.shortName,
      ugCourses: col.ugCourses,
      pgCourses: col.pgCourses,
      phdPrograms: col.phdPrograms,
      officialWebsite: col.officialWebsite,
    };
  }

  static _isMatch(courseName, query) {
    const c = courseName.toLowerCase();
    const q = query.toLowerCase();

    if (q === 'cse') return c.includes('computer science');
    if (q === 'it') return c.includes('information technology');
    if (q === 'ai & ds' || q === 'ai') return c.includes('artificial intelligence');
    if (q === 'ece') return c.includes('electronics and communication');
    if (q === 'eee') return c.includes('electrical and electronics');
    if (q === 'mech') return c.includes('mechanical');
    if (q === 'civil') return c.includes('civil');
    if (q === 'bca') return c.includes('b.c.a') || c.includes('bca');
    if (q === 'mca') return c.includes('m.c.a') || c.includes('mca');
    if (q === 'mba') return c.includes('mba');
    if (q === 'agri' || q === 'agriculture') return c.includes('agriculture') || c.includes('horticulture');

    return c.includes(q);
  }
}

module.exports = CourseService;
