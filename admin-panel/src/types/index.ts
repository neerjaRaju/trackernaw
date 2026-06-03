// Shared TypeScript types mirroring the backend Prisma schema.
// Keep these in sync with backend/prisma/schema.prisma — eventually generate
// them with prisma-zod or openapi-typescript.

export type Role = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'MANAGER' | 'TEAM_LEAD' | 'EMPLOYEE';

export interface User {
  id: string;
  email: string;
  phone?: string | null;
  fullName: string;
  role: Role;
  avatarUrl?: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  companyId: string;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LATE' | 'ON_LEAVE';

export interface Attendance {
  id: string;
  userId: string;
  date: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  checkInLat?: number | null;
  checkInLng?: number | null;
  withinGeofence: boolean;
  faceVerified: boolean;
  workMinutes?: number | null;
  status: AttendanceStatus;
}

export interface LocationPing {
  id: string;
  userId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  battery?: number;
  isMoving: boolean;
  isMock: boolean;
  recordedAt: string;
}

export interface Geofence {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  type: 'office' | 'client' | 'restricted';
}

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt?: string | null;
  assigneeId?: string | null;
  assignee?: Pick<User, 'id' | 'fullName' | 'avatarUrl'>;
  completedAt?: string | null;
  proofUrl?: string | null;
}

export type ExpenseStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface Expense {
  id: string;
  userId: string;
  category: string;
  amount: number;
  currency: string;
  description?: string | null;
  receiptUrl?: string | null;
  distanceKm?: number | null;
  status: ExpenseStatus;
}

export type SosStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface SosAlert {
  id: string;
  userId: string;
  lat: number;
  lng: number;
  status: SosStatus;
  createdAt: string;
  user?: Pick<User, 'id' | 'fullName' | 'phone' | 'avatarUrl'>;
}
