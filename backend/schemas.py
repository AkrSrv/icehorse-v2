from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    club_name: str

class UserOut(BaseModel):
    id: int
    email: EmailStr
    class Config:
        from_attributes = True

class ClubBase(BaseModel):
    name: str

class ClubUpdate(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    address: Optional[str] = None
    zip_code: Optional[str] = None
    city: Optional[str] = None
    logo_url: Optional[str] = None
    facebook_url: Optional[str] = None
    instagram_url: Optional[str] = None
    website_url: Optional[str] = None

class ClubCreate(ClubBase):
    pass

class ClubOut(ClubBase):
    id: int
    user_id: int
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    address: Optional[str] = None
    zip_code: Optional[str] = None
    city: Optional[str] = None
    logo_url: Optional[str] = None
    facebook_url: Optional[str] = None
    instagram_url: Optional[str] = None
    website_url: Optional[str] = None
    class Config:
        from_attributes = True

class DiscountCodeBase(BaseModel):
    code: str
    discount_amount: float
    is_active: bool = True
    max_uses_per_club: Optional[int] = None
    max_total_uses: Optional[int] = None

class DiscountCodeCreate(DiscountCodeBase):
    pass

class DiscountCodeOut(DiscountCodeBase):
    id: int
    total_used_count: Optional[int] = 0
    class Config:
        from_attributes = True

class CompetitionBase(BaseModel):
    name: str
    date: datetime
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: str
    discipline: Optional[str] = "gait"
    scoring_method: Optional[str] = "standard"

class CompetitionCreate(CompetitionBase):
    import_standards: Optional[bool] = False
    post_ids: Optional[List[int]] = []


class CompetitionOut(CompetitionBase):
    id: int
    club_id: int
    is_active: bool
    active_until: Optional[datetime] = None
    price_paid: Optional[float] = None
    club_posts: List["ClubPostOut"] = []
    class Config:
        from_attributes = True

class ClubPostBase(BaseModel):
    name: str
    description: Optional[str] = None
    location: Optional[str] = None
    coefficient: Optional[float] = 1.0
    max_value: Optional[float] = 10.0
    discipline: Optional[str] = "gait"
    scoring_method: Optional[str] = "standard"
    is_active: Optional[bool] = True
    configuration: Optional[str] = None

class ClubPostCreate(ClubPostBase):
    pass

class ClubPostOut(ClubPostBase):
    id: int
    club_id: int
    class Config:
        from_attributes = True

class HorseBase(BaseModel):
    name: str

class HorseCreate(HorseBase):
    pass

class HorseOut(HorseBase):
    id: int
    club_rider_id: int
    class Config:
        from_attributes = True

class ClubRiderBase(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None

class ClubRiderCreate(ClubRiderBase):
    pass

class ClubRiderOut(ClubRiderBase):
    id: int
    club_id: int
    horses: List[HorseOut] = []
    class Config:
        from_attributes = True

class ClubJudgeBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

class ClubJudgeCreate(ClubJudgeBase):
    pass

class ClubJudgeOut(ClubJudgeBase):
    id: int
    club_id: int
    class Config:
        from_attributes = True

class CompetitionRiderPostBase(BaseModel):
    club_post_id: int
    start_number: Optional[int] = None

class CompetitionRiderPostCreate(CompetitionRiderPostBase):
    pass

class CompetitionRiderPostOut(CompetitionRiderPostBase):
    id: int
    competition_rider_id: int
    club_post: ClubPostOut
    class Config:
        from_attributes = True

class CompetitionRiderBase(BaseModel):
    horse_id: int
    club_rider_id: int

class CompetitionRiderCreate(CompetitionRiderBase):
    rider_posts: List[CompetitionRiderPostBase] = []

class CompetitionRiderOut(CompetitionRiderBase):
    id: int
    competition_id: int
    start_number: Optional[int] = None
    magic_link_uuid: str
    club_rider: ClubRiderOut
    horse: HorseOut
    rider_posts: List[CompetitionRiderPostOut] = []
    class Config:
        from_attributes = True

class CompetitionJudgeBase(BaseModel):
    role: str
    club_judge_id: int

class CompetitionJudgeCreate(CompetitionJudgeBase):
    post_ids: List[int] = []

class CompetitionJudgeOut(CompetitionJudgeBase):
    id: int
    competition_id: int
    magic_link_uuid: str
    club_judge: ClubJudgeOut
    club_posts: List[ClubPostOut] = []
    competition: Optional[CompetitionOut] = None
    class Config:
        from_attributes = True

class DirectoryCompetitionOut(BaseModel):
    id: int
    name: str

class DirectoryRiderOut(ClubRiderOut):
    competitions: List[DirectoryCompetitionOut] = []

class DirectoryJudgeOut(ClubJudgeOut):
    competitions: List[DirectoryCompetitionOut] = []

class DirectoryOut(BaseModel):
    riders: List[DirectoryRiderOut]
    judges: List[DirectoryJudgeOut]

class ScoreBase(BaseModel):
    points: Optional[float] = None
    comment: Optional[str] = None
    deductions: Optional[float] = 0.0
    faults: Optional[int] = None
    time_seconds: Optional[float] = None
    style_points: Optional[float] = None
    is_eliminated: Optional[bool] = False
    is_retired: Optional[bool] = False
    is_clear: Optional[bool] = False
    jump_off_faults: Optional[int] = None
    jump_off_time: Optional[float] = None

class ScoreCreate(ScoreBase):
    club_post_id: Optional[int] = None
    competition_rider_id: int

class ScoreUpdate(ScoreBase):
    pass

class ScoreOut(ScoreBase):
    id: int
    club_post_id: Optional[int] = None
    competition_judge_id: int
    competition_rider_id: int
    timestamp: datetime
    
    class Config:
        from_attributes = True


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class CreatePaymentIntentRequest(BaseModel):
    discount_code: Optional[str] = None

class CreatePaymentIntentResponse(BaseModel):
    client_secret: Optional[str] = None
    amount: float
    currency: str = "dkk"
    discount_pct: float = 0.0

class ActivateCompetitionRequest(BaseModel):
    discount_code: Optional[str] = None
    payment_intent_id: Optional[str] = None


# --- NEW JUDGING SCHEMAS ---

class RuleSetBase(BaseModel):
    version: str
    valid_from: Optional[datetime] = None
    source_url: Optional[str] = None
    configuration: str  # JSON string

class RuleSetCreate(RuleSetBase):
    pass

class RuleSetOut(RuleSetBase):
    class Config:
        from_attributes = True

class ClassDefinitionBase(BaseModel):
    discipline: str
    code: str
    name: str
    scoring_model: str
    configuration: Optional[str] = None
    club_id: Optional[int] = None

class ClassDefinitionCreate(ClassDefinitionBase):
    pass

class ClassDefinitionOut(ClassDefinitionBase):
    id: int
    class Config:
        from_attributes = True

class JudgeBase(BaseModel):
    name: str
    position: Optional[str] = None

class JudgeCreate(JudgeBase):
    pass

class JudgeOut(JudgeBase):
    id: int
    competition_id: int
    magic_link_uuid: str
    class Config:
        from_attributes = True

class ScoreItemBase(BaseModel):
    sequence: int
    type: str  # mark, event, time, deduction
    value: str  # JSON representation

class ScoreItemCreate(ScoreItemBase):
    pass

class ScoreItemOut(ScoreItemBase):
    id: int
    score_sheet_id: int
    class Config:
        from_attributes = True

class ScoreSheetBase(BaseModel):
    status: str = "DRAFT"
    rule_version: str

class ScoreSheetCreate(ScoreSheetBase):
    judge_id: int

class ScoreSheetUpdate(BaseModel):
    status: Optional[str] = None
    change_reason: Optional[str] = None

class ScoreSheetOut(ScoreSheetBase):
    id: int
    entry_id: int
    judge_id: int
    created_at: datetime
    created_by: Optional[str] = None
    revision: int
    change_reason: Optional[str] = None
    items: List[ScoreItemOut] = []
    judge: JudgeOut
    class Config:
        from_attributes = True

class ResultOut(BaseModel):
    entry_id: int
    status: str
    primary_score: float
    secondary_score: Optional[float] = None
    tie_breaker: Optional[str] = None
    calculation_trace: Optional[str] = None
    class Config:
        from_attributes = True

class EntryBase(BaseModel):
    class_id: int
    rider_id: int
    horse_id: int
    start_number: Optional[int] = None
    competition_id: int

class EntryCreate(EntryBase):
    pass

class EntryOut(EntryBase):
    id: int
    class_def: ClassDefinitionOut
    rider: ClubRiderOut
    horse: HorseOut
    competition: Optional[CompetitionOut] = None
    score_sheets: List[ScoreSheetOut] = []
    result: Optional[ResultOut] = None
    class Config:
        from_attributes = True


class AuditLogOut(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    revision: int
    changed_at: datetime
    changed_by: Optional[str] = None
    change_reason: Optional[str] = None
    snapshot: str
    class Config:
        from_attributes = True



