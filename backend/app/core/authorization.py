from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.security import get_current_user
from app.models import Case, CaseAssignment, User

# Role-Based Access Control (RBAC)
ROLE_PERMISSIONS = {
    "Investigating Officer": ["VIEW", "DOWNLOAD", "EDIT", "UPLOAD", "SUBMIT"],
    "Senior Officer": ["VIEW", "DOWNLOAD", "EDIT", "UPLOAD", "SUBMIT", "APPROVE"],
    "Prosecutor": ["VIEW", "DOWNLOAD"],
    "Admin": ["VIEW", "DOWNLOAD", "EDIT", "UPLOAD", "SUBMIT", "APPROVE", "DELETE", "MANAGE_USERS"]
}


class RoleChecker:
    def __init__(self, required_permissions: list[str]):
        self.required_permissions = required_permissions

    def __call__(self, user: User = Depends(get_current_user)):
        user_perms = ROLE_PERMISSIONS.get(user.role, [])
        for perm in self.required_permissions:
            if perm not in user_perms:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Role '{user.role}' does not have the required permission: {perm}"
                )
        return user


async def check_case_upload_permission(
    db: AsyncSession,
    case: Case,
    user: User
) -> bool:
    """
    Checks if a user has permission to upload documents to a case.
    Admins and Senior Officers have global access.
    Officers can upload if they own the case, are assigned to the case,
    or have the UPLOAD role permission for open cases.
    """
    # 1. Admin or Senior Officer has universal upload permission
    if user.role in ["Admin", "Senior Officer"]:
        return True

    # 2. Check if role has UPLOAD permission
    user_perms = ROLE_PERMISSIONS.get(user.role, [])
    if "UPLOAD" not in user_perms:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{user.role}' is not authorized to upload documents."
        )

    # 3. Check if user is the owning officer
    if str(case.owning_officer_id) == str(user.id):
        return True

    # 4. Check if user is assigned to the case
    assignment_res = await db.execute(
        select(CaseAssignment).where(
            CaseAssignment.case_id == case.id,
            CaseAssignment.user_id == user.id
        )
    )
    if assignment_res.scalar_one_or_none():
        return True

    # If not assigned and not owner
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"You are not assigned to case '{case.case_number}'. An Admin must assign this case to you or you can create your own case."
    )

