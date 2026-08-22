
from fastapi import Depends, HTTPException, status

from app.core.security import get_current_user
from app.models import User

# Simple RBAC model mapping roles to permissions
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

# Dependency for Case-level access
async def verify_case_access(
    case_id: str,
    user: User = Depends(get_current_user)
):
    # In a real app, you would query the database here to check if the user
    # is the owning_officer_id OR is in the case_assignments table for this case_id.
    # For now, this is a placeholder that allows access to everything if logged in.
    # We will implement this fully in Phase 2/3.
    pass
