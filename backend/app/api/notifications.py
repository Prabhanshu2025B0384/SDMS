from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models import Notification, User
from app.core.security import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/")
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).order_by(Notification.created_at.desc())
    
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    return [
        {
            "id": str(n.id),
            "message": n.message,
            "link": n.link,
            "created_at": n.created_at.isoformat() if n.created_at else None
        }
        for n in notifications
    ]


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        )
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notification.is_read = True
    await db.commit()
    
    return {"message": "Notification marked as read"}

@router.delete("/all")
async def clear_all_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy import delete
    await db.execute(
        delete(Notification).where(Notification.user_id == current_user.id)
    )
    await db.commit()
    return {"message": "All notifications cleared"}
