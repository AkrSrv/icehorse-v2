from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import database, models
import json
from datetime import datetime
from routers import auth, clubs, admin, scores, support, judging

# Opret database tabeller
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="EquiEvent API")

# CORS setup for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(clubs.router)
app.include_router(admin.router)
app.include_router(scores.router)
app.include_router(support.router)
app.include_router(judging.router)

import os
@app.get("/public/drf-templates")
def get_drf_templates():
    json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "drf_dressage_templates.json")
    if os.path.exists(json_path):
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


@app.on_event("startup")
def seed_data():
    from sqlalchemy import text
    try:
        with database.engine.connect() as conn:
            conn.execute(text("ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS max_uses_per_club INTEGER;"))
            conn.execute(text("ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS max_total_uses INTEGER;"))
            conn.commit()
    except Exception as e:
        print("Discount migration notice:", e)

    db = database.SessionLocal()
    try:
        # Check if RuleSet "2026.1" exists
        existing = db.query(models.RuleSet).filter(models.RuleSet.version == "2026.1").first()
        if not existing:
            default_config = {
                "jumping": {
                    "disobedienceLimit": 2,
                    "eliminateAbove16ObstacleFaults": True,
                    "penalties": {
                        "KNOCKDOWN": {"faults": 4},
                        "DISOBEDIENCE": {"faults": 4},
                        "FALL": {"faults": 0},
                        "RETURE": {"faults": 0}
                    },
                    "style_deductions": {
                        "KNOCKDOWN": {"deduction": 0.5},
                        "DISOBEDIENCE": {"deduction": 1.0},
                        "FALL": {"deduction": 0.0}
                    }
                }
            }
            ruleset = models.RuleSet(
                version="2026.1",
                valid_from=datetime.utcnow(),
                configuration=json.dumps(default_config)
            )
            db.add(ruleset)
            db.commit()

        # Seed standard ClassDefinitions
        # --- DRESSAGE ---
        dressage_classes = [
            ("Intro", "Intro / bom / skridt-trav"),
            ("LD1", "LD1 Dressur (DRF Standard)"),
            ("LD2", "LD2 Dressur (DRF Standard)"),
            ("LC1", "LC1 Dressur (DRF Standard)"),
            ("LC2", "LC2 Dressur (DRF Standard)"),
            ("LC3", "LC3 Dressur (DRF Standard)"),
            ("LB1", "LB1 Dressur (DRF Standard)"),
            ("LB2", "LB2 Dressur (DRF Standard)"),
            ("LB3", "LB3 Dressur (DRF Standard)"),
            ("LA1", "LA1 Dressur (DRF Standard)"),
            ("LA2", "LA2 Dressur (DRF Standard)"),
            ("LA3", "LA3 Dressur (DRF Standard)"),
            ("LA4", "LA4 Dressur (DRF Standard)"),
            ("MB0", "MB0 Dressur (DRF Standard)"),
            ("MB1", "MB1 Dressur (DRF Standard)"),
            ("MB2", "MB2 Dressur (DRF Standard)"),
            ("MB3", "MB3 Dressur (DRF Standard)"),
            ("MA1", "MA1 Dressur (DRF Standard)"),
            ("MA2", "MA2 Dressur (DRF Standard)"),
            ("PSG", "Prix St. Georges (PSG) (DRF Standard)"),
            ("Inter1", "Intermediaire I (DRF Standard)"),
            ("Inter2", "Intermediaire II (DRF Standard)"),
            ("GP", "Grand Prix Dressur (DRF Standard)"),
            ("GPS", "Grand Prix Special (DRF Standard)"),
            ("Kur", "Kür Dressur (DRF Standard)")
        ]
        
        default_dressage_config = {
            "exercises": [
                {"sequence": 1, "code": "IND_PARADE_HILSEN",  "name": "Indridning, parade og hilsen",  "coefficient": 1, "maxMark": 10, "allowedIncrement": 0.5, "directiveIdeas": ["Lige indridning", "ro", "balance og præcision"]},
                {"sequence": 2, "code": "ARBEJDSTRAV",        "name": "Arbejdstrav",                    "coefficient": 1, "maxMark": 10, "allowedIncrement": 0.5, "directiveIdeas": ["Takt", "energi", "balance og kontakt"]},
                {"sequence": 3, "code": "VOLTE_TRAV",         "name": "20 m volte i trav",             "coefficient": 1, "maxMark": 10, "allowedIncrement": 0.5, "directiveIdeas": ["Størrelse", "runding", "takt og bøjning"]},
                {"sequence": 4, "code": "SKRAAT_IGENNEM",     "name": "Skråt igennem",                 "coefficient": 1, "maxMark": 10, "allowedIncrement": 0.5, "directiveIdeas": ["Ligeudretning", "tempo og ridevej"]},
                {"sequence": 5, "code": "MIDDELSKRIDT",       "name": "Middelskridt",                  "coefficient": 2, "maxMark": 10, "allowedIncrement": 0.5, "directiveIdeas": ["Firetakt", "afslapning og overtrædning"]},
                {"sequence": 6, "code": "GALOPSPRING",        "name": "Galopspring",                   "coefficient": 1, "maxMark": 10, "allowedIncrement": 0.5, "directiveIdeas": ["Korrekt galop", "placering og balance"]},
                {"sequence": 7, "code": "VOLTE_GALOP",        "name": "20 m volte i galop",            "coefficient": 1, "maxMark": 10, "allowedIncrement": 0.5, "directiveIdeas": ["Tretakt", "balance", "runding og størrelse"]},
                {"sequence": 8, "code": "OVERGANG_GAL_TRAV",  "name": "Overgang galop-trav",           "coefficient": 1, "maxMark": 10, "allowedIncrement": 0.5, "directiveIdeas": ["Balance", "lydighed og præcision"]},
                {"sequence": 9, "code": "MIDTERLINJ_PARADE",  "name": "Midterlinje, parade og hilsen", "coefficient": 1, "maxMark": 10, "allowedIncrement": 0.5, "directiveIdeas": ["Ligeudretning", "stilstand og afslutning"]}
            ],
            "officialResultDecimals": 2
        }
        
        for code, name in dressage_classes:
            if not db.query(models.ClassDefinition).filter(models.ClassDefinition.code == code, models.ClassDefinition.club_id == None).first():
                db.add(models.ClassDefinition(
                    discipline="dressage",
                    code=code,
                    name=name,
                    scoring_model="dressage_percentage",
                    configuration=json.dumps(default_dressage_config),
                    club_id=None
                ))

        # --- JUMPING ---
        jumping_classes = [
            ("JUMP_MINI", "Bom på jord / kryds / mini"),
            ("LF", "LF Spring (DRF Standard)"),
            ("LE", "LE Spring (DRF Standard)"),
            ("LD", "LD Spring (DRF Standard)"),
            ("LC", "LC Spring (DRF Standard)"),
            ("LB1", "LB1* Spring (DRF Standard)"),
            ("LB2", "LB2* Spring (DRF Standard)"),
            ("LA1", "LA1* Spring (DRF Standard)"),
            ("LA2", "LA2* Spring (DRF Standard)"),
            ("MB1", "MB1* Spring (DRF Standard)"),
            ("MB2", "MB2* Spring (DRF Standard)"),
            ("MA", "MA Spring (DRF Standard)"),
            ("S", "S Spring (DRF Standard)"),
            ("LB_A", "LB1 Spring (Metode A Standard)")
        ]
        
        default_jumping_config = {
            "method": "A",
            "allowedTime": 75.0,
            "maximumTime": 150.0,
            "timeFaultsPer": 4,
            "faultsPerKnockdown": 4,
            "faultsPerDisobedience": 4,
            "officialResultDecimals": 2,
            "obstacles": [
                {"sequence": 1,   "code": "OBS1",  "label": "1",  "type": "Lodret",      "combination": False, "notes": ""},
                {"sequence": 2,   "code": "OBS2",  "label": "2",  "type": "Oxer",        "combination": False, "notes": ""},
                {"sequence": 3,   "code": "OBS3",  "label": "3",  "type": "Lodret",      "combination": False, "notes": ""},
                {"sequence": 4,   "code": "OBS4",  "label": "4",  "type": "Oxer",        "combination": False, "notes": ""},
                {"sequence": 5,   "code": "OBS5A", "label": "5A", "type": "Kombination", "combination": True,  "notes": "Del A"},
                {"sequence": 6,   "code": "OBS5B", "label": "5B", "type": "Kombination", "combination": True,  "notes": "Del B"},
                {"sequence": 7,   "code": "OBS6",  "label": "6",  "type": "Vandgrav",    "combination": False, "notes": ""},
                {"sequence": 8,   "code": "OBS7",  "label": "7",  "type": "Lodret",      "combination": False, "notes": ""},
                {"sequence": 9,   "code": "OBS8",  "label": "8",  "type": "Oxer",        "combination": False, "notes": ""},
                {"sequence": 10,  "code": "OBS9",  "label": "9",  "type": "Lodret",      "combination": False, "notes": ""}
            ]
        }
        
        for code, name in jumping_classes:
            if not db.query(models.ClassDefinition).filter(models.ClassDefinition.code == code, models.ClassDefinition.club_id == None).first():
                scoring_model = "jumping_a" if "Metode A" in name else "jumping_faults_time"
                db.add(models.ClassDefinition(
                    discipline="jumping",
                    code=code,
                    name=name,
                    scoring_model=scoring_model,
                    configuration=json.dumps(default_jumping_config),
                    club_id=None
                ))

        # --- GAIT ---
        gait_classes = [
            ("T8", "T8 Tölt (FEIF Standard)", {
                "sections": [
                    {"sequence": 1, "name": "Valgfrit tempo tölt, første volte", "weight": 1},
                    {"sequence": 2, "name": "Valgfrit tempo tölt, anden volte", "weight": 1}
                ],
                "discardHighestAndLowest": True,
                "judgeMarkDecimals": 1,
                "officialResultDecimals": 2,
                "markIncrement": 0.5
            }),
            ("T1", "T1 Tölt (FEIF Standard)", {
                "sections": [
                    {"sequence": 1, "name": "Langsom tempo tölt", "weight": 1},
                    {"sequence": 2, "name": "Tempoændringer (tölt)", "weight": 1},
                    {"sequence": 3, "name": "Hurtig tempo tölt", "weight": 1}
                ],
                "discardHighestAndLowest": True,
                "judgeMarkDecimals": 1,
                "officialResultDecimals": 2,
                "markIncrement": 0.5
            }),
            ("4.1", "4.1 Firgang (FEIF Standard)", {
                "sections": [
                    {"sequence": 1, "name": "Langsom tölt", "weight": 1},
                    {"sequence": 2, "name": "Arbejdstempo trav", "weight": 1},
                    {"sequence": 3, "name": "Middelskridt", "weight": 1},
                    {"sequence": 4, "name": "Arbejdstempo galop", "weight": 1},
                    {"sequence": 5, "name": "Hurtigt tölt", "weight": 1}
                ],
                "discardHighestAndLowest": True,
                "judgeMarkDecimals": 1,
                "officialResultDecimals": 2,
                "markIncrement": 0.5
            }),
            ("5.1", "5.1 Femgang (FEIF Standard)", {
                "sections": [
                    {"sequence": 1, "name": "Langsom til middeltempo tölt", "weight": 1},
                    {"sequence": 2, "name": "Arbejds- til middeltempo trav", "weight": 1},
                    {"sequence": 3, "name": "Middelskridt", "weight": 1},
                    {"sequence": 4, "name": "Arbejds- til middeltempo galop", "weight": 1},
                    {"sequence": 5, "name": "Pas (skeið)", "weight": 2}
                ],
                "discardHighestAndLowest": True,
                "judgeMarkDecimals": 1,
                "officialResultDecimals": 2,
                "markIncrement": 0.5
            })
        ]
        
        for code, name, config in gait_classes:
            if not db.query(models.ClassDefinition).filter(models.ClassDefinition.code == code, models.ClassDefinition.club_id == None).first():
                db.add(models.ClassDefinition(
                    discipline="gait",
                    code=code,
                    name=name,
                    scoring_model=f"gait_{code.lower().replace('.', '_')}",
                    configuration=json.dumps(config),
                    club_id=None
                ))
            
        db.commit()
    finally:
        db.close()



@app.get("/")
def read_root():
    return {"message": "Welcome to EquiEvent API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
