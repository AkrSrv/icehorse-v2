from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import models, schemas, database
import uuid
import json
from datetime import datetime
import scoring_engine

router = APIRouter(prefix="/api/v1", tags=["judging"])

# --- HELPERS ---

def get_judge_by_uuid(uuid_str: str, db: Session):
    judge = db.query(models.Judge).filter(models.Judge.magic_link_uuid == uuid_str).first()
    if not judge:
        raise HTTPException(status_code=401, detail="Ugyldigt dommer magic link.")
    return judge

def snapshot_score_sheet(db: Session, sheet: models.ScoreSheet, username: str):
    # Snapshot all items
    items_snapshot = []
    for item in sheet.items:
        items_snapshot.append({
            "id": item.id,
            "sequence": item.sequence,
            "type": item.type,
            "value": item.value
        })
    
    snapshot_data = {
        "id": sheet.id,
        "entry_id": sheet.entry_id,
        "judge_id": sheet.judge_id,
        "status": sheet.status,
        "rule_version": sheet.rule_version,
        "created_at": sheet.created_at.isoformat() if sheet.created_at else None,
        "created_by": sheet.created_by,
        "revision": sheet.revision,
        "change_reason": sheet.change_reason,
        "items": items_snapshot
    }

    log = models.AuditLog(
        entity_type="ScoreSheet",
        entity_id=sheet.id,
        revision=sheet.revision,
        changed_at=datetime.utcnow(),
        changed_by=username,
        change_reason=sheet.change_reason or "Automatisk revision før ændring",
        snapshot=json.dumps(snapshot_data)
    )
    db.add(log)


# --- RULESETS ---

@router.post("/rulesets", response_model=schemas.RuleSetOut)
def create_ruleset(ruleset: schemas.RuleSetCreate, db: Session = Depends(database.get_db)):
    existing = db.query(models.RuleSet).filter(models.RuleSet.version == ruleset.version).first()
    if existing:
        raise HTTPException(status_code=400, detail="En regelversion med dette navn eksisterer allerede.")
    
    db_ruleset = models.RuleSet(**ruleset.model_dump())
    db.add(db_ruleset)
    db.commit()
    db.refresh(db_ruleset)
    return db_ruleset

@router.get("/rulesets", response_model=List[schemas.RuleSetOut])
def list_rulesets(db: Session = Depends(database.get_db)):
    return db.query(models.RuleSet).all()


# --- CLASS DEFINITIONS ---

@router.post("/class-definitions", response_model=schemas.ClassDefinitionOut)
def create_class_definition(class_def: schemas.ClassDefinitionCreate, db: Session = Depends(database.get_db)):
    db_class = models.ClassDefinition(**class_def.model_dump())
    db.add(db_class)
    db.commit()
    db.refresh(db_class)
    return db_class

@router.get("/class-definitions", response_model=List[schemas.ClassDefinitionOut])
def list_class_definitions(discipline: Optional[str] = None, db: Session = Depends(database.get_db)):
    q = db.query(models.ClassDefinition)
    if discipline:
        q = q.filter(models.ClassDefinition.discipline == discipline)
    return q.all()


# --- JUDGES ---

@router.post("/competitions/{compId}/judges", response_model=schemas.JudgeOut)
def create_judge(compId: int, judge: schemas.JudgeCreate, db: Session = Depends(database.get_db)):
    db_judge = models.Judge(
        competition_id=compId,
        name=judge.name,
        position=judge.position,
        magic_link_uuid=str(uuid.uuid4())
    )
    db.add(db_judge)
    db.commit()
    db.refresh(db_judge)
    return db_judge

@router.get("/competitions/{compId}/judges", response_model=List[schemas.JudgeOut])
def list_judges(compId: int, db: Session = Depends(database.get_db)):
    return db.query(models.Judge).filter(models.Judge.competition_id == compId).all()

@router.get("/judging/session/{uuid_str}", response_model=schemas.JudgeOut)
def get_judge_session(uuid_str: str, db: Session = Depends(database.get_db)):
    return get_judge_by_uuid(uuid_str, db)


# --- ENTRIES ---

@router.post("/entries", response_model=schemas.EntryOut)
def create_entry(entry: schemas.EntryCreate, db: Session = Depends(database.get_db)):
    db_entry = models.Entry(**entry.model_dump())
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

@router.get("/competitions/{compId}/entries", response_model=List[schemas.EntryOut])
def list_competition_entries(compId: int, db: Session = Depends(database.get_db)):
    entries = db.query(models.Entry).filter(models.Entry.competition_id == compId).all()
    for entry in entries:
        if entry.class_def:
            custom_def = db.query(models.ClassDefinition).filter(
                models.ClassDefinition.club_id == entry.competition.club_id,
                models.ClassDefinition.code == entry.class_def.code
            ).first()
            if custom_def:
                entry.class_def = custom_def
    return entries

@router.get("/classes/{classId}/entries", response_model=List[schemas.EntryOut])
def list_class_entries(classId: int, db: Session = Depends(database.get_db)):
    entries = db.query(models.Entry).filter(models.Entry.class_id == classId).all()
    for entry in entries:
        if entry.class_def:
            custom_def = db.query(models.ClassDefinition).filter(
                models.ClassDefinition.club_id == entry.competition.club_id,
                models.ClassDefinition.code == entry.class_def.code
            ).first()
            if custom_def:
                entry.class_def = custom_def
    return entries


# --- SCORE SHEETS ---

@router.post("/classes/{classId}/entries/{entryId}/score-sheets", response_model=schemas.ScoreSheetOut)
def get_or_create_score_sheet(
    classId: int,
    entryId: int,
    payload: schemas.ScoreSheetCreate,
    db: Session = Depends(database.get_db)
):
    # Check if entry exists
    entry = db.query(models.Entry).filter(models.Entry.id == entryId, models.Entry.class_id == classId).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry ikke fundet i denne klasse.")

    # Check if score sheet already exists
    existing = db.query(models.ScoreSheet).filter(
        models.ScoreSheet.entry_id == entryId,
        models.ScoreSheet.judge_id == payload.judge_id
    ).first()
    if existing:
        return existing

    # Create new score sheet
    db_sheet = models.ScoreSheet(
        entry_id=entryId,
        judge_id=payload.judge_id,
        status="DRAFT",
        rule_version=payload.rule_version,
        created_by="system",
        revision=1
    )
    db.add(db_sheet)
    db.commit()
    db.refresh(db_sheet)

    # Initialize ScoreItems based on class configuration
    class_def = entry.class_def
    custom_def = db.query(models.ClassDefinition).filter(
        models.ClassDefinition.club_id == entry.competition.club_id,
        models.ClassDefinition.code == class_def.code
    ).first()
    if custom_def:
        class_def = custom_def
    class_config = json.loads(class_def.configuration or '{}')

    if class_def.discipline == 'dressage':
        exercises = class_config.get('exercises', [])
        for ex in exercises:
            item = models.ScoreItem(
                score_sheet_id=db_sheet.id,
                sequence=ex.get('sequence'),
                type="mark",
                value=json.dumps({"mark": None, "comment": ""})
            )
            db.add(item)
    elif class_def.discipline == 'gait':
        sections = class_config.get('sections', [])
        for sec in sections:
            item = models.ScoreItem(
                score_sheet_id=db_sheet.id,
                sequence=sec.get('sequence'),
                type="mark",
                value=json.dumps({"mark": None})
            )
            db.add(item)
    elif class_def.discipline == 'jumping':
        # Create default time and style items
        time_item = models.ScoreItem(
            score_sheet_id=db_sheet.id,
            sequence=1,
            type="time",
            value=json.dumps({"ridingTime": 0.0})
        )
        db.add(time_item)
        
        if class_def.scoring_model == 'style':
            style_item = models.ScoreItem(
                score_sheet_id=db_sheet.id,
                sequence=2,
                type="style",
                value=json.dumps({"styleMark": 0.0})
            )
            db.add(style_item)

    db.commit()
    db.refresh(db_sheet)
    return db_sheet


# --- SCORE ITEMS ---

@router.put("/score-sheets/{scoreSheetId}/items/{itemId}", response_model=schemas.ScoreItemOut)
def update_score_item(
    scoreSheetId: int,
    itemId: int,
    payload: dict, # dynamic payload based on item type
    change_reason: Optional[str] = None,
    username: Optional[str] = "judge",
    db: Session = Depends(database.get_db)
):
    sheet = db.query(models.ScoreSheet).filter(models.ScoreSheet.id == scoreSheetId).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="ScoreSheet ikke fundet.")

    item = db.query(models.ScoreItem).filter(models.ScoreItem.id == itemId, models.ScoreItem.score_sheet_id == scoreSheetId).first()
    if not item:
        raise HTTPException(status_code=404, detail="ScoreItem ikke fundet.")

    # Audit snapshot check
    if sheet.status in ['APPROVED', 'VALIDATED']:
        if not change_reason:
            raise HTTPException(status_code=400, detail="Manuel korrektion af godkendte resultater kræver begrundelse.")
        snapshot_score_sheet(db, sheet, username)
        sheet.revision += 1
        sheet.change_reason = change_reason

    # Load existing value
    existing_val = json.loads(item.value or '{}')
    # Update value with payload
    existing_val.update(payload)
    item.value = json.dumps(existing_val)
    
    db.commit()
    db.refresh(item)
    return item


@router.delete("/score-sheets/{scoreSheetId}/items/{itemId}/delete")
def delete_score_item(
    scoreSheetId: int,
    itemId: int,
    change_reason: Optional[str] = None,
    username: Optional[str] = "judge",
    db: Session = Depends(database.get_db)
):
    sheet = db.query(models.ScoreSheet).filter(models.ScoreSheet.id == scoreSheetId).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="ScoreSheet ikke fundet.")

    item = db.query(models.ScoreItem).filter(models.ScoreItem.id == itemId, models.ScoreItem.score_sheet_id == scoreSheetId).first()
    if not item:
        raise HTTPException(status_code=404, detail="ScoreItem ikke fundet.")

    # Audit snapshot check
    if sheet.status in ['APPROVED', 'VALIDATED']:
        if not change_reason:
            raise HTTPException(status_code=400, detail="Manuel korrektion af godkendte resultater kræver begrundelse.")
        snapshot_score_sheet(db, sheet, username)
        sheet.revision += 1
        sheet.change_reason = change_reason

    db.delete(item)
    db.commit()
    return {"message": "Item slettet."}



@router.post("/score-sheets/{scoreSheetId}/events", response_model=schemas.ScoreItemOut)
def add_jumping_event(
    scoreSheetId: int,
    payload: dict, # event payload e.g. {"obstacle": "7", "eventType": "DISOBEDIENCE", "penalty": 4}
    change_reason: Optional[str] = None,
    username: Optional[str] = "judge",
    db: Session = Depends(database.get_db)
):
    sheet = db.query(models.ScoreSheet).filter(models.ScoreSheet.id == scoreSheetId).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="ScoreSheet ikke fundet.")

    # Audit snapshot check
    if sheet.status in ['APPROVED', 'VALIDATED']:
        if not change_reason:
            raise HTTPException(status_code=400, detail="Manuel korrektion af godkendte resultater kræver begrundelse.")
        snapshot_score_sheet(db, sheet, username)
        sheet.revision += 1
        sheet.change_reason = change_reason

    # Append new event
    # Find next sequence
    max_seq = db.query(models.ScoreItem).filter(models.ScoreItem.score_sheet_id == scoreSheetId).count()
    
    new_item = models.ScoreItem(
        score_sheet_id=scoreSheetId,
        sequence=max_seq + 1,
        type="event",
        value=json.dumps(payload)
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item


# --- RESULT CALCULATIONS ---

@router.post("/entries/{entryId}/calculate-result", response_model=schemas.ResultOut)
def run_calculations(
    entryId: int,
    db: Session = Depends(database.get_db)
):
    entry = db.query(models.Entry).filter(models.Entry.id == entryId).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry ikke fundet.")

    class_def = entry.class_def
    custom_def = db.query(models.ClassDefinition).filter(
        models.ClassDefinition.club_id == entry.competition.club_id,
        models.ClassDefinition.code == class_def.code
    ).first()
    if custom_def:
        class_def = custom_def
    
    # Retrieve RuleSet
    ruleset = db.query(models.RuleSet).filter(models.RuleSet.version == entry.competition.ruleVersion).first()
    if not ruleset:
        # Fallback to latest ruleset if not found
        ruleset = db.query(models.RuleSet).order_index(models.RuleSet.version.desc()).first()
        if not ruleset:
            raise HTTPException(status_code=500, detail="Ingen RuleSets fundet i databasen.")

    score_sheets = entry.score_sheets
    
    try:
        calc_result = scoring_engine.calculate_result(class_def, ruleset, score_sheets)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Save or update result
    db_res = db.query(models.Result).filter(models.Result.entry_id == entryId).first()
    if db_res:
        db_res.status = calc_result["status"]
        db_res.primary_score = calc_result["primary_score"]
        db_res.secondary_score = calc_result["secondary_score"]
        db_res.calculation_trace = calc_result["calculation_trace"]
    else:
        db_res = models.Result(
            entry_id=entryId,
            status=calc_result["status"],
            primary_score=calc_result["primary_score"],
            secondary_score=calc_result["secondary_score"],
            calculation_trace=calc_result["calculation_trace"]
        )
        db.add(db_res)
        
    db.commit()
    db.refresh(db_res)
    return db_res


@router.put("/score-sheets/{scoreSheetId}/status")
def update_score_sheet_status(
    scoreSheetId: int,
    payload: schemas.ScoreSheetUpdate,
    username: Optional[str] = "admin",
    db: Session = Depends(database.get_db)
):
    sheet = db.query(models.ScoreSheet).filter(models.ScoreSheet.id == scoreSheetId).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="ScoreSheet ikke fundet.")

    # Audit snapshot check
    if sheet.status in ['APPROVED', 'VALIDATED']:
        if not payload.change_reason:
            raise HTTPException(status_code=400, detail="Ændring af status for godkendte skemaer kræver begrundelse.")
        snapshot_score_sheet(db, sheet, username)
        sheet.revision += 1
        sheet.change_reason = payload.change_reason

    sheet.status = payload.status
    db.commit()
    db.refresh(sheet)
    return {"message": "Status opdateret.", "status": sheet.status}


@router.get("/score-sheets/{scoreSheetId}/history", response_model=List[schemas.AuditLogOut])
def get_score_sheet_history(scoreSheetId: int, db: Session = Depends(database.get_db)):
    return db.query(models.AuditLog).filter(
        models.AuditLog.entity_type == "ScoreSheet",
        models.AuditLog.entity_id == scoreSheetId
    ).order_by(models.AuditLog.revision.asc()).all()


# --- PUBLIC LEADERBOARD FOR NEW MODEL ---

@router.get("/competitions/{compId}/results")
def get_competition_results(compId: int, db: Session = Depends(database.get_db)):
    comp = db.query(models.Competition).filter(models.Competition.id == compId).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Stævne ikke fundet.")

    # Find all entries
    entries = db.query(models.Entry).filter(models.Entry.competition_id == compId).all()
    
    # Group by class
    classes_dict = {}
    for entry in entries:
        class_def = entry.class_def
        custom_def = db.query(models.ClassDefinition).filter(
            models.ClassDefinition.club_id == entry.competition.club_id,
            models.ClassDefinition.code == class_def.code
        ).first()
        if custom_def:
            class_def = custom_def
        if class_def.id not in classes_dict:
            classes_dict[class_def.id] = {
                "class_id": class_def.id,
                "class_name": class_def.name,
                "discipline": class_def.discipline,
                "scoring_model": class_def.scoring_model,
                "leaderboard": []
            }
        
        # Calculate/retrieve result
        res = entry.result
        if not res and entry.score_sheets:
            # Attempt auto-calculation if not calculated
            try:
                ruleset = db.query(models.RuleSet).filter(models.RuleSet.version == comp.ruleVersion).first()
                if ruleset:
                    calc = scoring_engine.calculate_result(class_def, ruleset, entry.score_sheets)
                    res = models.Result(
                        entry_id=entry.id,
                        status=calc["status"],
                        primary_score=calc["primary_score"],
                        secondary_score=calc["secondary_score"],
                        calculation_trace=calc["calculation_trace"]
                    )
                    db.add(res)
                    db.commit()
                    db.refresh(res)
            except Exception:
                pass
        
        display_score = "Draft"
        sort_val = 999999.0
        if res:
            if class_def.discipline == 'dressage':
                pct = res.primary_score or 0.0
                raw_pts = res.secondary_score if (res.secondary_score and res.secondary_score > 0) else None
                if raw_pts:
                    display_score = f"{round(pct, 2)}% ({round(raw_pts, 1)} p)"
                else:
                    display_score = f"{round(pct, 2)}%"
                sort_val = -pct  # higher is better
            elif class_def.discipline == 'jumping':
                if res.status == 'ELIMINATED':
                    display_score = "ELI"
                    sort_val = 999999.0
                else:
                    display_score = f"{int(res.primary_score)} fejl / {res.secondary_score}s"
                    sort_val = res.primary_score * 1000 + (res.secondary_score or 0)
            elif class_def.discipline == 'gait':
                display_score = f"{res.primary_score} p"
                sort_val = -res.primary_score # higher is better

        classes_dict[class_def.id]["leaderboard"].append({
            "entry_id": entry.id,
            "rider_name": entry.rider.name if entry.rider else "Ukendt",
            "horse_name": entry.horse.name if entry.horse else "Ukendt",
            "start_number": entry.start_number,
            "status": res.status if res else "DRAFT",
            "primary_score": res.primary_score if res else 0.0,
            "secondary_score": res.secondary_score if res else 0.0,
            "display_score": display_score,
            "calculation_trace": json.loads(res.calculation_trace) if (res and res.calculation_trace) else {},
            "_sort_key": sort_val
        })

    # Sort each leaderboard
    for c_id, c_data in classes_dict.items():
        c_data["leaderboard"].sort(key=lambda x: x["_sort_key"])
        for lb_item in c_data["leaderboard"]:
            del lb_item["_sort_key"]

    return {
        "competition_id": comp.id,
        "competition_name": comp.name,
        "classes": list(classes_dict.values())
    }


@router.get("/clubs/{clubId}/class-definitions", response_model=List[schemas.ClassDefinitionOut])
def get_club_class_definitions(clubId: int, db: Session = Depends(database.get_db)):
    # Fetch all definitions visible to the club (global + custom for this club)
    defs = db.query(models.ClassDefinition).filter(
        (models.ClassDefinition.club_id == clubId) | (models.ClassDefinition.club_id == None)
    ).all()
    
    # Merge prioritizing club-specific templates
    merged = {}
    for d in defs:
        # If the code already exists, we only override if this one is club-specific
        if d.code in merged:
            if d.club_id is not None:
                merged[d.code] = d
        else:
            merged[d.code] = d
            
    return list(merged.values())


@router.post("/clubs/{clubId}/class-definitions", response_model=schemas.ClassDefinitionOut)
def save_club_class_definition(
    clubId: int,
    payload: schemas.ClassDefinitionCreate,
    db: Session = Depends(database.get_db)
):
    # Check if a custom template with this code already exists for the club
    db_def = db.query(models.ClassDefinition).filter(
        models.ClassDefinition.club_id == clubId,
        models.ClassDefinition.code == payload.code
    ).first()
    
    if db_def:
        db_def.name = payload.name
        db_def.discipline = payload.discipline
        db_def.scoring_model = payload.scoring_model
        db_def.configuration = payload.configuration
    else:
        db_def = models.ClassDefinition(
            club_id=clubId,
            code=payload.code,
            name=payload.name,
            discipline=payload.discipline,
            scoring_model=payload.scoring_model,
            configuration=payload.configuration
        )
        db.add(db_def)
        
    db.commit()
    db.refresh(db_def)
    
    # Sync to ClubPost for the club
    existing_post = db.query(models.ClubPost).filter(
        models.ClubPost.club_id == clubId,
        (models.ClubPost.name == payload.name) | (models.ClubPost.name == payload.code)
    ).first()
    
    scoring_method = 'percentage' if payload.discipline == 'dressage' else ('faults_time' if payload.discipline == 'jumping' else 'standard')
    
    if existing_post:
        existing_post.name = payload.name
        existing_post.discipline = payload.discipline
        existing_post.scoring_method = scoring_method
        existing_post.configuration = payload.configuration
        existing_post.is_active = True
    else:
        new_post = models.ClubPost(
            club_id=clubId,
            name=payload.name,
            discipline=payload.discipline or 'gait',
            scoring_method=scoring_method,
            coefficient=1.0,
            max_value=10.0,
            is_active=True,
            configuration=payload.configuration
        )
        db.add(new_post)
        
    db.commit()
    return db_def


@router.delete("/clubs/{clubId}/class-definitions/{classId}/reset")
def reset_club_class_definition(
    clubId: int,
    classId: int,
    db: Session = Depends(database.get_db)
):
    db_def = db.query(models.ClassDefinition).filter(
        models.ClassDefinition.id == classId,
        models.ClassDefinition.club_id == clubId
    ).first()
    
    if not db_def:
        raise HTTPException(status_code=404, detail="Tilpasset klasse ikke fundet for denne klub.")
        
    db.delete(db_def)
    db.commit()
    return {"message": "Klasseskabelon nulstillet til standard."}

