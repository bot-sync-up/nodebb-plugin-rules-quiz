'use strict';

/**
 * Starter question seed for nodebb-plugin-rules-quiz.
 *
 * On first activation (when the questions sorted set is empty) we insert a
 * small set of sensible defaults so the quiz isn't a blank screen. Content
 * is in Hebrew to match the primary audience of the forum this plugin was
 * commissioned for.
 */

const SEED_QUESTIONS = [
  {
    type: 'single',
    title: 'איך מתנהגים כלפי חברים אחרים בפורום?',
    bodyMarkdown: 'הפורום הוא מקום משותף לכל הקהילה. חשוב לשמור על יחס הולם כלפי כל משתתף.',
    options: [
      { id: 'a', text: 'כותבים בכבוד ובנימוס, גם כשחולקים על דעתו',           correct: true  },
      { id: 'b', text: 'מותר ללעוג או לזלזל אם המשתמש טועה',                   correct: false },
      { id: 'c', text: 'מתעלמים ממי שמביע דעה שונה',                            correct: false },
    ],
    explanationMarkdown: 'כבוד הדדי הוא הכלל הראשון. גם מחלוקת אפשר לנהל בטון מכובד.',
    weight: 1,
    tags: ['respect', 'etiquette'],
    sort: 100,
  },
  {
    type: 'single',
    title: 'מה מותר לפרסם בתוך שרשור בפורום?',
    bodyMarkdown: 'לכל קטגוריה/שרשור יש נושא מוגדר.',
    options: [
      { id: 'a', text: 'כל תוכן שעולה לראש, בלי קשר לנושא',                     correct: false },
      { id: 'b', text: 'רק תגובות שקשורות לנושא השרשור',                         correct: true  },
      { id: 'c', text: 'פרסומות לעסק פרטי',                                      correct: false },
    ],
    explanationMarkdown: 'יש לשמור על רלוונטיות. הוצאת שרשור מהנושא פוגעת בקריאות עבור כל הקהילה.',
    weight: 1,
    tags: ['on-topic'],
    sort: 200,
  },
  {
    type: 'single',
    title: 'האם מותר לפרסם פרטים אישיים (טלפון, כתובת, ת"ז) של עצמך או של אחרים?',
    bodyMarkdown: 'הגנה על פרטיות היא חלק מכללי הפורום.',
    options: [
      { id: 'a', text: 'מותר בכל מקרה, זו האחריות שלי',                        correct: false },
      { id: 'b', text: 'אסור לפרסם פרטים אישיים בפומבי, לא של עצמי ולא של אחרים', correct: true  },
      { id: 'c', text: 'מותר רק אם האדם השני הסכים בעל פה',                      correct: false },
    ],
    explanationMarkdown: 'פרטים אישיים לעולם לא מתפרסמים בפומבי בפורום. לשאלות אישיות ניתן להשתמש בהודעה פרטית.',
    weight: 1,
    tags: ['privacy'],
    sort: 300,
  },
  {
    type: 'single',
    title: 'מצאת שרשור שבו כבר נשאלה אותה שאלה שרצית לשאול. מה עושים?',
    bodyMarkdown: 'כפילות שרשורים מפצלת את הדיון ומקשה על החיפוש.',
    options: [
      { id: 'a', text: 'פותחים שרשור חדש כדי לא להפריע',                         correct: false },
      { id: 'b', text: 'מגיבים בשרשור הקיים במקום לפתוח חדש',                    correct: true  },
      { id: 'c', text: 'מוחקים את השרשור הישן ופותחים מחדש',                     correct: false },
    ],
    explanationMarkdown: 'ממשיכים את הדיון במקום המקורי. כך כל החומר נשמר יחד וזמין למחפשים הבאים.',
    weight: 1,
    tags: ['duplicates'],
    sort: 400,
  },
  {
    type: 'single',
    title: 'ראית הודעה שפוגעת בכללי הפורום. מה הדרך הנכונה לפעול?',
    bodyMarkdown: 'ישנם כלים פנימיים לטיפול בהפרות.',
    options: [
      { id: 'a', text: 'להגיב פומבית בשרשור בטענות כלפי המשתמש',                 correct: false },
      { id: 'b', text: 'לדווח על ההודעה למנהלים באופן פרטי (כפתור דיווח / הודעה) ', correct: true  },
      { id: 'c', text: 'להתעלם ולא לעשות דבר',                                    correct: false },
    ],
    explanationMarkdown: 'הדיווח הפרטי מאפשר למנהלים לטפל מבלי להלהיב את הדיון ובלי לייצר עימות פומבי.',
    weight: 1,
    tags: ['reporting'],
    sort: 500,
  },
];

/**
 * If the questions store is empty, seed the starter questions. Never seeds
 * twice. Errors on any single insert are swallowed so that one bad record
 * cannot block the rest.
 *
 * @param {object} db the `lib/db` module
 * @returns {Promise<{seeded:number}>}
 */
async function seedIfEmpty(db) {
  const existing = await db.listQuestions({ limit: 1 });
  if (existing && existing.length > 0) return { seeded: 0 };
  let seeded = 0;
  for (const q of SEED_QUESTIONS) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await db.createQuestion(q);
      seeded += 1;
    } catch (e) { /* ignore individual insert errors */ }
  }
  return { seeded };
}

module.exports = { seedIfEmpty, SEED_QUESTIONS };
