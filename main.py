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


@app.on_event("startup")
def seed_data():
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
    finally:
        db.close()



@app.get("/")
def read_root():
    return {"message": "Welcome to EquiEvent API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
