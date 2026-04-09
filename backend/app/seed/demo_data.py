from datetime import timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.announcement import Announcement, Notification
from app.models.assignment import Assignment
from app.models.course import Course, CourseInstructor
from app.models.course_category import CourseCategory
from app.models.course_module import CourseModule
from app.models.enrollment import Enrollment
from app.models.instructor_approval_request import InstructorApprovalRequest
from app.models.lesson import Lesson
from app.models.lesson_progress import LessonProgress
from app.models.quiz import Quiz, QuizQuestion, QuizQuestionOption
from app.models.role import Role
from app.models.user import User, UserRole
from app.utils.datetime import utc_now


INSTRUCTOR_PASSWORD = "Instructor@123"
STUDENT_PASSWORD = "Student@123"
DEFAULT_VIDEO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
SECONDARY_VIDEO_URL = "https://www.w3schools.com/html/mov_bbb.mp4"


async def seed_demo_data(session: AsyncSession) -> None:
    role_map = await _get_role_map(session)
    admin_user = await _get_admin_user(session)

    instructor_one = await _get_or_create_user(
        session,
        email="instructor1@lms.local",
        password=INSTRUCTOR_PASSWORD,
        first_name="Ava",
        last_name="Sharma",
        role_id=role_map["instructor"].id,
        assigned_by=admin_user.id,
        status="active",
        email_verified=True,
    )
    instructor_two = await _get_or_create_user(
        session,
        email="instructor2@lms.local",
        password=INSTRUCTOR_PASSWORD,
        first_name="Rohan",
        last_name="Mehta",
        role_id=role_map["instructor"].id,
        assigned_by=admin_user.id,
        status="active",
        email_verified=True,
    )

    await _ensure_instructor_approval(session, instructor_one, admin_user)
    await _ensure_instructor_approval(session, instructor_two, admin_user)

    student_one = await _get_or_create_user(
        session,
        email="student1@lms.local",
        password=STUDENT_PASSWORD,
        first_name="Neha",
        last_name="Patel",
        role_id=role_map["student"].id,
        assigned_by=admin_user.id,
        status="active",
        email_verified=True,
    )
    student_two = await _get_or_create_user(
        session,
        email="student2@lms.local",
        password=STUDENT_PASSWORD,
        first_name="Arjun",
        last_name="Verma",
        role_id=role_map["student"].id,
        assigned_by=admin_user.id,
        status="active",
        email_verified=True,
    )
    student_three = await _get_or_create_user(
        session,
        email="student3@lms.local",
        password=STUDENT_PASSWORD,
        first_name="Sara",
        last_name="Khan",
        role_id=role_map["student"].id,
        assigned_by=admin_user.id,
        status="active",
        email_verified=True,
    )

    categories = await _seed_categories(session)
    courses = await _seed_courses(
        session,
        instructor_one=instructor_one,
        instructor_two=instructor_two,
        categories=categories,
    )
    modules = await _seed_modules(session, courses)
    lessons = await _seed_lessons(session, modules)
    await _seed_assignments(session, courses, modules, lessons, instructor_one, instructor_two)
    await _seed_quizzes(session, courses, instructor_one, instructor_two)
    enrollments = await _seed_enrollments(session, courses, student_one, student_two, student_three)
    await _seed_lesson_progress(session, enrollments, lessons)
    await _seed_notifications(
        session,
        admin_user=admin_user,
        instructor_one=instructor_one,
        instructor_two=instructor_two,
        student_one=student_one,
        student_two=student_two,
        student_three=student_three,
        python_course=courses["python-fastapi-bootcamp"],
        sql_course=courses["data-sql-foundations"],
    )


async def _get_role_map(session: AsyncSession) -> dict[str, Role]:
    roles = (await session.execute(select(Role).where(Role.status == "active"))).scalars().all()
    return {role.code: role for role in roles}


async def _get_admin_user(session: AsyncSession) -> User:
    statement = select(User).where(User.email == settings.ADMIN_EMAIL.lower())
    return (await session.execute(statement)).scalar_one()


async def _get_or_create_user(
    session: AsyncSession,
    *,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    role_id,
    assigned_by,
    status: str,
    email_verified: bool,
) -> User:
    statement = select(User).where(User.email == email.lower())
    user = (await session.execute(statement)).scalar_one_or_none()
    if user is None:
        user = User(
            email=email.lower(),
            password_hash=get_password_hash(password),
            first_name=first_name,
            last_name=last_name,
            status=status,
            email_verified=email_verified,
        )
        session.add(user)
        await session.flush()

    role_statement = select(UserRole).where(UserRole.user_id == user.id, UserRole.role_id == role_id)
    role_assignment = (await session.execute(role_statement)).scalar_one_or_none()
    if role_assignment is None:
        session.add(UserRole(user_id=user.id, role_id=role_id, assigned_by=assigned_by))
        await session.flush()

    return user


async def _ensure_instructor_approval(session: AsyncSession, instructor: User, admin_user: User) -> None:
    statement = select(InstructorApprovalRequest).where(
        InstructorApprovalRequest.user_id == instructor.id,
        InstructorApprovalRequest.status == "approved",
    )
    approval = (await session.execute(statement)).scalar_one_or_none()
    if approval is not None:
        return

    now = utc_now()
    session.add(
        InstructorApprovalRequest(
            user_id=instructor.id,
            headline=f"{instructor.first_name} {instructor.last_name} - Senior Instructor",
            bio="Experienced LMS instructor seeded for local development and demos.",
            expertise="Python, SQL, backend APIs, teaching",
            experience_years=6,
            linkedin_url="https://www.linkedin.com/in/demo-instructor",
            portfolio_url="https://portfolio.example.com/demo-instructor",
            resume_file_url="https://files.example.com/demo-instructor-resume.pdf",
            status="approved",
            submitted_at=now - timedelta(days=14),
            reviewed_at=now - timedelta(days=10),
            reviewed_by=admin_user.id,
            review_notes="Approved automatically for demo seed data.",
        )
    )
    await session.flush()


async def _seed_categories(session: AsyncSession) -> dict[str, CourseCategory]:
    category_specs = [
        {
            "slug": "development",
            "name": "Development",
            "description": "Backend, API, and software engineering courses.",
            "sort_order": 1,
        },
        {
            "slug": "data",
            "name": "Data",
            "description": "SQL, analytics, and data skills for modern teams.",
            "sort_order": 2,
        },
        {
            "slug": "career-skills",
            "name": "Career Skills",
            "description": "Communication, productivity, and professional growth.",
            "sort_order": 3,
        },
    ]

    categories: dict[str, CourseCategory] = {}
    for spec in category_specs:
        statement = select(CourseCategory).where(CourseCategory.slug == spec["slug"])
        category = (await session.execute(statement)).scalar_one_or_none()
        if category is None:
            category = CourseCategory(status="active", **spec)
            session.add(category)
            await session.flush()
        categories[spec["slug"]] = category

    return categories


async def _seed_courses(
    session: AsyncSession,
    *,
    instructor_one: User,
    instructor_two: User,
    categories: dict[str, CourseCategory],
) -> dict[str, Course]:
    now = utc_now()
    course_specs = [
        {
            "slug": "python-fastapi-bootcamp",
            "title": "Python FastAPI Bootcamp",
            "short_description": "Build production-ready APIs with FastAPI and PostgreSQL.",
            "description": "A hands-on backend course covering FastAPI, auth, SQLAlchemy, and deployment patterns.",
            "category_id": categories["development"].id,
            "level": "intermediate",
            "visibility": "public",
            "estimated_duration_minutes": 360,
            "created_by": instructor_one.id,
            "updated_by": instructor_one.id,
            "status": "published",
            "published_at": now - timedelta(days=20),
            "language": "en",
            "thumbnail_url": "/assets/course-thumbnails/python-fastapi-bootcamp.svg",
            "is_featured": True,
            "instructor_id": instructor_one.id,
        },
        {
            "slug": "data-sql-foundations",
            "title": "Data SQL Foundations",
            "short_description": "Learn practical SQL for analytics and backend applications.",
            "description": "A beginner-friendly course on querying, joins, aggregation, and reporting with PostgreSQL.",
            "category_id": categories["data"].id,
            "level": "beginner",
            "visibility": "public",
            "estimated_duration_minutes": 300,
            "created_by": instructor_two.id,
            "updated_by": instructor_two.id,
            "status": "published",
            "published_at": now - timedelta(days=15),
            "language": "en",
            "thumbnail_url": "/assets/course-thumbnails/data-sql-foundations.svg",
            "is_featured": False,
            "instructor_id": instructor_two.id,
        },
    ]

    courses: dict[str, Course] = {}
    for spec in course_specs:
        instructor_id = spec["instructor_id"]
        payload = {key: value for key, value in spec.items() if key != "instructor_id"}
        statement = select(Course).where(Course.slug == spec["slug"])
        course = (await session.execute(statement)).scalar_one_or_none()
        if course is None:
            course = Course(**payload)
            session.add(course)
            await session.flush()
        else:
            for key, value in payload.items():
                setattr(course, key, value)
            await session.flush()

        assignment_statement = select(CourseInstructor).where(
            CourseInstructor.course_id == course.id,
            CourseInstructor.instructor_id == instructor_id,
        )
        course_instructor = (await session.execute(assignment_statement)).scalar_one_or_none()
        if course_instructor is None:
            session.add(
                CourseInstructor(
                    course_id=course.id,
                    instructor_id=instructor_id,
                    is_primary=True,
                )
            )
            await session.flush()

        courses[course.slug] = course

    return courses


async def _seed_modules(session: AsyncSession, courses: dict[str, Course]) -> dict[str, CourseModule]:
    module_specs = [
        {
            "key": "python-api-basics",
            "course_id": courses["python-fastapi-bootcamp"].id,
            "title": "API Foundations",
            "description": "Project setup, routing, and request handling.",
            "position": 1,
        },
        {
            "key": "python-auth-db",
            "course_id": courses["python-fastapi-bootcamp"].id,
            "title": "Authentication and Database",
            "description": "JWT auth, PostgreSQL models, and migrations.",
            "position": 2,
        },
        {
            "key": "sql-query-basics",
            "course_id": courses["data-sql-foundations"].id,
            "title": "Query Basics",
            "description": "Selecting, filtering, sorting, and limiting rows.",
            "position": 1,
        },
        {
            "key": "sql-joins-reports",
            "course_id": courses["data-sql-foundations"].id,
            "title": "Joins and Reporting",
            "description": "Aggregations, joins, and dashboard-friendly queries.",
            "position": 2,
        },
        {
            "key": "python-validation-async",
            "course_id": courses["python-fastapi-bootcamp"].id,
            "title": "Validation and Async Workflows",
            "description": "Validation patterns, background tasks, and async request lifecycles.",
            "position": 3,
        },
        {
            "key": "python-testing-deploy",
            "course_id": courses["python-fastapi-bootcamp"].id,
            "title": "Testing and Deployment",
            "description": "Testing APIs, environment configs, and deployment handoff.",
            "position": 4,
        },
        {
            "key": "python-project-wrapup",
            "course_id": courses["python-fastapi-bootcamp"].id,
            "title": "Project Wrap-up",
            "description": "Final polish, documentation, and release readiness.",
            "position": 5,
        },
        {
            "key": "sql-analytics-foundations",
            "course_id": courses["data-sql-foundations"].id,
            "title": "Analytics Foundations",
            "description": "Metrics, grouped reporting, and stakeholder-friendly analysis.",
            "position": 3,
        },
        {
            "key": "sql-window-functions",
            "course_id": courses["data-sql-foundations"].id,
            "title": "Window Functions",
            "description": "Running totals, ranking, and advanced SQL patterns.",
            "position": 4,
        },
        {
            "key": "sql-dashboard-ready",
            "course_id": courses["data-sql-foundations"].id,
            "title": "Dashboard-ready Queries",
            "description": "Reusable reporting queries for BI tools and product dashboards.",
            "position": 5,
        },
    ]

    modules: dict[str, CourseModule] = {}
    for spec in module_specs:
        key = spec["key"]
        statement = select(CourseModule).where(
            CourseModule.course_id == spec["course_id"],
            CourseModule.position == spec["position"],
        )
        module = (await session.execute(statement)).scalar_one_or_none()
        if module is None:
            module = CourseModule(
                course_id=spec["course_id"],
                title=spec["title"],
                description=spec["description"],
                position=spec["position"],
                status="published",
                is_preview=spec["position"] == 1,
            )
            session.add(module)
            await session.flush()
        modules[key] = module

    return modules


async def _seed_lessons(session: AsyncSession, modules: dict[str, CourseModule]) -> dict[str, Lesson]:
    lesson_specs = [
        {
            "key": "fastapi-intro-video",
            "module_id": modules["python-api-basics"].id,
            "title": "Welcome to FastAPI",
            "lesson_type": "video",
            "video_url": DEFAULT_VIDEO_URL,
            "duration_minutes": 18,
            "position": 1,
            "is_preview": True,
        },
        {
            "key": "fastapi-routing-text",
            "module_id": modules["python-api-basics"].id,
            "title": "Routing and Request Models",
            "lesson_type": "text",
            "content": "Learn how routes, path parameters, and Pydantic models work together in FastAPI.",
            "duration_minutes": 24,
            "position": 2,
            "is_preview": False,
        },
        {
            "key": "fastapi-auth-video",
            "module_id": modules["python-auth-db"].id,
            "title": "JWT Authentication Flow",
            "lesson_type": "video",
            "video_url": SECONDARY_VIDEO_URL,
            "duration_minutes": 22,
            "position": 1,
            "is_preview": False,
        },
        {
            "key": "fastapi-db-resource",
            "module_id": modules["python-auth-db"].id,
            "title": "SQLAlchemy Async Cheatsheet",
            "lesson_type": "resource_link",
            "resource_url": "https://docs.example.com/sqlalchemy-async-cheatsheet",
            "duration_minutes": 10,
            "position": 2,
            "is_preview": False,
        },
        {
            "key": "sql-select-text",
            "module_id": modules["sql-query-basics"].id,
            "title": "SELECT, WHERE, ORDER BY",
            "lesson_type": "text",
            "content": "This lesson covers the core SQL query clauses used in everyday analytics work.",
            "duration_minutes": 20,
            "position": 1,
            "is_preview": True,
        },
        {
            "key": "sql-filter-video",
            "module_id": modules["sql-query-basics"].id,
            "title": "Filtering Data with Confidence",
            "lesson_type": "video",
            "video_url": DEFAULT_VIDEO_URL,
            "duration_minutes": 16,
            "position": 2,
            "is_preview": False,
        },
        {
            "key": "sql-joins-text",
            "module_id": modules["sql-joins-reports"].id,
            "title": "INNER JOIN and LEFT JOIN",
            "lesson_type": "text",
            "content": "Use joins to combine tables for reporting and product analytics.",
            "duration_minutes": 28,
            "position": 1,
            "is_preview": False,
        },
        {
            "key": "sql-report-resource",
            "module_id": modules["sql-joins-reports"].id,
            "title": "Reporting Query Patterns",
            "lesson_type": "resource_link",
            "resource_url": "https://docs.example.com/sql-report-patterns",
            "duration_minutes": 12,
            "position": 2,
            "is_preview": False,
        },
        {
            "key": "fastapi-validation-video",
            "module_id": modules["python-validation-async"].id,
            "title": "Validation Rules and Form Parsing",
            "lesson_type": "video",
            "video_url": SECONDARY_VIDEO_URL,
            "duration_minutes": 19,
            "position": 1,
            "is_preview": False,
        },
        {
            "key": "fastapi-background-tasks",
            "module_id": modules["python-validation-async"].id,
            "title": "Background Tasks and Async Flow",
            "lesson_type": "video",
            "video_url": DEFAULT_VIDEO_URL,
            "duration_minutes": 21,
            "position": 2,
            "is_preview": False,
        },
        {
            "key": "fastapi-validation-notes",
            "module_id": modules["python-validation-async"].id,
            "title": "Validation Notes",
            "lesson_type": "text",
            "content": "Use this lesson to review request validation, response models, and async patterns from the module.",
            "duration_minutes": 11,
            "position": 3,
            "is_preview": False,
        },
        {
            "key": "fastapi-testing-video",
            "module_id": modules["python-testing-deploy"].id,
            "title": "Testing Routes with Pytest",
            "lesson_type": "video",
            "video_url": DEFAULT_VIDEO_URL,
            "duration_minutes": 17,
            "position": 1,
            "is_preview": False,
        },
        {
            "key": "fastapi-env-config-video",
            "module_id": modules["python-testing-deploy"].id,
            "title": "Environment Config and Secrets",
            "lesson_type": "video",
            "video_url": SECONDARY_VIDEO_URL,
            "duration_minutes": 15,
            "position": 2,
            "is_preview": False,
        },
        {
            "key": "fastapi-deploy-resource",
            "module_id": modules["python-testing-deploy"].id,
            "title": "Deployment Checklist",
            "lesson_type": "resource_link",
            "resource_url": "https://fastapi.tiangolo.com/deployment/",
            "duration_minutes": 8,
            "position": 3,
            "is_preview": False,
        },
        {
            "key": "fastapi-wrap-video",
            "module_id": modules["python-project-wrapup"].id,
            "title": "Capstone API Walkthrough",
            "lesson_type": "video",
            "video_url": DEFAULT_VIDEO_URL,
            "duration_minutes": 26,
            "position": 1,
            "is_preview": False,
        },
        {
            "key": "fastapi-wrap-text",
            "module_id": modules["python-project-wrapup"].id,
            "title": "Release Notes and Next Steps",
            "lesson_type": "text",
            "content": "Wrap up your project with deployment notes, testing follow-ups, and next-step ideas.",
            "duration_minutes": 9,
            "position": 2,
            "is_preview": False,
        },
        {
            "key": "sql-metrics-video",
            "module_id": modules["sql-analytics-foundations"].id,
            "title": "Metrics and KPI Queries",
            "lesson_type": "video",
            "video_url": SECONDARY_VIDEO_URL,
            "duration_minutes": 18,
            "position": 1,
            "is_preview": False,
        },
        {
            "key": "sql-cohort-video",
            "module_id": modules["sql-analytics-foundations"].id,
            "title": "Cohort and Funnel Basics",
            "lesson_type": "video",
            "video_url": DEFAULT_VIDEO_URL,
            "duration_minutes": 20,
            "position": 2,
            "is_preview": False,
        },
        {
            "key": "sql-analytics-notes",
            "module_id": modules["sql-analytics-foundations"].id,
            "title": "Analytics Notes",
            "lesson_type": "text",
            "content": "Review grouped reports, KPIs, and stakeholder-friendly SQL explanation patterns.",
            "duration_minutes": 10,
            "position": 3,
            "is_preview": False,
        },
        {
            "key": "sql-window-video",
            "module_id": modules["sql-window-functions"].id,
            "title": "ROW_NUMBER and Ranking",
            "lesson_type": "video",
            "video_url": DEFAULT_VIDEO_URL,
            "duration_minutes": 19,
            "position": 1,
            "is_preview": False,
        },
        {
            "key": "sql-window-running-total",
            "module_id": modules["sql-window-functions"].id,
            "title": "Running Totals and Moving Windows",
            "lesson_type": "video",
            "video_url": SECONDARY_VIDEO_URL,
            "duration_minutes": 22,
            "position": 2,
            "is_preview": False,
        },
        {
            "key": "sql-window-resource",
            "module_id": modules["sql-window-functions"].id,
            "title": "Window Function Cheatsheet",
            "lesson_type": "resource_link",
            "resource_url": "https://www.postgresql.org/docs/current/tutorial-window.html",
            "duration_minutes": 7,
            "position": 3,
            "is_preview": False,
        },
        {
            "key": "sql-dashboard-video",
            "module_id": modules["sql-dashboard-ready"].id,
            "title": "BI-ready Dataset Preparation",
            "lesson_type": "video",
            "video_url": DEFAULT_VIDEO_URL,
            "duration_minutes": 16,
            "position": 1,
            "is_preview": False,
        },
        {
            "key": "sql-dashboard-resource",
            "module_id": modules["sql-dashboard-ready"].id,
            "title": "Dashboard Query Pack",
            "lesson_type": "resource_link",
            "resource_url": "https://mode.com/sql-tutorial/",
            "duration_minutes": 9,
            "position": 2,
            "is_preview": False,
        },
    ]

    lessons: dict[str, Lesson] = {}
    for spec in lesson_specs:
        key = spec["key"]
        statement = select(Lesson).where(
            Lesson.module_id == spec["module_id"],
            Lesson.position == spec["position"],
        )
        lesson = (await session.execute(statement)).scalar_one_or_none()
        if lesson is None:
            lesson = Lesson(
                module_id=spec["module_id"],
                title=spec["title"],
                lesson_type=spec["lesson_type"],
                content=spec.get("content"),
                video_url=spec.get("video_url"),
                resource_url=spec.get("resource_url"),
                duration_minutes=spec["duration_minutes"],
                position=spec["position"],
                status="published",
                is_preview=spec["is_preview"],
            )
            session.add(lesson)
            await session.flush()
        else:
            lesson.title = spec["title"]
            lesson.lesson_type = spec["lesson_type"]
            lesson.content = spec.get("content")
            lesson.video_url = spec.get("video_url")
            lesson.resource_url = spec.get("resource_url")
            lesson.duration_minutes = spec["duration_minutes"]
            lesson.is_preview = spec["is_preview"]
            lesson.status = "published"
            await session.flush()
        lessons[key] = lesson

    return lessons


async def _seed_assignments(
    session: AsyncSession,
    courses: dict[str, Course],
    modules: dict[str, CourseModule],
    lessons: dict[str, Lesson],
    instructor_one: User,
    instructor_two: User,
) -> None:
    assignment_specs = [
        {
            "course_id": courses["python-fastapi-bootcamp"].id,
            "module_id": modules["python-auth-db"].id,
            "lesson_id": lessons["fastapi-auth-video"].id,
            "title": "Build JWT Login Endpoint",
            "description": "Create an authenticated login endpoint with hashed passwords and access tokens.",
            "instructions": "Submit a short write-up and a repository link showing your login route and token response.",
            "max_score": Decimal("100.00"),
            "pass_score": Decimal("70.00"),
            "due_at": utc_now() + timedelta(days=10),
            "allow_late_submission": True,
            "created_by": instructor_one.id,
        },
        {
            "course_id": courses["data-sql-foundations"].id,
            "module_id": modules["sql-joins-reports"].id,
            "lesson_id": lessons["sql-joins-text"].id,
            "title": "Customer Revenue Report Query",
            "description": "Write a join-based SQL report summarizing customer revenue by month.",
            "instructions": "Submit the SQL query and a short explanation of each aggregation you used.",
            "max_score": Decimal("100.00"),
            "pass_score": Decimal("65.00"),
            "due_at": utc_now() + timedelta(days=7),
            "allow_late_submission": False,
            "created_by": instructor_two.id,
        },
    ]

    for spec in assignment_specs:
        statement = select(Assignment).where(
            Assignment.course_id == spec["course_id"],
            Assignment.title == spec["title"],
        )
        assignment = (await session.execute(statement)).scalar_one_or_none()
        if assignment is None:
            session.add(
                Assignment(
                    course_id=spec["course_id"],
                    module_id=spec["module_id"],
                    lesson_id=spec["lesson_id"],
                    title=spec["title"],
                    description=spec["description"],
                    instructions=spec["instructions"],
                    max_score=spec["max_score"],
                    pass_score=spec["pass_score"],
                    due_at=spec["due_at"],
                    allow_late_submission=spec["allow_late_submission"],
                    status="published",
                    created_by=spec["created_by"],
                )
            )
            await session.flush()


async def _seed_quizzes(
    session: AsyncSession,
    courses: dict[str, Course],
    instructor_one: User,
    instructor_two: User,
) -> None:
    quiz_specs = [
        {
            "course_id": courses["python-fastapi-bootcamp"].id,
            "title": "FastAPI Basics Quiz",
            "description": "Check your understanding of routes, models, and auth fundamentals.",
            "instructions": "Choose the best answer for each question.",
            "passing_score": Decimal("2.00"),
            "max_attempts": 3,
            "created_by": instructor_one.id,
            "questions": [
                {
                    "question_text": "Which library is commonly used for request validation in FastAPI?",
                    "points": Decimal("1.00"),
                    "position": 1,
                    "allow_multiple_answers": False,
                    "options": [
                        {"option_text": "Pydantic", "position": 1, "is_correct": True},
                        {"option_text": "Alembic", "position": 2, "is_correct": False},
                        {"option_text": "Celery", "position": 3, "is_correct": False},
                    ],
                },
                {
                    "question_text": "What is a common format for API bearer tokens?",
                    "points": Decimal("1.00"),
                    "position": 2,
                    "allow_multiple_answers": False,
                    "options": [
                        {"option_text": "JWT", "position": 1, "is_correct": True},
                        {"option_text": "CSV", "position": 2, "is_correct": False},
                        {"option_text": "HTML", "position": 3, "is_correct": False},
                    ],
                },
            ],
        },
        {
            "course_id": courses["data-sql-foundations"].id,
            "title": "SQL Reporting Quiz",
            "description": "Test your understanding of joins and aggregation.",
            "instructions": "Answer all questions before submitting.",
            "passing_score": Decimal("2.00"),
            "max_attempts": 2,
            "created_by": instructor_two.id,
            "questions": [
                {
                    "question_text": "Which clause is used to group rows for aggregation?",
                    "points": Decimal("1.00"),
                    "position": 1,
                    "allow_multiple_answers": False,
                    "options": [
                        {"option_text": "GROUP BY", "position": 1, "is_correct": True},
                        {"option_text": "ORDER BY", "position": 2, "is_correct": False},
                        {"option_text": "LIMIT", "position": 3, "is_correct": False},
                    ],
                },
                {
                    "question_text": "Which join keeps all rows from the left table?",
                    "points": Decimal("1.00"),
                    "position": 2,
                    "allow_multiple_answers": False,
                    "options": [
                        {"option_text": "LEFT JOIN", "position": 1, "is_correct": True},
                        {"option_text": "INNER JOIN", "position": 2, "is_correct": False},
                        {"option_text": "CROSS JOIN", "position": 3, "is_correct": False},
                    ],
                },
            ],
        },
    ]

    for spec in quiz_specs:
        statement = select(Quiz).where(
            Quiz.course_id == spec["course_id"],
            Quiz.title == spec["title"],
        )
        quiz = (await session.execute(statement)).scalar_one_or_none()
        if quiz is None:
            quiz = Quiz(
                course_id=spec["course_id"],
                title=spec["title"],
                description=spec["description"],
                instructions=spec["instructions"],
                passing_score=spec["passing_score"],
                max_attempts=spec["max_attempts"],
                shuffle_questions=False,
                status="published",
                created_by=spec["created_by"],
                updated_by=spec["created_by"],
                published_at=utc_now(),
            )
            session.add(quiz)
            await session.flush()

        for question_spec in spec["questions"]:
            question_statement = select(QuizQuestion).where(
                QuizQuestion.quiz_id == quiz.id,
                QuizQuestion.position == question_spec["position"],
            )
            question = (await session.execute(question_statement)).scalar_one_or_none()
            if question is None:
                question = QuizQuestion(
                    quiz_id=quiz.id,
                    question_text=question_spec["question_text"],
                    explanation=None,
                    points=question_spec["points"],
                    position=question_spec["position"],
                    allow_multiple_answers=question_spec["allow_multiple_answers"],
                )
                session.add(question)
                await session.flush()

            for option_spec in question_spec["options"]:
                option_statement = select(QuizQuestionOption).where(
                    QuizQuestionOption.question_id == question.id,
                    QuizQuestionOption.position == option_spec["position"],
                )
                option = (await session.execute(option_statement)).scalar_one_or_none()
                if option is None:
                    session.add(
                        QuizQuestionOption(
                            question_id=question.id,
                            option_text=option_spec["option_text"],
                            position=option_spec["position"],
                            is_correct=option_spec["is_correct"],
                        )
                    )
                    await session.flush()


async def _seed_enrollments(
    session: AsyncSession,
    courses: dict[str, Course],
    student_one: User,
    student_two: User,
    student_three: User,
) -> dict[str, Enrollment]:
    now = utc_now()
    enrollment_specs = [
        {
            "key": "student1_python",
            "user_id": student_one.id,
            "course_id": courses["python-fastapi-bootcamp"].id,
            "status": "active",
            "enrolled_at": now - timedelta(days=8),
            "started_at": now - timedelta(days=7),
            "completed_at": None,
        },
        {
            "key": "student1_sql",
            "user_id": student_one.id,
            "course_id": courses["data-sql-foundations"].id,
            "status": "active",
            "enrolled_at": now - timedelta(days=5),
            "started_at": now - timedelta(days=4),
            "completed_at": None,
        },
        {
            "key": "student2_python",
            "user_id": student_two.id,
            "course_id": courses["python-fastapi-bootcamp"].id,
            "status": "completed",
            "enrolled_at": now - timedelta(days=18),
            "started_at": now - timedelta(days=17),
            "completed_at": now - timedelta(days=2),
        },
        {
            "key": "student2_sql",
            "user_id": student_two.id,
            "course_id": courses["data-sql-foundations"].id,
            "status": "active",
            "enrolled_at": now - timedelta(days=6),
            "started_at": now - timedelta(days=5),
            "completed_at": None,
        },
        {
            "key": "student3_sql",
            "user_id": student_three.id,
            "course_id": courses["data-sql-foundations"].id,
            "status": "active",
            "enrolled_at": now - timedelta(days=4),
            "started_at": None,
            "completed_at": None,
        },
    ]

    enrollments: dict[str, Enrollment] = {}
    for spec in enrollment_specs:
        statement = select(Enrollment).where(
            Enrollment.user_id == spec["user_id"],
            Enrollment.course_id == spec["course_id"],
        )
        enrollment = (await session.execute(statement)).scalar_one_or_none()
        if enrollment is None:
            enrollment = Enrollment(
                user_id=spec["user_id"],
                course_id=spec["course_id"],
                status=spec["status"],
                enrolled_at=spec["enrolled_at"],
                started_at=spec["started_at"],
                completed_at=spec["completed_at"],
            )
            session.add(enrollment)
            await session.flush()
        else:
            enrollment.status = spec["status"]
            enrollment.enrolled_at = spec["enrolled_at"]
            enrollment.started_at = spec["started_at"]
            enrollment.completed_at = spec["completed_at"]
            await session.flush()
        enrollments[spec["key"]] = enrollment

    return enrollments


async def _seed_lesson_progress(
    session: AsyncSession,
    enrollments: dict[str, Enrollment],
    lessons: dict[str, Lesson],
) -> None:
    progress_specs = [
        {"enrollment": "student1_python", "lesson": "fastapi-intro-video", "days_ago": 6},
        {"enrollment": "student1_python", "lesson": "fastapi-routing-text", "days_ago": 6},
        {"enrollment": "student1_python", "lesson": "fastapi-auth-video", "days_ago": 5},
        {"enrollment": "student1_sql", "lesson": "sql-select-text", "days_ago": 3},
        {"enrollment": "student2_python", "lesson": "fastapi-intro-video", "days_ago": 15},
        {"enrollment": "student2_python", "lesson": "fastapi-routing-text", "days_ago": 15},
        {"enrollment": "student2_python", "lesson": "fastapi-auth-video", "days_ago": 14},
        {"enrollment": "student2_python", "lesson": "fastapi-db-resource", "days_ago": 14},
        {"enrollment": "student2_python", "lesson": "fastapi-validation-video", "days_ago": 13},
        {"enrollment": "student2_python", "lesson": "fastapi-background-tasks", "days_ago": 13},
        {"enrollment": "student2_python", "lesson": "fastapi-validation-notes", "days_ago": 12},
        {"enrollment": "student2_python", "lesson": "fastapi-testing-video", "days_ago": 11},
        {"enrollment": "student2_python", "lesson": "fastapi-env-config-video", "days_ago": 11},
        {"enrollment": "student2_python", "lesson": "fastapi-deploy-resource", "days_ago": 10},
        {"enrollment": "student2_python", "lesson": "fastapi-wrap-video", "days_ago": 9},
        {"enrollment": "student2_python", "lesson": "fastapi-wrap-text", "days_ago": 9},
        {"enrollment": "student2_sql", "lesson": "sql-select-text", "days_ago": 4},
        {"enrollment": "student2_sql", "lesson": "sql-filter-video", "days_ago": 4},
        {"enrollment": "student2_sql", "lesson": "sql-joins-text", "days_ago": 3},
    ]

    for spec in progress_specs:
        enrollment = enrollments[spec["enrollment"]]
        lesson = lessons[spec["lesson"]]
        completed_at = utc_now() - timedelta(days=spec["days_ago"])
        statement = select(LessonProgress).where(
            LessonProgress.enrollment_id == enrollment.id,
            LessonProgress.lesson_id == lesson.id,
        )
        progress = (await session.execute(statement)).scalar_one_or_none()
        if progress is None:
            progress = LessonProgress(
                enrollment_id=enrollment.id,
                lesson_id=lesson.id,
                completed_at=completed_at,
                last_accessed_at=completed_at,
            )
            session.add(progress)
        else:
            progress.completed_at = completed_at
            progress.last_accessed_at = completed_at
        await session.flush()


async def _seed_notifications(
    session: AsyncSession,
    *,
    admin_user: User,
    instructor_one: User,
    instructor_two: User,
    student_one: User,
    student_two: User,
    student_three: User,
    python_course: Course,
    sql_course: Course,
) -> None:
    platform_announcement = await _get_or_create_announcement(
        session,
        announcement_type="platform",
        course_id=None,
        title="Welcome to LMS Portal",
        body="Your demo workspace is ready with courses, assignments, quizzes, and notifications.",
        target_roles="student,instructor",
        include_students=False,
        include_instructors=False,
        created_by=admin_user.id,
    )
    for recipient in [instructor_one, instructor_two, student_one, student_two, student_three]:
        await _get_or_create_notification(
            session,
            user_id=recipient.id,
            announcement_id=platform_announcement.id,
            course_id=None,
            notification_type="role_notification",
            title=platform_announcement.title,
            body=platform_announcement.body,
            is_read=recipient.id == student_two.id,
        )

    python_announcement = await _get_or_create_announcement(
        session,
        announcement_type="course",
        course_id=python_course.id,
        title="FastAPI Bootcamp Kickoff",
        body="Module 1 is live. Start with the preview lesson and complete the JWT assignment this week.",
        target_roles=None,
        include_students=True,
        include_instructors=True,
        created_by=instructor_one.id,
    )
    for recipient in [instructor_one, student_one, student_two]:
        await _get_or_create_notification(
            session,
            user_id=recipient.id,
            announcement_id=python_announcement.id,
            course_id=python_course.id,
            notification_type="course_announcement",
            title=python_announcement.title,
            body=python_announcement.body,
            is_read=False,
        )

    sql_announcement = await _get_or_create_announcement(
        session,
        announcement_type="course",
        course_id=sql_course.id,
        title="SQL Reporting Practice Set",
        body="The joins module is open. Review the resource link before attempting the quiz.",
        target_roles=None,
        include_students=True,
        include_instructors=True,
        created_by=instructor_two.id,
    )
    for recipient in [instructor_two, student_two, student_three]:
        await _get_or_create_notification(
            session,
            user_id=recipient.id,
            announcement_id=sql_announcement.id,
            course_id=sql_course.id,
            notification_type="course_announcement",
            title=sql_announcement.title,
            body=sql_announcement.body,
            is_read=recipient.id == student_three.id,
        )


async def _get_or_create_announcement(
    session: AsyncSession,
    *,
    announcement_type: str,
    course_id,
    title: str,
    body: str,
    target_roles: str | None,
    include_students: bool,
    include_instructors: bool,
    created_by,
) -> Announcement:
    statement = select(Announcement).where(
        Announcement.announcement_type == announcement_type,
        Announcement.course_id == course_id,
        Announcement.title == title,
    )
    announcement = (await session.execute(statement)).scalar_one_or_none()
    if announcement is None:
        announcement = Announcement(
            announcement_type=announcement_type,
            course_id=course_id,
            title=title,
            body=body,
            target_roles=target_roles,
            include_students=include_students,
            include_instructors=include_instructors,
            created_by=created_by,
        )
        session.add(announcement)
        await session.flush()
    return announcement


async def _get_or_create_notification(
    session: AsyncSession,
    *,
    user_id,
    announcement_id,
    course_id,
    notification_type: str,
    title: str,
    body: str,
    is_read: bool,
) -> Notification:
    statement = select(Notification).where(
        Notification.user_id == user_id,
        Notification.announcement_id == announcement_id,
    )
    notification = (await session.execute(statement)).scalar_one_or_none()
    if notification is None:
        notification = Notification(
            user_id=user_id,
            announcement_id=announcement_id,
            course_id=course_id,
            notification_type=notification_type,
            title=title,
            body=body,
            is_read=is_read,
            read_at=utc_now() if is_read else None,
        )
        session.add(notification)
        await session.flush()
    return notification
