export type ChipTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

function normalize(value?: string | null): string {
  return String(value ?? '').trim().toLowerCase();
}

export function chipToneForUserStatus(status?: string | null): ChipTone {
  switch (normalize(status)) {
    case 'active':
      return 'success';
    case 'suspended':
      return 'danger';
    case 'inactive':
      return 'neutral';
    case 'pending':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function chipToneForRole(role?: string | null): ChipTone {
  switch (normalize(role)) {
    case 'admin':
      return 'info';
    case 'instructor':
      return 'success';
    case 'student':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function chipToneForCourseStatus(status?: string | null): ChipTone {
  switch (normalize(status)) {
    case 'published':
      return 'success';
    case 'draft':
      return 'warning';
    case 'archived':
      return 'neutral';
    case 'closed':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function chipToneForVisibility(visibility?: string | null): ChipTone {
  switch (normalize(visibility)) {
    case 'public':
      return 'info';
    case 'private':
      return 'warning';
    case 'restricted':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function chipToneForApprovalStatus(status?: string | null): ChipTone {
  switch (normalize(status)) {
    case 'submitted':
      return 'warning';
    case 'under_review':
      return 'info';
    case 'approved':
      return 'success';
    case 'rejected':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function chipToneForCategoryStatus(status?: string | null): ChipTone {
  switch (normalize(status)) {
    case 'active':
      return 'success';
    case 'inactive':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function chipToneForNotificationType(type?: string | null): ChipTone {
  switch (normalize(type)) {
    case 'platform':
      return 'info';
    case 'course':
      return 'success';
    case 'system':
      return 'warning';
    case 'account':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function chipToneForSubmissionStatus(status?: string | null): ChipTone {
  switch (normalize(status)) {
    case 'submitted':
    case 'pending':
      return 'warning';
    case 'in_review':
      return 'info';
    case 'graded':
    case 'completed':
      return 'success';
    case 'late':
    case 'rejected':
      return 'danger';
    default:
      return 'neutral';
  }
}

