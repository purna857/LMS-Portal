import { MatDialogConfig } from '@angular/material/dialog';


export type PortalDialogSize = 'sm' | 'md' | 'lg' | 'xl';

export function portalDialogPanelClasses(size: PortalDialogSize, ...extraClasses: string[]): string[] {
  return ['lms-dialog-panel', `lms-dialog-panel--${size}`, ...extraClasses];
}

export function portalDialogConfig<T>(size: PortalDialogSize, config: Partial<MatDialogConfig<T>> = {}): MatDialogConfig<T> {
  return {
    autoFocus: false,
    restoreFocus: true,
    panelClass: portalDialogPanelClasses(size),
    ...config
  };
}
