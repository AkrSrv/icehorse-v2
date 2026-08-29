import os
import re
import json
import glob
import pypdf

PDF_DIR = "/Users/arno/AI Udvikling/antigravity/dressurprogrammer_pdf"
OUTPUT_JSON = "/Users/arno/AI Udvikling/antigravity/scratch/icehorse-v2.1/backend/drf_dressage_templates.json"

def clean_text(t):
    if not t:
        return ""
    t = re.sub(r'[ 	]+', ' ', t)
    return t.strip()

def parse_protocol_pdf(filepath):
    filename = os.path.basename(filepath)
    reader = pypdf.PdfReader(filepath)
    pages_text = []
    for page in reader.pages:
        txt = page.extract_text()
        if txt:
            pages_text.append(txt)
    full_text = chr(10).join(pages_text)
    
    base_name = os.path.splitext(filename)[0]
    base_name = re.sub(r' V\d+', '', base_name)
    base_name = re.sub(r' - \d{6,}', '', base_name)
    
    code = base_name.replace("DRF ", "").replace("DRFLA6_", "LA6 ").replace("STIL CUP - DRF ", "STIL-").replace("STILCUP ", "STIL-")
    code = code.split(" 2025")[0].split(" 2026")[0].strip()
    
    arena = "A" if (" - A" in filename or "BaneA" in filename or "_A" in filename or "HEST" in filename) else ("B" if (" - B" in filename or "BaneB" in filename or "_B" in filename or "PONY" in filename) else "A")
    
    lines = [line.strip() for line in full_text.splitlines() if line.strip()]
    
    exercises = []
    collective_marks = []
    
    in_collective = False
    in_guidelines = False
    current_ex = None
    
    for line in lines:
        if "Karakterer for samlet indtryk" in line or "SAMLET INDTRYK" in line.upper():
            if current_ex:
                exercises.append(current_ex)
                current_ex = None
            in_collective = True
            continue
            
        if "GUIDELINES" in line or "Fradrag" in line or "Fejlridning" in line:
            if current_ex:
                if in_collective:
                    collective_marks.append(current_ex)
                else:
                    exercises.append(current_ex)
                current_ex = None
            in_guidelines = True
            
        if in_guidelines:
            continue
            
        if in_collective:
            m_col = re.match(r'^(\d)\s+([A-ZÆØÅ\s\-]+):?\s*(.*)$', line)
            if m_col:
                if current_ex:
                    collective_marks.append(current_ex)
                col_num = int(m_col.group(1))
                col_name = clean_text(m_col.group(2))
                col_desc = clean_text(m_col.group(3))
                current_ex = {
                    "sequence": col_num,
                    "code": f"COL_{col_num}",
                    "name": col_name,
                    "description": col_desc,
                    "coefficient": 1,
                    "maxMark": 10,
                    "allowedIncrement": 0.5,
                    "is_collective": True
                }
            elif current_ex:
                if line.strip() in ['1', '2', '3', '4', '5']:
                    current_ex["coefficient"] = int(line.strip())
                else:
                    current_ex["description"] = clean_text(current_ex["description"] + " " + line)
            continue
            
        m_ex = re.match(r'^(\d{1,2})\s+([A-Z\(\)\&\/\-\s]{1,10})\s+(.+)$', line)
        m_ex_simple = re.match(r'^(\d{1,2})\s+(.+)$', line)
        
        if m_ex and int(m_ex.group(1)) == (len(exercises) + 1):
            if current_ex:
                exercises.append(current_ex)
            seq = int(m_ex.group(1))
            loc = clean_text(m_ex.group(2))
            desc = clean_text(m_ex.group(3))
            current_ex = {
                "sequence": seq,
                "code": f"EX_{seq}",
                "letter": loc,
                "name": f"{loc} - {desc}" if loc else desc,
                "description": desc,
                "directives": [],
                "coefficient": 1,
                "maxMark": 10,
                "allowedIncrement": 0.5
            }
        elif m_ex_simple and int(m_ex_simple.group(1)) == (len(exercises) + 1):
            if current_ex:
                exercises.append(current_ex)
            seq = int(m_ex_simple.group(1))
            desc = clean_text(m_ex_simple.group(2))
            current_ex = {
                "sequence": seq,
                "code": f"EX_{seq}",
                "letter": "",
                "name": desc,
                "description": desc,
                "directives": [],
                "coefficient": 1,
                "maxMark": 10,
                "allowedIncrement": 0.5
            }
        elif current_ex:
            if line.strip() in ['2', '3'] and len(line.strip()) == 1:
                current_ex["coefficient"] = int(line.strip())
            elif "Anvisninger" in line or "Point" in line or "Koefficient" in line or "Side " in line or "Equipe" in line or "St.No" in line:
                continue
            else:
                if len(current_ex["directives"]) < 3:
                    current_ex["directives"].append(clean_text(line))
                else:
                    current_ex["description"] = clean_text(current_ex["description"] + " " + line)

    if current_ex:
        if in_collective:
            collective_marks.append(current_ex)
        else:
            exercises.append(current_ex)

    if not collective_marks:
        collective_marks = [
            {"sequence": 1, "code": "COL_1", "name": "Gangarter", "description": "Renhed, regelmæssighed, frihed og smidighed", "coefficient": 1, "maxMark": 10, "allowedIncrement": 0.5, "is_collective": True},
            {"sequence": 2, "code": "COL_2", "name": "Spændstighed & Sving", "description": "Energi, afskub, smidighed og bæring", "coefficient": 2, "maxMark": 10, "allowedIncrement": 0.5, "is_collective": True},
            {"sequence": 3, "code": "COL_3", "name": "Eftergivenhed & Ridelighed", "description": "Sug på biddet, accept af hjælperne", "coefficient": 2, "maxMark": 10, "allowedIncrement": 0.5, "is_collective": True},
            {"sequence": 4, "code": "COL_4", "name": "Rytterens Opstilling & Indvirkning", "description": "Korrekt opstilling, balance og hjælpernes finhed", "coefficient": 2, "maxMark": 10, "allowedIncrement": 0.5, "is_collective": True}
        ]

    all_scoring_items = []
    seq_counter = 1
    for ex in exercises:
        ex["sequence"] = seq_counter
        ex["directiveIdeas"] = ex.get("directives", [])
        all_scoring_items.append(ex)
        seq_counter += 1
        
    for col in collective_marks:
        col_copy = dict(col)
        col_copy["sequence"] = seq_counter
        col_copy["directiveIdeas"] = [col_copy.get("description", "")]
        all_scoring_items.append(col_copy)
        seq_counter += 1

    max_points = sum(item.get("maxMark", 10) * item.get("coefficient", 1) for item in all_scoring_items)

    config = {
        "program_code": code,
        "program_name": base_name,
        "arena_size": arena,
        "arena_dimensions": "20x60m (Bane A)" if arena == "A" else "20x40m (Bane B)",
        "source_pdf": filename,
        "officialResultDecimals": 2,
        "maximumPoints": max_points,
        "exercise_count": len(exercises),
        "collective_count": len(collective_marks),
        "exercises": all_scoring_items,
        "deductions_rules": {
            "error_1": {"penalty_points": 2, "penalty_percent": 0.5, "description": "1. gang fejlridning (-2 point)"},
            "error_2": {"penalty_points": 4, "penalty_percent": 1.0, "description": "2. gang fejlridning (-4 point)"},
            "error_3": {"elimination": True, "description": "3. gang fejlridning (Diskvalifikation)"}
        }
    }
    
    return {
        "discipline": "dressage",
        "code": code,
        "name": f"{base_name} ({arena})",
        "scoring_model": "dressage_percentage",
        "configuration": config
    }

def main():
    files = sorted(glob.glob(os.path.join(PDF_DIR, "*.pdf")) + glob.glob(os.path.join(PDF_DIR, "*.PDF")))
    templates = []
    
    print(f"Parsing {len(files)} DRF dressage protocol PDF files...")
    
    for f in files:
        fname = os.path.basename(f)
        if "bane" in fname.lower() or "parlør" in fname.lower():
            continue
        try:
            tpl = parse_protocol_pdf(f)
            if tpl and tpl["configuration"]["exercises"]:
                templates.append(tpl)
                print(f"✓ Parsed: {tpl['name']} ({tpl['configuration']['exercise_count']} øvelser, {tpl['configuration']['collective_count']} samlet indtryk, maks {tpl['configuration']['maximumPoints']} point)")
        except Exception as e:
            print(f"✗ Failed {fname}: {e}")
            
    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as out:
        json.dump(templates, out, ensure_ascii=False, indent=2)
    print(f"Successfully generated {len(templates)} DRF dressage class templates in {OUTPUT_JSON}!")

if __name__ == "__main__":
    main()
