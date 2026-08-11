import json
import math
from decimal import Decimal, ROUND_UP, ROUND_HALF_UP

def get_decimal(val) -> Decimal:
    if val is None:
        return Decimal('0')
    if isinstance(val, Decimal):
        return val
    return Decimal(str(val))

def decimal_ceil(val: Decimal) -> Decimal:
    if val <= 0:
        return Decimal('0')
    # Round positive Decimal up to nearest integer
    return val.quantize(Decimal('1'), rounding=ROUND_UP)

def calculate_dressage(class_def, rule_set, score_sheets) -> dict:
    """
    Dressage calculation:
    weightedPoint[i] = mark[i] * coefficient[i]
    grossPoints      = sum(weightedPoint)
    netPoints        = grossPoints - deductions
    percentage       = netPoints / maximumPoints * 100
    """
    trace = []
    # Load class definition configuration
    class_config = json.loads(class_def.configuration or '{}')
    exercises = class_config.get('exercises', [])
    
    # Calculate maximum possible points
    maximum_points = Decimal('0')
    for ex in exercises:
        max_mark = get_decimal(ex.get('maxMark', 10))
        coeff = get_decimal(ex.get('coefficient', 1))
        maximum_points += max_mark * coeff
        
    trace.append(f"Maximum points calculated: {maximum_points} based on {len(exercises)} exercises.")

    # Calculate score for each judge/scoresheet
    judge_results = []
    total_percentage_sum = Decimal('0')
    valid_sheets_count = 0
    
    for sheet in score_sheets:
        if sheet.status in ['ELIMINATED', 'DISQUALIFIED', 'WITHDRAWN', 'NO_SHOW']:
            continue
            
        sheet_trace = []
        sheet_items = sheet.items
        
        # Build lookup for marks by sequence
        marks_by_seq = {}
        for item in sheet_items:
            if item.type == 'mark':
                val = json.loads(item.value or '{}')
                marks_by_seq[item.sequence] = get_decimal(val.get('mark'))

        gross_points = Decimal('0')
        # Validate that all required exercises are judged (DR-V04)
        for ex in exercises:
            seq = ex.get('sequence')
            mark = marks_by_seq.get(seq)
            if mark is None:
                raise ValueError(f"DR-V04: Exercise with sequence {seq} is missing a mark.")
            
            # DR-V01 & DR-V02 Validations
            allowed_inc = get_decimal(ex.get('allowedIncrement', 0.5))
            if mark < 0 or mark > 10:
                raise ValueError(f"DR-V01: Mark {mark} must be between 0 and 10.")
            if (mark % allowed_inc) != 0:
                raise ValueError(f"DR-V02: Mark {mark} must be divisible by allowed increment {allowed_inc}.")
                
            coeff = get_decimal(ex.get('coefficient', 1))
            if coeff <= 0:
                raise ValueError(f"DR-V03: Coefficient {coeff} must be greater than 0.")
                
            weighted = mark * coeff
            gross_points += weighted
            sheet_trace.append(f"Ex {seq}: mark {mark} x coeff {coeff} = {weighted}")

        # Deductions
        # Can be stored as sheet deduction or score item deductions
        deductions = Decimal('0')
        for item in sheet_items:
            if item.type == 'deduction':
                val = json.loads(item.value or '{}')
                deductions += get_decimal(val.get('deduction', 0))

        net_points = gross_points - deductions
        if net_points > maximum_points:
            raise ValueError("DR-V06: Net points cannot exceed maximum points.")
            
        percentage = (net_points / maximum_points * Decimal('100')) if maximum_points > 0 else Decimal('0')
        
        # Round percentage to 2 or 3 decimals as configured
        # standard DRF: rounded to 3 decimals or 2 decimals
        pct_rounded = percentage.quantize(Decimal('0.001'), rounding=ROUND_HALF_UP)
        
        total_percentage_sum += percentage
        valid_sheets_count += 1
        
        judge_results.append({
            "judge_id": sheet.judge_id,
            "judge_name": sheet.judge.name if sheet.judge else "Unknown",
            "position": sheet.judge.position if sheet.judge else "",
            "gross_points": float(gross_points),
            "deductions": float(deductions),
            "net_points": float(net_points),
            "maximum_points": float(maximum_points),
            "percentage": float(pct_rounded),
            "trace": sheet_trace
        })

    if valid_sheets_count == 0:
        return {
            "status": "ELIMINATED" if any(s.status == 'ELIMINATED' for s in score_sheets) else "DRAFT",
            "primary_score": 0.0,
            "secondary_score": None,
            "calculation_trace": json.dumps({"error": "No valid score sheets"}),
            "judge_results": []
        }

    # Average percentage across judges
    avg_percentage = total_percentage_sum / Decimal(valid_sheets_count)
    avg_percentage_rounded = avg_percentage.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    trace.append(f"Average percentage from {valid_sheets_count} judges: {avg_percentage_rounded}% (unrounded: {avg_percentage}%)")

    return {
        "status": "APPROVED",
        "primary_score": float(avg_percentage_rounded),
        "secondary_score": float(total_percentage_sum), # for tie breaker if needed
        "calculation_trace": json.dumps({
            "trace": trace,
            "judge_results": judge_results,
            "formula": f"Average({', '.join(str(j['percentage']) for j in judge_results)}) = {avg_percentage_rounded}%"
        }),
        "judge_results": judge_results
    }


def calculate_jumping(class_def, rule_set, score_sheets) -> dict:
    """
    Jumping calculation based on class method:
    - Incidents -> knockdowns, disobediences, water, falls
    - Allowed Time vs Riding Time -> Time faults (1 fault per 4 commenced seconds)
    - Style: styleMark - obstacleDeductions - timeDeductions
    - Rank / Placement criteria depends on method A, B0, B4, B7, style, etc.
    """
    # Jumping typically has 1 score sheet containing the main round details
    if not score_sheets:
        return {"status": "DRAFT", "primary_score": 0.0, "calculation_trace": "{}"}
        
    sheet = score_sheets[0]
    if sheet.status in ['ELIMINATED', 'DISQUALIFIED', 'WITHDRAWN', 'NO_SHOW']:
        return {
            "status": sheet.status,
            "primary_score": 999.0 if sheet.status == 'ELIMINATED' else 9999.0,
            "secondary_score": 9999.0,
            "calculation_trace": json.dumps({"status": sheet.status, "reason": sheet.change_reason or "Udgået"})
        }

    trace = []
    class_config = json.loads(class_def.configuration or '{}')
    rule_config = json.loads(rule_set.configuration or '{}')
    jumping_rules = rule_config.get('jumping', {})

    allowed_time = get_decimal(class_config.get('allowedTime', 75))
    max_time = get_decimal(class_config.get('maximumTime', 150))
    
    if max_time <= allowed_time:
        raise ValueError("SP-V02: Maximum time must be greater than allowed time.")

    # Parse items
    incidents = []
    riding_time = Decimal('0')
    style_mark = Decimal('0')
    
    jump_off_faults = None
    jump_off_time = None
    
    for item in sheet.items:
        val = json.loads(item.value or '{}')
        if item.type == 'event':
            incidents.append(val)
        elif item.type == 'time':
            riding_time = get_decimal(val.get('ridingTime', 0))
            if riding_time < 0:
                raise ValueError("SP-V01: Riding time must be greater than or equal to 0.")
        elif item.type == 'style':
            style_mark = get_decimal(val.get('styleMark', 0))
        elif item.type == 'jump_off':
            jump_off_faults = val.get('jumpOffFaults')
            jump_off_time = val.get('jumpOffTime')

    # Assess penalties
    obstacle_faults = Decimal('0')
    disobedience_count = 0
    disobedience_limit = jumping_rules.get('disobedienceLimit', 2) # e.g. 2 for A, B, C classes
    
    is_eliminated = False
    elimination_reason = ""
    
    for inc in incidents:
        etype = inc.get('eventType')
        obs = inc.get('obstacle', 'unknown')
        
        # SP-V03 Validation
        if not obs:
            raise ValueError("SP-V03: Incident must be associated with an obstacle or event.")
            
        penalty_conf = jumping_rules.get('penalties', {}).get(etype, {})
        fault_val = get_decimal(penalty_conf.get('faults', 0))
        
        if etype == 'DISOBEDIENCE':
            disobedience_count += 1
            if disobedience_count >= disobedience_limit:
                is_eliminated = True
                elimination_reason = f"Eliminated: {disobedience_count} disobediences."
                
        if etype == 'FALL' or etype == 'RETURE':
            is_eliminated = True
            elimination_reason = f"Eliminated: {etype}."
            
        obstacle_faults += fault_val
        trace.append(f"Incident {etype} at obstacle {obs}: {fault_val} faults.")

    # Time faults
    time_faults = Decimal('0')
    if riding_time > allowed_time:
        if riding_time > max_time:
            is_eliminated = True
            elimination_reason = "Eliminated: Maximum time exceeded."
        else:
            time_exceeded = riding_time - allowed_time
            time_faults = decimal_ceil(time_exceeded / Decimal('4')) # ceiling(timeExceeded / 4)
            trace.append(f"Time exceeded: {time_exceeded}s. Time faults: {time_faults}")
            
    # Check if more than 16 faults on obstacles (excluding time faults) -> udgået/eliminated (standard rule)
    if obstacle_faults > Decimal('16') and jumping_rules.get('eliminateAbove16ObstacleFaults', True):
        is_eliminated = True
        elimination_reason = "Eliminated: More than 16 faults on obstacles."

    if is_eliminated:
        return {
            "status": "ELIMINATED",
            "primary_score": 999.0, # High penalty faults
            "secondary_score": float(riding_time),
            "calculation_trace": json.dumps({
                "status": "ELIMINATED",
                "reason_code": "ELIM",
                "reason_detail": elimination_reason,
                "trace": trace
            })
        }

    total_faults = obstacle_faults + time_faults
    scoring_model = class_def.scoring_model

    # Style Jumping Math
    if scoring_model == 'style':
        # styleResult = styleMark - obstacleDeductions - timeDeductions
        # knocks/water = -0.5 points
        # disobedience 1st = -1.0, 2nd = -2.0
        # time = -0.1 points per commenced second over allowed time
        obstacle_deductions = Decimal('0')
        for inc in incidents:
            etype = inc.get('eventType')
            ded_val = get_decimal(jumping_rules.get('style_deductions', {}).get(etype, 0))
            obstacle_deductions += ded_val
            
        time_deductions = Decimal('0')
        if riding_time > allowed_time:
            time_exceeded = riding_time - allowed_time
            # Each commenced second means ceiling
            commenced_seconds = decimal_ceil(time_exceeded)
            time_deductions = commenced_seconds * Decimal('0.1')
            
        style_result = style_mark - obstacle_deductions - time_deductions
        if style_result < 0:
            style_result = Decimal('0')
            
        trace.append(f"Style calculation: {style_mark} (base) - {obstacle_deductions} (deductions) - {time_deductions} (time) = {style_result}")
        
        return {
            "status": "APPROVED",
            "primary_score": float(style_result),
            "secondary_score": float(riding_time),
            "calculation_trace": json.dumps({
                "trace": trace,
                "style_mark": float(style_mark),
                "obstacle_deductions": float(obstacle_deductions),
                "time_deductions": float(time_deductions),
                "style_result": float(style_result),
                "formula": f"{style_mark} - {obstacle_deductions} - {time_deductions} = {style_result}"
            })
        }

    # B4 (Two-phase): Phase 2 only opened if Phase 1 is clear (0 faults)
    if scoring_model == 'jumping_b4':
        # Check if phase 1 has faults
        # In B4, incidents before allowed_time or within first N obstacles are Phase 1
        # Let's say phase 1 is clear if total_faults is 0
        if total_faults > 0:
            trace.append("Phase 2 not opened because Phase 1 had faults.")
            # SP-V06 check
            return {
                "status": "APPROVED",
                "primary_score": float(total_faults),
                "secondary_score": float(riding_time),
                "calculation_trace": json.dumps({
                    "trace": trace,
                    "phase2_opened": False,
                    "reason": "Phase 1 not clear",
                    "total_faults": float(total_faults),
                    "riding_time": float(riding_time)
                })
            }

    # Standard sorting
    # A: Rank by faults ascending, then time ascending
    return {
        "status": "APPROVED",
        "primary_score": float(total_faults),
        "secondary_score": float(riding_time),
        "calculation_trace": json.dumps({
            "trace": trace,
            "obstacle_faults": float(obstacle_faults),
            "time_faults": float(time_faults),
            "total_faults": float(total_faults),
            "riding_time": float(riding_time),
            "jump_off_faults": jump_off_faults,
            "jump_off_time": jump_off_time
        })
    }


def calculate_icelandic(class_def, rule_set, score_sheets) -> dict:
    """
    Icelandic Horse calculation:
    - 3 or 5 judges judge individually.
    - Each section weighted by sectionWeight.
    - Judge final mark = sum(sectionMark * sectionWeight) / sum(sectionWeight)
    - Optional bad riding deduction: judge final mark = max(0.0, judge final mark - badRidingDeduction)
    - If 5 judges: drop lowest and highest judge final marks, average the remaining 3.
    - Result rounded to officialResultDecimals (e.g. 2 decimals).
    """
    trace = []
    class_config = json.loads(class_def.configuration or '{}')
    sections = class_config.get('sections', [])
    discard_high_low = class_config.get('discardHighestAndLowest', True)
    decimals = class_config.get('officialResultDecimals', 2)
    
    judge_final_marks = []
    
    for sheet in score_sheets:
        if sheet.status in ['ELIMINATED', 'DISQUALIFIED', 'WITHDRAWN', 'NO_SHOW']:
            continue
            
        sheet_trace = []
        marks_by_seq = {}
        deductions = Decimal('0')
        
        for item in sheet.items:
            val = json.loads(item.value or '{}')
            if item.type == 'mark':
                # item.sequence represents section sequence
                marks_by_seq[item.sequence] = get_decimal(val.get('mark'))
            elif item.type == 'deduction':
                ded_val = get_decimal(val.get('deduction', 0))
                # IS-V07: Bad riding deduction requires explanation/reason
                if ded_val > 0 and not val.get('reason'):
                    raise ValueError("IS-V07: Fradrag for dårlig ridning skal have begrundelse.")
                deductions += ded_val

        # IS-V03: All required sections must be judged
        weighted_sum = Decimal('0')
        weight_sum = Decimal('0')
        
        for sec in sections:
            seq = sec.get('sequence')
            mark = marks_by_seq.get(seq)
            if mark is None:
                raise ValueError(f"IS-V03: Opgavedel {sec.get('name')} (seq {seq}) mangler bedømmelse.")
                
            # IS-V01 & IS-V02
            if mark < 0 or mark > 10:
                raise ValueError("IS-V01: Delkarakter skal være mellem 0 og 10.")
            if (mark % Decimal('0.5')) != 0:
                raise ValueError("IS-V02: Delkarakter skal være delelig med 0.5.")
                
            weight = get_decimal(sec.get('weight', 1))
            weighted_sum += mark * weight
            weight_sum += weight
            sheet_trace.append(f"Section {seq}: {mark} x weight {weight} = {mark * weight}")

        # Judge final mark before bad riding deduction
        judge_mark = (weighted_sum / weight_sum) if weight_sum > 0 else Decimal('0')
        
        # Apply bad riding deduction
        final_judge_mark = judge_mark - deductions
        if final_judge_mark < 0:
            final_judge_mark = Decimal('0')
            
        # Round judge final mark to configured decimals (defaults to 1 decimal)
        judge_decimals = class_config.get('judgeMarkDecimals', 1)
        judge_quantize_str = '0.' + ('0' * judge_decimals) if judge_decimals > 0 else '1'
        final_judge_mark_rounded = final_judge_mark.quantize(Decimal(judge_quantize_str), rounding=ROUND_HALF_UP)
        
        sheet_trace.append(f"Judge final mark: {final_judge_mark_rounded} (before deduction: {judge_mark}, deduction: {deductions})")
        judge_final_marks.append((sheet.judge_id, final_judge_mark_rounded, sheet_trace))

    if not judge_final_marks:
        return {"status": "DRAFT", "primary_score": 0.0, "calculation_trace": "{}"}

    # Sort final marks
    sorted_marks = sorted(judge_final_marks, key=lambda x: x[1])
    
    # IS-V04: Drop low/high only if we have exactly 5 judges (or 5 or more)
    # FEIF rules: Discard highest and lowest marks if count is 5
    if len(sorted_marks) == 5 and discard_high_low:
        discarded_low = sorted_marks[0]
        discarded_high = sorted_marks[-1]
        counted = sorted_marks[1:4]
        trace.append(f"Dropped lowest: {discarded_low[1]} (Judge {discarded_low[0]})")
        trace.append(f"Dropped highest: {discarded_high[1]} (Judge {discarded_high[0]})")
    else:
        counted = sorted_marks
        trace.append(f"Keeping all {len(sorted_marks)} judge marks (no dropping of low/high).")

    sum_marks = sum(item[1] for item in counted)
    avg_mark = sum_marks / Decimal(len(counted))
    
    # IS-V06: Official result rounded to 2 decimals
    official_result = avg_mark.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    trace.append(f"Averaged remaining: {', '.join(str(x[1]) for x in counted)} = {official_result}")

    return {
        "status": "APPROVED",
        "primary_score": float(official_result),
        "calculation_trace": json.dumps({
            "trace": trace,
            "all_judge_marks": [{"judge_id": j[0], "mark": float(j[1]), "trace": j[2]} for j in judge_final_marks],
            "formula": f"Average({', '.join(str(x[1]) for x in counted)}) = {official_result}"
        })
    }


def calculate_result(class_def, rule_set, score_sheets) -> dict:
    """
    Main router for scoring engine.
    """
    discipline = class_def.discipline
    if discipline == 'dressage':
        return calculate_dressage(class_def, rule_set, score_sheets)
    elif discipline == 'jumping':
        return calculate_jumping(class_def, rule_set, score_sheets)
    elif discipline == 'gait':
        return calculate_icelandic(class_def, rule_set, score_sheets)
    else:
        raise ValueError(f"Unknown discipline {discipline}")
