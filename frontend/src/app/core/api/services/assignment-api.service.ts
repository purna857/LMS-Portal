import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '@app/core/api/api-client.service';
import type { MessageResponse } from '@app/core/models/auth.model';
import type { AdminAssignmentTrackerListResponse } from '@app/features/admin/models/admin.models';
import type {
  Assignment,
  AssignmentListResponse,
  AssignmentPayload,
  AssignmentSubmissionDetail,
  AssignmentSubmissionListResponse,
  AssignmentGradePayload
} from '@app/features/instructor/models/instructor.models';
import type {
  AssignmentSubmissionResponse,
  AssignmentUploadResponse,
  StudentAssignmentRecordListResponse,
  AssignmentSubmitPayload
} from '@app/features/student/models/student.models';


@Injectable({ providedIn: 'root' })
export class AssignmentApiService {
  private readonly api = inject(ApiClientService);

  listAssignmentsByCourse(courseId: string): Observable<AssignmentListResponse> {
    return this.api.get<AssignmentListResponse>(`/courses/${courseId}/assignments`);
  }

  createAssignment(courseId: string, payload: AssignmentPayload): Observable<Assignment> {
    return this.api.post<Assignment>(`/courses/${courseId}/assignments`, payload);
  }

  updateAssignment(assignmentId: string, payload: Partial<AssignmentPayload>): Observable<Assignment> {
    return this.api.patch<Assignment>(`/assignments/${assignmentId}`, payload);
  }

  deleteAssignment(assignmentId: string): Observable<MessageResponse> {
    return this.api.delete<MessageResponse>(`/assignments/${assignmentId}`);
  }

  submitAssignment(assignmentId: string, payload: AssignmentSubmitPayload): Observable<AssignmentSubmissionResponse> {
    return this.api.post<AssignmentSubmissionResponse>(`/assignments/${assignmentId}/submit`, payload);
  }

  uploadAssignmentFile(file: File): Observable<AssignmentUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.postFormData<AssignmentUploadResponse>('/assignments/uploads', formData);
  }

  listMyAssignmentSubmissions(): Observable<StudentAssignmentRecordListResponse> {
    return this.api.get<StudentAssignmentRecordListResponse>('/assignments/submissions/me');
  }

  listAssignmentSubmissions(assignmentId: string): Observable<AssignmentSubmissionListResponse> {
    return this.api.get<AssignmentSubmissionListResponse>(`/assignments/${assignmentId}/submissions`);
  }

  gradeSubmission(submissionId: string, payload: AssignmentGradePayload): Observable<AssignmentSubmissionDetail> {
    return this.api.post<AssignmentSubmissionDetail>(`/assignment-submissions/${submissionId}/grade`, payload);
  }

  addFeedback(submissionId: string, payload: { feedback: string }): Observable<AssignmentSubmissionDetail> {
    return this.api.post<AssignmentSubmissionDetail>(`/assignment-submissions/${submissionId}/feedback`, payload);
  }

  listAdminAssignmentTracker(): Observable<AdminAssignmentTrackerListResponse> {
    return this.api.get<AdminAssignmentTrackerListResponse>('/admin/assignment-tracker');
  }
}
