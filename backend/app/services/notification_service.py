from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.announcement import Announcement, Notification
from app.models.course import Course, CourseInstructor
from app.models.enrollment import Enrollment
from app.models.role import Role
from app.models.user import User, UserRole
from app.schemas.notification import (
    AnnouncementResponse,
    CourseAnnouncementCreateRequest,
    NotificationListResponse,
    NotificationResponse,
    PlatformAnnouncementCreateRequest,
)
from app.utils.datetime import utc_now


class NotificationServiceError(Exception):
    pass


class NotificationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_platform_announcement(
        self,
        current_user: User,
        payload: PlatformAnnouncementCreateRequest,
    ) -> AnnouncementResponse:
        target_roles = self._normalize_roles(payload.target_roles or [])
        await self._validate_target_roles(target_roles)
        recipients = await self._get_platform_recipient_ids(target_roles)
        if not recipients:
            raise NotificationServiceError("No active users match the selected announcement audience")

        announcement = Announcement(
            announcement_type="platform",
            title=self._normalize_required_text(payload.title, "Announcement title"),
            body=self._normalize_required_text(payload.body, "Announcement body"),
            target_roles=",".join(target_roles) if target_roles else None,
            include_students=False,
            include_instructors=False,
            created_by=current_user.id,
        )
        self.session.add(announcement)
        await self.session.flush()

        for user_id in recipients:
            self.session.add(
                Notification(
                    user_id=user_id,
                    announcement_id=announcement.id,
                    notification_type="platform_announcement" if not target_roles else "role_notification",
                    title=announcement.title,
                    body=announcement.body,
                )
            )

        await self.session.commit()
        return self._serialize_announcement(announcement)

    async def create_course_announcement(
        self,
        course_id: UUID,
        current_user: User,
        payload: CourseAnnouncementCreateRequest,
    ) -> AnnouncementResponse:
        if not payload.include_students and not payload.include_instructors:
            raise NotificationServiceError("Course announcements must target at least one audience")

        course = await self._get_course_or_raise(course_id)
        await self._ensure_course_manage_access(course, current_user)

        recipients = await self._get_course_recipient_ids(
            course.id,
            include_students=payload.include_students,
            include_instructors=payload.include_instructors,
        )
        if not recipients:
            raise NotificationServiceError("No recipients match the selected course announcement audience")

        announcement = Announcement(
            announcement_type="course",
            course_id=course.id,
            title=self._normalize_required_text(payload.title, "Announcement title"),
            body=self._normalize_required_text(payload.body, "Announcement body"),
            target_roles=None,
            include_students=payload.include_students,
            include_instructors=payload.include_instructors,
            created_by=current_user.id,
        )
        self.session.add(announcement)
        await self.session.flush()

        for user_id in recipients:
            self.session.add(
                Notification(
                    user_id=user_id,
                    announcement_id=announcement.id,
                    course_id=course.id,
                    notification_type="course_announcement",
                    title=announcement.title,
                    body=announcement.body,
                )
            )

        await self.session.commit()
        return self._serialize_announcement(announcement)

    async def list_user_notifications(self, current_user: User) -> NotificationListResponse:
        statement = (
            select(Notification)
            .where(Notification.user_id == current_user.id)
            .order_by(Notification.created_at.desc())
        )
        notifications = (await self.session.execute(statement)).scalars().all()
        return NotificationListResponse(
            items=[self._serialize_notification(item) for item in notifications],
            total=len(notifications),
        )

    async def mark_notification_read(self, notification_id: UUID, current_user: User) -> NotificationResponse:
        statement = select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        notification = (await self.session.execute(statement)).scalar_one_or_none()
        if notification is None:
            raise NotificationServiceError("Notification not found")

        if not notification.is_read or notification.read_at is None:
            notification.is_read = True
            notification.read_at = utc_now()
            await self.session.commit()

        return self._serialize_notification(notification)

    async def _get_course_or_raise(self, course_id: UUID) -> Course:
        statement = (
            select(Course)
            .options(selectinload(Course.instructors).selectinload(CourseInstructor.instructor))
            .where(Course.id == course_id)
        )
        course = (await self.session.execute(statement)).scalar_one_or_none()
        if course is None:
            raise NotificationServiceError("Course not found")
        return course

    async def _ensure_course_manage_access(self, course: Course, current_user: User) -> None:
        if current_user.is_superuser or self._has_role(current_user, "admin"):
            return
        if self._has_role(current_user, "instructor") and any(
            item.instructor_id == current_user.id for item in course.instructors
        ):
            return
        raise NotificationServiceError("You do not have permission to manage announcements for this course")

    async def _get_platform_recipient_ids(self, target_roles: list[str]) -> list[UUID]:
        statement = (
            select(User)
            .options(selectinload(User.roles).selectinload(UserRole.role))
            .where(User.status == "active")
        )
        users = (await self.session.execute(statement)).scalars().all()
        recipient_ids: list[UUID] = []
        for user in users:
            role_codes = {assignment.role.code for assignment in user.roles}
            if not target_roles or role_codes.intersection(target_roles):
                recipient_ids.append(user.id)
        return recipient_ids

    async def _get_course_recipient_ids(
        self,
        course_id: UUID,
        include_students: bool,
        include_instructors: bool,
    ) -> list[UUID]:
        recipient_ids: set[UUID] = set()

        if include_students:
            statement = (
                select(Enrollment.user_id)
                .join(User, User.id == Enrollment.user_id)
                .where(
                    Enrollment.course_id == course_id,
                    Enrollment.status.in_(("active", "completed")),
                    User.status == "active",
                )
            )
            rows = (await self.session.execute(statement)).all()
            recipient_ids.update(row[0] for row in rows)

        if include_instructors:
            statement = (
                select(CourseInstructor.instructor_id)
                .join(User, User.id == CourseInstructor.instructor_id)
                .where(
                    CourseInstructor.course_id == course_id,
                    User.status == "active",
                )
            )
            rows = (await self.session.execute(statement)).all()
            recipient_ids.update(row[0] for row in rows)

        return list(recipient_ids)

    async def _validate_target_roles(self, target_roles: list[str]) -> None:
        if not target_roles:
            return
        statement = select(Role.code).where(Role.status == "active")
        rows = (await self.session.execute(statement)).all()
        active_role_codes = {row[0] for row in rows}
        invalid_roles = [role for role in target_roles if role not in active_role_codes]
        if invalid_roles:
            raise NotificationServiceError(
                f"Invalid target roles: {', '.join(sorted(invalid_roles))}"
            )

    def _normalize_roles(self, roles: list[str]) -> list[str]:
        normalized_roles = sorted({role.strip().lower() for role in roles if role and role.strip()})
        return normalized_roles

    def _normalize_required_text(self, value: str, label: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise NotificationServiceError(f"{label} cannot be empty")
        return normalized

    def _serialize_announcement(self, announcement: Announcement) -> AnnouncementResponse:
        target_roles = announcement.target_roles.split(",") if announcement.target_roles else []
        return AnnouncementResponse(
            id=str(announcement.id),
            announcement_type=announcement.announcement_type,
            course_id=str(announcement.course_id) if announcement.course_id else None,
            title=announcement.title,
            body=announcement.body,
            target_roles=target_roles,
            include_students=announcement.include_students,
            include_instructors=announcement.include_instructors,
            created_by=str(announcement.created_by) if announcement.created_by else None,
            created_at=announcement.created_at,
        )

    def _serialize_notification(self, notification: Notification) -> NotificationResponse:
        return NotificationResponse(
            id=str(notification.id),
            announcement_id=str(notification.announcement_id) if notification.announcement_id else None,
            course_id=str(notification.course_id) if notification.course_id else None,
            notification_type=notification.notification_type,
            title=notification.title,
            body=notification.body,
            is_read=notification.is_read,
            read_at=notification.read_at,
            created_at=notification.created_at,
        )

    def _role_codes(self, current_user: User) -> set[str]:
        return {assignment.role.code for assignment in current_user.roles}

    def _has_role(self, current_user: User, role_code: str) -> bool:
        return current_user.is_superuser or role_code in self._role_codes(current_user)
