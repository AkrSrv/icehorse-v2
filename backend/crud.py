from sqlalchemy.orm import Session
from typing import List
import models, schemas
import uuid
import auth

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user_and_club(db: Session, user: schemas.UserCreate):
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    db_club = models.Club(name=user.club_name, user_id=db_user.id)
    db.add(db_club)
    db.commit()
    return db_user

def get_club(db: Session, club_id: int):
    return db.query(models.Club).filter(models.Club.id == club_id).first()

def get_user_clubs(db: Session, user_id: int):
    return db.query(models.Club).filter(models.Club.user_id == user_id).all()

def create_club(db: Session, club: schemas.ClubCreate, user_id: int):
    existing_club = db.query(models.Club).filter(models.Club.user_id == user_id).first()
    if existing_club:
        db_club = models.Club(
            name=club.name,
            user_id=user_id,
            contact_name=existing_club.contact_name,
            phone=existing_club.phone,
            contact_email=existing_club.contact_email,
            address=existing_club.address,
            zip_code=existing_club.zip_code,
            city=existing_club.city,
            logo_url=existing_club.logo_url,
            facebook_url=existing_club.facebook_url,
            instagram_url=existing_club.instagram_url,
            website_url=existing_club.website_url
        )
    else:
        db_club = models.Club(name=club.name, user_id=user_id)
    db.add(db_club)
    db.commit()
    db.refresh(db_club)
    return db_club

def update_club(db: Session, club_id: int, club_update: schemas.ClubUpdate):
    db_club = get_club(db, club_id)
    if not db_club:
        return None
    
    update_data = club_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_club, key, value)
        
    db.commit()
    db.refresh(db_club)
    return db_club

def get_competitions(db: Session, club_id: int):
    return db.query(models.Competition).filter(models.Competition.club_id == club_id).all()

def create_competition(db: Session, competition: schemas.CompetitionCreate, club_id: int):
    db_competition = models.Competition(**competition.model_dump(), club_id=club_id)
    db.add(db_competition)
    db.commit()
    db.refresh(db_competition)
    return db_competition

def delete_competition(db: Session, competition_id: int):
    db_comp = db.query(models.Competition).filter(models.Competition.id == competition_id).first()
    if db_comp:
        db.delete(db_comp)
        db.commit()
        return True
    return False

# --- CLUB RIDERS & HORSES ---
def create_club_rider(db: Session, rider: schemas.ClubRiderCreate, club_id: int):
    db_rider = models.ClubRider(**rider.model_dump(), club_id=club_id)
    db.add(db_rider)
    db.commit()
    db.refresh(db_rider)
    return db_rider

def get_club_riders(db: Session, club_id: int):
    return db.query(models.ClubRider).filter(models.ClubRider.club_id == club_id).all()

def update_club_rider(db: Session, rider_id: int, rider_update: schemas.ClubRiderCreate):
    db_rider = db.query(models.ClubRider).filter(models.ClubRider.id == rider_id).first()
    if db_rider:
        db_rider.name = rider_update.name
        db_rider.email = rider_update.email
        db_rider.phone = rider_update.phone
        db.commit()
        db.refresh(db_rider)
    return db_rider

def delete_club_rider(db: Session, rider_id: int):
    db_rider = db.query(models.ClubRider).filter(models.ClubRider.id == rider_id).first()
    if db_rider:
        db.delete(db_rider)
        db.commit()
        return True
    return False

def add_horse_to_rider(db: Session, horse: schemas.HorseCreate, rider_id: int):
    db_horse = models.Horse(**horse.model_dump(), club_rider_id=rider_id)
    db.add(db_horse)
    db.commit()
    db.refresh(db_horse)
    return db_horse

def remove_horse(db: Session, horse_id: int):
    db_horse = db.query(models.Horse).filter(models.Horse.id == horse_id).first()
    if db_horse:
        db.delete(db_horse)
        db.commit()
        return True
    return False

# --- CLUB JUDGES ---
def create_club_judge(db: Session, judge: schemas.ClubJudgeCreate, club_id: int):
    db_judge = models.ClubJudge(**judge.model_dump(), club_id=club_id)
    db.add(db_judge)
    db.commit()
    db.refresh(db_judge)
    return db_judge

def get_club_judges(db: Session, club_id: int):
    return db.query(models.ClubJudge).filter(models.ClubJudge.club_id == club_id).all()

def update_club_judge(db: Session, judge_id: int, judge_update: schemas.ClubJudgeCreate):
    db_judge = db.query(models.ClubJudge).filter(models.ClubJudge.id == judge_id).first()
    if db_judge:
        db_judge.name = judge_update.name
        db_judge.email = judge_update.email
        db_judge.phone = judge_update.phone
        db.commit()
        db.refresh(db_judge)
    return db_judge

def delete_club_judge(db: Session, judge_id: int):
    db_judge = db.query(models.ClubJudge).filter(models.ClubJudge.id == judge_id).first()
    if db_judge:
        db.delete(db_judge)
        db.commit()
        return True
    return False

# --- COMPETITION ATTACHMENTS ---
def create_competition_rider(db: Session, comp_rider: schemas.CompetitionRiderCreate, competition_id: int):
    magic_token = str(uuid.uuid4())
    rider_data = comp_rider.model_dump(exclude={"rider_posts"})
    db_comp_rider = models.CompetitionRider(
        **rider_data, 
        competition_id=competition_id,
        magic_link_uuid=magic_token
    )
    db.add(db_comp_rider)
    db.commit()
    db.refresh(db_comp_rider)
    
    # Store class registrations
    for rp in comp_rider.rider_posts:
        db_rp = models.CompetitionRiderPost(
            competition_rider_id=db_comp_rider.id,
            club_post_id=rp.club_post_id,
            start_number=rp.start_number
        )
        db.add(db_rp)
        
    if comp_rider.rider_posts:
        db.commit()
        db.refresh(db_comp_rider)
        
    return db_comp_rider

def get_competition_riders(db: Session, competition_id: int):
    return db.query(models.CompetitionRider).filter(models.CompetitionRider.competition_id == competition_id).all()

def delete_competition_rider(db: Session, comp_rider_id: int):
    db_comp_rider = db.query(models.CompetitionRider).filter(models.CompetitionRider.id == comp_rider_id).first()
    if db_comp_rider:
        db.delete(db_comp_rider)
        db.commit()
        return True
    return False

def add_post_to_competition(db: Session, competition_id: int, club_post_id: int):
    existing = db.query(models.CompetitionPost).filter(
        models.CompetitionPost.competition_id == competition_id,
        models.CompetitionPost.club_post_id == club_post_id
    ).first()
    if not existing:
        db_comp_post = models.CompetitionPost(
            competition_id=competition_id,
            club_post_id=club_post_id
        )
        db.add(db_comp_post)
        db.commit()
    return True

def remove_post_from_competition(db: Session, competition_id: int, club_post_id: int):
    db_comp_post = db.query(models.CompetitionPost).filter(
        models.CompetitionPost.competition_id == competition_id,
        models.CompetitionPost.club_post_id == club_post_id
    ).first()
    if db_comp_post:
        db.delete(db_comp_post)
        db.commit()
        return True
    return False

def set_competition_posts(db: Session, competition_id: int, post_ids: List[int]):
    db.query(models.CompetitionPost).filter(
        models.CompetitionPost.competition_id == competition_id
    ).delete()
    for pid in post_ids:
        db_comp_post = models.CompetitionPost(
            competition_id=competition_id,
            club_post_id=pid
        )
        db.add(db_comp_post)
    db.commit()
    return True

def create_competition_judge(db: Session, comp_judge: schemas.CompetitionJudgeCreate, competition_id: int):
    magic_token = str(uuid.uuid4())
    # Exclude post_ids from the model dump for the CompetitionJudge model
    judge_data = comp_judge.model_dump(exclude={"post_ids"})
    
    db_comp_judge = models.CompetitionJudge(
        **judge_data, 
        competition_id=competition_id,
        magic_link_uuid=magic_token
    )
    db.add(db_comp_judge)
    db.commit()
    db.refresh(db_comp_judge)
    
    # Knyt dommeren til de valgte poster
    for post_id in comp_judge.post_ids:
        db_judge_post = models.JudgePost(
            competition_judge_id=db_comp_judge.id,
            club_post_id=post_id
        )
        db.add(db_judge_post)
    
    if comp_judge.post_ids:
        db.commit()
        db.refresh(db_comp_judge)
        
    return db_comp_judge

def get_competition_judges(db: Session, competition_id: int):
    # This automatically includes db_comp_judge.club_posts via the SQLAlchemy relationship
    return db.query(models.CompetitionJudge).filter(models.CompetitionJudge.competition_id == competition_id).all()

def delete_competition_judge(db: Session, comp_judge_id: int):
    db_comp_judge = db.query(models.CompetitionJudge).filter(models.CompetitionJudge.id == comp_judge_id).first()
    if db_comp_judge:
        db.delete(db_comp_judge)
        db.commit()
        return True
    return False

# --- CLUB POSTS ---
def create_club_post(db: Session, post: schemas.ClubPostCreate, club_id: int):
    existing = db.query(models.ClubPost).filter(
        models.ClubPost.club_id == club_id,
        models.ClubPost.name == post.name
    ).first()
    
    if existing:
        existing.description = post.description
        existing.location = post.location
        existing.coefficient = post.coefficient
        existing.max_value = post.max_value
        existing.discipline = post.discipline
        existing.scoring_method = post.scoring_method
        existing.is_active = post.is_active
        if post.configuration:
            existing.configuration = post.configuration
        db.commit()
        db.refresh(existing)
        return existing
        
    db_post = models.ClubPost(**post.model_dump(), club_id=club_id)
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return db_post

def get_club_posts(db: Session, club_id: int):
    # Ensure any custom ClassDefinition for this club has a corresponding ClubPost
    custom_defs = db.query(models.ClassDefinition).filter(models.ClassDefinition.club_id == club_id).all()
    if custom_defs:
        existing_posts = db.query(models.ClubPost).filter(models.ClubPost.club_id == club_id).all()
        existing_names = {p.name.strip().lower() for p in existing_posts}
        
        has_new = False
        for c_def in custom_defs:
            if c_def.name and c_def.name.strip().lower() not in existing_names:
                scoring_method = 'percentage' if c_def.discipline == 'dressage' else ('faults_time' if c_def.discipline == 'jumping' else 'standard')
                new_post = models.ClubPost(
                    club_id=club_id,
                    name=c_def.name,
                    discipline=c_def.discipline or 'gait',
                    scoring_method=scoring_method,
                    coefficient=1.0,
                    max_value=10.0,
                    is_active=True,
                    configuration=c_def.configuration
                )
                db.add(new_post)
                existing_names.add(c_def.name.strip().lower())
                has_new = True
        if has_new:
            db.commit()

    return db.query(models.ClubPost).filter(models.ClubPost.club_id == club_id).all()

def update_club_post(db: Session, post_id: int, post_update: schemas.ClubPostCreate, club_id: int):
    post = db.query(models.ClubPost).filter(models.ClubPost.id == post_id, models.ClubPost.club_id == club_id).first()
    if post:
        for k, v in post_update.model_dump(exclude_unset=True).items():
            setattr(post, k, v)
        db.commit()
        db.refresh(post)
    return post

def toggle_club_post_active(db: Session, post_id: int, club_id: int, is_active: bool):
    post = db.query(models.ClubPost).filter(models.ClubPost.id == post_id, models.ClubPost.club_id == club_id).first()
    if post:
        post.is_active = is_active
        db.commit()
        db.refresh(post)
    return post

def delete_club_post(db: Session, post_id: int, club_id: int):
    post = db.query(models.ClubPost).filter(models.ClubPost.id == post_id, models.ClubPost.club_id == club_id).first()
    if post:
        # Check if post has scores or is attached to competitions - if so soft-delete
        has_scores = db.query(models.Score).filter(models.Score.club_post_id == post_id).first()
        if has_scores:
            post.is_active = False
            db.commit()
            return True
        db.delete(post)
        db.commit()
        return True
    return False

# --- DIRECTORY ---
def get_club_directory(db: Session, club_id: int):
    club_riders = db.query(models.ClubRider).filter(models.ClubRider.club_id == club_id).all()
    club_judges = db.query(models.ClubJudge).filter(models.ClubJudge.club_id == club_id).all()
    
    dir_riders = []
    for r in club_riders:
        comps = [{"id": cr.competition.id, "name": cr.competition.name} for cr in r.competitions_participated]
        dir_riders.append({
            "id": r.id,
            "club_id": r.club_id,
            "name": r.name,
            "email": r.email,
            "phone": r.phone,
            "horses": [{"id": h.id, "club_rider_id": h.club_rider_id, "name": h.name} for h in r.horses],
            "competitions": comps
        })
        
    dir_judges = []
    for j in club_judges:
        comps = [{"id": cj.competition.id, "name": cj.competition.name} for cj in j.competitions_participated]
        dir_judges.append({
            "id": j.id,
            "club_id": j.club_id,
            "name": j.name,
            "email": j.email,
            "phone": j.phone,
            "competitions": comps
        })
        
    return {
        "riders": dir_riders,
        "judges": dir_judges
    }

# --- SCORES ---
def create_score(db: Session, score: schemas.ScoreCreate, judge_id: int):
    db_score = models.Score(
        **score.model_dump(),
        competition_judge_id=judge_id
    )
    db.add(db_score)
    db.commit()
    db.refresh(db_score)
    return db_score

def update_score(db: Session, score_id: int, score_update: schemas.ScoreUpdate, judge_id: int):
    db_score = db.query(models.Score).filter(models.Score.id == score_id, models.Score.competition_judge_id == judge_id).first()
    if db_score:
        update_data = score_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_score, key, value)
        db.commit()
        db.refresh(db_score)
    return db_score

def get_scores_for_competition(db: Session, competition_id: int):
    # Retrieve all scores that belong to a specific competition
    # We join via competition_rider
    return db.query(models.Score).join(
        models.CompetitionRider, models.Score.competition_rider_id == models.CompetitionRider.id
    ).filter(
        models.CompetitionRider.competition_id == competition_id
    ).all()

