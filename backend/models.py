from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)

    clubs = relationship("Club", back_populates="user", cascade="all, delete-orphan")

class Club(Base):
    __tablename__ = "clubs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, index=True)
    
    contact_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    address = Column(String, nullable=True)
    zip_code = Column(String, nullable=True)
    city = Column(String, nullable=True)

    logo_url = Column(String, nullable=True)
    facebook_url = Column(String, nullable=True)
    instagram_url = Column(String, nullable=True)
    website_url = Column(String, nullable=True)

    user = relationship("User", back_populates="clubs")
    competitions = relationship("Competition", back_populates="club", cascade="all, delete-orphan")
    club_riders = relationship("ClubRider", back_populates="club", cascade="all, delete-orphan")
    club_judges = relationship("ClubJudge", back_populates="club", cascade="all, delete-orphan")
    club_posts = relationship("ClubPost", back_populates="club", cascade="all, delete-orphan")

class DiscountCode(Base):
    __tablename__ = "discount_codes"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)
    discount_amount = Column(Float)
    is_active = Column(Boolean, default=True)
    max_uses_per_club = Column(Integer, nullable=True, default=None)
    max_total_uses = Column(Integer, nullable=True, default=None)

    usages = relationship("DiscountUsage", back_populates="discount_code", cascade="all, delete-orphan")

class DiscountUsage(Base):
    __tablename__ = "discount_usages"
    id = Column(Integer, primary_key=True, index=True)
    discount_code_id = Column(Integer, ForeignKey("discount_codes.id"))
    club_id = Column(Integer, ForeignKey("clubs.id"))
    competition_id = Column(Integer, ForeignKey("competitions.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    used_at = Column(DateTime, default=datetime.utcnow)

    discount_code = relationship("DiscountCode", back_populates="usages")
    club = relationship("Club")

class Competition(Base):
    __tablename__ = "competitions"
    id = Column(Integer, primary_key=True, index=True)
    club_id = Column(Integer, ForeignKey("clubs.id"))
    name = Column(String, index=True)
    date = Column(DateTime)
    start_time = Column(String, nullable=True)
    end_time = Column(String, nullable=True)
    location = Column(String)
    
    is_active = Column(Boolean, default=False)
    active_until = Column(DateTime, nullable=True)
    price_paid = Column(Float, nullable=True)

    discipline = Column(String, default="gait")
    scoring_method = Column(String, default="standard")
    ruleVersion = Column(String, default="2026.1")

    club = relationship("Club", back_populates="competitions")
    competition_judges = relationship("CompetitionJudge", back_populates="competition", cascade="all, delete-orphan")
    competition_riders = relationship("CompetitionRider", back_populates="competition", cascade="all, delete-orphan")
    club_posts = relationship("ClubPost", secondary="competition_posts", back_populates="competitions")

class ClubPost(Base):
    __tablename__ = "club_posts"
    id = Column(Integer, primary_key=True, index=True)
    club_id = Column(Integer, ForeignKey("clubs.id"))
    name = Column(String)
    description = Column(Text, nullable=True)
    location = Column(String, nullable=True)

    coefficient = Column(Float, default=1.0)
    max_value = Column(Float, default=10.0)
    discipline = Column(String, default="gait")
    scoring_method = Column(String, default="standard")
    is_active = Column(Boolean, default=True)
    configuration = Column(Text, nullable=True)

    club = relationship("Club", back_populates="club_posts")
    scores = relationship("Score", back_populates="club_post", cascade="all, delete-orphan")
    competition_judges = relationship("CompetitionJudge", secondary="judge_posts", back_populates="club_posts")
    competitions = relationship("Competition", secondary="competition_posts", back_populates="club_posts")

class ClubRider(Base):
    __tablename__ = "club_riders"
    id = Column(Integer, primary_key=True, index=True)
    club_id = Column(Integer, ForeignKey("clubs.id"))
    name = Column(String)
    email = Column(String) # Required
    phone = Column(String, nullable=True)

    club = relationship("Club", back_populates="club_riders")
    horses = relationship("Horse", back_populates="club_rider", cascade="all, delete-orphan")
    competitions_participated = relationship("CompetitionRider", back_populates="club_rider", cascade="all, delete-orphan")

class Horse(Base):
    __tablename__ = "horses"
    id = Column(Integer, primary_key=True, index=True)
    club_rider_id = Column(Integer, ForeignKey("club_riders.id"))
    name = Column(String)

    club_rider = relationship("ClubRider", back_populates="horses")
    competitions_participated = relationship("CompetitionRider", back_populates="horse", cascade="all, delete-orphan")

class ClubJudge(Base):
    __tablename__ = "club_judges"
    id = Column(Integer, primary_key=True, index=True)
    club_id = Column(Integer, ForeignKey("clubs.id"))
    name = Column(String)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)

    club = relationship("Club", back_populates="club_judges")
    competitions_participated = relationship("CompetitionJudge", back_populates="club_judge", cascade="all, delete-orphan")

class CompetitionPost(Base):
    __tablename__ = "competition_posts"
    competition_id = Column(Integer, ForeignKey("competitions.id", ondelete="CASCADE"), primary_key=True)
    club_post_id = Column(Integer, ForeignKey("club_posts.id", ondelete="CASCADE"), primary_key=True)

class CompetitionRiderPost(Base):
    __tablename__ = "competition_rider_posts"
    id = Column(Integer, primary_key=True, index=True)
    competition_rider_id = Column(Integer, ForeignKey("competition_riders.id", ondelete="CASCADE"))
    club_post_id = Column(Integer, ForeignKey("club_posts.id", ondelete="CASCADE"))
    start_number = Column(Integer, nullable=True)

    competition_rider = relationship("CompetitionRider", back_populates="rider_posts")
    club_post = relationship("ClubPost")

class CompetitionRider(Base):
    __tablename__ = "competition_riders"
    id = Column(Integer, primary_key=True, index=True)
    competition_id = Column(Integer, ForeignKey("competitions.id"))
    club_rider_id = Column(Integer, ForeignKey("club_riders.id"))
    horse_id = Column(Integer, ForeignKey("horses.id"))
    
    start_number = Column(Integer, nullable=True)
    magic_link_uuid = Column(String, unique=True, index=True)

    competition = relationship("Competition", back_populates="competition_riders")
    club_rider = relationship("ClubRider", back_populates="competitions_participated")
    horse = relationship("Horse", back_populates="competitions_participated")
    scores = relationship("Score", back_populates="competition_rider", cascade="all, delete-orphan")
    rider_posts = relationship("CompetitionRiderPost", back_populates="competition_rider", cascade="all, delete-orphan")

class CompetitionJudge(Base):
    __tablename__ = "competition_judges"
    id = Column(Integer, primary_key=True, index=True)
    competition_id = Column(Integer, ForeignKey("competitions.id"))
    club_judge_id = Column(Integer, ForeignKey("club_judges.id"))
    
    role = Column(String)
    magic_link_uuid = Column(String, unique=True, index=True)

    competition = relationship("Competition", back_populates="competition_judges")
    club_judge = relationship("ClubJudge", back_populates="competitions_participated")
    club_posts = relationship("ClubPost", secondary="judge_posts", back_populates="competition_judges")
    scores = relationship("Score", back_populates="competition_judge", cascade="all, delete-orphan")

class JudgePost(Base):
    __tablename__ = "judge_posts"
    competition_judge_id = Column(Integer, ForeignKey("competition_judges.id"), primary_key=True)
    club_post_id = Column(Integer, ForeignKey("club_posts.id"), primary_key=True)

class Score(Base):
    __tablename__ = "scores"
    id = Column(Integer, primary_key=True, index=True)
    club_post_id = Column(Integer, ForeignKey("club_posts.id"), nullable=True)
    competition_judge_id = Column(Integer, ForeignKey("competition_judges.id"))
    competition_rider_id = Column(Integer, ForeignKey("competition_riders.id"))
    
    points = Column(Float, nullable=True)
    comment = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Nye felter til Dressur og Spring
    deductions = Column(Float, default=0.0)
    faults = Column(Integer, nullable=True)
    time_seconds = Column(Float, nullable=True)
    style_points = Column(Float, nullable=True)
    is_eliminated = Column(Boolean, default=False)
    is_retired = Column(Boolean, default=False)
    is_clear = Column(Boolean, default=False)
    jump_off_faults = Column(Integer, nullable=True)
    jump_off_time = Column(Float, nullable=True)

    club_post = relationship("ClubPost", back_populates="scores")
    competition_judge = relationship("CompetitionJudge", back_populates="scores")
    competition_rider = relationship("CompetitionRider", back_populates="scores")


class RuleSet(Base):
    __tablename__ = "rulesets"
    version = Column(String, primary_key=True)
    valid_from = Column(DateTime, default=datetime.utcnow)
    source_url = Column(String, nullable=True)
    configuration = Column(Text)  # JSON text storing rules/consequences


class ClassDefinition(Base):
    __tablename__ = "class_definitions"
    id = Column(Integer, primary_key=True, index=True)
    discipline = Column(String)  # dressage, jumping, gait
    code = Column(String)  # e.g., LA2, T8, V5, LB1
    name = Column(String)
    scoring_model = Column(String)  # e.g., dressage_percentage, jumping_a, etc.
    configuration = Column(Text, nullable=True)  # JSON configuration for exercises/sections/parameters
    club_id = Column(Integer, ForeignKey("clubs.id"), nullable=True)
    
    club = relationship("Club")


class Entry(Base):
    __tablename__ = "entries"
    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("class_definitions.id"))
    rider_id = Column(Integer, ForeignKey("club_riders.id"))
    horse_id = Column(Integer, ForeignKey("horses.id"))
    start_number = Column(Integer, nullable=True)
    competition_id = Column(Integer, ForeignKey("competitions.id"))

    class_def = relationship("ClassDefinition")
    rider = relationship("ClubRider")
    horse = relationship("Horse")
    competition = relationship("Competition")
    score_sheets = relationship("ScoreSheet", back_populates="entry", cascade="all, delete-orphan")
    result = relationship("Result", uselist=False, back_populates="entry", cascade="all, delete-orphan")


class Judge(Base):
    __tablename__ = "judges"
    id = Column(Integer, primary_key=True, index=True)
    competition_id = Column(Integer, ForeignKey("competitions.id"))
    name = Column(String)
    position = Column(String, nullable=True)  # e.g., C, M, H or 1, 2, 3, 4, 5
    magic_link_uuid = Column(String, unique=True, index=True)

    competition = relationship("Competition")


class ScoreSheet(Base):
    __tablename__ = "score_sheets"
    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("entries.id"))
    judge_id = Column(Integer, ForeignKey("judges.id"))
    status = Column(String, default="DRAFT")  # DRAFT, SUBMITTED, VALIDATED, APPROVED, ELIMINATED, DISQUALIFIED, WITHDRAWN, NO_SHOW
    rule_version = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String, nullable=True)
    revision = Column(Integer, default=1)
    change_reason = Column(String, nullable=True)

    entry = relationship("Entry", back_populates="score_sheets")
    judge = relationship("Judge")
    items = relationship("ScoreItem", back_populates="score_sheet", cascade="all, delete-orphan")


class ScoreItem(Base):
    __tablename__ = "score_items"
    id = Column(Integer, primary_key=True, index=True)
    score_sheet_id = Column(Integer, ForeignKey("score_sheets.id"))
    sequence = Column(Integer)
    type = Column(String)  # mark, event, time, deduction
    value = Column(Text)  # JSON representation of the item value (e.g. {"mark": 7.5, "comment": "..."})

    score_sheet = relationship("ScoreSheet", back_populates="items")


class Result(Base):
    __tablename__ = "results"
    entry_id = Column(Integer, ForeignKey("entries.id"), primary_key=True)
    status = Column(String)  # APPROVED, ELIMINATED, etc.
    primary_score = Column(Float)  # percentage, faults, or average mark
    secondary_score = Column(Float, nullable=True)  # e.g., time or style points for tie breaker
    tie_breaker = Column(Text, nullable=True)
    calculation_trace = Column(Text, nullable=True)  # JSON trace of calculation steps

    entry = relationship("Entry", back_populates="result")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String)  # e.g., "ScoreSheet"
    entity_id = Column(Integer)
    revision = Column(Integer)
    changed_at = Column(DateTime, default=datetime.utcnow)
    changed_by = Column(String, nullable=True)
    change_reason = Column(String, nullable=True)
    snapshot = Column(Text)  # JSON representation of the entity before this change


class SupportTicket(Base):
    __tablename__ = "support_tickets"
    id = Column(Integer, primary_key=True, index=True)
    source_system = Column(String, default="EquiEvent", index=True)
    name = Column(String, index=True)
    email = Column(String, index=True)
    subject = Column(String)
    message = Column(Text)
    club_name = Column(String, nullable=True)
    status = Column(String, default="Ny", index=True)  # "Ny", "I gang", "Modtaget svar", "Løst", "Arkiveret"
    priority = Column(String, default="Normal")  # "Lav", "Normal", "Høj"
    internal_notes = Column(Text, nullable=True)
    attachment_filename = Column(String, nullable=True)
    attachment_path = Column(String, nullable=True)
    attachment_size = Column(Integer, nullable=True)
    attachment_mimetype = Column(String, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship("SupportMessage", back_populates="ticket", cascade="all, delete-orphan", order_by="SupportMessage.created_at.asc()")


class SupportMessage(Base):
    __tablename__ = "support_messages"
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.id"), index=True)
    sender_type = Column(String, default="customer")  # "customer" or "admin"
    sender_name = Column(String)
    sender_email = Column(String)
    message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    ticket = relationship("SupportTicket", back_populates="messages")




