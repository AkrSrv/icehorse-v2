import pytest
import json
from decimal import Decimal
from scoring_engine import calculate_result, calculate_dressage, calculate_jumping, calculate_icelandic

# Simple mock classes to simulate SQLAlchemy models
class MockClassDefinition:
    def __init__(self, discipline, scoring_model, configuration):
        self.discipline = discipline
        self.scoring_model = scoring_model
        self.configuration = configuration

class MockRuleSet:
    def __init__(self, configuration):
        self.configuration = configuration

class MockJudge:
    def __init__(self, name, position=None):
        self.name = name
        self.position = position

class MockScoreSheet:
    def __init__(self, judge, items, status="APPROVED", judge_id=1, change_reason=None):
        self.judge = judge
        self.items = items
        self.status = status
        self.judge_id = judge_id
        self.change_reason = change_reason

class MockScoreItem:
    def __init__(self, sequence, type, value):
        self.sequence = sequence
        self.type = type
        self.value = value


# --- DRESSAGE TESTS ---

def test_tc_dr_01_percentage():
    # 159 points, max 240, expected 66.25%
    # Define an exercise list that has a total maximum points of 240.
    # e.g., 24 exercises with coefficient 1 and maxMark 10.
    exercises = []
    items = []
    # Let's say we have 24 exercises, each coefficient 1, maxMark 10
    # To get 159 points, we can have 15 exercises with 7.0 and 9 exercises with 6.0:
    # 15 * 7 = 105; 9 * 6 = 54. 105 + 54 = 159.
    for i in range(1, 25):
        exercises.append({
            "sequence": i,
            "code": f"EX_{i}",
            "name": f"Exercise {i}",
            "coefficient": 1,
            "maxMark": 10,
            "allowedIncrement": 0.5
        })
        mark = 7.0 if i <= 15 else 6.0
        items.append(MockScoreItem(i, "mark", json.dumps({"mark": mark})))

    class_def = MockClassDefinition(
        discipline="dressage",
        scoring_model="dressage_percentage",
        configuration=json.dumps({"exercises": exercises})
    )
    rule_set = MockRuleSet(configuration="{}")
    judge = MockJudge(name="Dommer A", position="C")
    sheet = MockScoreSheet(judge=judge, items=items)

    result = calculate_result(class_def, rule_set, [sheet])
    assert result["status"] == "APPROVED"
    assert result["primary_score"] == 66.25


def test_tc_dr_02_coefficient():
    # Mark 7.5 and coefficient 2 => 15.0 points
    exercises = [
        {
            "sequence": 1,
            "code": "MEDIUM_WALK",
            "name": "Middelskridt",
            "coefficient": 2,
            "maxMark": 10,
            "allowedIncrement": 0.5
        }
    ]
    items = [
        MockScoreItem(1, "mark", json.dumps({"mark": 7.5}))
    ]
    class_def = MockClassDefinition(
        discipline="dressage",
        scoring_model="dressage_percentage",
        configuration=json.dumps({"exercises": exercises})
    )
    rule_set = MockRuleSet(configuration="{}")
    judge = MockJudge(name="Dommer A")
    sheet = MockScoreSheet(judge=judge, items=items)

    result = calculate_result(class_def, rule_set, [sheet])
    assert result["judge_results"][0]["gross_points"] == 15.0


# --- JUMPING TESTS ---

def test_tc_sp_01_time_faults():
    # 1.42 seconds over allowed time in main round => 1 time fault (ceiling(1.42/4) = 1)
    class_def = MockClassDefinition(
        discipline="jumping",
        scoring_model="jumping_a",
        configuration=json.dumps({
            "allowedTime": 75.0,
            "maximumTime": 150.0
        })
    )
    # Configure rule set penalties
    rule_set = MockRuleSet(configuration=json.dumps({
        "jumping": {
            "disobedienceLimit": 2,
            "eliminateAbove16ObstacleFaults": True,
            "penalties": {
                "KNOCKDOWN": {"faults": 4},
                "DISOBEDIENCE": {"faults": 4}
            }
        }
    }))

    items = [
        MockScoreItem(1, "time", json.dumps({"ridingTime": 76.42}))
    ]
    sheet = MockScoreSheet(judge=MockJudge("Tidstager"), items=items)

    result = calculate_result(class_def, rule_set, [sheet])
    assert result["status"] == "APPROVED"
    assert result["primary_score"] == 1.0 # only 1 time fault


def test_tc_sp_02_combined_penalties():
    # One knockdown (4), one disobedience (4) and 1 time fault (1) => 9 faults
    class_def = MockClassDefinition(
        discipline="jumping",
        scoring_model="jumping_a",
        configuration=json.dumps({
            "allowedTime": 75.0,
            "maximumTime": 150.0
        })
    )
    rule_set = MockRuleSet(configuration=json.dumps({
        "jumping": {
            "disobedienceLimit": 2,
            "penalties": {
                "KNOCKDOWN": {"faults": 4},
                "DISOBEDIENCE": {"faults": 4}
            }
        }
    }))

    items = [
        MockScoreItem(1, "event", json.dumps({"obstacle": "5", "eventType": "KNOCKDOWN"})),
        MockScoreItem(2, "event", json.dumps({"obstacle": "7", "eventType": "DISOBEDIENCE"})),
        MockScoreItem(3, "time", json.dumps({"ridingTime": 76.42})) # 1.42s over 75s => 1 time fault
    ]
    sheet = MockScoreSheet(judge=MockJudge("Dommer"), items=items)

    result = calculate_result(class_def, rule_set, [sheet])
    assert result["status"] == "APPROVED"
    assert result["primary_score"] == 9.0


def test_tc_sp_03_jumping_b4_phase2():
    # 4 faults in phase 1 => phase 2 must not be opened
    class_def = MockClassDefinition(
        discipline="jumping",
        scoring_model="jumping_b4",
        configuration=json.dumps({
            "allowedTime": 75.0,
            "maximumTime": 150.0
        })
    )
    rule_set = MockRuleSet(configuration=json.dumps({
        "jumping": {
            "disobedienceLimit": 2,
            "penalties": {
                "KNOCKDOWN": {"faults": 4}
            }
        }
    }))

    # Phase 1 Knockdown
    items = [
        MockScoreItem(1, "event", json.dumps({"obstacle": "3", "eventType": "KNOCKDOWN"})),
        MockScoreItem(2, "time", json.dumps({"ridingTime": 65.0}))
    ]
    sheet = MockScoreSheet(judge=MockJudge("Dommer"), items=items)

    result = calculate_result(class_def, rule_set, [sheet])
    trace_data = json.loads(result["calculation_trace"])
    assert trace_data["phase2_opened"] is False
    assert result["primary_score"] == 4.0


# --- ICELANDIC TESTS ---

def test_tc_is_01_average_dropping():
    # T8 5 judges: 6.5, 6.8, 7.0, 7.3, 7.5 => lowest/highest drop => (6.8 + 7.0 + 7.3)/3 = 7.03
    sections = [
        {"sequence": 1, "name": "Section 1", "weight": 1},
        {"sequence": 2, "name": "Section 2", "weight": 1}
    ]
    class_def = MockClassDefinition(
        discipline="gait",
        scoring_model="gait_t8",
        configuration=json.dumps({
            "sections": sections,
            "discardHighestAndLowest": True,
            "judgeMarkDecimals": 1,
            "officialResultDecimals": 2
        })
    )
    rule_set = MockRuleSet(configuration="{}")

    # We need 5 judge score sheets with valid 0.5-increment section marks
    # that calculate to: 6.5, 6.75 (rounds to 6.8), 7.0, 7.25 (rounds to 7.3), and 7.5.
    marks_pairs = [
        (6.5, 6.5), # 6.5
        (6.5, 7.0), # 6.75 -> 6.8
        (7.0, 7.0), # 7.0
        (7.0, 7.5), # 7.25 -> 7.3
        (7.5, 7.5)  # 7.5
    ]
    sheets = []
    for idx, (m1, m2) in enumerate(marks_pairs):
        items = [
            MockScoreItem(1, "mark", json.dumps({"mark": m1})),
            MockScoreItem(2, "mark", json.dumps({"mark": m2}))
        ]
        sheets.append(MockScoreSheet(judge=MockJudge(f"Dommer {idx}"), items=items, judge_id=idx))

    result = calculate_result(class_def, rule_set, sheets)
    assert result["status"] == "APPROVED"
    assert result["primary_score"] == 7.03


def test_tc_is_02_weighting():
    # F2: tölt and pas weighted double (tölt: 2, trav: 1, skridt: 1, galop: 1, pas: 2)
    # Let's say: Tölt 6.5, Trav 6.0, Skridt 6.0, Galop 6.0, Pas 6.0
    # Expected weighted average: (6.5*2 + 6.0*1 + 6.0*1 + 6.0*1 + 6.0*2) / (2+1+1+1+2)
    # = (13.0 + 6.0 + 6.0 + 6.0 + 12.0) / 7 = 43.0 / 7 = 6.1428... => 6.14
    sections = [
        {"sequence": 1, "name": "Tölt", "weight": 2},
        {"sequence": 2, "name": "Trav", "weight": 1},
        {"sequence": 3, "name": "Skridt", "weight": 1},
        {"sequence": 4, "name": "Galop", "weight": 1},
        {"sequence": 5, "name": "Pas", "weight": 2}
    ]
    class_def = MockClassDefinition(
        discipline="gait",
        scoring_model="gait_f2",
        configuration=json.dumps({
            "sections": sections,
            "discardHighestAndLowest": False, # single judge test
            "judgeMarkDecimals": 2,
            "officialResultDecimals": 2
        })
    )
    rule_set = MockRuleSet(configuration="{}")

    items = [
        MockScoreItem(1, "mark", json.dumps({"mark": 6.5})),
        MockScoreItem(2, "mark", json.dumps({"mark": 6.0})),
        MockScoreItem(3, "mark", json.dumps({"mark": 6.0})),
        MockScoreItem(4, "mark", json.dumps({"mark": 6.0})),
        MockScoreItem(5, "mark", json.dumps({"mark": 6.0}))
    ]
    sheet = MockScoreSheet(judge=MockJudge("Dommer 1"), items=items, judge_id=1)

    result = calculate_icelandic(class_def, rule_set, [sheet])
    assert result["status"] == "APPROVED"
    assert result["primary_score"] == 6.14
