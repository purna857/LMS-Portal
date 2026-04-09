import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel


class Quiz(BaseModel):
    __tablename__ = "quizzes"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'published', 'archived')", name="quizzes_status_valid"),
        CheckConstraint("max_attempts > 0", name="quizzes_max_attempts_positive"),
        CheckConstraint(
            "passing_score IS NULL OR passing_score >= 0",
            name="quizzes_passing_score_non_negative",
        ),
    )

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    passing_score: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    shuffle_questions: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    course: Mapped["Course"] = relationship()
    questions: Mapped[list["QuizQuestion"]] = relationship(
        back_populates="quiz",
        cascade="all, delete-orphan",
        order_by="QuizQuestion.position",
    )
    attempts: Mapped[list["QuizAttempt"]] = relationship(
        back_populates="quiz",
        cascade="all, delete-orphan",
    )


class QuizQuestion(BaseModel):
    __tablename__ = "quiz_questions"
    __table_args__ = (
        CheckConstraint("position > 0", name="quiz_questions_position_positive"),
        CheckConstraint("points > 0", name="quiz_questions_points_positive"),
        UniqueConstraint("quiz_id", "position", name="uq_quiz_questions_quiz_position"),
    )

    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    points: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False, default=1)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    allow_multiple_answers: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    quiz: Mapped["Quiz"] = relationship(back_populates="questions")
    options: Mapped[list["QuizQuestionOption"]] = relationship(
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="QuizQuestionOption.position",
    )


class QuizQuestionOption(BaseModel):
    __tablename__ = "quiz_question_options"
    __table_args__ = (
        CheckConstraint("position > 0", name="quiz_question_options_position_positive"),
        UniqueConstraint("question_id", "position", name="uq_quiz_question_options_question_position"),
    )

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quiz_questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    option_text: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    question: Mapped["QuizQuestion"] = relationship(back_populates="options")


class QuizAttempt(BaseModel):
    __tablename__ = "quiz_attempts"
    __table_args__ = (
        CheckConstraint("attempt_number > 0", name="quiz_attempts_attempt_number_positive"),
        CheckConstraint("score >= 0", name="quiz_attempts_score_non_negative"),
        CheckConstraint("total_points >= 0", name="quiz_attempts_total_points_non_negative"),
        CheckConstraint("percentage >= 0 AND percentage <= 100", name="quiz_attempts_percentage_valid"),
        UniqueConstraint("quiz_id", "enrollment_id", "attempt_number", name="uq_quiz_attempts_quiz_enrollment_number"),
    )

    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    enrollment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    score: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False, default=0)
    total_points: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False, default=0)
    percentage: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    quiz: Mapped["Quiz"] = relationship(back_populates="attempts")
    enrollment: Mapped["Enrollment"] = relationship()
    answers: Mapped[list["QuizAttemptAnswer"]] = relationship(
        back_populates="attempt",
        cascade="all, delete-orphan",
    )


class QuizAttemptAnswer(BaseModel):
    __tablename__ = "quiz_attempt_answers"
    __table_args__ = (
        UniqueConstraint("attempt_id", "question_id", name="uq_quiz_attempt_answers_attempt_question"),
    )

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quiz_attempts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quiz_questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    selected_option_ids: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    earned_points: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False, default=0)

    attempt: Mapped["QuizAttempt"] = relationship(back_populates="answers")
    question: Mapped["QuizQuestion"] = relationship()
