import re
from decimal import Decimal
from pathlib import Path
from uuid import UUID
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.assignment import Assignment, AssignmentSubmission
from app.models.course import Course, CourseInstructor
from app.models.course_module import CourseModule
from app.models.enrollment import Enrollment
from app.models.lesson import Lesson
from app.models.user import User
from app.schemas.assignment import (
    AssignmentCreateRequest,
    AssignmentFeedbackRequest,
    AssignmentGradeRequest,
    AssignmentListResponse,
    AssignmentResponse,
    AssignmentUploadResponse,
    AdminAssignmentTrackerItemResponse,
    AdminAssignmentTrackerListResponse,
    AssignmentSubmissionListItemResponse,
    AssignmentSubmissionListResponse,
    AssignmentSubmissionResponse,
    AssignmentSubmitRequest,
    AssignmentUpdateRequest,
    StudentAssignmentRecordListResponse,
    StudentAssignmentRecordResponse,
)
from app.utils.datetime import utc_now


class AssignmentServiceError(Exception):
    pass


class AssignmentService:
    _upload_root = Path(__file__).resolve().parents[2] / "uploads" / "assignments"
    _allowed_upload_suffixes = {
        ".pdf",
        ".doc",
        ".docx",
        ".txt",
        ".md",
        ".csv",
        ".xlsx",
        ".xls",
        ".ppt",
        ".pptx",
        ".png",
        ".jpg",
        ".jpeg",
        ".zip",
    }
    _max_upload_size_bytes = 10 * 1024 * 1024

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_assignment(
        self,
        course_id: UUID,
        current_user: User,
        payload: AssignmentCreateRequest,
    ) -> AssignmentResponse:
        course = await self._get_course_or_raise(course_id)
        await self._ensure_manage_access(course, current_user)
        module_id, lesson_id = await self._validate_assignment_scope(course.id, payload.module_id, payload.lesson_id)
        self._validate_scores(payload.max_score, payload.pass_score)

        assignment = Assignment(
            course_id=course.id,
            module_id=module_id,
            lesson_id=lesson_id,
            title=self._normalize_title(payload.title),
            description=payload.description,
            instructions=payload.instructions,
            max_score=Decimal(str(payload.max_score)),
            pass_score=Decimal(str(payload.pass_score)) if payload.pass_score is not None else None,
            due_at=payload.due_at,
            allow_late_submission=payload.allow_late_submission,
            status=payload.status,
            created_by=current_user.id,
        )
        self.session.add(assignment)
        await self.session.commit()
        await self.session.refresh(assignment)
        return self._serialize_assignment(assignment)

    async def update_assignment(
        self,
        assignment_id: UUID,
        current_user: User,
        payload: AssignmentUpdateRequest,
    ) -> AssignmentResponse:
        assignment = await self._get_assignment_or_raise(assignment_id)
        course = await self._get_course_or_raise(assignment.course_id)
        await self._ensure_manage_access(course, current_user)

        update_data = payload.model_dump(exclude_unset=True)
        next_max_score = update_data.get("max_score", float(assignment.max_score))
        next_pass_score = update_data.get(
            "pass_score",
            float(assignment.pass_score) if assignment.pass_score is not None else None,
        )
        self._validate_scores(next_max_score, next_pass_score)

        if "module_id" in update_data or "lesson_id" in update_data:
            module_id_value = update_data.get("module_id", str(assignment.module_id) if assignment.module_id else None)
            lesson_id_value = update_data.get("lesson_id", str(assignment.lesson_id) if assignment.lesson_id else None)
            module_id, lesson_id = await self._validate_assignment_scope(course.id, module_id_value, lesson_id_value)
            update_data["module_id"] = module_id
            update_data["lesson_id"] = lesson_id

        if "title" in update_data and update_data["title"] is not None:
            update_data["title"] = self._normalize_title(update_data["title"])
        if "max_score" in update_data and update_data["max_score"] is not None:
            update_data["max_score"] = Decimal(str(update_data["max_score"]))
        if "pass_score" in update_data:
            update_data["pass_score"] = (
                Decimal(str(update_data["pass_score"])) if update_data["pass_score"] is not None else None
            )

        for field_name, value in update_data.items():
            setattr(assignment, field_name, value)

        await self.session.commit()
        await self.session.refresh(assignment)
        return self._serialize_assignment(assignment)

    async def delete_assignment(self, assignment_id: UUID, current_user: User) -> None:
        assignment = await self._get_assignment_or_raise(assignment_id)
        course = await self._get_course_or_raise(assignment.course_id)
        await self._ensure_manage_access(course, current_user)
        await self.session.delete(assignment)
        await self.session.commit()

    async def list_assignments_by_course(
        self,
        course_id: UUID,
        current_user: User,
    ) -> AssignmentListResponse:
        course = await self._get_course_or_raise(course_id)
        if not await self._can_view_assignments(course, current_user):
            raise AssignmentServiceError("You do not have permission to view assignments for this course")

        statement = select(Assignment).where(Assignment.course_id == course.id).order_by(Assignment.created_at.desc())
        assignments = (await self.session.execute(statement)).scalars().all()

        can_manage = current_user.is_superuser or self._has_role(current_user, "admin") or (
            self._has_role(current_user, "instructor")
            and any(item.instructor_id == current_user.id for item in course.instructors)
        )
        if not can_manage:
            assignments = [item for item in assignments if item.status == "published"]

        return AssignmentListResponse(
            items=[self._serialize_assignment(item) for item in assignments],
            total=len(assignments),
        )

    async def submit_assignment(
        self,
        assignment_id: UUID,
        current_user: User,
        payload: AssignmentSubmitRequest,
    ) -> AssignmentSubmissionResponse:
        if not self._has_explicit_role(current_user, "student"):
            raise AssignmentServiceError("Only students can submit assignments")

        assignment = await self._get_assignment_or_raise(assignment_id)
        if assignment.status != "published":
            raise AssignmentServiceError("Only published assignments can be submitted")

        course = await self._get_course_or_raise(assignment.course_id)
        if course.status != "published":
            raise AssignmentServiceError("Assignments cannot be submitted for unpublished courses")

        enrollment = await self._get_active_enrollment_or_raise(current_user.id, assignment.course_id)
        self._validate_submission_payload(payload)
        is_late = assignment.due_at is not None and utc_now() > assignment.due_at
        if is_late and not assignment.allow_late_submission:
            raise AssignmentServiceError("Assignment due date has passed")

        existing_submission = await self._get_submission_by_enrollment(enrollment.id, assignment.id)
        if existing_submission is not None:
            raise AssignmentServiceError("Assignment has already been submitted")

        submission = AssignmentSubmission(
            assignment_id=assignment.id,
            enrollment_id=enrollment.id,
            submission_text=self._normalize_optional_text(payload.submission_text),
            submission_link=self._normalize_optional_text(payload.submission_link),
            submission_file_url=self._normalize_optional_text(payload.submission_file_url),
            submission_file_name=self._normalize_optional_text(payload.submission_file_name),
            submission_file_size_bytes=payload.submission_file_size_bytes,
            status="late_submitted" if is_late else "submitted",
            submitted_at=utc_now(),
            is_late=is_late,
        )
        self.session.add(submission)
        await self.session.commit()
        await self.session.refresh(submission)
        return self._serialize_submission(submission)

    async def list_assignment_submissions(
        self,
        assignment_id: UUID,
        current_user: User,
    ) -> AssignmentSubmissionListResponse:
        assignment = await self._get_assignment_or_raise(assignment_id)
        course = await self._get_course_or_raise(assignment.course_id)
        await self._ensure_manage_access(course, current_user)

        statement = (
            select(AssignmentSubmission)
            .options(selectinload(AssignmentSubmission.enrollment).selectinload(Enrollment.user))
            .where(AssignmentSubmission.assignment_id == assignment.id)
            .order_by(AssignmentSubmission.submitted_at.desc())
        )
        submissions = (await self.session.execute(statement)).scalars().all()
        items = [
            AssignmentSubmissionListItemResponse(
                submission_id=str(item.id),
                student_id=str(item.enrollment.user_id),
                student_name=f"{item.enrollment.user.first_name} {item.enrollment.user.last_name}".strip(),
                student_email=item.enrollment.user.email,
                submission_text=item.submission_text,
                submission_link=item.submission_link,
                submission_file_url=item.submission_file_url,
                submission_file_name=item.submission_file_name,
                submission_file_size_bytes=item.submission_file_size_bytes,
                feedback=item.feedback,
                status=item.status,
                submitted_at=item.submitted_at,
                graded_at=item.graded_at,
                score=float(item.score) if item.score is not None else None,
                is_late=item.is_late,
            )
            for item in submissions
        ]
        return AssignmentSubmissionListResponse(items=items, total=len(items))

    async def upload_submission_file(
        self,
        current_user: User,
        file: UploadFile,
    ) -> AssignmentUploadResponse:
        if not self._has_explicit_role(current_user, "student"):
            raise AssignmentServiceError("Only students can upload assignment files")
        if not file.filename:
            raise AssignmentServiceError("Uploaded file must include a filename")

        suffix = Path(file.filename).suffix.lower()
        if suffix not in self._allowed_upload_suffixes:
            raise AssignmentServiceError("Unsupported assignment file type")

        contents = await file.read()
        if not contents:
            raise AssignmentServiceError("Uploaded file is empty")
        if len(contents) > self._max_upload_size_bytes:
            raise AssignmentServiceError("Uploaded file exceeds the 10 MB limit")

        self._upload_root.mkdir(parents=True, exist_ok=True)
        sanitized_stem = re.sub(r"[^a-zA-Z0-9_-]+", "-", Path(file.filename).stem).strip("-") or "submission"
        stored_name = f"{uuid4().hex}-{sanitized_stem}{suffix}"
        stored_path = self._upload_root / stored_name
        stored_path.write_bytes(contents)

        return AssignmentUploadResponse(
            file_url=f"/uploads/assignments/{stored_name}",
            file_name=file.filename,
            file_size_bytes=len(contents),
        )

    async def list_student_assignment_records(
        self,
        current_user: User,
    ) -> StudentAssignmentRecordListResponse:
        if not self._has_explicit_role(current_user, "student"):
            raise AssignmentServiceError("Only students can view their assignment records")

        statement = (
            select(AssignmentSubmission, Assignment, Course)
            .join(Enrollment, Enrollment.id == AssignmentSubmission.enrollment_id)
            .join(Assignment, Assignment.id == AssignmentSubmission.assignment_id)
            .join(Course, Course.id == Assignment.course_id)
            .where(Enrollment.user_id == current_user.id)
            .order_by(AssignmentSubmission.submitted_at.desc())
        )
        rows = (await self.session.execute(statement)).all()
        items = [
            StudentAssignmentRecordResponse(
                submission_id=str(submission.id),
                assignment_id=str(assignment.id),
                assignment_title=assignment.title,
                course_id=str(course.id),
                course_title=course.title,
                submission_text=submission.submission_text,
                submission_link=submission.submission_link,
                submission_file_url=submission.submission_file_url,
                submission_file_name=submission.submission_file_name,
                submission_file_size_bytes=submission.submission_file_size_bytes,
                status=submission.status,
                submitted_at=submission.submitted_at,
                graded_at=submission.graded_at,
                score=float(submission.score) if submission.score is not None else None,
                feedback=submission.feedback,
                is_late=submission.is_late,
            )
            for submission, assignment, course in rows
        ]
        return StudentAssignmentRecordListResponse(items=items, total=len(items))

    async def list_admin_assignment_tracker(
        self,
        current_user: User,
    ) -> AdminAssignmentTrackerListResponse:
        if not (current_user.is_superuser or self._has_role(current_user, "admin")):
            raise AssignmentServiceError("You do not have permission to view assignment tracking")

        statement = (
            select(AssignmentSubmission, Assignment, Enrollment, User, Course)
            .join(Assignment, Assignment.id == AssignmentSubmission.assignment_id)
            .join(Enrollment, Enrollment.id == AssignmentSubmission.enrollment_id)
            .join(User, User.id == Enrollment.user_id)
            .join(Course, Course.id == Assignment.course_id)
            .order_by(AssignmentSubmission.submitted_at.desc())
        )
        rows = (await self.session.execute(statement)).all()
        items = [
            AdminAssignmentTrackerItemResponse(
                submission_id=str(submission.id),
                assignment_id=str(assignment.id),
                assignment_title=assignment.title,
                course_id=str(course.id),
                course_title=course.title,
                student_id=str(student.id),
                student_name=f"{student.first_name} {student.last_name}".strip(),
                student_email=student.email,
                status=submission.status,
                submitted_at=submission.submitted_at,
                graded_at=submission.graded_at,
                score=float(submission.score) if submission.score is not None else None,
                max_score=float(assignment.max_score),
                feedback=submission.feedback,
                is_late=submission.is_late,
                submission_file_url=submission.submission_file_url,
                submission_file_name=submission.submission_file_name,
            )
            for submission, assignment, _enrollment, student, course in rows
        ]
        return AdminAssignmentTrackerListResponse(items=items, total=len(items))

    async def grade_submission(
        self,
        submission_id: UUID,
        current_user: User,
        payload: AssignmentGradeRequest,
    ) -> AssignmentSubmissionResponse:
        submission = await self._get_submission_or_raise(submission_id)
        assignment = await self._get_assignment_or_raise(submission.assignment_id)
        course = await self._get_course_or_raise(assignment.course_id)
        await self._ensure_manage_access(course, current_user)

        if payload.score > float(assignment.max_score):
            raise AssignmentServiceError("Score cannot exceed assignment max_score")

        submission.score = Decimal(str(payload.score))
        submission.feedback = self._normalize_optional_text(payload.feedback)
        submission.graded_at = utc_now()
        submission.graded_by = current_user.id
        submission.status = "graded"

        await self.session.commit()
        await self.session.refresh(submission)
        return self._serialize_submission(submission)

    async def add_feedback(
        self,
        submission_id: UUID,
        current_user: User,
        payload: AssignmentFeedbackRequest,
    ) -> AssignmentSubmissionResponse:
        submission = await self._get_submission_or_raise(submission_id)
        assignment = await self._get_assignment_or_raise(submission.assignment_id)
        course = await self._get_course_or_raise(assignment.course_id)
        await self._ensure_manage_access(course, current_user)

        submission.feedback = self._normalize_optional_text(payload.feedback)
        if submission.status in {"submitted", "late_submitted"}:
            submission.status = "returned"

        await self.session.commit()
        await self.session.refresh(submission)
        return self._serialize_submission(submission)

    async def _get_course_or_raise(self, course_id: UUID) -> Course:
        statement = (
            select(Course)
            .options(selectinload(Course.instructors).selectinload(CourseInstructor.instructor))
            .where(Course.id == course_id)
        )
        course = (await self.session.execute(statement)).scalar_one_or_none()
        if course is None:
            raise AssignmentServiceError("Course not found")
        return course

    async def _get_assignment_or_raise(self, assignment_id: UUID) -> Assignment:
        statement = select(Assignment).where(Assignment.id == assignment_id)
        assignment = (await self.session.execute(statement)).scalar_one_or_none()
        if assignment is None:
            raise AssignmentServiceError("Assignment not found")
        return assignment

    async def _get_submission_or_raise(self, submission_id: UUID) -> AssignmentSubmission:
        statement = (
            select(AssignmentSubmission)
            .options(selectinload(AssignmentSubmission.enrollment))
            .where(AssignmentSubmission.id == submission_id)
        )
        submission = (await self.session.execute(statement)).scalar_one_or_none()
        if submission is None:
            raise AssignmentServiceError("Assignment submission not found")
        return submission

    async def _get_active_enrollment_or_raise(self, user_id: UUID, course_id: UUID) -> Enrollment:
        statement = (
            select(Enrollment)
            .where(
                Enrollment.user_id == user_id,
                Enrollment.course_id == course_id,
                Enrollment.status.in_(("active", "completed")),
            )
        )
        enrollment = (await self.session.execute(statement)).scalar_one_or_none()
        if enrollment is None:
            raise AssignmentServiceError("Student is not enrolled in this course")
        return enrollment

    async def _get_submission_by_enrollment(
        self,
        enrollment_id: UUID,
        assignment_id: UUID,
    ) -> AssignmentSubmission | None:
        statement = select(AssignmentSubmission).where(
            AssignmentSubmission.enrollment_id == enrollment_id,
            AssignmentSubmission.assignment_id == assignment_id,
        )
        return (await self.session.execute(statement)).scalar_one_or_none()

    async def _validate_assignment_scope(
        self,
        course_id: UUID,
        module_id: str | None,
        lesson_id: str | None,
    ) -> tuple[UUID | None, UUID | None]:
        module_uuid = None
        lesson_uuid = None

        if module_id:
            try:
                module_uuid = UUID(module_id)
            except ValueError as exc:
                raise AssignmentServiceError("Invalid module_id") from exc
            module = await self._get_module_or_raise(module_uuid)
            if module.course_id != course_id:
                raise AssignmentServiceError("Module does not belong to the given course")

        if lesson_id:
            try:
                lesson_uuid = UUID(lesson_id)
            except ValueError as exc:
                raise AssignmentServiceError("Invalid lesson_id") from exc
            lesson = await self._get_lesson_or_raise(lesson_uuid)
            if module_uuid and lesson.module_id != module_uuid:
                raise AssignmentServiceError("Lesson does not belong to the given module")
            if not module_uuid:
                module_uuid = lesson.module_id
                module = await self._get_module_or_raise(module_uuid)
                if module.course_id != course_id:
                    raise AssignmentServiceError("Lesson does not belong to the given course")

        return module_uuid, lesson_uuid

    async def _get_module_or_raise(self, module_id: UUID) -> CourseModule:
        statement = select(CourseModule).where(CourseModule.id == module_id)
        module = (await self.session.execute(statement)).scalar_one_or_none()
        if module is None:
            raise AssignmentServiceError("Course module not found")
        return module

    async def _get_lesson_or_raise(self, lesson_id: UUID) -> Lesson:
        statement = select(Lesson).where(Lesson.id == lesson_id)
        lesson = (await self.session.execute(statement)).scalar_one_or_none()
        if lesson is None:
            raise AssignmentServiceError("Lesson not found")
        return lesson

    async def _ensure_manage_access(self, course: Course, current_user: User) -> None:
        if current_user.is_superuser or self._has_role(current_user, "admin"):
            return
        if self._has_role(current_user, "instructor") and any(
            item.instructor_id == current_user.id for item in course.instructors
        ):
            return
        raise AssignmentServiceError("You do not have permission to manage assignments for this course")

    async def _can_view_assignments(self, course: Course, current_user: User) -> bool:
        if current_user.is_superuser or self._has_role(current_user, "admin"):
            return True
        if self._has_role(current_user, "instructor"):
            return any(item.instructor_id == current_user.id for item in course.instructors)
        if self._has_explicit_role(current_user, "student"):
            enrollment = await self._get_active_enrollment_or_raise_if_exists(current_user.id, course.id)
            return course.status == "published" and enrollment is not None
        return False

    async def _get_active_enrollment_or_raise_if_exists(
        self,
        user_id: UUID,
        course_id: UUID,
    ) -> Enrollment | None:
        statement = select(Enrollment).where(
            Enrollment.user_id == user_id,
            Enrollment.course_id == course_id,
            Enrollment.status.in_(("active", "completed")),
        )
        return (await self.session.execute(statement)).scalar_one_or_none()

    def _validate_scores(self, max_score: float, pass_score: float | None) -> None:
        if pass_score is not None and pass_score > max_score:
            raise AssignmentServiceError("pass_score cannot exceed max_score")

    def _validate_submission_payload(self, payload: AssignmentSubmitRequest) -> None:
        submission_text = payload.submission_text.strip() if payload.submission_text else ""
        submission_link = payload.submission_link.strip() if payload.submission_link else ""
        submission_file_url = payload.submission_file_url.strip() if payload.submission_file_url else ""
        if not submission_text and not submission_link and not submission_file_url:
            raise AssignmentServiceError("Submission must include text, link, or an uploaded file")

    def _normalize_optional_text(self, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    def _normalize_title(self, title: str) -> str:
        normalized = title.strip()
        if not normalized:
            raise AssignmentServiceError("Assignment title cannot be empty")
        return normalized

    def _serialize_assignment(self, assignment: Assignment) -> AssignmentResponse:
        return AssignmentResponse(
            id=str(assignment.id),
            course_id=str(assignment.course_id),
            module_id=str(assignment.module_id) if assignment.module_id else None,
            lesson_id=str(assignment.lesson_id) if assignment.lesson_id else None,
            title=assignment.title,
            description=assignment.description,
            instructions=assignment.instructions,
            max_score=float(assignment.max_score),
            pass_score=float(assignment.pass_score) if assignment.pass_score is not None else None,
            due_at=assignment.due_at,
            allow_late_submission=assignment.allow_late_submission,
            status=assignment.status,
            created_by=str(assignment.created_by) if assignment.created_by else None,
            created_at=assignment.created_at,
            updated_at=assignment.updated_at,
        )

    def _serialize_submission(self, submission: AssignmentSubmission) -> AssignmentSubmissionResponse:
        return AssignmentSubmissionResponse(
            id=str(submission.id),
            assignment_id=str(submission.assignment_id),
            enrollment_id=str(submission.enrollment_id),
            submission_text=submission.submission_text,
            submission_link=submission.submission_link,
            submission_file_url=submission.submission_file_url,
            submission_file_name=submission.submission_file_name,
            submission_file_size_bytes=submission.submission_file_size_bytes,
            status=submission.status,
            submitted_at=submission.submitted_at,
            graded_at=submission.graded_at,
            graded_by=str(submission.graded_by) if submission.graded_by else None,
            score=float(submission.score) if submission.score is not None else None,
            feedback=submission.feedback,
            is_late=submission.is_late,
            created_at=submission.created_at,
            updated_at=submission.updated_at,
        )

    def _role_codes(self, current_user: User) -> set[str]:
        return {assignment.role.code for assignment in current_user.roles}

    def _has_role(self, current_user: User, role_code: str) -> bool:
        return current_user.is_superuser or role_code in self._role_codes(current_user)

    def _has_explicit_role(self, current_user: User, role_code: str) -> bool:
        return role_code in self._role_codes(current_user)
