from datetime import datetime

from pydantic import BaseModel, Field


class QuizCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    instructions: str | None = None
    passing_score: float | None = Field(default=None, ge=0)
    max_attempts: int = Field(default=1, ge=1)
    shuffle_questions: bool = False
    status: str = Field(default="draft", pattern="^(draft|published|archived)$")


class QuizUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    instructions: str | None = None
    passing_score: float | None = Field(default=None, ge=0)
    max_attempts: int | None = Field(default=None, ge=1)
    shuffle_questions: bool | None = None
    status: str | None = Field(default=None, pattern="^(draft|published|archived)$")


class QuizQuestionOptionInput(BaseModel):
    option_text: str = Field(min_length=1)
    is_correct: bool = False


class QuizQuestionCreateRequest(BaseModel):
    question_text: str = Field(min_length=1)
    explanation: str | None = None
    points: float = Field(default=1, gt=0)
    position: int | None = Field(default=None, ge=1)
    allow_multiple_answers: bool = False
    options: list[QuizQuestionOptionInput] = Field(min_length=2)


class QuizQuestionUpdateRequest(BaseModel):
    question_text: str | None = Field(default=None, min_length=1)
    explanation: str | None = None
    points: float | None = Field(default=None, gt=0)
    position: int | None = Field(default=None, ge=1)
    allow_multiple_answers: bool | None = None
    options: list[QuizQuestionOptionInput] | None = None


class QuizAttemptAnswerInput(BaseModel):
    question_id: str
    selected_option_ids: list[str] = Field(default_factory=list)


class QuizAttemptSubmitRequest(BaseModel):
    answers: list[QuizAttemptAnswerInput] = Field(default_factory=list)


class QuizQuestionOptionResponse(BaseModel):
    id: str
    option_text: str
    position: int
    is_correct: bool


class QuizQuestionResponse(BaseModel):
    id: str
    quiz_id: str
    question_text: str
    explanation: str | None = None
    points: float
    position: int
    allow_multiple_answers: bool
    options: list[QuizQuestionOptionResponse]
    created_at: datetime
    updated_at: datetime


class QuizListItemResponse(BaseModel):
    id: str
    course_id: str
    title: str
    description: str | None = None
    passing_score: float | None = None
    max_attempts: int
    shuffle_questions: bool
    status: str
    question_count: int
    total_points: float
    published_at: datetime | None = None
    created_at: datetime


class QuizListResponse(BaseModel):
    items: list[QuizListItemResponse]
    total: int


class QuizDetailResponse(BaseModel):
    id: str
    course_id: str
    title: str
    description: str | None = None
    instructions: str | None = None
    passing_score: float | None = None
    max_attempts: int
    shuffle_questions: bool
    status: str
    published_at: datetime | None = None
    question_count: int
    total_points: float
    questions: list[QuizQuestionResponse]
    created_by: str | None = None
    updated_by: str | None = None
    created_at: datetime
    updated_at: datetime


class QuizAttemptAnswerResultResponse(BaseModel):
    question_id: str
    question_text: str
    selected_option_ids: list[str]
    correct_option_ids: list[str]
    is_correct: bool
    earned_points: float
    max_points: float


class QuizAttemptResultResponse(BaseModel):
    attempt_id: str
    quiz_id: str
    enrollment_id: str
    attempt_number: int
    score: float
    total_points: float
    percentage: float
    passed: bool
    submitted_at: datetime
    answers: list[QuizAttemptAnswerResultResponse]


class QuizAttemptHistoryItemResponse(BaseModel):
    attempt_id: str
    attempt_number: int
    score: float
    total_points: float
    percentage: float
    passed: bool
    submitted_at: datetime


class QuizAttemptHistoryResponse(BaseModel):
    items: list[QuizAttemptHistoryItemResponse]
    total: int
