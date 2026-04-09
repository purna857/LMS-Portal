from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.course import Course, CourseInstructor
from app.models.course_module import CourseModule
from app.models.enrollment import Enrollment
from app.models.user import User
from app.schemas.course import (
    CourseModuleCreateRequest,
    CourseModuleListResponse,
    CourseModuleResponse,
    CourseModuleUpdateRequest,
)


class CourseModuleServiceError(Exception):
    pass


class CourseModuleService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_module(
        self,
        course_id: UUID,
        current_user: User,
        payload: CourseModuleCreateRequest,
    ) -> CourseModuleResponse:
        course = await self._get_course_or_raise(course_id)
        await self._ensure_manage_access(course, current_user)

        existing_modules = await self._get_course_modules(course.id)
        insert_position = payload.position or (len(existing_modules) + 1)
        self._validate_position(insert_position, len(existing_modules) + 1)

        module = CourseModule(
            course_id=course.id,
            title=self._normalize_title(payload.title),
            description=payload.description,
            position=len(existing_modules) + 1,
            status=payload.status,
            is_preview=payload.is_preview,
        )
        self.session.add(module)
        await self.session.flush()

        reordered_modules = existing_modules[:]
        reordered_modules.insert(insert_position - 1, module)
        await self._resequence_modules(reordered_modules)

        await self.session.commit()
        await self.session.refresh(module)
        return self._serialize_module(module)

    async def update_module(
        self,
        module_id: UUID,
        current_user: User,
        payload: CourseModuleUpdateRequest,
    ) -> CourseModuleResponse:
        module = await self._get_module_or_raise(module_id)
        course = await self._get_course_or_raise(module.course_id)
        await self._ensure_manage_access(course, current_user)
        existing_modules = await self._get_course_modules(course.id)

        if payload.position is not None and payload.position != module.position:
            self._validate_position(payload.position, len(existing_modules))
            remaining_modules = [item for item in existing_modules if item.id != module.id]
            remaining_modules.insert(payload.position - 1, module)
            await self._resequence_modules(remaining_modules)

        update_data = payload.model_dump(exclude_unset=True, exclude={"position"})
        if "title" in update_data and update_data["title"] is not None:
            update_data["title"] = self._normalize_title(update_data["title"])

        for field_name, value in update_data.items():
            setattr(module, field_name, value)

        await self.session.commit()
        await self.session.refresh(module)
        return self._serialize_module(module)

    async def delete_module(self, module_id: UUID, current_user: User) -> None:
        module = await self._get_module_or_raise(module_id)
        course = await self._get_course_or_raise(module.course_id)
        await self._ensure_manage_access(course, current_user)

        deleted_position = module.position
        course_id = module.course_id
        await self.session.delete(module)
        await self.session.flush()

        modules = await self._get_course_modules(course_id)
        await self._resequence_modules(modules)

        await self.session.commit()

    async def list_modules_by_course(
        self,
        course_id: UUID,
        current_user: User,
    ) -> CourseModuleListResponse:
        course = await self._get_course_or_raise(course_id)
        if not await self._can_view_modules(course, current_user):
            raise CourseModuleServiceError("You do not have permission to view modules for this course")

        modules = await self._get_course_modules(course.id)
        if not (current_user.is_superuser or self._has_role(current_user, "admin")):
            if not (
                self._has_role(current_user, "instructor")
                and any(item.instructor_id == current_user.id for item in course.instructors)
            ):
                modules = [module for module in modules if module.status == "published"]

        return CourseModuleListResponse(
            items=[self._serialize_module(module) for module in modules],
            total=len(modules),
        )

    async def _get_course_or_raise(self, course_id: UUID) -> Course:
        statement = (
            select(Course)
            .options(selectinload(Course.instructors).selectinload(CourseInstructor.instructor))
            .where(Course.id == course_id)
        )
        course = (await self.session.execute(statement)).scalar_one_or_none()
        if course is None:
            raise CourseModuleServiceError("Course not found")
        return course

    async def _get_module_or_raise(self, module_id: UUID) -> CourseModule:
        statement = select(CourseModule).where(CourseModule.id == module_id)
        module = (await self.session.execute(statement)).scalar_one_or_none()
        if module is None:
            raise CourseModuleServiceError("Course module not found")
        return module

    async def _get_course_modules(self, course_id: UUID) -> list[CourseModule]:
        statement = (
            select(CourseModule)
            .where(CourseModule.course_id == course_id)
            .order_by(CourseModule.position.asc(), CourseModule.created_at.asc())
        )
        return list((await self.session.execute(statement)).scalars().all())

    async def _resequence_modules(self, modules: list[CourseModule]) -> None:
        temp_offset = len(modules) + 1000
        for index, module in enumerate(modules, start=1):
            module.position = temp_offset + index
        await self.session.flush()

        for index, module in enumerate(modules, start=1):
            module.position = index
        await self.session.flush()

    async def _ensure_manage_access(self, course: Course, current_user: User) -> None:
        if current_user.is_superuser or self._has_role(current_user, "admin"):
            return
        if self._has_role(current_user, "instructor") and any(
            item.instructor_id == current_user.id for item in course.instructors
        ):
            return
        raise CourseModuleServiceError("You do not have permission to manage modules for this course")

    async def _can_view_modules(self, course: Course, current_user: User) -> bool:
        if current_user.is_superuser or self._has_role(current_user, "admin"):
            return True
        if self._has_role(current_user, "instructor"):
            return any(item.instructor_id == current_user.id for item in course.instructors)
        if self._has_role(current_user, "student"):
            if course.status != "published":
                return False
            return await self._is_student_enrolled(course.id, current_user.id)
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
            raise CourseModuleServiceError(f"Position must be between 1 and {max_position}")

    def _normalize_title(self, title: str) -> str:
        normalized_title = title.strip()
        if not normalized_title:
            raise CourseModuleServiceError("Module title cannot be empty")
        return normalized_title

    def _serialize_module(self, module: CourseModule) -> CourseModuleResponse:
        return CourseModuleResponse(
            id=str(module.id),
            course_id=str(module.course_id),
            title=module.title,
            description=module.description,
            position=module.position,
            status=module.status,
            is_preview=module.is_preview,
            created_at=module.created_at,
            updated_at=module.updated_at,
        )

    def _role_codes(self, current_user: User) -> set[str]:
        return {assignment.role.code for assignment in current_user.roles}

    def _has_role(self, current_user: User, role_code: str) -> bool:
        return current_user.is_superuser or role_code in self._role_codes(current_user)
