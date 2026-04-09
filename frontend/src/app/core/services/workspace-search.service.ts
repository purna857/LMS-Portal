import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WorkspaceSearchService {
  readonly query = signal('');

  setQuery(value: string): void {
    this.query.set(value.trimStart());
  }

  clear(): void {
    this.query.set('');
  }
}
