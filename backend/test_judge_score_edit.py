import os
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
import uuid

import models
import database
from main import app

# In-memory SQLite for testing
from sqlalchemy.pool import StaticPool
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[database.get_db] = override_get_db

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    models.Base.metadata.create_all(bind=engine)
    yield
    models.Base.metadata.drop_all(bind=engine)

def test_judge_scoring_and_upsert():
    db = TestingSessionLocal()
    
    # 1. Create User and Club
    user = models.User(email="test_judge_club@example.com", hashed_password="pw")
    db.add(user)
    db.commit()
    db.refresh(user)
    
    club = models.Club(name="Test Rideklub", user_id=user.id)
    db.add(club)
    db.commit()
    db.refresh(club)
    
    # 2. Create Competition (active)
    comp = models.Competition(
        name="Sommerstævne",
        club_id=club.id,
        is_active=True,
        active_until=datetime.utcnow() + timedelta(days=14)
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)
    
    # 3. Create ClubPost
    post = models.ClubPost(
        name="LD1 Dressur",
        discipline="dressage",
        scoring_method="percentage",
        club_id=club.id,
        is_active=True
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    
    # 4. Create ClubJudge and CompetitionJudge with magic link
    cjudge = models.ClubJudge(name="Dommer Anne", email="anne@example.com", club_id=club.id)
    db.add(cjudge)
    db.commit()
    db.refresh(cjudge)
    
    magic_uuid = str(uuid.uuid4())
    comp_judge = models.CompetitionJudge(
        competition_id=comp.id,
        club_judge_id=cjudge.id,
        role="Dressurdommer",
        magic_link_uuid=magic_uuid
    )
    comp_judge.club_posts.append(post)
    db.add(comp_judge)
    db.commit()
    db.refresh(comp_judge)
    
    # 5. Create Rider and Horse
    crider = models.ClubRider(name="Marie Jensen", email="marie@example.com", club_id=club.id)
    db.add(crider)
    db.commit()
    db.refresh(crider)
    
    horse = models.Horse(name="Sleipnir", club_rider_id=crider.id)
    db.add(horse)
    db.commit()
    db.refresh(horse)
    
    comp_rider = models.CompetitionRider(
        competition_id=comp.id,
        club_rider_id=crider.id,
        horse_id=horse.id
    )
    db.add(comp_rider)
    db.commit()
    db.refresh(comp_rider)
    
    client = TestClient(app)
    
    # 6. Submit score first time via POST
    score_payload = {
        "competition_rider_id": comp_rider.id,
        "club_post_id": post.id,
        "points": 64.50,
        "deductions": 0.0,
        "comment": "Pænt ridt, god overgang."
    }
    res = client.post(f"/magic/{magic_uuid}/scores", json=score_payload)
    assert res.status_code == 200, res.text
    first_score_data = res.json()
    assert first_score_data["points"] == 64.50
    assert first_score_data["comment"] == "Pænt ridt, god overgang."
    score_id = first_score_data["id"]
    
    # 7. Get judge scores via GET /magic/{uuid}/scores
    res_get = client.get(f"/magic/{magic_uuid}/scores")
    assert res_get.status_code == 200
    judge_scores = res_get.json()
    assert len(judge_scores) == 1
    assert judge_scores[0]["id"] == score_id
    assert judge_scores[0]["points"] == 64.50
    
    # 8. Submit updated score again via POST (the previously failing case: upsert!)
    update_payload = {
        "competition_rider_id": comp_rider.id,
        "club_post_id": post.id,
        "points": 67.25,
        "deductions": 2.0,
        "comment": "Rettet: Rigtig flot galop, men fejlridning ved C."
    }
    res_update_post = client.post(f"/magic/{magic_uuid}/scores", json=update_payload)
    assert res_update_post.status_code == 200, res_update_post.text
    updated_data = res_update_post.json()
    assert updated_data["id"] == score_id
    assert updated_data["points"] == 67.25
    assert updated_data["deductions"] == 2.0
    assert updated_data["comment"] == "Rettet: Rigtig flot galop, men fejlridning ved C."
    
    # 9. Update score via PUT
    put_payload = {
        "points": 68.00,
        "deductions": 0.0,
        "comment": "Slutresultat godkendt."
    }
    res_put = client.put(f"/magic/{magic_uuid}/scores/{score_id}", json=put_payload)
    assert res_put.status_code == 200, res_put.text
    put_data = res_put.json()
    assert put_data["points"] == 68.00
    assert put_data["comment"] == "Slutresultat godkendt."
    
    db.close()
