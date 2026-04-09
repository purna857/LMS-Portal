import type { UserRole } from './auth.model';


export interface NavItem {
  section: string;
  label: string;
  caption: string;
  icon: string;
  route: string;
  roles: UserRole[];
}
