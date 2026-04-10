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

export function portalDrawerPanelClasses(size: PortalDialogSize, ...extraClasses: string[]): string[] {
  return ['lms-drawer-panel', `lms-drawer-panel--${size}`, ...extraClasses];
}

export function portalDrawerConfig<T>(size: PortalDialogSize, config: Partial<MatDialogConfig<T>> = {}): MatDialogConfig<T> {
  return {
    autoFocus: false,
    restoreFocus: true,
    panelClass: portalDrawerPanelClasses(size),
    position: { right: '0', top: '0' },
    ...config
  };
}
