from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.course import Course, CourseInstructor
from app.models.enrollment import Enrollment
from app.models.quiz import Quiz, QuizAttempt, QuizAttemptAnswer, QuizQuestion, QuizQuestionOption
from app.models.user import User
from app.schemas.quiz import (
    QuizAttemptHistoryItemResponse,
    QuizAttemptHistoryResponse,
    QuizAttemptResultResponse,
    QuizAttemptSubmitRequest,
    QuizCreateRequest,
    QuizDetailResponse,
    QuizListItemResponse,
    QuizListResponse,
    QuizQuestionCreateRequest,
    QuizQuestionOptionResponse,
    QuizQuestionResponse,
    QuizQuestionUpdateRequest,
    QuizUpdateRequest,
)
from app.utils.datetime import utc_now


class QuizServiceError(Exception):
    pass


class QuizService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_quiz(self, course_id: UUID, current_user: User, payload: QuizCreateRequest) -> QuizDetailResponse:
        course = await self._get_course_or_raise(course_id)
        await self._ensure_manage_access(course, current_user)
        if payload.status == "published":
            raise QuizServiceError("Create the quiz as draft first, then add questions before publishing")

        quiz = Quiz(
            course_id=course.id,
            title=self._normalize_required_text(payload.title, "Quiz title"),
            description=self._normalize_optional_text(payload.description),
            instructions=self._normalize_optional_text(payload.instructions),
            passing_score=Decimal(str(payload.passing_score)) if payload.passing_score is not None else None,
            max_attempts=payload.max_attempts,
            shuffle_questions=payload.shuffle_questions,
            status=payload.status,
            created_by=current_user.id,
            updated_by=current_user.id,
            published_at=utc_now() if payload.status == "published" else None,
        )
        self.session.add(quiz)
        await self.session.commit()
        return await self.get_quiz_detail(quiz.id, current_user)

    async def update_quiz(
        self,
        quiz_id: UUID,
        current_user: User,
        payload: QuizUpdateRequest,
    ) -> QuizDetailResponse:
        quiz = await self._get_quiz_or_raise(quiz_id)
        course = await self._get_course_or_raise(quiz.course_id)
        await self._ensure_manage_access(course, current_user)

        update_data = payload.model_dump(exclude_unset=True)
        if "title" in update_data and update_data["title"] is not None:
            update_data["title"] = self._normalize_required_text(update_data["title"], "Quiz title")
        if "description" in update_data:
            update_data["description"] = self._normalize_optional_text(update_data["description"])
        if "instructions" in update_data:
            update_data["instructions"] = self._normalize_optional_text(update_data["instructions"])
        if "passing_score" in update_data:
            update_data["passing_score"] = (
                Decimal(str(update_data["passing_score"])) if update_data["passing_score"] is not None else None
            )
        if "status" in update_data and update_data["status"] == "published":
            proposed_passing_score = update_data.get("passing_score", quiz.passing_score)
            await self._validate_quiz_can_be_published(quiz, proposed_passing_score)
            if quiz.published_at is None:
                update_data["published_at"] = utc_now()
        if "status" in update_data and update_data["status"] != "published":
            update_data["published_at"] = None
        elif quiz.status == "published" and "passing_score" in update_data:
            await self._validate_quiz_can_be_published(quiz, update_data["passing_score"])

        for field_name, value in update_data.items():
            setattr(quiz, field_name, value)
        quiz.updated_by = current_user.id

        await self.session.commit()
        return await self.get_quiz_detail(quiz.id, current_user)

    async def delete_quiz(self, quiz_id: UUID, current_user: User) -> None:
        quiz = await self._get_quiz_or_raise(quiz_id)
        course = await self._get_course_or_raise(quiz.course_id)
        await self._ensure_manage_access(course, current_user)
        await self.session.delete(quiz)
        await self.session.commit()

    async def add_question(
        self,
        quiz_id: UUID,
        current_user: User,
        payload: QuizQuestionCreateRequest,
    ) -> QuizQuestionResponse:
        quiz = await self._get_quiz_or_raise(quiz_id)
        course = await self._get_course_or_raise(quiz.course_id)
        await self._ensure_manage_access(course, current_user)
        await self._ensure_quiz_structure_editable(quiz)
        self._validate_question_options(payload.allow_multiple_answers, payload.options)

        existing_questions = await self._get_quiz_questions(quiz.id)
        insert_position = payload.position or (len(existing_questions) + 1)
        self._validate_position(insert_position, len(existing_questions) + 1, "Question position")

        question = QuizQuestion(
            quiz_id=quiz.id,
            question_text=self._normalize_required_text(payload.question_text, "Question text"),
            explanation=self._normalize_optional_text(payload.explanation),
            points=Decimal(str(payload.points)),
            position=len(existing_questions) + 1,
            allow_multiple_answers=payload.allow_multiple_answers,
        )
        self.session.add(question)
        await self.session.flush()
        self._add_question_options(question, payload.options)
        reordered_questions = existing_questions[:]
        reordered_questions.insert(insert_position - 1, question)
        await self._resequence_questions(reordered_questions)
        if quiz.status == "published":
            await self._validate_quiz_can_be_published(quiz, quiz.passing_score)

        await self.session.commit()
        return await self.get_question_detail(question.id, current_user)

    async def update_question(
        self,
        question_id: UUID,
        current_user: User,
        payload: QuizQuestionUpdateRequest,
    ) -> QuizQuestionResponse:
        question = await self._get_question_or_raise(question_id)
        quiz = await self._get_quiz_or_raise(question.quiz_id)
        course = await self._get_course_or_raise(quiz.course_id)
        await self._ensure_manage_access(course, current_user)
        await self._ensure_quiz_structure_editable(quiz)

        existing_questions = await self._get_quiz_questions(quiz.id)
        if payload.position is not None and payload.position != question.position:
            self._validate_position(payload.position, len(existing_questions), "Question position")
            remaining_questions = [item for item in existing_questions if item.id != question.id]
            remaining_questions.insert(payload.position - 1, question)
            await self._resequence_questions(remaining_questions)

        update_data = payload.model_dump(exclude_unset=True, exclude={"position"})
        next_allow_multiple = update_data.get("allow_multiple_answers", question.allow_multiple_answers)
        next_options = update_data.get(
            "options",
            [
                {"option_text": option.option_text, "is_correct": option.is_correct}
                for option in question.options
            ],
        )
        self._validate_question_options(next_allow_multiple, next_options)

        if "question_text" in update_data and update_data["question_text"] is not None:
            update_data["question_text"] = self._normalize_required_text(update_data["question_text"], "Question text")
        if "explanation" in update_data:
            update_data["explanation"] = self._normalize_optional_text(update_data["explanation"])
        if "points" in update_data and update_data["points"] is not None:
            update_data["points"] = Decimal(str(update_data["points"]))

        options_payload = update_data.pop("options", None)
        for field_name, value in update_data.items():
            setattr(question, field_name, value)

        if options_payload is not None:
            question.options.clear()
            await self.session.flush()
            self._add_question_options(question, options_payload)
        if quiz.status == "published":
            await self._validate_quiz_can_be_published(quiz, quiz.passing_score)

        await self.session.commit()
        return await self.get_question_detail(question.id, current_user)

    async def delete_question(self, question_id: UUID, current_user: User) -> None:
        question = await self._get_question_or_raise(question_id)
        quiz = await self._get_quiz_or_raise(question.quiz_id)
        course = await self._get_course_or_raise(quiz.course_id)
        await self._ensure_manage_access(course, current_user)
        await self._ensure_quiz_structure_editable(quiz)

        quiz_id = quiz.id
        await self.session.delete(question)
        await self.session.flush()
        remaining_questions = await self._get_quiz_questions(quiz_id)
        if quiz.status == "published":
            if len(remaining_questions) == 0:
                raise QuizServiceError("Published quizzes must keep at least one question")
            total_points = sum(Decimal(str(item.points)) for item in remaining_questions)
            if quiz.passing_score is not None and Decimal(str(quiz.passing_score)) > total_points:
                raise QuizServiceError("Published quiz passing score cannot exceed remaining total points")
        await self._resequence_questions(remaining_questions)
        await self.session.commit()

    async def list_quizzes_by_course(self, course_id: UUID, current_user: User) -> QuizListResponse:
        course = await self._get_course_or_raise(course_id)
        if not await self._can_view_course_quizzes(course, current_user):
            raise QuizServiceError("You do not have permission to view quizzes for this course")

        statement = (
            select(Quiz)
            .options(selectinload(Quiz.questions))
            .where(Quiz.course_id == course.id)
            .order_by(Quiz.created_at.desc())
        )
        quizzes = (await self.session.execute(statement)).scalars().all()

        can_manage = current_user.is_superuser or self._has_role(current_user, "admin") or (
            self._has_role(current_user, "instructor")
            and any(item.instructor_id == current_user.id for item in course.instructors)
        )
        if not can_manage:
            quizzes = [quiz for quiz in quizzes if quiz.status == "published"]

        items = [self._serialize_quiz_list_item(quiz) for quiz in quizzes]
        return QuizListResponse(items=items, total=len(items))

    async def get_quiz_detail(self, quiz_id: UUID, current_user: User) -> QuizDetailResponse:
        quiz = await self._get_quiz_or_raise(quiz_id)
        course = await self._get_course_or_raise(quiz.course_id)
        if not await self._can_view_quiz(quiz, course, current_user):
            raise QuizServiceError("You do not have permission to view this quiz")
        return self._serialize_quiz_detail(quiz, include_correct_answers=self._can_manage_course(course, current_user))

    async def get_question_detail(self, question_id: UUID, current_user: User) -> QuizQuestionResponse:
        question = await self._get_question_or_raise(question_id)
        quiz = await self._get_quiz_or_raise(question.quiz_id)
        course = await self._get_course_or_raise(quiz.course_id)
        if not await self._can_view_quiz(quiz, course, current_user):
            raise QuizServiceError("You do not have permission to view this quiz question")
        return self._serialize_question(question, include_correct_answers=self._can_manage_course(course, current_user))

    async def submit_quiz_attempt(
        self,
        quiz_id: UUID,
        current_user: User,
        payload: QuizAttemptSubmitRequest,
    ) -> QuizAttemptResultResponse:
        if not self._has_explicit_role(current_user, "student"):
            raise QuizServiceError("Only students can attempt quizzes")

        quiz = await self._get_quiz_or_raise(quiz_id)
        course = await self._get_course_or_raise(quiz.course_id)
        if quiz.status != "published":
            raise QuizServiceError("Only published quizzes can be attempted")
        if course.status != "published":
            raise QuizServiceError("Quizzes cannot be attempted for unpublished courses")
        if not quiz.questions:
            raise QuizServiceError("Quiz does not contain any questions")

        enrollment = await self._get_active_enrollment_or_raise(current_user.id, course.id)
        existing_attempt_count = await self._count_attempts(quiz.id, enrollment.id)
        if existing_attempt_count >= quiz.max_attempts:
            raise QuizServiceError("Maximum quiz attempts reached")

        answers_by_question = self._normalize_attempt_answers(payload.answers)
        quiz_question_ids = {question.id for question in quiz.questions}
        unknown_question_ids = set(answers_by_question).difference(quiz_question_ids)
        if unknown_question_ids:
            raise QuizServiceError("Quiz attempt contains answers for questions outside this quiz")
        total_points = Decimal("0")
        earned_score = Decimal("0")

        attempt = QuizAttempt(
            quiz_id=quiz.id,
            enrollment_id=enrollment.id,
            attempt_number=existing_attempt_count + 1,
            submitted_at=utc_now(),
            score=Decimal("0"),
            total_points=Decimal("0"),
            percentage=Decimal("0"),
            passed=False,
        )
        self.session.add(attempt)
        await self.session.flush()

        for question in quiz.questions:
            selected_option_ids = answers_by_question.get(question.id, set())
            self._validate_selected_options(question, selected_option_ids)

            correct_option_ids = {option.id for option in question.options if option.is_correct}
            is_correct = selected_option_ids == correct_option_ids
            question_points = Decimal(str(question.points))
            earned_points = question_points if is_correct else Decimal("0")
            total_points += question_points
            earned_score += earned_points

            self.session.add(
                QuizAttemptAnswer(
                    attempt_id=attempt.id,
                    question_id=question.id,
                    selected_option_ids=[str(option_id) for option_id in sorted(selected_option_ids, key=str)],
                    is_correct=is_correct,
                    earned_points=earned_points,
                )
            )

        percentage = Decimal("0")
        if total_points > 0:
            percentage = (earned_score / total_points) * Decimal("100")
        passing_score = Decimal(str(quiz.passing_score)) if quiz.passing_score is not None else None
        passed = earned_score >= passing_score if passing_score is not None else True

        attempt.score = earned_score
        attempt.total_points = total_points
        attempt.percentage = percentage.quantize(Decimal("0.01"))
        attempt.passed = passed

        await self.session.commit()
        return await self.get_attempt_result(attempt.id, current_user)

    async def get_attempt_history(self, quiz_id: UUID, current_user: User) -> QuizAttemptHistoryResponse:
        if not self._has_explicit_role(current_user, "student"):
            raise QuizServiceError("Only students can view quiz attempt history")

        quiz = await self._get_quiz_or_raise(quiz_id)
        statement = (
            select(QuizAttempt)
            .join(Enrollment, Enrollment.id == QuizAttempt.enrollment_id)
            .where(
                QuizAttempt.quiz_id == quiz.id,
                Enrollment.user_id == current_user.id,
            )
            .order_by(QuizAttempt.attempt_number.desc())
        )
        attempts = (await self.session.execute(statement)).scalars().all()
        items = [
            QuizAttemptHistoryItemResponse(
                attempt_id=str(attempt.id),
                attempt_number=attempt.attempt_number,
                score=float(attempt.score),
                total_points=float(attempt.total_points),
                percentage=float(attempt.percentage),
                passed=attempt.passed,
                submitted_at=attempt.submitted_at,
            )
            for attempt in attempts
        ]
        return QuizAttemptHistoryResponse(items=items, total=len(items))

    async def get_attempt_result(self, attempt_id: UUID, current_user: User) -> QuizAttemptResultResponse:
        attempt = await self._get_attempt_or_raise(attempt_id)
        quiz = await self._get_quiz_or_raise(attempt.quiz_id)
        course = await self._get_course_or_raise(quiz.course_id)

        if not self._can_manage_course(course, current_user):
            if self._has_explicit_role(current_user, "student"):
                if attempt.enrollment.user_id != current_user.id:
                    raise QuizServiceError("You do not have permission to view this quiz result")
            else:
                raise QuizServiceError("You do not have permission to view this quiz result")

        return self._serialize_attempt_result(attempt, quiz)

    async def _get_course_or_raise(self, course_id: UUID) -> Course:
        statement = (
            select(Course)
            .options(selectinload(Course.instructors).selectinload(CourseInstructor.instructor))
            .where(Course.id == course_id)
        )
        course = (await self.session.execute(statement)).scalar_one_or_none()
        if course is None:
            raise QuizServiceError("Course not found")
        return course

    async def _get_quiz_or_raise(self, quiz_id: UUID) -> Quiz:
        statement = (
            select(Quiz)
            .options(
                selectinload(Quiz.questions).selectinload(QuizQuestion.options),
                selectinload(Quiz.attempts),
            )
            .where(Quiz.id == quiz_id)
        )
        quiz = (await self.session.execute(statement)).scalar_one_or_none()
        if quiz is None:
            raise QuizServiceError("Quiz not found")
        return quiz

    async def _get_question_or_raise(self, question_id: UUID) -> QuizQuestion:
        statement = (
            select(QuizQuestion)
            .options(selectinload(QuizQuestion.options))
            .where(QuizQuestion.id == question_id)
        )
        question = (await self.session.execute(statement)).scalar_one_or_none()
        if question is None:
            raise QuizServiceError("Quiz question not found")
        return question

    async def _get_attempt_or_raise(self, attempt_id: UUID) -> QuizAttempt:
        statement = (
            select(QuizAttempt)
            .options(
                selectinload(QuizAttempt.enrollment).selectinload(Enrollment.user),
                selectinload(QuizAttempt.answers)
                .selectinload(QuizAttemptAnswer.question)
                .selectinload(QuizQuestion.options),
            )
            .where(QuizAttempt.id == attempt_id)
        )
        attempt = (await self.session.execute(statement)).scalar_one_or_none()
        if attempt is None:
            raise QuizServiceError("Quiz attempt not found")
        return attempt

    async def _get_quiz_questions(self, quiz_id: UUID) -> list[QuizQuestion]:
        statement = (
            select(QuizQuestion)
            .options(selectinload(QuizQuestion.options))
            .where(QuizQuestion.quiz_id == quiz_id)
            .order_by(QuizQuestion.position.asc(), QuizQuestion.created_at.asc())
        )
        return list((await self.session.execute(statement)).scalars().all())

    async def _ensure_manage_access(self, course: Course, current_user: User) -> None:
        if current_user.is_superuser or self._has_role(current_user, "admin"):
            return
        if self._has_role(current_user, "instructor") and any(
            item.instructor_id == current_user.id for item in course.instructors
        ):
            return
        raise QuizServiceError("You do not have permission to manage quizzes for this course")

    async def _ensure_quiz_structure_editable(self, quiz: Quiz) -> None:
        if quiz.attempts:
            raise QuizServiceError("Quiz questions cannot be changed after attempts have been submitted")

    async def _can_view_course_quizzes(self, course: Course, current_user: User) -> bool:
        if self._can_manage_course(course, current_user):
            return True
        if self._has_explicit_role(current_user, "student"):
            if course.status != "published":
                return False
            return await self._get_active_enrollment_or_none(current_user.id, course.id) is not None
        return False

    async def _can_view_quiz(self, quiz: Quiz, course: Course, current_user: User) -> bool:
        if self._can_manage_course(course, current_user):
            return True
        if self._has_explicit_role(current_user, "student"):
            enrollment = await self._get_active_enrollment_or_none(current_user.id, course.id)
            return course.status == "published" and quiz.status == "published" and enrollment is not None
        return False

    async def _validate_quiz_can_be_published(self, quiz: Quiz, passing_score: Decimal | float | None) -> None:
        if not quiz.questions:
            raise QuizServiceError("Quiz must have at least one question before publishing")
        total_points = Decimal("0")
        for question in quiz.questions:
            self._validate_existing_question_options(question)
            total_points += Decimal(str(question.points))
        if passing_score is not None and Decimal(str(passing_score)) > total_points:
            raise QuizServiceError("Passing score cannot exceed total quiz points")

    async def _get_active_enrollment_or_raise(self, user_id: UUID, course_id: UUID) -> Enrollment:
        enrollment = await self._get_active_enrollment_or_none(user_id, course_id)
        if enrollment is None:
            raise QuizServiceError("Student is not enrolled in this course")
        return enrollment

    async def _get_active_enrollment_or_none(self, user_id: UUID, course_id: UUID) -> Enrollment | None:
        statement = (
            select(Enrollment)
            .where(
                Enrollment.user_id == user_id,
                Enrollment.course_id == course_id,
                Enrollment.status.in_(("active", "completed")),
            )
        )
        return (await self.session.execute(statement)).scalar_one_or_none()

    async def _count_attempts(self, quiz_id: UUID, enrollment_id: UUID) -> int:
        statement = select(func.count(QuizAttempt.id)).where(
            QuizAttempt.quiz_id == quiz_id,
            QuizAttempt.enrollment_id == enrollment_id,
        )
        return (await self.session.execute(statement)).scalar_one()

    async def _resequence_questions(self, questions: list[QuizQuestion]) -> None:
        temp_offset = len(questions) + 1000
        for index, question in enumerate(questions, start=1):
            question.position = temp_offset + index
        await self.session.flush()

        for index, question in enumerate(questions, start=1):
            question.position = index
        await self.session.flush()

    def _add_question_options(self, question: QuizQuestion, options: list[object]) -> None:
        for index, option in enumerate(options, start=1):
            option_text = option.option_text if hasattr(option, "option_text") else option["option_text"]
            is_correct = option.is_correct if hasattr(option, "is_correct") else option["is_correct"]
            question.options.append(
                QuizQuestionOption(
                    option_text=self._normalize_required_text(option_text, "Option text"),
                    position=index,
                    is_correct=is_correct,
                )
            )

    def _validate_question_options(self, allow_multiple_answers: bool, options: list[object]) -> None:
        if len(options) < 2:
            raise QuizServiceError("Quiz questions must have at least two options")
        correct_count = 0
        for option in options:
            option_text = option.option_text if hasattr(option, "option_text") else option["option_text"]
            is_correct = option.is_correct if hasattr(option, "is_correct") else option["is_correct"]
            normalized_text = option_text.strip() if isinstance(option_text, str) else ""
            if not normalized_text:
                raise QuizServiceError("Quiz question options cannot be empty")
            if is_correct:
                correct_count += 1
        if correct_count == 0:
            raise QuizServiceError("Quiz questions must have at least one correct option")
        if not allow_multiple_answers and correct_count != 1:
            raise QuizServiceError("Single-answer questions must have exactly one correct option")

    def _validate_existing_question_options(self, question: QuizQuestion) -> None:
        self._validate_question_options(
            question.allow_multiple_answers,
            [{"option_text": option.option_text, "is_correct": option.is_correct} for option in question.options],
        )

    def _validate_position(self, position: int, max_position: int, label: str) -> None:
        if position < 1 or position > max_position:
            raise QuizServiceError(f"{label} must be between 1 and {max_position}")

    def _normalize_attempt_answers(self, answers: list[object]) -> dict[UUID, set[UUID]]:
        answers_by_question: dict[UUID, set[UUID]] = {}
        for answer in answers:
            question_id_value = answer.question_id if hasattr(answer, "question_id") else answer["question_id"]
            selected_option_values = (
                answer.selected_option_ids if hasattr(answer, "selected_option_ids") else answer["selected_option_ids"]
            )
            try:
                question_id = UUID(question_id_value)
            except ValueError as exc:
                raise QuizServiceError("Invalid question_id in quiz answers") from exc
            if question_id in answers_by_question:
                raise QuizServiceError("Each quiz question can only be answered once per attempt")

            selected_option_ids: set[UUID] = set()
            for option_id_value in selected_option_values:
                try:
                    selected_option_ids.add(UUID(option_id_value))
                except ValueError as exc:
                    raise QuizServiceError("Invalid selected option id in quiz answers") from exc
            answers_by_question[question_id] = selected_option_ids
        return answers_by_question

    def _validate_selected_options(self, question: QuizQuestion, selected_option_ids: set[UUID]) -> None:
        valid_option_ids = {option.id for option in question.options}
        if not selected_option_ids.issubset(valid_option_ids):
            raise QuizServiceError("Selected options do not belong to the given quiz question")
        if not question.allow_multiple_answers and len(selected_option_ids) > 1:
            raise QuizServiceError("Single-answer quiz questions accept only one selected option")

    def _normalize_required_text(self, value: str, label: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise QuizServiceError(f"{label} cannot be empty")
        return normalized

    def _normalize_optional_text(self, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    def _serialize_question(self, question: QuizQuestion, include_correct_answers: bool = True) -> QuizQuestionResponse:
        return QuizQuestionResponse(
            id=str(question.id),
            quiz_id=str(question.quiz_id),
            question_text=question.question_text,
            explanation=question.explanation,
            points=float(question.points),
            position=question.position,
            allow_multiple_answers=question.allow_multiple_answers,
            options=[
                QuizQuestionOptionResponse(
                    id=str(option.id),
                    option_text=option.option_text,
                    position=option.position,
                    is_correct=option.is_correct if include_correct_answers else False,
                )
                for option in question.options
            ],
            created_at=question.created_at,
            updated_at=question.updated_at,
        )

    def _serialize_quiz_list_item(self, quiz: Quiz) -> QuizListItemResponse:
        total_points = sum(float(question.points) for question in quiz.questions)
        return QuizListItemResponse(
            id=str(quiz.id),
            course_id=str(quiz.course_id),
            title=quiz.title,
            description=quiz.description,
            passing_score=float(quiz.passing_score) if quiz.passing_score is not None else None,
            max_attempts=quiz.max_attempts,
            shuffle_questions=quiz.shuffle_questions,
            status=quiz.status,
            question_count=len(quiz.questions),
            total_points=total_points,
            published_at=quiz.published_at,
            created_at=quiz.created_at,
        )

    def _serialize_quiz_detail(self, quiz: Quiz, include_correct_answers: bool = True) -> QuizDetailResponse:
        total_points = sum(float(question.points) for question in quiz.questions)
        return QuizDetailResponse(
            id=str(quiz.id),
            course_id=str(quiz.course_id),
            title=quiz.title,
            description=quiz.description,
            instructions=quiz.instructions,
            passing_score=float(quiz.passing_score) if quiz.passing_score is not None else None,
            max_attempts=quiz.max_attempts,
            shuffle_questions=quiz.shuffle_questions,
            status=quiz.status,
            published_at=quiz.published_at,
            question_count=len(quiz.questions),
            total_points=total_points,
            questions=[
                self._serialize_question(question, include_correct_answers=include_correct_answers)
                for question in quiz.questions
            ],
            created_by=str(quiz.created_by) if quiz.created_by else None,
            updated_by=str(quiz.updated_by) if quiz.updated_by else None,
            created_at=quiz.created_at,
            updated_at=quiz.updated_at,
        )

    def _serialize_attempt_result(self, attempt: QuizAttempt, quiz: Quiz) -> QuizAttemptResultResponse:
        answer_map = {answer.question_id: answer for answer in attempt.answers}
        answer_results = []
        for question in quiz.questions:
            answer = answer_map.get(question.id)
            correct_option_ids = [str(option.id) for option in question.options if option.is_correct]
            selected_option_ids = answer.selected_option_ids if answer is not None else []
            answer_results.append(
                {
                    "question_id": str(question.id),
                    "question_text": question.question_text,
                    "selected_option_ids": selected_option_ids,
                    "correct_option_ids": correct_option_ids,
                    "is_correct": answer.is_correct if answer is not None else False,
                    "earned_points": float(answer.earned_points) if answer is not None else 0.0,
                    "max_points": float(question.points),
                }
            )

        return QuizAttemptResultResponse(
            attempt_id=str(attempt.id),
            quiz_id=str(attempt.quiz_id),
            enrollment_id=str(attempt.enrollment_id),
            attempt_number=attempt.attempt_number,
            score=float(attempt.score),
            total_points=float(attempt.total_points),
            percentage=float(attempt.percentage),
            passed=attempt.passed,
            submitted_at=attempt.submitted_at,
            answers=answer_results,
        )

    def _role_codes(self, current_user: User) -> set[str]:
        return {assignment.role.code for assignment in current_user.roles}

    def _can_manage_course(self, course: Course, current_user: User) -> bool:
        return current_user.is_superuser or self._has_role(current_user, "admin") or (
            self._has_role(current_user, "instructor")
            and any(item.instructor_id == current_user.id for item in course.instructors)
        )

    def _has_role(self, current_user: User, role_code: str) -> bool:
        return current_user.is_superuser or role_code in self._role_codes(current_user)

    def _has_explicit_role(self, current_user: User, role_code: str) -> bool:
        return role_code in self._role_codes(current_user)
