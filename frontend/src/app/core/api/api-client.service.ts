import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { appSettings } from '@app/core/config/app-settings';


@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = appSettings.apiBaseUrl;

  get<T>(path: string, query?: object): Observable<T> {
    return this.http.get<T>(this.buildUrl(path), {
      params: this.buildParams(query)
    });
  }

  post<T>(path: string, body: unknown, query?: object): Observable<T> {
    return this.http.post<T>(this.buildUrl(path), body, {
      params: this.buildParams(query)
    });
  }

  postFormData<T>(path: string, body: FormData, query?: object): Observable<T> {
    return this.http.post<T>(this.buildUrl(path), body, {
      params: this.buildParams(query)
    });
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(this.buildUrl(path), body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(this.buildUrl(path));
  }

  buildParams(query?: object): HttpParams | undefined {
    if (!query) {
      return undefined;
    }

    let params = new HttpParams();
    for (const [key, value] of Object.entries(query as Record<string, string | number | boolean | undefined | null>)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      params = params.set(key, String(value));
    }
    return params;
  }

  private buildUrl(path: string): string {
    const normalizedBaseUrl = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalizedBaseUrl}${normalizedPath}`;
  }
}
