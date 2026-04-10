import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WorkspaceSearchService {
  readonly query = signal('');
  readonly normalizedQuery = computed(() => this.query().trim().toLowerCase());

  setQuery(value: string): void {
    this.query.set(value.trimStart());
  }

  clear(): void {
    this.query.set('');
  }

  matches(...values: Array<string | null | undefined>): boolean {
    const query = this.normalizedQuery();
    if (!query) {
      return true;
    }

    return values
      .filter((value): value is string => !!value)
      .join(' ')
      .toLowerCase()
      .includes(query);
  }
}
