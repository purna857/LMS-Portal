from fastapi import APIRouter

from app.routers.assignments import router as assignments_router
from app.routers.analytics import router as analytics_router
from app.routers.auth import router as auth_router
from app.routers.categories import router as categories_router
from app.routers.courses import router as courses_router
from app.routers.course_modules import router as course_modules_router
from app.routers.enrollments import router as enrollments_router
from app.routers.health import router as health_router
from app.routers.instructor_approvals import router as instructor_approvals_router
from app.routers.lessons import router as lessons_router
from app.routers.notifications import router as notifications_router
from app.routers.profile import router as profile_router
from app.routers.progress import router as progress_router
from app.routers.quizzes import router as quizzes_router
from app.routers.users import router as users_router


api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(health_router, tags=["Health"])
api_router.include_router(assignments_router)
api_router.include_router(analytics_router)
api_router.include_router(profile_router)
api_router.include_router(progress_router)
api_router.include_router(users_router)
api_router.include_router(instructor_approvals_router)
api_router.include_router(categories_router)
api_router.include_router(courses_router)
api_router.include_router(course_modules_router)
api_router.include_router(enrollments_router)
api_router.include_router(lessons_router)
api_router.include_router(notifications_router)
api_router.include_router(quizzes_router)
