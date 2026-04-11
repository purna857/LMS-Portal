from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.course import Course, CourseInstructor
from app.models.course_module import CourseModule
from app.models.enrollment import Enrollment
from app.models.lesson import Lesson
from app.models.user import User
from app.schemas.lesson import LessonCreateRequest, LessonListResponse, LessonResponse, LessonUpdateRequest


class LessonServiceError(Exception):
    pass


class LessonService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_lesson(
        self,
        module_id: UUID,
        current_user: User,
        payload: LessonCreateRequest,
    ) -> LessonResponse:
        module = await self._get_module_or_raise(module_id)
        course = await self._get_course_or_raise(module.course_id)
        await self._ensure_manage_access(course, current_user)
        self._validate_lesson_payload(payload.lesson_type, payload.content, payload.video_url, payload.resource_url)

        existing_lessons = await self._get_module_lessons(module.id)
        insert_position = payload.position or (len(existing_lessons) + 1)
        self._validate_position(insert_position, len(existing_lessons) + 1)

        lesson = Lesson(
            module_id=module.id,
            title=self._normalize_title(payload.title),
            lesson_type=payload.lesson_type,
            content=self._normalized_content(payload.lesson_type, payload.content),
            video_url=self._normalized_video_url(payload.lesson_type, payload.video_url),
            resource_url=self._normalized_resource_url(payload.lesson_type, payload.resource_url),
            duration_minutes=payload.duration_minutes,
            position=len(existing_lessons) + 1,
            status=payload.status,
            is_preview=payload.is_preview,
        )
        self.session.add(lesson)
        await self.session.flush()

        reordered_lessons = existing_lessons[:]
        reordered_lessons.insert(insert_position - 1, lesson)
        await self._resequence_lessons(reordered_lessons)

        await self.session.commit()
        await self.session.refresh(lesson)
        return self._serialize_lesson(lesson)

    async def update_lesson(
        self,
        lesson_id: UUID,
        current_user: User,
        payload: LessonUpdateRequest,
    ) -> LessonResponse:
        lesson = await self._get_lesson_or_raise(lesson_id)
        module = await self._get_module_or_raise(lesson.module_id)
        course = await self._get_course_or_raise(module.course_id)
        await self._ensure_manage_access(course, current_user)

        existing_lessons = await self._get_module_lessons(module.id)
        if payload.position is not None and payload.position != lesson.position:
            self._validate_position(payload.position, len(existing_lessons))
            remaining_lessons = [item for item in existing_lessons if item.id != lesson.id]
            remaining_lessons.insert(payload.position - 1, lesson)
            await self._resequence_lessons(remaining_lessons)

        update_data = payload.model_dump(exclude_unset=True, exclude={"position"})
        next_lesson_type = update_data.get("lesson_type", lesson.lesson_type)
        next_content = update_data["content"] if "content" in update_data else lesson.content
        next_video_url = update_data["video_url"] if "video_url" in update_data else lesson.video_url
        next_resource_url = update_data["resource_url"] if "resource_url" in update_data else lesson.resource_url
        self._validate_lesson_payload(next_lesson_type, next_content, next_video_url, next_resource_url)

        if "title" in update_data and update_data["title"] is not None:
            update_data["title"] = self._normalize_title(update_data["title"])

        update_data["content"] = self._normalized_content(next_lesson_type, next_content)
        update_data["video_url"] = self._normalized_video_url(next_lesson_type, next_video_url)
        update_data["resource_url"] = self._normalized_resource_url(next_lesson_type, next_resource_url)

        for field_name, value in update_data.items():
            setattr(lesson, field_name, value)

        await self.session.commit()
        await self.session.refresh(lesson)
        return self._serialize_lesson(lesson)

    async def delete_lesson(self, lesson_id: UUID, current_user: User) -> None:
        lesson = await self._get_lesson_or_raise(lesson_id)
        module_id = lesson.module_id
        module = await self._get_module_or_raise(module_id)
        course = await self._get_course_or_raise(module.course_id)
        await self._ensure_manage_access(course, current_user)

        await self.session.delete(lesson)
        await self.session.flush()

        remaining_lessons = await self._get_module_lessons(module_id)
        await self._resequence_lessons(remaining_lessons)

        await self.session.commit()

    async def list_lessons_by_module(
        self,
        module_id: UUID,
        current_user: User,
    ) -> LessonListResponse:
        module = await self._get_module_or_raise(module_id)
        course = await self._get_course_or_raise(module.course_id)
        if not await self._can_view_lessons(course, current_user):
            raise LessonServiceError("You do not have permission to view lessons for this module")

        lessons = await self._get_module_lessons(module.id)

        can_manage = current_user.is_superuser or self._has_role(current_user, "admin") or (
            self._has_role(current_user, "instructor")
            and any(item.instructor_id == current_user.id for item in course.instructors)
        )

        if not can_manage:
            student_enrolled = self._has_role(current_user, "student") and await self._is_student_enrolled(
                course.id,
                current_user.id,
            )
            if student_enrolled:
                lessons = [lesson for lesson in lessons if lesson.status == "published"]
            else:
                lessons = [
                    lesson
                    for lesson in lessons
                    if lesson.status == "published" and lesson.is_preview
                ]

        return LessonListResponse(
            items=[self._serialize_lesson(lesson) for lesson in lessons],
            total=len(lessons),
        )

    async def _get_course_or_raise(self, course_id: UUID) -> Course:
        statement = (
            select(Course)
            .options(selectinload(Course.instructors).selectinload(CourseInstructor.instructor))
            .where(Course.id == course_id)
        )
        course = (await self.session.execute(statement)).scalar_one_or_none()
        if course is None:
            raise LessonServiceError("Course not found")
        return course

    async def _get_module_or_raise(self, module_id: UUID) -> CourseModule:
        statement = select(CourseModule).where(CourseModule.id == module_id)
        module = (await self.session.execute(statement)).scalar_one_or_none()
        if module is None:
            raise LessonServiceError("Course module not found")
        return module

    async def _get_lesson_or_raise(self, lesson_id: UUID) -> Lesson:
        statement = select(Lesson).where(Lesson.id == lesson_id)
        lesson = (await self.session.execute(statement)).scalar_one_or_none()
        if lesson is None:
            raise LessonServiceError("Lesson not found")
        return lesson

    async def _get_module_lessons(self, module_id: UUID) -> list[Lesson]:
        statement = (
            select(Lesson)
            .where(Lesson.module_id == module_id)
            .order_by(Lesson.position.asc(), Lesson.created_at.asc())
        )
        return list((await self.session.execute(statement)).scalars().all())

    async def _resequence_lessons(self, lessons: list[Lesson]) -> None:
        temp_offset = len(lessons) + 1000
        for index, lesson in enumerate(lessons, start=1):
            lesson.position = temp_offset + index
        await self.session.flush()

        for index, lesson in enumerate(lessons, start=1):
            lesson.position = index
        await self.session.flush()

    async def _ensure_manage_access(self, course: Course, current_user: User) -> None:
        if current_user.is_superuser or self._has_role(current_user, "admin"):
            return
        if self._has_role(current_user, "instructor") and any(
            item.instructor_id == current_user.id for item in course.instructors
        ):
            return
        raise LessonServiceError("You do not have permission to manage lessons for this course")

    async def _can_view_lessons(self, course: Course, current_user: User) -> bool:
        if current_user.is_superuser or self._has_role(current_user, "admin"):
            return True
        if self._has_role(current_user, "instructor"):
            return any(item.instructor_id == current_user.id for item in course.instructors)
        if course.status != "published":
            return self._has_role(current_user, "student") and await self._is_student_enrolled(course.id, current_user.id)
        if self._has_role(current_user, "student"):
            return True
        return False

    async def _is_student_enrolled(self, course_id: UUID, user_id: UUID) -> bool:
        statement = select(Enrollment).where(
            Enrollment.course_id == course_id,
            Enrollment.user_id == user_id,
            Enrollment.status.in_(("active", "completed")),
        )
        enrollment = (await self.session.execute(statement)).scalar_one_or_none()
        return enrollment is not None

    def _validate_position(self, position: int, max_position: int) -> None:
        if position < 1 or position > max_position:
            raise LessonServiceError(f"Position must be between 1 and {max_position}")

    def _validate_lesson_payload(
        self,
        lesson_type: str,
        content: str | None,
        video_url: str | None,
        resource_url: str | None,
    ) -> None:
        if lesson_type == "video" and not video_url:
            raise LessonServiceError("Video lessons require a video_url")
        if lesson_type == "text" and not content:
            raise LessonServiceError("Text lessons require content")
        if lesson_type == "resource_link" and not resource_url:
            raise LessonServiceError("Resource link lessons require a resource_url")

    def _normalize_title(self, title: str) -> str:
        normalized_title = title.strip()
        if not normalized_title:
            raise LessonServiceError("Lesson title cannot be empty")
        return normalized_title

    def _normalized_content(self, lesson_type: str, content: str | None) -> str | None:
        if lesson_type != "text":
            return None
        normalized = content.strip() if content else ""
        return normalized or None

    def _normalized_video_url(self, lesson_type: str, video_url: str | None) -> str | None:
        if lesson_type != "video":
            return None
        normalized = video_url.strip() if video_url else ""
        return normalized or None

    def _normalized_resource_url(self, lesson_type: str, resource_url: str | None) -> str | None:
        if lesson_type != "resource_link":
            return None
        normalized = resource_url.strip() if resource_url else ""
        return normalized or None

    def _serialize_lesson(self, lesson: Lesson) -> LessonResponse:
        return LessonResponse(
            id=str(lesson.id),
            module_id=str(lesson.module_id),
            title=lesson.title,
            lesson_type=lesson.lesson_type,
            content=lesson.content,
            video_url=lesson.video_url,
            resource_url=lesson.resource_url,
            duration_minutes=lesson.duration_minutes,
            position=lesson.position,
            status=lesson.status,
            is_preview=lesson.is_preview,
            created_at=lesson.created_at,
            updated_at=lesson.updated_at,
        )

    def _role_codes(self, current_user: User) -> set[str]:
        return {assignment.role.code for assignment in current_user.roles}

    def _has_role(self, current_user: User, role_code: str) -> bool:
        return current_user.is_superuser or role_code in self._role_codes(current_user)
