export interface Permission {
  id: string;
  name: string;
  description: string;
  scope: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[]; // Array of permission IDs
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_PERMISSIONS: Permission[] = [
  {
    id: 'users:read',
    name: 'View Users',
    description: 'View user list and profiles',
    scope: 'users'
  },
  {
    id: 'users:write',
    name: 'Manage Users',
    description: 'Create, edit, and delete users',
    scope: 'users'
  },
  {
    id: 'roles:read',
    name: 'View Roles',
    description: 'View roles and permissions',
    scope: 'roles'
  },
  {
    id: 'roles:write',
    name: 'Manage Roles',
    description: 'Create, edit, and delete roles',
    scope: 'roles'
  },
  {
    id: 'expenses:read',
    name: 'View Expenses',
    description: 'View all user expenses',
    scope: 'expenses'
  },
  {
    id: 'expenses:write',
    name: 'Manage Expenses',
    description: 'Create, edit, and delete expenses',
    scope: 'expenses'
  },
  {
    id: 'settings:read',
    name: 'View Settings',
    description: 'View system settings',
    scope: 'settings'
  },
  {
    id: 'settings:write',
    name: 'Manage Settings',
    description: 'Modify system settings',
    scope: 'settings'
  },
  {
    id: 'reports:read',
    name: 'View Reports',
    description: 'Access analytics and reports',
    scope: 'reports'
  },
  {
    id: 'reports:write',
    name: 'Manage Reports',
    description: 'Create and modify reports',
    scope: 'reports'
  }
];