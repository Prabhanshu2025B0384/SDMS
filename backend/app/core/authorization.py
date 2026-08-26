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
    Also ensures the case is not CLOSED.
    """
    if case.status == "CLOSED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify a CLOSED case."
        )
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
    
    If required_action == 'EDIT', also ensures the associated Case is not CLOSED.
    """
    case_res = await db.execute(select(Case).where(Case.id == document.case_id))
    case = case_res.scalar_one_or_none()
    
    if required_action == "EDIT" and case and case.status == "CLOSED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit documents in a CLOSED case."
        )
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
        from app.core.audit import log_audit_event
        await log_audit_event(
            db=db,
            action="UNAUTHORIZED_ACCESS_ATTEMPT",
            user_id=user.id,
            document_id=document.id,
            case_id=document.case_id,
            result="FAILURE",
            details={"reason": "Insufficient clearance level"}
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Security Classification Error: Document classification is Level {doc_classification}, but your clearance is Level {user_clearance}."
        )

    if required_action in ["VIEW", "DOWNLOAD", "SEARCH"]:
        return True

    if is_case_owner or is_case_assigned:
        return True

    from app.core.audit import log_audit_event
    await log_audit_event(
        db=db,
        action="UNAUTHORIZED_ACCESS_ATTEMPT",
        user_id=user.id,
        document_id=document.id,
        case_id=document.case_id,
        result="FAILURE",
        details={"reason": "No assigned permission or case access"}
    )
    await db.commit()
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to edit this document. Request access from the document owner or an Admin."
    )


def get_authorized_document_filter(user: User):
    """
    Returns a SQLAlchemy filter condition for Document queries that enforces the exact
    authorization rules defined in check_document_access().
    """
    from sqlalchemy import or_, and_, func
    from app.models import Document, Case, CaseAssignment, DocumentPermission
    
    # 1. Admin or Executive clearance gets everything
    if user.role == "Admin" or (user.clearance_level and user.clearance_level >= 5):
        return True
        
    user_clearance = user.clearance_level or 1
    
    # Subqueries for explicit permissions and assignments
    explicit_perm_subq = select(DocumentPermission.document_id).where(
        DocumentPermission.user_id == user.id
    )
    
    case_assigned_subq = select(CaseAssignment.case_id).where(
        CaseAssignment.user_id == user.id
    )
    
    # The filter logic:
    return or_(
        # Condition A: Explicit permission bypasses clearance check for VIEW
        Document.id.in_(explicit_perm_subq),
        
        # Condition B: Meets clearance
        func.coalesce(Document.classification_level, 1) <= user_clearance
    )
