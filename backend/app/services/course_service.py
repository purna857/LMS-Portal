from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.course import Course, CourseInstructor
from app.models.course_category import CourseCategory
from app.models.enrollment import Enrollment
from app.models.user import User, UserRole
from app.schemas.course import (
    CourseCategoryCreateRequest,
    CourseCategoryResponse,
    CourseCategoryUpdateRequest,
    CourseCreateRequest,
    CourseDetailResponse,
    CourseListItemResponse,
    CourseListResponse,
    CoursePublishActionResponse,
    CourseUpdateRequest,
)
from app.utils.datetime import utc_now


class CourseServiceError(Exception):
    pass


class CourseService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_course(self, current_user: User, payload: CourseCreateRequest) -> CourseDetailResponse:
        if not self._has_role(current_user, "instructor"):
            raise CourseServiceError("Only instructors can create courses")

        category_id = await self._validate_category(payload.category_id) if payload.category_id else None

        course = Course(
            category_id=category_id,
            title=payload.title.strip(),
            slug=payload.slug.strip().lower(),
            short_description=payload.short_description,
            description=payload.description,
            thumbnail_url=payload.thumbnail_url,
            level=payload.level,
            language=payload.language,
            visibility=payload.visibility,
            estimated_duration_minutes=payload.estimated_duration_minutes,
            is_featured=payload.is_featured,
            status="draft",
            created_by=current_user.id,
            updated_by=current_user.id,
        )
        self.session.add(course)
        try:
            await self.session.flush()
            self.session.add(
                CourseInstructor(
                    course_id=course.id,
                    instructor_id=current_user.id,
                    is_primary=True,
                )
            )
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise CourseServiceError("Course slug already exists") from exc

        return await self.get_course_detail(course.id, current_user)

    async def update_course(
        self,
        course_id: UUID,
        current_user: User,
        payload: CourseUpdateRequest,
    ) -> CourseDetailResponse:
        course = await self._get_course_or_raise(course_id)
        await self._ensure_manage_access(course, current_user)

        update_data = payload.model_dump(exclude_unset=True)
        if "category_id" in update_data:
            update_data["category_id"] = (
                await self._validate_category(update_data["category_id"])
                if update_data["category_id"]
                else None
            )
        if "title" in update_data and update_data["title"] is not None:
            update_data["title"] = update_data["title"].strip()
        if "slug" in update_data and update_data["slug"] is not None:
            update_data["slug"] = update_data["slug"].strip().lower()

        for field_name, value in update_data.items():
            setattr(course, field_name, value)
        course.updated_by = current_user.id

        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise CourseServiceError("Course slug already exists") from exc

        return await self.get_course_detail(course.id, current_user)

    async def delete_course(self, course_id: UUID, current_user: User) -> None:
        course = await self._get_course_or_raise(course_id)
        await self._ensure_manage_access(course, current_user)
        await self.session.delete(course)
        await self.session.commit()

    async def publish_course(self, course_id: UUID, current_user: User) -> CoursePublishActionResponse:
        course = await self._get_course_or_raise(course_id)
        await self._ensure_manage_access(course, current_user)
        course.status = "published"
        course.published_at = utc_now()
        course.archived_at = None
        course.updated_by = current_user.id
        await self.session.commit()
        return CoursePublishActionResponse(
            message="Course published successfully",
            course_id=str(course.id),
            status=course.status,
        )

    async def unpublish_course(self, course_id: UUID, current_user: User) -> CoursePublishActionResponse:
        course = await self._get_course_or_raise(course_id)
        await self._ensure_manage_access(course, current_user)
        course.status = "draft"
        course.published_at = None
        course.updated_by = current_user.id
        await self.session.commit()
        return CoursePublishActionResponse(
            message="Course unpublished successfully",
            course_id=str(course.id),
            status=course.status,
        )

    async def list_courses(
        self,
        current_user: User,
        limit: int,
        offset: int,
        search: str | None,
        category_id: str | None,
        level: str | None,
        language: str | None,
        status: str | None,
    ) -> CourseListResponse:
        filters = []
        query_role_codes = self._role_codes(current_user)

        if search:
            term = f"%{search.strip()}%"
            filters.append(
                or_(
                    Course.title.ilike(term),
                    Course.short_description.ilike(term),
                    Course.description.ilike(term),
                )
            )
        if category_id:
            try:
                filters.append(Course.category_id == UUID(category_id))
            except ValueError as exc:
                raise CourseServiceError("Invalid category id") from exc
        if level:
            filters.append(Course.level == level)
        if language:
            filters.append(Course.language == language)

        if current_user.is_superuser or "admin" in query_role_codes:
            if status:
                filters.append(Course.status == status)
        elif "instructor" in query_role_codes:
            ownership_filter = Course.instructors.any(CourseInstructor.instructor_id == current_user.id)
            owned_published_filter = and_(
                Course.status == "published",
                ownership_filter,
            )
            public_course_filter = and_(
                Course.status == "published",
                Course.visibility == "public",
            )
            if status:
                if status == "published":
                    filters.append(or_(owned_published_filter, public_course_filter))
                else:
                    filters.append(Course.status == status)
                    filters.append(ownership_filter)
            else:
                filters.append(or_(ownership_filter, public_course_filter))
        else:
            filters.append(Course.status == "published")
            filters.append(self._student_visibility_filter(current_user.id))
            if status and status != "published":
                raise CourseServiceError("Students can view only published courses")

        total_statement = select(func.count(Course.id))
        if filters:
            total_statement = total_statement.where(*filters)
        total = (await self.session.execute(total_statement)).scalar_one()

        statement = (
            select(Course)
            .options(
                selectinload(Course.category),
                selectinload(Course.instructors).selectinload(CourseInstructor.instructor),
            )
            .order_by(Course.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        if filters:
            statement = statement.where(*filters)

        courses = (await self.session.execute(statement)).scalars().all()
        items = [self._serialize_course_list_item(course) for course in courses]
        return CourseListResponse(items=items, total=total, limit=limit, offset=offset)

    async def list_instructor_courses(
        self,
        current_user: User,
        limit: int,
        offset: int,
        status: str | None,
    ) -> CourseListResponse:
        if not self._has_role(current_user, "instructor"):
            raise CourseServiceError("Only instructors can access their course list")

        filters = [Course.instructors.any(CourseInstructor.instructor_id == current_user.id)]
        if status:
            filters.append(Course.status == status)

        total_statement = select(func.count(Course.id)).where(*filters)
        total = (await self.session.execute(total_statement)).scalar_one()

        statement = (
            select(Course)
            .options(
                selectinload(Course.category),
                selectinload(Course.instructors).selectinload(CourseInstructor.instructor),
            )
            .where(*filters)
            .order_by(Course.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        courses = (await self.session.execute(statement)).scalars().all()
        return CourseListResponse(
            items=[self._serialize_course_list_item(course) for course in courses],
            total=total,
            limit=limit,
            offset=offset,
        )

    async def get_course_detail(self, course_id: UUID, current_user: User) -> CourseDetailResponse:
        course = await self._get_course_or_raise(course_id)
        if not await self._can_view_course(course, current_user):
            raise CourseServiceError("You do not have permission to view this course")

        category_payload = (
            CourseCategoryResponse(
                id=str(course.category.id),
                parent_id=str(course.category.parent_id) if course.category.parent_id else None,
                name=course.category.name,
                slug=course.category.slug,
                description=course.category.description,
                status=course.category.status,
                sort_order=course.category.sort_order,
                created_at=course.category.created_at,
                updated_at=course.category.updated_at,
            )
            if course.category is not None
            else None
        )
        return CourseDetailResponse(
            id=str(course.id),
            category=category_payload,
            title=course.title,
            slug=course.slug,
            short_description=course.short_description,
            description=course.description,
            thumbnail_url=course.thumbnail_url,
            level=course.level,
            language=course.language,
            status=course.status,
            visibility=course.visibility,
            estimated_duration_minutes=course.estimated_duration_minutes,
            is_featured=course.is_featured,
            published_at=course.published_at,
            archived_at=course.archived_at,
            created_by=str(course.created_by) if course.created_by else None,
            updated_by=str(course.updated_by) if course.updated_by else None,
            created_at=course.created_at,
            updated_at=course.updated_at,
            instructor_ids=[str(item.instructor_id) for item in course.instructors],
        )

    async def list_categories(self, active_only: bool = False) -> list[CourseCategoryResponse]:
        statement = select(CourseCategory).order_by(CourseCategory.sort_order.asc(), CourseCategory.name.asc())
        if active_only:
            statement = statement.where(CourseCategory.status == "active")
        categories = (await self.session.execute(statement)).scalars().all()
        return [
            CourseCategoryResponse(
                id=str(category.id),
                parent_id=str(category.parent_id) if category.parent_id else None,
                name=category.name,
                slug=category.slug,
                description=category.description,
                status=category.status,
                sort_order=category.sort_order,
                created_at=category.created_at,
                updated_at=category.updated_at,
            )
            for category in categories
        ]

    async def create_category(self, payload: CourseCategoryCreateRequest) -> CourseCategoryResponse:
        parent_id = await self._validate_parent_category(payload.parent_id) if payload.parent_id else None
        category = CourseCategory(
            parent_id=parent_id,
            name=payload.name.strip(),
            slug=payload.slug.strip().lower(),
            description=payload.description,
            status=payload.status,
            sort_order=payload.sort_order,
        )
        self.session.add(category)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise CourseServiceError("Category slug already exists") from exc
        return CourseCategoryResponse(
            id=str(category.id),
            parent_id=str(category.parent_id) if category.parent_id else None,
            name=category.name,
            slug=category.slug,
            description=category.description,
            status=category.status,
            sort_order=category.sort_order,
            created_at=category.created_at,
            updated_at=category.updated_at,
        )

    async def update_category(
        self,
        category_id: UUID,
        payload: CourseCategoryUpdateRequest,
    ) -> CourseCategoryResponse:
        category = await self._get_category_or_raise(category_id)
        update_data = payload.model_dump(exclude_unset=True)
        if "name" in update_data and update_data["name"] is not None:
            update_data["name"] = update_data["name"].strip()
        if "slug" in update_data and update_data["slug"] is not None:
            update_data["slug"] = update_data["slug"].strip().lower()
        if "parent_id" in update_data:
            update_data["parent_id"] = (
                await self._validate_parent_category(update_data["parent_id"], category.id)
                if update_data["parent_id"]
                else None
            )

        for field_name, value in update_data.items():
            setattr(category, field_name, value)

        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise CourseServiceError("Category slug already exists") from exc

        return CourseCategoryResponse(
            id=str(category.id),
            parent_id=str(category.parent_id) if category.parent_id else None,
            name=category.name,
            slug=category.slug,
            description=category.description,
            status=category.status,
            sort_order=category.sort_order,
            created_at=category.created_at,
            updated_at=category.updated_at,
        )

    async def delete_category(self, category_id: UUID) -> None:
        category = await self._get_category_or_raise(category_id)
        in_use = await self.session.execute(select(func.count(Course.id)).where(Course.category_id == category.id))
        if in_use.scalar_one() > 0:
            raise CourseServiceError("Category cannot be deleted because it is assigned to courses")
        await self.session.delete(category)
        await self.session.commit()

    async def _get_course_or_raise(self, course_id: UUID) -> Course:
        statement = (
            select(Course)
            .options(
                selectinload(Course.category),
                selectinload(Course.instructors).selectinload(CourseInstructor.instructor),
            )
            .where(Course.id == course_id)
        )
        course = (await self.session.execute(statement)).scalar_one_or_none()
        if course is None:
            raise CourseServiceError("Course not found")
        return course

    async def _get_category_or_raise(self, category_id: UUID) -> CourseCategory:
        statement = select(CourseCategory).where(CourseCategory.id == category_id)
        category = (await self.session.execute(statement)).scalar_one_or_none()
        if category is None:
            raise CourseServiceError("Category not found")
        return category

    async def _validate_category(self, category_id: str) -> UUID:
        try:
            category_uuid = UUID(category_id)
        except ValueError as exc:
            raise CourseServiceError("Invalid category id") from exc
        category = await self._get_category_or_raise(category_uuid)
        if category.status != "active":
            raise CourseServiceError("Only active categories can be assigned to courses")
        return category_uuid

    async def _validate_parent_category(
        self,
        parent_id: str,
        current_category_id: UUID | None = None,
    ) -> UUID:
        try:
            parent_uuid = UUID(parent_id)
        except ValueError as exc:
            raise CourseServiceError("Invalid parent category id") from exc
        if current_category_id and parent_uuid == current_category_id:
            raise CourseServiceError("Category cannot be its own parent")
        await self._get_category_or_raise(parent_uuid)
        return parent_uuid

    async def _ensure_manage_access(self, course: Course, current_user: User) -> None:
        if current_user.is_superuser or self._has_role(current_user, "admin"):
            return
        if self._has_role(current_user, "instructor") and any(
            item.instructor_id == current_user.id for item in course.instructors
        ):
            return
        raise CourseServiceError("You do not have permission to manage this course")

    async def _can_view_course(self, course: Course, current_user: User) -> bool:
        if current_user.is_superuser or self._has_role(current_user, "admin"):
            return True
        if self._has_role(current_user, "instructor"):
            if any(item.instructor_id == current_user.id for item in course.instructors):
                return True
        if course.status != "published":
            return False
        if course.visibility == "public":
            return True
        if "student" in self._role_codes(current_user):
            return await self._is_student_enrolled(course.id, current_user.id)
        return False

    async def _is_student_enrolled(self, course_id: UUID, user_id: UUID) -> bool:
        statement = select(Enrollment.id).where(
            Enrollment.course_id == course_id,
            Enrollment.user_id == user_id,
            Enrollment.status.in_(("active", "completed")),
        )
        return (await self.session.execute(statement)).scalar_one_or_none() is not None

    def _serialize_course_list_item(self, course: Course) -> CourseListItemResponse:
        primary_instructor = next((item for item in course.instructors if item.is_primary), None)
        primary_name = None
        primary_id = None
        if primary_instructor and primary_instructor.instructor:
            primary_id = str(primary_instructor.instructor_id)
            primary_name = (
                f"{primary_instructor.instructor.first_name} {primary_instructor.instructor.last_name}"
            ).strip()

        return CourseListItemResponse(
            id=str(course.id),
            category_id=str(course.category_id) if course.category_id else None,
            category_name=course.category.name if course.category else None,
            title=course.title,
            slug=course.slug,
            short_description=course.short_description,
            level=course.level,
            language=course.language,
            status=course.status,
            visibility=course.visibility,
            estimated_duration_minutes=course.estimated_duration_minutes,
            is_featured=course.is_featured,
            published_at=course.published_at,
            created_at=course.created_at,
            primary_instructor_id=primary_id,
            primary_instructor_name=primary_name,
        )

    def _role_codes(self, current_user: User) -> set[str]:
        return {assignment.role.code for assignment in current_user.roles}

    def _has_role(self, current_user: User, role_code: str) -> bool:
        return current_user.is_superuser or role_code in self._role_codes(current_user)

    def _student_visibility_filter(self, user_id: UUID) -> object:
        enrolled_course_ids = (
            select(Enrollment.course_id)
            .where(
                Enrollment.user_id == user_id,
                Enrollment.status.in_(("active", "completed")),
            )
        )
        return or_(
            Course.visibility == "public",
            Course.id.in_(enrolled_course_ids),
        )
