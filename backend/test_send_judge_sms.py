import os
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["GATEWAYAPI_TOKEN"] = "ryKz47pcSUyPJC2NJMFc8IaLfc5VSowfSof5gvt4soY-347TsBEesgOb8J3LtG0g"
import unittest
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from datetime import datetime, timedelta

import models
import database
from main import app
import sms_service

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

class TestSendJudgeSms(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        models.Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        models.Base.metadata.drop_all(bind=engine)

    def test_normalize_msisdn(self):
        self.assertEqual(sms_service.normalize_msisdn("12345678"), 4512345678)
        self.assertEqual(sms_service.normalize_msisdn("+45 20 30 40 50"), 4520304050)
        self.assertEqual(sms_service.normalize_msisdn("004520304050"), 4520304050)
        self.assertEqual(sms_service.normalize_msisdn("4520304050"), 4520304050)

        with self.assertRaises(ValueError):
            sms_service.normalize_msisdn("abc")

    @patch("sms_service.urllib.request.urlopen")
    def test_send_sms_service_mock(self, mock_urlopen):
        mock_response = MagicMock()
        mock_response.read.return_value = b'{"ids": [123456]}'
        mock_urlopen.return_value.__enter__.return_value = mock_response

        res = sms_service.send_judge_magic_link_sms(
            phone="20304050",
            judge_name="Mette Hansen",
            comp_name="Klubmesterskab",
            magic_link="https://equievent.dk/?magic=test-uuid"
        )
        self.assertEqual(res, {"ids": [123456]})
        self.assertTrue(mock_urlopen.called)

    @patch("sms_service.urllib.request.urlopen")
    def test_send_sms_endpoint(self, mock_urlopen):
        mock_response = MagicMock()
        mock_response.read.return_value = b'{"ids": [99999]}'
        mock_urlopen.return_value.__enter__.return_value = mock_response

        db = TestingSessionLocal()
        user = models.User(email="admin_sms_test@alkdata.dk", hashed_password="pw")
        db.add(user)
        db.commit()
        db.refresh(user)

        club = models.Club(name="SMS Test Club", user_id=user.id)
        db.add(club)
        db.commit()
        db.refresh(club)

        comp = models.Competition(
            name="Efterårsstævne 2026",
            club_id=club.id,
            is_active=True,
            active_until=datetime.utcnow() + timedelta(days=10)
        )
        db.add(comp)
        db.commit()
        db.refresh(comp)

        judge = models.ClubJudge(
            club_id=club.id,
            name="Lars Dommer",
            email="lars@test.dk",
            phone="12345678"
        )
        db.add(judge)
        db.commit()
        db.refresh(judge)

        comp_judge = models.CompetitionJudge(
            competition_id=comp.id,
            club_judge_id=judge.id,
            role="Dommer C",
            magic_link_uuid="test-uuid-judge-sms"
        )
        db.add(comp_judge)
        db.commit()
        db.refresh(comp_judge)

        # Mock current active user auth dependency
        from auth import get_current_user
        app.dependency_overrides[get_current_user] = lambda: user

        response = self.client.post(f"/clubs/{club.id}/competitions/{comp.id}/judges/{comp_judge.id}/send-sms")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("Lars Dommer", data["message"])
        self.assertIn("12345678", data["message"])

if __name__ == "__main__":
    unittest.main()
