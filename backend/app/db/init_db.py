import asyncio

from sqlalchemy import text

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import (
    Announcement,
    Assignment,
    AssignmentSubmission,
    Course,
    CourseCategory,
    CourseInstructor,
    CourseModule,
    Enrollment,
    InstructorApprovalRequest,
    Lesson,
    LessonProgress,
    LoginAuditLog,
    Notification,
    Quiz,
    QuizAttempt,
    QuizAttemptAnswer,
    QuizQuestion,
    QuizQuestionOption,
    RefreshToken,
    Role,
    User,
    UserProfile,
    UserRole,
)
from app.seed.seed_runner import run_seed


async def ensure_assignment_submission_columns(connection) -> None:
    await connection.execute(
        text(
            """
            ALTER TABLE assignment_submissions
            ADD COLUMN IF NOT EXISTS submission_file_url TEXT,
            ADD COLUMN IF NOT EXISTS submission_file_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS submission_file_size_bytes INTEGER
            """
        )
    )


async def ensure_enrollment_columns(connection) -> None:
    await connection.execute(
        text(
            """
            ALTER TABLE enrollments
            ADD COLUMN IF NOT EXISTS progress DOUBLE PRECISION NOT NULL DEFAULT 0
            """
        )
    )


async def ensure_runtime_schema() -> None:
    async with engine.begin() as connection:
        await ensure_assignment_submission_columns(connection)
        await ensure_enrollment_columns(connection)


async def init_db() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await ensure_assignment_submission_columns(connection)
        await ensure_enrollment_columns(connection)

    async with SessionLocal() as session:
        await run_seed(session)


if __name__ == "__main__":
    asyncio.run(init_db())
