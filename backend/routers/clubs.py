from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import crud, models, schemas, database
from auth import get_current_user
from datetime import datetime, timedelta
from email_service import send_invoice_email
import os

router = APIRouter(prefix="/clubs", tags=["clubs"])

def get_club_if_owner(club_id: int, db: Session, current_user: models.User):
    club = db.query(models.Club).filter(models.Club.id == club_id, models.Club.user_id == current_user.id).first()
    if not club:
        raise HTTPException(status_code=404, detail="Club not found or not owned by user")
    return club

def get_competition_if_owner(comp_id: int, club_id: int, db: Session, current_user: models.User):
    # First verify club ownership
    get_club_if_owner(club_id, db, current_user)
    comp = db.query(models.Competition).filter(models.Competition.id == comp_id, models.Competition.club_id == club_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    return comp

# --- CLUB MANAGEMENT ---

@router.get("/me", response_model=List[schemas.ClubOut])
def read_my_clubs(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_user_clubs(db=db, user_id=current_user.id)

@router.post("/", response_model=schemas.ClubOut)
def create_new_club(club: schemas.ClubCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return crud.create_club(db=db, club=club, user_id=current_user.id)

@router.get("/{club_id}", response_model=schemas.ClubOut)
def read_club(club_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return get_club_if_owner(club_id, db, current_user)

@router.put("/{club_id}", response_model=schemas.ClubOut)
def update_club(
    club_id: int,
    club_update: schemas.ClubUpdate, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    get_club_if_owner(club_id, db, current_user)
    return crud.update_club(db=db, club_id=club_id, club_update=club_update)

# --- DIRECTORY ---
@router.get("/{club_id}/directory", response_model=schemas.DirectoryOut)
def read_global_directory(
    club_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_club_if_owner(club_id, db, current_user)
    return crud.get_club_directory(db=db, club_id=club_id)

# --- CLUB RIDERS & HORSES ---
@router.post("/{club_id}/club_riders", response_model=schemas.ClubRiderOut)
def create_club_rider(
    club_id: int,
    rider: schemas.ClubRiderCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_club_if_owner(club_id, db, current_user)
    return crud.create_club_rider(db=db, rider=rider, club_id=club_id)

@router.put("/{club_id}/club_riders/{rider_id}", response_model=schemas.ClubRiderOut)
def update_club_rider(
    club_id: int,
    rider_id: int,
    rider: schemas.ClubRiderCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_club_if_owner(club_id, db, current_user)
    db_rider = db.query(models.ClubRider).filter(models.ClubRider.id == rider_id, models.ClubRider.club_id == club_id).first()
    if not db_rider:
        raise HTTPException(status_code=404, detail="Rider not found")
    return crud.update_club_rider(db=db, rider_id=rider_id, rider_update=rider)

@router.delete("/{club_id}/club_riders/{rider_id}")
def delete_club_rider(
    club_id: int,
    rider_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_club_if_owner(club_id, db, current_user)
    db_rider = db.query(models.ClubRider).filter(models.ClubRider.id == rider_id, models.ClubRider.club_id == club_id).first()
    if not db_rider:
        raise HTTPException(status_code=404, detail="Rider not found")
    crud.delete_club_rider(db=db, rider_id=rider_id)
    return {"status": "success"}

@router.post("/{club_id}/club_riders/{rider_id}/horses", response_model=schemas.HorseOut)
def add_horse_to_rider(
    club_id: int,
    rider_id: int,
    horse: schemas.HorseCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_club_if_owner(club_id, db, current_user)
    db_rider = db.query(models.ClubRider).filter(models.ClubRider.id == rider_id, models.ClubRider.club_id == club_id).first()
    if not db_rider:
        raise HTTPException(status_code=404, detail="Rider not found")
    return crud.add_horse_to_rider(db=db, horse=horse, rider_id=rider_id)

@router.delete("/{club_id}/horses/{horse_id}")
def delete_horse(
    club_id: int,
    horse_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_club_if_owner(club_id, db, current_user)
    horse = db.query(models.Horse).join(models.ClubRider).filter(models.Horse.id == horse_id, models.ClubRider.club_id == club_id).first()
    if not horse:
        raise HTTPException(status_code=404, detail="Horse not found")
    crud.remove_horse(db=db, horse_id=horse_id)
    return {"status": "success"}

# --- CLUB JUDGES ---
@router.post("/{club_id}/club_judges", response_model=schemas.ClubJudgeOut)
def create_club_judge(
    club_id: int,
    judge: schemas.ClubJudgeCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_club_if_owner(club_id, db, current_user)
    return crud.create_club_judge(db=db, judge=judge, club_id=club_id)

@router.put("/{club_id}/club_judges/{judge_id}", response_model=schemas.ClubJudgeOut)
def update_club_judge(
    club_id: int,
    judge_id: int,
    judge: schemas.ClubJudgeCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_club_if_owner(club_id, db, current_user)
    db_judge = db.query(models.ClubJudge).filter(models.ClubJudge.id == judge_id, models.ClubJudge.club_id == club_id).first()
    if not db_judge:
        raise HTTPException(status_code=404, detail="Judge not found")
    return crud.update_club_judge(db=db, judge_id=judge_id, judge_update=judge)

@router.delete("/{club_id}/club_judges/{judge_id}")
def delete_club_judge(
    club_id: int,
    judge_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_club_if_owner(club_id, db, current_user)
    db_judge = db.query(models.ClubJudge).filter(models.ClubJudge.id == judge_id, models.ClubJudge.club_id == club_id).first()
    if not db_judge:
        raise HTTPException(status_code=404, detail="Judge not found")
    crud.delete_club_judge(db=db, judge_id=judge_id)
    return {"status": "success"}

# --- COMPETITIONS ---
@router.post("/{club_id}/competitions", response_model=schemas.CompetitionOut)
def create_competition_for_club(
    club_id: int,
    competition: schemas.CompetitionCreate, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    get_club_if_owner(club_id, db, current_user)
    
    comp_data = competition.model_dump(exclude={"post_ids", "import_standards"})
    db_competition = models.Competition(**comp_data, club_id=club_id)
    db.add(db_competition)
    db.commit()
    db.refresh(db_competition)
    
    if competition.import_standards:
        disciplines = [d.strip() for d in db_competition.discipline.split(",") if d.strip()]
        if not disciplines:
            disciplines = ["gait"]
            
        standards = []
        if "dressage" in disciplines:
            dressage_names = [
                "Intro / bom / skridt-trav",
                "LD1", "LD2",
                "LC1", "LC2", "LC3",
                "LB1", "LB2", "LB3",
                "LA1", "LA2", "LA3", "LA4",
                "MB0", "MB1", "MB2", "MB3",
                "MA1", "MA2", "Prix St. Georges (PSG)", "Intermediaire I", "Intermediaire II",
                "Grand Prix", "Grand Prix Special", "Kür"
            ]
            for name in dressage_names:
                standards.append({
                    "name": name,
                    "coefficient": 1.0,
                    "max_value": 10.0,
                    "discipline": "dressage",
                    "scoring_method": "percentage"
                })
                
        if "jumping" in disciplines:
            jumping_classes = [
                ("Bom på jord / kryds / mini", "clear_round"),
                ("LF", "faults_time"),
                ("LE", "faults_time"),
                ("LD", "faults_time"),
                ("LC", "faults_time"),
                ("LB1*", "jump_off"),
                ("LB2*", "jump_off"),
                ("LA1*", "jump_off"),
                ("LA2*", "jump_off"),
                ("MB1*", "jump_off"),
                ("MB2*", "jump_off"),
                ("MA", "jump_off"),
                ("S", "jump_off")
            ]
            for name, method in jumping_classes:
                standards.append({
                    "name": name,
                    "coefficient": 1.0,
                    "max_value": 10.0,
                    "discipline": "jumping",
                    "scoring_method": method
                })
                
        if "gait" in disciplines:
            gait_names = ["T8 Tølt", "T1 Tølt", "4.1 Firgang", "5.1 Femgang"]
            for name in gait_names:
                standards.append({
                    "name": name,
                    "coefficient": 1.0,
                    "max_value": 10.0,
                    "discipline": "gait",
                    "scoring_method": "standard"
                })
                
        imported_posts = []
        for std in standards:
            existing_post = db.query(models.ClubPost).filter(
                models.ClubPost.club_id == club_id,
                models.ClubPost.name == std["name"],
                models.ClubPost.discipline == std["discipline"]
            ).first()
            
            if not existing_post:
                new_post = models.ClubPost(
                    club_id=club_id,
                    name=std["name"],
                    coefficient=std["coefficient"],
                    max_value=std["max_value"],
                    discipline=std["discipline"],
                    scoring_method=std["scoring_method"]
                )
                db.add(new_post)
                db.commit()
                db.refresh(new_post)
                imported_posts.append(new_post)
            else:
                imported_posts.append(existing_post)
                
        for post in imported_posts:
            assoc = db.query(models.CompetitionPost).filter(
                models.CompetitionPost.competition_id == db_competition.id,
                models.CompetitionPost.club_post_id == post.id
            ).first()
            if not assoc:
                db_assoc = models.CompetitionPost(
                    competition_id=db_competition.id,
                    club_post_id=post.id
                )
                db.add(db_assoc)
        db.commit()
        
    elif competition.post_ids:
        for pid in competition.post_ids:
            assoc = db.query(models.CompetitionPost).filter(
                models.CompetitionPost.competition_id == db_competition.id,
                models.CompetitionPost.club_post_id == pid
            ).first()
            if not assoc:
                db_assoc = models.CompetitionPost(
                    competition_id=db_competition.id,
                    club_post_id=pid
                )
                db.add(db_assoc)
        db.commit()
        
    db.refresh(db_competition)
    return db_competition

@router.get("/{club_id}/competitions", response_model=List[schemas.CompetitionOut])
def read_competitions_for_club(
    club_id: int,
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    get_club_if_owner(club_id, db, current_user)
    return crud.get_competitions(db=db, club_id=club_id)

@router.get("/{club_id}/competitions/{comp_id}", response_model=schemas.CompetitionOut)
def read_competition(
    club_id: int,
    comp_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    return get_competition_if_owner(comp_id, club_id, db, current_user)


@router.delete("/{club_id}/competitions/{comp_id}")
def delete_competition_for_club(
    club_id: int,
    comp_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_competition_if_owner(comp_id, club_id, db, current_user)
    if crud.delete_competition(db, comp_id):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Competition not found")

@router.post("/{club_id}/competitions/{comp_id}/posts", response_model=schemas.CompetitionOut)
def set_competition_posts(
    club_id: int,
    comp_id: int,
    post_ids: List[int],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    comp = get_competition_if_owner(comp_id, club_id, db, current_user)
    crud.set_competition_posts(db, comp_id, post_ids)
    db.refresh(comp)
    return comp

@router.post("/{club_id}/competitions/{comp_id}/import-standard-classes", response_model=schemas.CompetitionOut)
def import_standard_classes(
    club_id: int,
    comp_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    comp = get_competition_if_owner(comp_id, club_id, db, current_user)
    
    # Parse disciplines
    disciplines = [d.strip() for d in comp.discipline.split(",") if d.strip()]
    if not disciplines:
        disciplines = ["gait"]
        
    standards = []
    if "dressage" in disciplines:
        dressage_names = [
            "Intro / bom / skridt-trav",
            "LD1", "LD2",
            "LC1", "LC2", "LC3",
            "LB1", "LB2", "LB3",
            "LA1", "LA2", "LA3", "LA4",
            "MB0", "MB1", "MB2", "MB3",
            "MA1", "MA2", "Prix St. Georges (PSG)", "Intermediaire I", "Intermediaire II",
            "Grand Prix", "Grand Prix Special", "Kür"
        ]
        for name in dressage_names:
            standards.append({
                "name": name,
                "coefficient": 1.0,
                "max_value": 10.0,
                "discipline": "dressage",
                "scoring_method": "percentage"
            })
            
    if "jumping" in disciplines:
        jumping_classes = [
            ("Bom på jord / kryds / mini", "clear_round"),
            ("LF", "faults_time"),
            ("LE", "faults_time"),
            ("LD", "faults_time"),
            ("LC", "faults_time"),
            ("LB1*", "jump_off"),
            ("LB2*", "jump_off"),
            ("LA1*", "jump_off"),
            ("LA2*", "jump_off"),
            ("MB1*", "jump_off"),
            ("MB2*", "jump_off"),
            ("MA", "jump_off"),
            ("S", "jump_off")
        ]
        for name, method in jumping_classes:
            standards.append({
                "name": name,
                "coefficient": 1.0,
                "max_value": 10.0,
                "discipline": "jumping",
                "scoring_method": method
            })
            
    if "gait" in disciplines:
        gait_names = ["T8 Tølt", "T1 Tølt", "4.1 Firgang", "5.1 Femgang"]
        for name in gait_names:
            standards.append({
                "name": name,
                "coefficient": 1.0,
                "max_value": 10.0,
                "discipline": "gait",
                "scoring_method": "standard"
            })
            
    imported_posts = []
    for std in standards:
        existing_post = db.query(models.ClubPost).filter(
            models.ClubPost.club_id == club_id,
            models.ClubPost.name == std["name"],
            models.ClubPost.discipline == std["discipline"]
        ).first()
        
        if not existing_post:
            new_post = models.ClubPost(
                club_id=club_id,
                name=std["name"],
                coefficient=std["coefficient"],
                max_value=std["max_value"],
                discipline=std["discipline"],
                scoring_method=std["scoring_method"]
            )
            db.add(new_post)
            db.commit()
            db.refresh(new_post)
            imported_posts.append(new_post)
        else:
            imported_posts.append(existing_post)
            
    for post in imported_posts:
        assoc = db.query(models.CompetitionPost).filter(
            models.CompetitionPost.competition_id == comp_id,
            models.CompetitionPost.club_post_id == post.id
        ).first()
        if not assoc:
            db_assoc = models.CompetitionPost(
                competition_id=comp_id,
                club_post_id=post.id
            )
            db.add(db_assoc)
            
    db.commit()
    db.refresh(comp)
    return comp

# --- COMPETITION ATTACHMENTS (RIDERS/JUDGES/POSTS) ---
@router.post("/{club_id}/competitions/{comp_id}/riders", response_model=schemas.CompetitionRiderOut)
def attach_rider_to_competition(
    club_id: int,
    comp_id: int,
    comp_rider: schemas.CompetitionRiderCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_competition_if_owner(comp_id, club_id, db, current_user)
    db_rider = db.query(models.ClubRider).filter(models.ClubRider.id == comp_rider.club_rider_id, models.ClubRider.club_id == club_id).first()
    if not db_rider:
        raise HTTPException(status_code=404, detail="ClubRider not found")
    return crud.create_competition_rider(db=db, comp_rider=comp_rider, competition_id=comp_id)

@router.get("/{club_id}/competitions/{comp_id}/riders", response_model=List[schemas.CompetitionRiderOut])
def read_riders_for_competition(
    club_id: int,
    comp_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_competition_if_owner(comp_id, club_id, db, current_user)
    return crud.get_competition_riders(db=db, competition_id=comp_id)

@router.delete("/{club_id}/competitions/{comp_id}/riders/{comp_rider_id}")
def remove_rider_from_competition(
    club_id: int,
    comp_id: int, 
    comp_rider_id: int, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    get_competition_if_owner(comp_id, club_id, db, current_user)
    if crud.delete_competition_rider(db, comp_rider_id):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Competition Rider not found")

@router.post("/{club_id}/competitions/{comp_id}/judges", response_model=schemas.CompetitionJudgeOut)
def attach_judge_to_competition(
    club_id: int,
    comp_id: int,
    comp_judge: schemas.CompetitionJudgeCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_competition_if_owner(comp_id, club_id, db, current_user)
    db_judge = db.query(models.ClubJudge).filter(models.ClubJudge.id == comp_judge.club_judge_id, models.ClubJudge.club_id == club_id).first()
    if not db_judge:
        raise HTTPException(status_code=404, detail="ClubJudge not found")
    return crud.create_competition_judge(db=db, comp_judge=comp_judge, competition_id=comp_id)

@router.get("/{club_id}/competitions/{comp_id}/judges", response_model=List[schemas.CompetitionJudgeOut])
def read_judges_for_competition(
    club_id: int,
    comp_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_competition_if_owner(comp_id, club_id, db, current_user)
    return crud.get_competition_judges(db=db, competition_id=comp_id)

@router.delete("/{club_id}/competitions/{comp_id}/judges/{comp_judge_id}")
def remove_judge_from_competition(
    club_id: int,
    comp_id: int, 
    comp_judge_id: int, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    get_competition_if_owner(comp_id, club_id, db, current_user)
    if crud.delete_competition_judge(db, comp_judge_id):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Competition Judge not found")

@router.post("/{club_id}/competitions/{comp_id}/judges/{comp_judge_id}/send-email")
def send_magic_link_email(
    club_id: int,
    comp_id: int,
    comp_judge_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_competition_if_owner(comp_id, club_id, db, current_user)
    
    comp_judge = db.query(models.CompetitionJudge).filter(models.CompetitionJudge.id == comp_judge_id, models.CompetitionJudge.competition_id == comp_id).first()
    if not comp_judge:
        raise HTTPException(status_code=404, detail="Competition Judge not found")
        
    club_judge = comp_judge.club_judge
    if not club_judge.email:
        raise HTTPException(status_code=400, detail="Denne dommer har ingen registreret e-mailadresse.")
        
    comp = db.query(models.Competition).filter(models.Competition.id == comp_id).first()
    
    # Afsend email via Simply.com (eller anden SMTP)
    try:
        from email_service import send_judge_magic_link_email
        frontend_url = os.environ.get("FRONTEND_URL", "http://192.168.1.59:3000").rstrip("/")
        magic_link = f"{frontend_url}/?magic={comp_judge.magic_link_uuid}"
        send_judge_magic_link_email(
            to_email=club_judge.email,
            judge_name=club_judge.name,
            comp_name=comp.name,
            magic_link=magic_link
        )
        return {"status": "success", "message": f"Email sendt til {club_judge.email}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{club_id}/club_posts", response_model=schemas.ClubPostOut)
def create_post_for_club(
    club_id: int,
    post: schemas.ClubPostCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_club_if_owner(club_id, db, current_user)
    db_post = crud.create_club_post(db=db, post=post, club_id=club_id)
    
    # Sync to ClassDefinition for the club
    code = (post.name or 'CUSTOM').upper().replace(' ', '_')[:15]
    scoring_model = 'dressage_percentage' if post.discipline == 'dressage' else ('faults_time' if post.discipline == 'jumping' else 'gait_standard')
    
    db_def = db.query(models.ClassDefinition).filter(
        models.ClassDefinition.club_id == club_id,
        models.ClassDefinition.name == post.name
    ).first()
    
    if not db_def:
        new_def = models.ClassDefinition(
            club_id=club_id,
            code=code,
            name=post.name,
            discipline=post.discipline or 'gait',
            scoring_model=scoring_model,
            configuration=post.configuration
        )
        db.add(new_def)
        db.commit()
    elif post.configuration:
        db_def.configuration = post.configuration
        db.commit()
        
    return db_post

@router.get("/{club_id}/club_posts", response_model=List[schemas.ClubPostOut])
def read_posts_for_club(
    club_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_club_if_owner(club_id, db, current_user)
    return crud.get_club_posts(db=db, club_id=club_id)

@router.put("/{club_id}/club_posts/{post_id}", response_model=schemas.ClubPostOut)
def update_post_for_club(
    club_id: int,
    post_id: int,
    post: schemas.ClubPostCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_club_if_owner(club_id, db, current_user)
    updated = crud.update_club_post(db=db, post_id=post_id, post_update=post, club_id=club_id)
    if not updated:
        raise HTTPException(status_code=404, detail="ClubPost not found")
    return updated

@router.patch("/{club_id}/club_posts/{post_id}/toggle", response_model=schemas.ClubPostOut)
def toggle_post_active_for_club(
    club_id: int,
    post_id: int,
    is_active: bool,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_club_if_owner(club_id, db, current_user)
    updated = crud.toggle_club_post_active(db=db, post_id=post_id, club_id=club_id, is_active=is_active)
    if not updated:
        raise HTTPException(status_code=404, detail="ClubPost not found")
    return updated

@router.delete("/{club_id}/club_posts/{post_id}")
def delete_post_from_club(
    club_id: int,
    post_id: int, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    get_club_if_owner(club_id, db, current_user)
    if crud.delete_club_post(db, post_id, club_id):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="ClubPost not found")

# --- BILLING & ACTIVATION ---
@router.get("/{club_id}/check-discount")
def check_discount_code(
    club_id: int,
    code: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    get_club_if_owner(club_id, db, current_user)
    clean_code = code.strip().upper()
    discount = db.query(models.DiscountCode).filter(
        models.DiscountCode.code.ilike(clean_code),
        models.DiscountCode.is_active == True
    ).first()
    if not discount:
        raise HTTPException(status_code=400, detail="Ugyldig eller deaktiveret rabatkode.")
    
    # Tjek maks antal anvendelser for denne klub
    if discount.max_uses_per_club is not None and discount.max_uses_per_club > 0:
        club_uses = db.query(models.DiscountUsage).filter(
            models.DiscountUsage.discount_code_id == discount.id,
            models.DiscountUsage.club_id == club_id
        ).count()
        if club_uses >= discount.max_uses_per_club:
            raise HTTPException(
                status_code=400, 
                detail=f"Rabatkoden '{discount.code}' er allerede anvendt det maksimale antal gange ({discount.max_uses_per_club} gange) for denne klub."
            )

    # Tjek samlet maks antal anvendelser
    if discount.max_total_uses is not None and discount.max_total_uses > 0:
        total_uses = db.query(models.DiscountUsage).filter(
            models.DiscountUsage.discount_code_id == discount.id
        ).count()
        if total_uses >= discount.max_total_uses:
            raise HTTPException(
                status_code=400,
                detail=f"Rabatkoden '{discount.code}' er udløbet (maksimalt samlet antal anvendelser nået)."
            )

    return {
        "code": discount.code,
        "discount_amount": discount.discount_amount,
        "max_uses_per_club": discount.max_uses_per_club
    }

@router.post("/{club_id}/competitions/{comp_id}/activate", response_model=schemas.CompetitionOut)
def activate_competition(
    club_id: int,
    comp_id: int,
    payload: schemas.ActivateCompetitionRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    club = get_club_if_owner(club_id, db, current_user)
    if not club.contact_email:
        raise HTTPException(
            status_code=400,
            detail="Udfyld venligst klubbens kontakt-e-mail under Profil, før du kan aktivere stævnet, så vi kan sende en faktura."
        )

    comp = get_competition_if_owner(comp_id, club_id, db, current_user)
    
    if comp.is_active:
        raise HTTPException(status_code=400, detail="Dette stævne er allerede aktiveret.")
        
    price = 299.0
    discount_to_record = None
    
    if payload.discount_code:
        clean_code = payload.discount_code.strip().upper()
        discount = db.query(models.DiscountCode).filter(
            models.DiscountCode.code.ilike(clean_code),
            models.DiscountCode.is_active == True
        ).first()
        if not discount:
            raise HTTPException(status_code=400, detail="Ugyldig eller deaktiveret rabatkode.")
        
        # Tjek maks anvendelser for denne klub
        if discount.max_uses_per_club is not None and discount.max_uses_per_club > 0:
            club_uses = db.query(models.DiscountUsage).filter(
                models.DiscountUsage.discount_code_id == discount.id,
                models.DiscountUsage.club_id == club_id
            ).count()
            if club_uses >= discount.max_uses_per_club:
                raise HTTPException(
                    status_code=400,
                    detail=f"Rabatkoden '{discount.code}' er allerede anvendt det maksimale antal gange ({discount.max_uses_per_club} gange) for denne klub."
                )
                
        # Tjek samlet maks anvendelser
        if discount.max_total_uses is not None and discount.max_total_uses > 0:
            total_uses = db.query(models.DiscountUsage).filter(
                models.DiscountUsage.discount_code_id == discount.id
            ).count()
            if total_uses >= discount.max_total_uses:
                raise HTTPException(
                    status_code=400,
                    detail=f"Rabatkoden '{discount.code}' er udløbet (maksimalt samlet antal anvendelser nået)."
                )

        discount_pct = discount.discount_amount
        if discount_pct >= 100.0:
            price = 0.0
        elif discount_pct > 0.0:
            price = 299.0 * (1.0 - (discount_pct / 100.0))
            
        discount_to_record = discount
            
    comp.is_active = True
    comp.price_paid = price
    
    start_point = comp.date if comp.date else datetime.utcnow()
    if start_point < datetime.utcnow():
        start_point = datetime.utcnow()
    comp.active_until = start_point + timedelta(days=14)

    # Gem DiscountUsage registrering hvis rabatkode blev brugt
    if discount_to_record:
        usage = models.DiscountUsage(
            discount_code_id=discount_to_record.id,
            club_id=club_id,
            competition_id=comp_id,
            user_id=current_user.id
        )
        db.add(usage)
    
    db.commit()
    db.refresh(comp)

    # Send faktura email
    try:
        send_invoice_email(
            to_email=club.contact_email,
            club_name=club.name,
            comp_name=comp.name,
            price=price,
            discount_code=payload.discount_code
        )
    except Exception as e:
        print(f"Fejl ved afsendelse af faktura email: {e}")

    return comp

