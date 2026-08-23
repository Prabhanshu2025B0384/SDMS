from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.security import get_current_user
from app.models import Case, CaseAssignment, Document, DocumentPermission, User

# Role-Based Access Control (RBAC)
ROLE_PERMISSIONS = {
    "Investigating Officer": ["VIEW", "DOWNLOAD", "EDIT", "UPLOAD", "SUBMIT"],
    "Senior Officer": ["VIEW", "DOWNLOAD", "EDIT", "UPLOAD", "SUBMIT", "APPROVE"],
    "Prosecutor": ["VIEW", "DOWNLOAD"],
    "Admin": ["VIEW", "DOWNLOAD", "EDIT", "UPLOAD", "SUBMIT", "APPROVE", "DELETE", "MANAGE_USERS"]
}

# Hierarchy / Clearance Levels (1 to 5)
CLEARANCE_LEVELS = {
    1: {"name": "Level 1: Restricted", "role_default": "Constable / Junior Officer"},
    2: {"name": "Level 2: Confidential", "role_default": "Sub-Inspector"},
    3: {"name": "Level 3: Secret", "role_default": "Investigating Officer / Inspector"},
    4: {"name": "Level 4: Top Secret", "role_default": "Senior Officer / SP"},
    5: {"name": "Level 5: Executive / Admin", "role_default": "Admin / System Director"}
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
    """
    if user.role in ["Admin", "Senior Officer"] or (user.clearance_level and user.clearance_level >= 4):
        return True

    user_perms = ROLE_PERMISSIONS.get(user.role, [])
    if "UPLOAD" not in user_perms:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{user.role}' is not authorized to upload documents."
        )

    if str(case.owning_officer_id) == str(user.id):
        return True

    assignment_res = await db.execute(
        select(CaseAssignment).where(
            CaseAssignment.case_id == case.id,
            CaseAssignment.user_id == user.id
        )
    )
    if assignment_res.scalar_one_or_none():
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"You are not assigned to case '{case.case_number}'. An Admin must assign this case to you or you can create your own case."
    )


async def check_document_access(
    db: AsyncSession,
    document: Document,
    user: User,
    required_action: str = "VIEW" # "VIEW", "DOWNLOAD", "EDIT"
) -> bool:
    """
    Verifies document access by checking:
    1. Admin / Executive status
    2. Case Ownership
    3. Explicit Multi-User Document Permissions (DocumentPermission)
    4. Hierarchy Clearance Level (user.clearance_level >= document.classification_level)
    """
    # 1. Admin or Executive clearance
    if user.role == "Admin" or (user.clearance_level and user.clearance_level >= 5):
        return True

    # 2. Check explicit granular document permissions
    perm_result = await db.execute(
        select(DocumentPermission).where(
            DocumentPermission.document_id == document.id,
            DocumentPermission.user_id == user.id
        )
    )
    explicit_perm = perm_result.scalar_one_or_none()
    if explicit_perm:
        if required_action == "VIEW":
            return True
        elif required_action == "DOWNLOAD" and explicit_perm.permission_type in ["DOWNLOAD", "EDIT", "VIEW"]:
            return True
        elif required_action == "EDIT" and explicit_perm.permission_type == "EDIT":
            return True

    # 3. Check Case ownership or assignment
    case_res = await db.execute(select(Case).where(Case.id == document.case_id))
    case = case_res.scalar_one_or_none()
    
    is_case_owner = case and str(case.owning_officer_id) == str(user.id)
    
    assignment_res = await db.execute(
        select(CaseAssignment).where(
            CaseAssignment.case_id == document.case_id,
            CaseAssignment.user_id == user.id
        )
    )
    is_case_assigned = assignment_res.scalar_one_or_none() is not None

    # 4. Check Hierarchy Clearance Level
    user_clearance = user.clearance_level or 1
    doc_classification = document.classification_level or 1
    
    if user_clearance < doc_classification:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Security Classification Error: Document classification is Level {doc_classification}, but your clearance is Level {user_clearance}."
        )

    if is_case_owner or is_case_assigned:
        return True

    # If document classification is unrestricted (Level 1) and user has VIEW permission
    if doc_classification == 1 and user.role in ["Investigating Officer", "Senior Officer", "Prosecutor"]:
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to access this document. Request access from the document owner or an Admin."
    )


