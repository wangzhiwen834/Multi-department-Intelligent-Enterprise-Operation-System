export type Role = 'chairman' | 'manager' | 'employee';

// 董事长可创建经理;经理不能创建经理
export const canCreateManager = (actor: Role) => actor === 'chairman';

// 董事长可管所有经理+员工(不管别的董事长);经理只管 employee 且需是本部门或自己创建的
export const canManageTarget = (
  actor: { role: Role; department: string | null },
  target: { role: Role; department: string | null; created_by: number | null; id: number },
  actorId: number,
): boolean => {
  if (actor.role === 'chairman') return target.role !== 'chairman';
  if (actor.role === 'manager') {
    if (target.role !== 'employee') return false;
    return target.created_by === actorId || target.department === actor.department;
  }
  return false;
};
