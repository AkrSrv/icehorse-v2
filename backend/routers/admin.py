from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas, database
from auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])

# Simpel Super Admin tjek for nu. Du bør være den eneste super admin.
def get_super_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.email not in ["arno@alkdata.dk", "arnolkristiansen@outlook.com"]:
        raise HTTPException(status_code=403, detail="Not authorized as Super Admin")
    return current_user

@router.get("/clubs", response_model=List[schemas.ClubOut])
def read_all_clubs(db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    return db.query(models.Club).all()

@router.get("/competitions", response_model=List[schemas.CompetitionOut])
def read_all_competitions(db: Session = Depends(database.get_db), admin: models.User = Depends(get_super_admin)):
    return db.query(models.Competition).all()

class DiscountCodeCreate(schemas.BaseModel):
    code: str
    discount_amount: float

@router.post("/discount-codes")
def create_discount_code(
    discount: DiscountCodeCreate, 
    db: Session = Depends(database.get_db), 
    admin: models.User = Depends(get_super_admin)
):
    db_discount = models.DiscountCode(code=discount.code, discount_amount=discount.discount_amount)
    db.add(db_discount)
    db.commit()
    db.refresh(db_discount)
    return db_discount

@router.get("/discount-codes", response_model=List[schemas.DiscountCodeOut])
def list_discount_codes(
    db: Session = Depends(database.get_db), 
    admin: models.User = Depends(get_super_admin)
):
    return db.query(models.DiscountCode).all()

@router.delete("/discount-codes/{code_id}")
def delete_discount_code(
    code_id: int,
    db: Session = Depends(database.get_db), 
    admin: models.User = Depends(get_super_admin)
):
    discount = db.query(models.DiscountCode).filter(models.DiscountCode.id == code_id).first()
    if not discount:
        raise HTTPException(status_code=404, detail="Rabatkode ikke fundet.")
    db.delete(discount)
    db.commit()
    return {"status": "success"}

@router.delete("/competitions/{comp_id}")
def delete_competition_as_admin(
    comp_id: int,
    db: Session = Depends(database.get_db), 
    admin: models.User = Depends(get_super_admin)
):
    comp = db.query(models.Competition).filter(models.Competition.id == comp_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Stævne ikke fundet.")
    db.delete(comp)
    db.commit()
    return {"status": "success"}

from datetime import datetime

@router.get("/stats")
def get_system_stats(
    db: Session = Depends(database.get_db), 
    admin: models.User = Depends(get_super_admin)
):
    clubs = db.query(models.Club).all()
    comps = db.query(models.Competition).all()
    
    total_clubs = len(clubs)
    total_comps = len(comps)
    
    active_comps = len([c for c in comps if c.is_active])
    inactive_comps = total_comps - active_comps
    
    now = datetime.utcnow()
    outdated_inactive_comps = len([c for c in comps if not c.is_active and c.date < now])
    
    club_stats = []
    for club in clubs:
        club_comps = [c for c in comps if c.club_id == club.id]
        created_count = len(club_comps)
        active_count = len([c for c in club_comps if c.is_active])
        club_stats.append({
            "club_id": club.id,
            "club_name": club.name,
            "owner_email": club.user.email if club.user else "Ingen ejer",
            "created_count": created_count,
            "active_count": active_count
        })
        
    comp_list = []
    for comp in comps:
        comp_list.append({
            "id": comp.id,
            "name": comp.name,
            "club_name": comp.club.name if comp.club else "Ingen klub",
            "date": comp.date.isoformat() if comp.date else None,
            "is_active": comp.is_active,
            "price_paid": comp.price_paid
        })
        
    return {
        "total_clubs": total_clubs,
        "total_competitions": total_comps,
        "active_competitions": active_comps,
        "inactive_competitions": inactive_comps,
        "outdated_inactive_competitions": outdated_inactive_comps,
        "club_stats": club_stats,
        "competitions": comp_list
    }

