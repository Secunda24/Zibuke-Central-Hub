export const courseProgressSql=`SELECT c.*,a.user_id,a.required,a.due_date,a.started_at,a.assigned_at,
 (SELECT count(*) FROM learning_lessons l WHERE l.course_id=c.id AND l.required=1) total,
 (SELECT count(*) FROM learning_progress p JOIN learning_lessons l ON l.id=p.lesson_id WHERE p.user_id=a.user_id AND l.course_id=c.id AND l.required=1) completed,
 (SELECT MAX(p.completed_at) FROM learning_progress p JOIN learning_lessons l ON l.id=p.lesson_id WHERE p.user_id=a.user_id AND l.course_id=c.id AND l.required=1) last_lesson_at,
 (SELECT count(*) FROM learning_quizzes q WHERE q.course_id=c.id AND q.required=1) quizzes_required,
 (SELECT count(*) FROM learning_quizzes q WHERE q.course_id=c.id AND q.required=1 AND EXISTS(SELECT 1 FROM learning_quiz_attempts t WHERE t.quiz_id=q.id AND t.user_id=a.user_id AND t.passed=1)) quizzes_passed,
 (SELECT MAX((SELECT MIN(t.attempted_at) FROM learning_quiz_attempts t WHERE t.quiz_id=q.id AND t.user_id=a.user_id AND t.passed=1)) FROM learning_quizzes q WHERE q.course_id=c.id AND q.required=1) quiz_passed_at
 FROM learning_assignments a JOIN learning_courses c ON c.id=a.course_id`;
export interface CourseProgress {id:string;title:string;user_id:string;required:number;total:number;completed:number;quizzes_required:number;quizzes_passed:number;due_date:string|null;started_at:string|null;assigned_at:string;last_lesson_at:string|null;quiz_passed_at:string|null}
export function courseState(c:CourseProgress){
 const complete=c.total>0&&c.completed>=c.total&&c.quizzes_passed>=c.quizzes_required;
 return {...c,learning_status:complete?'Completed':c.started_at||c.completed?'In progress':'Not started',completed_at:complete?[c.last_lesson_at,c.quiz_passed_at].filter(Boolean).sort().at(-1)||null:null};
}
