import json
from datetime import datetime
import uuid
import database
import models

def seed_demo():
    # Initialize all tables in the database
    models.Base.metadata.create_all(bind=database.engine)
    db = database.SessionLocal()
    try:
        # Check if database is empty or needs seeding
        existing_comp = db.query(models.Competition).filter(models.Competition.name == "Rosendal Sommerstævne 2026").first()
        if existing_comp:
            print("Demo data already seeded!")
            return
            
        print("Seeding demo user and club...")
        # Create user
        user = models.User(email="admin@example.com", hashed_password="dummy_password_hash")
        db.add(user)
        db.commit()
        db.refresh(user)
        
        club = models.Club(name="Rosendal Rideklub", user_id=user.id, contact_email="rosendal@example.com")
        db.add(club)
        db.commit()
        db.refresh(club)

        # Create competition
        print("Seeding competition...")
        comp = models.Competition(
            club_id=club.id,
            name="Rosendal Sommerstævne 2026",
            date=datetime.utcnow(),
            location="Rosendal Ridecenter",
            is_active=True,
            ruleVersion="2026.1"
        )
        db.add(comp)
        db.commit()
        db.refresh(comp)

        # Seeding ClassDefinitions
        print("Seeding ClassDefinitions...")
        
        # 1. Dressage
        dressage_config = {
            "exercises": [
                {"sequence": 1, "code": "IND_PARADE", "name": "Indridning og parade", "coefficient": 1, "maxMark": 10, "allowedIncrement": 0.5, "directiveIdeas": ["lige linje", "ro i paraden", "overgange"]},
                {"sequence": 2, "code": "ARBEJDSTRAV", "name": "Arbejdstrav", "coefficient": 1, "maxMark": 10, "allowedIncrement": 0.5, "directiveIdeas": ["takt", "balance", "søgning"]},
                {"sequence": 3, "code": "MIDDELSKRIDT", "name": "Middelskridt", "coefficient": 2, "maxMark": 10, "allowedIncrement": 0.5, "directiveIdeas": ["ren firetakt", "afslapning", "overtrædning"]}
            ],
            "officialResultDecimals": 2
        }
        class_dressage = models.ClassDefinition(
            discipline="dressage",
            code="LA1",
            name="LA1 Dressur (DRF)",
            scoring_model="dressage_percentage",
            configuration=json.dumps(dressage_config)
        )
        db.add(class_dressage)
        
        # 2. Jumping
        jumping_config = {
            "allowedTime": 75.0,
            "maximumTime": 150.0,
            "officialResultDecimals": 2
        }
        class_jumping = models.ClassDefinition(
            discipline="jumping",
            code="LB_A",
            name="LB1 Spring (Metode A)",
            scoring_model="jumping_a",
            configuration=json.dumps(jumping_config)
        )
        db.add(class_jumping)
        
        # 3. Icelandic T8
        icelandic_config = {
            "sections": [
                {"sequence": 1, "name": "Valgfrit tempo tölt, første volte", "weight": 1},
                {"sequence": 2, "name": "Valgfrit tempo tölt, anden volte", "weight": 1}
            ],
            "discardHighestAndLowest": True,
            "judgeMarkDecimals": 1,
            "officialResultDecimals": 2,
            "markIncrement": 0.5
        }
        class_icelandic = models.ClassDefinition(
            discipline="gait",
            code="T8",
            name="T8 Tölt (FEIF)",
            scoring_model="gait_t8",
            configuration=json.dumps(icelandic_config)
        )
        db.add(class_icelandic)
        
        db.commit()
        db.refresh(class_dressage)
        db.refresh(class_jumping)
        db.refresh(class_icelandic)

        # Seeding Riders and Horses
        print("Seeding Riders & Horses...")
        rider1 = models.ClubRider(club_id=club.id, name="Signe Hansen", email="signe@example.com")
        rider2 = models.ClubRider(club_id=club.id, name="Peter Jensen", email="peter@example.com")
        db.add(rider1)
        db.add(rider2)
        db.commit()
        db.refresh(rider1)
        db.refresh(rider2)

        horse1 = models.Horse(club_rider_id=rider1.id, name="Freja fra Rosendal")
        horse2 = models.Horse(club_rider_id=rider2.id, name="Buster")
        db.add(horse1)
        db.add(horse2)
        db.commit()
        db.refresh(horse1)
        db.refresh(horse2)

        # Seeding Entries (ekvipage starts)
        print("Seeding Entries...")
        entry_dr1 = models.Entry(class_id=class_dressage.id, rider_id=rider1.id, horse_id=horse1.id, start_number=101, competition_id=comp.id)
        entry_dr2 = models.Entry(class_id=class_dressage.id, rider_id=rider2.id, horse_id=horse2.id, start_number=102, competition_id=comp.id)
        
        entry_jp1 = models.Entry(class_id=class_jumping.id, rider_id=rider1.id, horse_id=horse1.id, start_number=201, competition_id=comp.id)
        entry_jp2 = models.Entry(class_id=class_jumping.id, rider_id=rider2.id, horse_id=horse2.id, start_number=202, competition_id=comp.id)

        entry_ice1 = models.Entry(class_id=class_icelandic.id, rider_id=rider1.id, horse_id=horse1.id, start_number=301, competition_id=comp.id)
        entry_ice2 = models.Entry(class_id=class_icelandic.id, rider_id=rider2.id, horse_id=horse2.id, start_number=302, competition_id=comp.id)

        db.add(entry_dr1)
        db.add(entry_dr2)
        db.add(entry_jp1)
        db.add(entry_jp2)
        db.add(entry_ice1)
        db.add(entry_ice2)
        db.commit()

        # Seeding Judges with UUIDs
        print("Seeding Judges...")
        judge_c = models.Judge(
            competition_id=comp.id,
            name="Overdommer Carl",
            position="C",
            magic_link_uuid="test-judge-uuid-dressage"
        )
        db.add(judge_c)
        db.commit()
        
        print("Seeding complete! You can open:")
        print("Judge panel: http://localhost:5173/?magic=test-judge-uuid-dressage")
        print(f"Leaderboard: http://localhost:5173/?leaderboard={comp.id}")

    finally:
        db.close()

if __name__ == "__main__":
    seed_demo()
