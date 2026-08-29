from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import crud, models, schemas, database
from datetime import datetime

router = APIRouter(tags=["scores"])

def get_judge_by_uuid(uuid: str, db: Session):
    judge = db.query(models.CompetitionJudge).filter(models.CompetitionJudge.magic_link_uuid == uuid).first()
    if not judge:
        raise HTTPException(status_code=401, detail="Ugyldigt Magic Link")
    return judge

# --- MAGIC LINK / JUDGE AUTH ---
@router.get("/magic/{uuid}", response_model=schemas.CompetitionJudgeOut)
def get_magic_link_session(uuid: str, db: Session = Depends(database.get_db)):
    """Validates magic link and returns judge details including assigned posts."""
    judge = get_judge_by_uuid(uuid, db)
    return judge

# --- JUDGE SCORING ENDPOINTS ---
@router.post("/magic/{uuid}/scores", response_model=schemas.ScoreOut)
def submit_score(uuid: str, score: schemas.ScoreCreate, db: Session = Depends(database.get_db)):
    judge = get_judge_by_uuid(uuid, db)
    comp = judge.competition
    
    is_active_and_valid = comp.is_active
    if comp.is_active and comp.active_until and comp.active_until < datetime.utcnow():
        is_active_and_valid = False
        
    if not is_active_and_valid:
        raise HTTPException(status_code=403, detail="Dette stævne er inaktivt eller betalingsperioden (14 dage efter stævnets afholdelse) er udløbet. Pointafgivelse er deaktiveret.")
        
    # Verify that the judge is actually allowed to judge this post
    assigned_post_ids = [p.id for p in judge.club_posts]
    if score.club_post_id not in assigned_post_ids:
        raise HTTPException(status_code=403, detail="Du er ikke tildelt denne post.")
        
    # Check if score already exists for this rider by this judge on this class
    existing_score = db.query(models.Score).filter(
        models.Score.competition_rider_id == score.competition_rider_id,
        models.Score.club_post_id == score.club_post_id,
        models.Score.competition_judge_id == judge.id
    ).first()

    if existing_score:
        raise HTTPException(status_code=400, detail="Du har allerede givet point til denne rytter på denne post.")
        
    return crud.create_score(db=db, score=score, judge_id=judge.id)

@router.put("/magic/{uuid}/scores/{score_id}", response_model=schemas.ScoreOut)
def update_score(uuid: str, score_id: int, score_update: schemas.ScoreUpdate, db: Session = Depends(database.get_db)):
    judge = get_judge_by_uuid(uuid, db)
    comp = judge.competition
    
    is_active_and_valid = comp.is_active
    if comp.is_active and comp.active_until and comp.active_until < datetime.utcnow():
        is_active_and_valid = False
        
    if not is_active_and_valid:
        raise HTTPException(status_code=403, detail="Dette stævne er inaktivt eller betalingsperioden (14 dage efter stævnets afholdelse) er udløbet. Pointafgivelse er deaktiveret.")
        
    updated_score = crud.update_score(db=db, score_id=score_id, score_update=score_update, judge_id=judge.id)
    if not updated_score:
        raise HTTPException(status_code=404, detail="Score ikke fundet eller du har ikke rettigheder til at rette den.")
    return updated_score

# --- PUBLIC LEADERBOARD ---
@router.get("/public/competitions/{comp_id}/leaderboard")
def get_public_leaderboard(comp_id: int, db: Session = Depends(database.get_db)):
    """Returns the leaderboard with total scores and individual details grouped by class/post."""
    comp = db.query(models.Competition).filter(models.Competition.id == comp_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
        
    active_posts = comp.club_posts
    classes_leaderboards = []
    
    for class_obj in active_posts:
        discipline = class_obj.discipline or "gait"
        scoring_method = class_obj.scoring_method or "standard"
        
        # Get all riders registered for this class
        rider_posts = db.query(models.CompetitionRiderPost).join(models.CompetitionRider).filter(
            models.CompetitionRider.competition_id == comp_id,
            models.CompetitionRiderPost.club_post_id == class_obj.id
        ).all()
        
        # Count unique judges assigned to this class for the competition
        total_judges_in_class = db.query(models.JudgePost).join(models.CompetitionJudge).filter(
            models.CompetitionJudge.competition_id == comp_id,
            models.JudgePost.club_post_id == class_obj.id
        ).count()
        
        class_leaderboard = []
        for rp in rider_posts:
            rider = rp.competition_rider
            post_details = []
            
            # Get scores for this rider in this specific class
            scores = db.query(models.Score).filter(
                models.Score.competition_rider_id == rider.id,
                models.Score.club_post_id == class_obj.id
            ).all()
            
            if discipline == "dressage":
                judge_percentages = []
                judge_points = []
                for s in scores:
                    pts = s.points or 0.0
                    deductions = s.deductions or 0.0
                    raw_pts = s.style_points if (s.style_points is not None and s.style_points > 0) else None
                    
                    # Determine percentage and raw points
                    if pts > 100.0:  # pts was stored as raw points directly
                        raw_pts = pts - deductions
                        max_val = class_obj.max_value if (class_obj.max_value and class_obj.max_value > 100) else 200.0
                        pct = (raw_pts / max_val * 100.0) if max_val > 0 else 0.0
                    else:  # pts is percentage
                        pct = pts
                        if raw_pts is None:
                            max_val = class_obj.max_value if (class_obj.max_value and class_obj.max_value > 100) else 200.0
                            raw_pts = (pct / 100.0) * max_val
                    
                    judge_percentages.append(pct)
                    if raw_pts is not None:
                        judge_points.append(raw_pts)
                    
                    post_details.append({
                        "score_id": s.id,
                        "points": round(raw_pts, 1) if raw_pts is not None else round(pts, 1),
                        "percentage": round(pct, 2),
                        "deductions": deductions,
                        "comment": s.comment,
                        "post_name": class_obj.name,
                        "post_id": class_obj.id,
                        "judge_name": s.competition_judge.club_judge.name if s.competition_judge and s.competition_judge.club_judge else "Ukendt Dommer",
                        "judge_id": s.competition_judge_id
                    })
                
                total_pct = sum(judge_percentages) / len(judge_percentages) if judge_percentages else 0.0
                total_raw_pts = sum(judge_points) / len(judge_points) if judge_points else 0.0
                
                if total_raw_pts > 0:
                    display_score = f"{round(total_pct, 2)}% ({round(total_raw_pts, 1)} p)"
                else:
                    display_score = f"{round(total_pct, 2)}%"
                
                class_leaderboard.append({
                    "rider_id": rider.id,
                    "start_number": rp.start_number,
                    "rider_name": rider.club_rider.name,
                    "horse_name": rider.horse.name,
                    "total_score": round(total_pct, 3),
                    "raw_points": round(total_raw_pts, 1) if total_raw_pts > 0 else None,
                    "percentage": round(total_pct, 2),
                    "posts_completed": len(scores),
                    "details": post_details,
                    "is_eliminated": False,
                    "is_retired": False,
                    "display_score": display_score
                })
                
            elif discipline == "jumping":
                score = scores[0] if scores else None
                faults = score.faults if (score and score.faults is not None) else 0
                time_seconds = score.time_seconds if (score and score.time_seconds is not None) else 0.0
                style_points = score.style_points if (score and score.style_points is not None) else 0.0
                is_eliminated = score.is_eliminated if score else False
                is_retired = score.is_retired if score else False
                is_clear = score.is_clear if score else (faults == 0 and not is_eliminated and not is_retired)
                jump_off_faults = score.jump_off_faults if (score and score.jump_off_faults is not None) else None
                jump_off_time = score.jump_off_time if (score and score.jump_off_time is not None) else None
                comment = score.comment if score else None
                
                final_style = style_points - (faults * 0.5) if style_points > 0 else 0.0
                if final_style < 0:
                    final_style = 0.0
                    
                if score:
                    post_details.append({
                        "score_id": score.id,
                        "faults": faults,
                        "time_seconds": time_seconds,
                        "style_points": style_points,
                        "final_style_score": final_style,
                        "is_eliminated": is_eliminated,
                        "is_retired": is_retired,
                        "is_clear": is_clear,
                        "jump_off_faults": jump_off_faults,
                        "jump_off_time": jump_off_time,
                        "comment": comment,
                        "judge_name": score.competition_judge.club_judge.name if score.competition_judge and score.competition_judge.club_judge else "Ukendt Dommer"
                    })
                    
                if is_eliminated:
                    display_score = "ELI"
                elif is_retired:
                    display_score = "RET"
                elif scoring_method == "clear_round":
                    display_score = "Fejlfri" if is_clear else f"{faults} fejl"
                elif scoring_method == "style":
                    display_score = f"{round(final_style, 1)} p (Stil)"
                elif scoring_method == "jump_off":
                    if jump_off_faults is not None:
                        display_score = f"{faults} / {jump_off_faults} fejl - {jump_off_time}s"
                    else:
                        display_score = f"{faults} fejl - {time_seconds}s"
                else:  # faults_time
                    display_score = f"{faults} fejl - {time_seconds}s"
                    
                if is_eliminated or is_retired:
                    sort_key = (2, 0, 0, 0)
                elif scoring_method == "clear_round":
                    sort_key = (0 if is_clear else 1, faults, 0, 0)
                elif scoring_method == "style":
                    sort_key = (0, -final_style, 0, 0)
                elif scoring_method == "jump_off":
                    if jump_off_faults is not None:
                        sort_key = (0, jump_off_faults, jump_off_time, faults)
                    else:
                        sort_key = (1, faults, time_seconds, 0)
                else:  # faults_time
                    sort_key = (0, faults, time_seconds, 0)
                    
                class_leaderboard.append({
                    "rider_id": rider.id,
                    "start_number": rp.start_number,
                    "rider_name": rider.club_rider.name,
                    "horse_name": rider.horse.name,
                    "total_score": 0.0,
                    "posts_completed": 1 if score else 0,
                    "details": post_details,
                    "is_eliminated": is_eliminated,
                    "is_retired": is_retired,
                    "display_score": display_score,
                    "_sort_key": sort_key
                })
                
            else:  # gait
                points_list = [s.points for s in scores if s.points is not None]
                total_score = sum(points_list) / len(points_list) if points_list else 0.0
                display_score = f"{round(total_score, 2)} p"
                
                for s in scores:
                    post_details.append({
                        "score_id": s.id,
                        "points": s.points,
                        "comment": s.comment,
                        "post_name": class_obj.name,
                        "post_id": class_obj.id,
                        "judge_name": s.competition_judge.club_judge.name if s.competition_judge and s.competition_judge.club_judge else "Ukendt Dommer",
                        "judge_id": s.competition_judge_id
                    })
                    
                class_leaderboard.append({
                    "rider_id": rider.id,
                    "start_number": rp.start_number,
                    "rider_name": rider.club_rider.name,
                    "horse_name": rider.horse.name,
                    "total_score": round(total_score, 2),
                    "posts_completed": len(scores),
                    "details": post_details,
                    "is_eliminated": False,
                    "is_retired": False,
                    "display_score": display_score
                })
                
        if discipline == "jumping":
            class_leaderboard.sort(key=lambda x: x["_sort_key"])
            for r in class_leaderboard:
                del r["_sort_key"]
        else:
            class_leaderboard.sort(key=lambda x: x["total_score"], reverse=True)
            
        classes_leaderboards.append({
            "class_id": class_obj.id,
            "class_name": class_obj.name,
            "discipline": discipline,
            "scoring_method": scoring_method,
            "total_expected_posts_per_rider": total_judges_in_class if discipline != "jumping" else 1,
            "leaderboard": class_leaderboard
        })
        
    return {
        "competition_name": comp.name,
        "classes": classes_leaderboards
    }
