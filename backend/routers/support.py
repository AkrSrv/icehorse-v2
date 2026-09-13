import os
import re
import json
import uuid
import base64
import urllib.request
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Header, Query, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from email_service import send_support_ticket_email
from database import SessionLocal
import models

router = APIRouter(prefix="/support", tags=["Support"])

UPLOAD_DIR = os.getenv("SUPPORT_UPLOAD_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads", "support_attachments"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

def cleanup_expired_attachments(db):
    """
    Sletter vedhæftede filer på sager, der har været løst i mere end 8 dage.
    """
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=8)
        expired_tickets = db.query(models.SupportTicket).filter(
            models.SupportTicket.status == "Løst",
            models.SupportTicket.resolved_at != None,
            models.SupportTicket.resolved_at <= cutoff_date,
            models.SupportTicket.attachment_path != None
        ).all()

        for t in expired_tickets:
            file_path = os.path.join(UPLOAD_DIR, t.attachment_path)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    print(f"Fejl ved sletning af udløbet fil {file_path}: {e}")
            del_note = f"\n[System {datetime.utcnow().strftime('%d-%m-%Y %H:%M')}: Vedhæftet fil ({t.attachment_filename or 'billede'}) blev automatisk slettet jf. 8-dages reglen for løste sager]"
            t.internal_notes = (t.internal_notes or "") + del_note
            t.attachment_path = None
        if expired_tickets:
            db.commit()
    except Exception as e:
        print(f"Fejl under cleanup_expired_attachments: {e}")

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

SYSTEM_PROMPT = """Du er EquiEvent Support AI Assistent. Din opgave er UDELUKKENDE at hjælpe brugere, stævnearrangører, ryttere og dommere med at forstå og anvende stævnesystemet EquiEvent. Svar altid venligt, professionelt, pædagogisk, struktureret og på flydende dansk.

VIGTIG BEGRÆNSNING OG SIKKERHEDSREGEL:
Du må KUN besvare spørgsmål, der relaterer sig til hestestævnesystemet EquiEvent, hestesport (dressur, springning, islandske heste), regler i systemet, afholdelse af stævner og relaterede administrative opgaver for en rideklub.
Hvis brugeren stiller spørgsmål om helt andre emner (fx opskrifter, politik, kodning, andre softwareprogrammer), skal du høfligt afvise med:
"Jeg er en support-assistent dedikeret til hestestævnesystemet EquiEvent. Jeg kan desværre kun besvare spørgsmål relateret til EquiEvent. Til generelle spørgsmål om andre emner bedes du benytte en anden AI-assistent."

KONTAKT TIL MENNESKELIG SUPPORT:
Hvis brugeren efterspørger personlig support, kontakt til udvikleren/virksomheden eller har henvendelser/fejl, der kræver direkte menneskelig håndtering, skal du henvise til:
- E-mail: equievent_support@alkdata.dk
- Oplys altid: "Henvendelser via e-mail besvares inden for max 3 arbejdsdage."

=============================================================================
KOMPLET VIDENSBASE FOR EQUIEVENT (ALLE MODULER OG FUNKTIONER):
=============================================================================

1. PROFIL, REGISTRERING & KLUBADMINISTRATION:
- Opret klub (TC-01): På forsiden klikkes på "Opret ny klub". Udfyld Klubbens Navn, E-mail og Adgangskode. Systemet opretter klubben og logger automatisk ind.
- Login & Logout (TC-02): Sikker adgangskontrol med JWT tokens. Log ud via menuen øverst til højre.
- Glemt adgangskode (TC-03): Klik på "Glemt adgangskode?" på loginsiden for at få tilsendt et sikkert nulstillingslink på e-mail.
- Klubprofil (TC-04): Under "Profil" i menuen kan klubbens adresse, kontaktperson, telefon og e-mail opdateres og gemmes via "Gem Profil". Disse oplysninger fremgår af officielle diplomer.
- Flere klubber / Multiklub (TC-05 & TC-06): Under "Profil" kan der oprettes ekstra klubber under samme login ("Tilknyt endnu en klub"). Skift aktiv klub lynhurtigt via "Skift Klub" øverst til højre uden at logge ud.

2. PERSONKARTOTEK (RYTTERE, HESTE & DOMMERE):
- Ryttere & Heste (TC-07 & TC-08): Gå til "Personkartotek" -> Klik "+ Opret Ny" under Ryttere. Udfyld navn, e-mail og telefon, og tryk "Gem Stamdata". Knyt derefter én eller flere heste til rytteren i bunden af rytterkortet. En rytter kan have ubegrænset antal heste tilknyttet.
- Rediger & Slet (TC-09 & TC-10): Klik på blyanten for at rette kontaktoplysninger eller skraldespanden for at slette en ekvipage.
- Dommere (TC-11 & TC-12): Opret dommere under Personkartotek med Navn, E-mail (påkrævet til Magic Link) og Telefon. Dommerne kan genbruges til alle fremtidige stævner.
- Søgning (TC-13): Realtidssøgning over rytterlisten filtrerer prompte for hvert tastetryk på både rytter- og hestenavne.

3. POSTER & KLASSER (DE 3 FANBLADE):
Siden "Poster / Klasser" er opdelt i 3 specialiserede fanblade:
- Fanblad 1: "Opret mine egne klasser / poster" (TC-16, TC-17 & TC-18):
  * Dressur: Opret øvelser med bogstaver (fx A, C, M), anvisninger, instruktioner og koefficienter (fx x2). Systemet regner automatisk procent og opnåede point.
  * Spring: Opret forhindringer/spring og vælg scoring (Fejl & Tid, Stilspringning eller Omspringning).
  * Islænder: Opret opgavedele/sektioner (fx Arbejdstølt, Hurtigtølt, Skridt) med vægtning (1-3) og rækkefølge.
  * Oprettelsen er sikret mod dubletter og synkroniseres automatisk til klubbens aktive poster.
- Fanblad 2: "Klasser/Poster som anvendes i min klub" (TC-19, TC-20 & TC-21):
  * Brug filterknapperne (Dressur, Spring, Islænder) til at isolere klasserne.
  * Klik "Deaktivér" for at sætte en klasse inaktiv (gråes ud og skjules fra nye stævner uden at slette historik).
  * Klik "Aktivér" for at gøre den valgbar til stævner igen.
- Fanblad 3: "Tilpasning af standard klasseskabeloner & Massehandlinger" (TC-22, TC-23 & TC-24):
  * Vælg en standard DRF/DI-skabelon (fx LD1, LC1, LB1) og tilpas øvelser for klubben.
  * MASSEHANDLINGER (Bulk Actions): Sæt tjekmærke i tjekboksene ud for de ønskede øvelser/spring og klik "Slet valgte (X)" eller "Deaktivér valgte (X)" for at udføre ændringen samlet med ét klik.

4. STÆVNEOPSÆTNING & STARTLISTER:
- Opret stævne (TC-25): Gå til "Stævner" -> "+ Nyt Stævne". Indtast Navn, Dato, Tid, Sted og Hoveddisciplin.
- Knyt klasser til stævnet (TC-26): Vælg fanen "Klasser / Poster" i stævneadgangen. Klasserne vises grupperet efter disciplin. Sæt flueben og klik "Gem Valgte Klasser" (hver klasse vises kun 1 gang).
- Tilmeld ekvipager & Startnumre (TC-27 & TC-31): Vælg fanen "Tilknyttede Ryttere". Vælg rytter, hest, klasse og tildel startnummer (fx 101, 102...).
- Tildel dommere & Magic Links (TC-28, TC-29 & TC-30): Vælg fanen "Tilknyttede Dommere & Poster". Vælg dommer, tildel rolle (fx Hoveddommer) og sæt flueben i de klasser, dommeren skal dømme. Klik "Send Magic Link" for at sende en direkte e-mail, eller klik "Kopiér Link" for at dele det manuelt.

5. BETALING, AKTIVERING & DOMMERLÅS:
- Inaktivitetslås FØR betaling (TC-34 & TC-35): Stævner kan opsættes helt gratis. Før stævnet er aktiveret/betalt, viser dommerpanelet en rød advarselsbadge ("⚠️ Stævne ikke aktiveret"), en infobjælke og en GRÅET/LÅST "Gem Resultat"-knap, så dommere ikke kan indsende point før tid.
- Betaling & Aktivering (TC-36 & TC-37): Klik "Aktivér & Betal Stævne" i klubbens stævneoversigt (299 kr per stævne, gyldigt indtil 14 dage efter stævnedagen). Rabatkuponer kan indtastes for rabat eller gratis aktivering (0 kr).
- LIVE OPLÅSNING (TC-38): I samme sekund klubben betaler, FORSVINDER advarselsbadgen automatisk hos dommeren, og Gem-knappen bliver grøn og aktiv UDEN at dommeren behøver genindlæse siden!

6. LIVE DOMMERAFVIKLING (ALLE DISCIPLINER):
- Dommeren tilgår systemet via sit Magic Link direkte i mobilens browser uden kodeord eller app-download (TC-40).
- DRESSURBEDØMMELSE (TC-41 til TC-45):
  * Dommeren vælger rytter og giver karakterer 0.0 - 10.0 med halve point (fx 6.5, 7.0, 7.5). Koefficienter (x2) ganges automatisk i højre kolonne.
  * Fejlridning: Dropdown med 1. gang (-2 p) eller 2. gang (-6 p) fradrag trækkes automatisk.
  * Delkommentarer pr. øvelse gemmes og opsummeres med øvelsesnummer sammen med den generelle dommerkommentar.
  * LIVE PROCENT & POINT: Bunden af skemaet viser øjeblikkeligt både procent og opnåede point ud af maksimum, fx "85.91 % (171.8 p)".
- SPRINGBEDØMMELSE (TC-46, TC-47 & TC-48):
  * Registrering af nedslag (hver 4 fejl), refuseringer og ridetid i sekunder (fx "4 fejl - 64.2s").
  * Omspringning: Separat registrering af omspringningsfejl og omspringningstid.
  * Status: Fejlfri (Clear), Elimineret (ELI) eller Udgået (RET).
- ISLÆNDERBEDØMMELSE (TC-49):
  * Delkarakterer 0-10 for hver opgavedel/gangart og automatisk vægtet gennemsnitsberegning.
- Rette en bedømmelse (TC-50): Dommeren kan vælge en allerede bedømt ekvipage under "Seneste bedømmelser", rette en karakter og gemme på ny.

7. RESULTATER, LIVE LEADERBOARD, DIPLOMER & EKSPORT:
- Public Live Leaderboard (TC-51): Førende ekvipager fremhæves automatisk med 🥇 Guld, 🥈 Sølv og 🥉 Bronze medaljer. Ranglisten opdateres i realtid uden forsinkelse.
- DRESSUR: VISNING AF BÅDE % OG POINT (TC-52): På scorelisten og leaderboardet præsenteres dressurresultater altid med både procent og samlede opnåede point, fx: 85.91% (171.8 p) eller 68.50% (137.0 p).
- Fold-ud dommerdetaljer (TC-53): Klik på et rytterkort for at se dommernavne, delkarakterer, fejlfradrag og fulde kommentarer.
- PRINT DIPLOM (TC-54): Fold rytterens resultat ud og klik "Print Diplom". Der åbnes et flot, officielt A4-diplom med stævnenavn, rytter, hest, officiel placering, samlet resultat (% og point) samt dommerens kommentarer.
- CSV Eksport (TC-56): Klik "Eksporter CSV" under stævnets resultater for at downloade alle placeringer og resultater til Microsoft Excel eller Google Sheets.

Giv altid klare, punktvise vejledninger, og henvis venligt til knapperne og fanerne i systemet.
"""

@router.post("/chat")
def support_chat(req: ChatRequest):
    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")
    
    if not openai_key and not gemini_key:
        return {"response": "Systemets AI-support er klar, men der mangler at blive indsat en API-nøgle (OPENAI_API_KEY eller GEMINI_API_KEY) i serverens .env fil."}
        
    if openai_key:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for msg in req.messages:
            role = msg.role
            if role in ["model", "assistant"]:
                role = "assistant"
            messages.append({"role": role, "content": msg.content})

        url = "https://api.openai.com/v1/chat/completions"
        data = {
            "model": "gpt-4o-mini",
            "messages": messages,
            "temperature": 0.3
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {openai_key}"
        }
        try:
            req_data = json.dumps(data).encode("utf-8")
            request = urllib.request.Request(url, data=req_data, headers=headers, method="POST")
            with urllib.request.urlopen(request, timeout=15) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                reply = res_data["choices"][0]["message"]["content"]
                return {"response": reply}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"OpenAI error: {str(e)}")
            
    elif gemini_key:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
        
        contents = []
        system_instruction = {"parts": [{"text": SYSTEM_PROMPT}]}
        
        for msg in req.messages:
            role = msg.role
            if role in ["assistant", "model"]:
                role = "model"
            contents.append({
                "role": role,
                "parts": [{"text": msg.content}]
            })
            
        data = {
            "contents": contents,
            "systemInstruction": system_instruction,
            "generationConfig": {
                "temperature": 0.3
            }
        }
        try:
            req_data = json.dumps(data).encode("utf-8")
            request = urllib.request.Request(url, data=req_data, headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(request, timeout=15) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                reply = res_data["candidates"][0]["content"]["parts"][0]["text"]
                return {"response": reply}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Gemini error: {str(e)}")

class ContactSupportRequest(BaseModel):
    name: str
    email: str
    subject: str
    message: str
    club_name: Optional[str] = None
    source_system: Optional[str] = "EquiEvent"
    priority: Optional[str] = "Normal"
    attachment_base64: Optional[str] = None
    attachment_name: Optional[str] = None

class UpdateTicketRequest(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    internal_notes: Optional[str] = None

class CreateManualTicketRequest(BaseModel):
    source_system: Optional[str] = "EquiEvent"
    name: str
    email: str
    subject: str
    message: str
    club_name: Optional[str] = None
    status: Optional[str] = "Ny"
    priority: Optional[str] = "Normal"
    internal_notes: Optional[str] = None

def check_admin_access(x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"), password: Optional[str] = Query(None)):
    token = x_admin_key or password
    if token == "SommerHaar2026":
        return True
    raise HTTPException(status_code=401, detail="Ugyldig adgangskode.")

@router.post("/contact")
def submit_contact_support(req: ContactSupportRequest):
    if not req.name or not req.email or not req.message:
        raise HTTPException(status_code=400, detail="Navn, e-mail og besked skal udfyldes.")
    
    src = req.source_system.strip() if req.source_system else "EquiEvent"
    name = req.name.strip()
    email = req.email.strip()
    subject = req.subject.strip() if req.subject else "Supporthenvendelse"
    message = req.message.strip()
    club_name = req.club_name.strip() if req.club_name else None
    priority = req.priority.strip() if req.priority else "Normal"
    
    # Valider og gem vedhæftet billede (maks 5 MB)
    attachment_filename = None
    attachment_path = None
    attachment_size = None
    attachment_mimetype = None
    saved_disk_path = None

    if req.attachment_base64 and req.attachment_base64.strip():
        b64_str = req.attachment_base64.strip()
        mimetype = "image/png"
        if b64_str.startswith("data:") and ";base64," in b64_str:
            head, b64_str = b64_str.split(";base64,", 1)
            mimetype = head.replace("data:", "").strip()
        
        try:
            raw_bytes = base64.b64decode(b64_str)
        except Exception:
            raise HTTPException(status_code=400, detail="Det vedhæftede billede er i et ugyldigt format.")

        MAX_BYTES = 5 * 1024 * 1024  # 5 MB
        if len(raw_bytes) > MAX_BYTES:
            raise HTTPException(status_code=400, detail="Det vedhæftede billede er for stort (maks. 5 MB).")

        orig_name = req.attachment_name.strip() if req.attachment_name else "skaermbillede.png"
        ext = os.path.splitext(orig_name)[1].lower()
        if ext not in [".png", ".jpg", ".jpeg", ".webp", ".gif"]:
            if raw_bytes.startswith(b"\x89PNG"):
                ext = ".png"
                mimetype = "image/png"
            elif raw_bytes.startswith(b"\xff\xd8"):
                ext = ".jpg"
                mimetype = "image/jpeg"
            elif raw_bytes.startswith(b"GIF8"):
                ext = ".gif"
                mimetype = "image/gif"
            elif raw_bytes.startswith(b"RIFF") and b"WEBP" in raw_bytes[:16]:
                ext = ".webp"
                mimetype = "image/webp"
            else:
                ext = ".png"
                mimetype = "image/png"

        unique_file = f"ticket_att_{uuid.uuid4().hex[:12]}{ext}"
        saved_disk_path = os.path.join(UPLOAD_DIR, unique_file)
        try:
            with open(saved_disk_path, "wb") as f:
                f.write(raw_bytes)
            attachment_filename = orig_name
            attachment_path = unique_file
            attachment_size = len(raw_bytes)
            attachment_mimetype = mimetype
        except Exception as write_err:
            print(f"Fejl ved lagring af vedhæftet billede: {write_err}")
            saved_disk_path = None

    # 1. Gem i databasen
    ticket_id = None
    try:
        db = SessionLocal()
        ticket = models.SupportTicket(
            source_system=src,
            name=name,
            email=email,
            subject=subject,
            message=message,
            club_name=club_name,
            status="Ny",
            priority=priority,
            attachment_filename=attachment_filename,
            attachment_path=attachment_path,
            attachment_size=attachment_size,
            attachment_mimetype=attachment_mimetype
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        ticket_id = ticket.id

        # Opret første besked i samtale-tråden
        init_msg = models.SupportMessage(
            ticket_id=ticket.id,
            sender_type="customer",
            sender_name=name,
            sender_email=email,
            message=message
        )
        db.add(init_msg)
        db.commit()
        db.close()
    except Exception as e:
        print(f"Fejl ved oprettelse af support_ticket i DB: {e}")

    # 2. Send email notifikation til support og kvittering til bruger
    try:
        send_support_ticket_email(
            name=name,
            email=email,
            subject=subject,
            message=message,
            club_name=club_name or "",
            source_system=src,
            ticket_id=ticket_id,
            attachment_file_path=saved_disk_path,
            attachment_filename=attachment_filename
        )
    except Exception as e:
        print(f"Fejl ved afsendelse af support email: {e}")
    
    return {
        "status": "success",
        "ticket_id": ticket_id,
        "message": "Din henvendelse er modtaget. Skriftlige henvendelser besvares inden for max 3 arbejdsdage."
    }

@router.get("/tickets")
def list_support_tickets(
    source: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("date_desc"),
    auth: bool = Depends(check_admin_access)
):
    db = SessionLocal()
    try:
        cleanup_expired_attachments(db)
        query = db.query(models.SupportTicket)
        
        # Filtre
        if source and source != "Alle":
            query = query.filter(models.SupportTicket.source_system == source)
            
        if status and status != "Alle":
            if status in ["Aabne", "Aktive", "aktive", "aabne"]:
                query = query.filter(models.SupportTicket.status.in_(["Ny", "I gang", "Modtaget svar"]))
            elif status in ["Arkiv", "arkiv", "Løst", "loest"]:
                query = query.filter(models.SupportTicket.status == "Løst")
            else:
                query = query.filter(models.SupportTicket.status == status)
        elif not status:
            # Standard visning: Vis kun aktive opgaver (løste sager ligger i arkivet)
            query = query.filter(models.SupportTicket.status.in_(["Ny", "I gang", "Modtaget svar"]))
                
        if search:
            term = f"%{search.strip().lower()}%"
            query = query.filter(
                (models.SupportTicket.name.ilike(term)) |
                (models.SupportTicket.email.ilike(term)) |
                (models.SupportTicket.subject.ilike(term)) |
                (models.SupportTicket.message.ilike(term)) |
                (models.SupportTicket.club_name.ilike(term))
            )
            
        # Sortering
        if sort_by == "date_asc":
            query = query.order_by(models.SupportTicket.created_at.asc())
        elif sort_by == "user_asc":
            query = query.order_by(models.SupportTicket.name.asc())
        elif sort_by == "user_desc":
            query = query.order_by(models.SupportTicket.name.desc())
        elif sort_by == "source":
            query = query.order_by(models.SupportTicket.source_system.asc(), models.SupportTicket.created_at.desc())
        else:
            query = query.order_by(models.SupportTicket.created_at.desc())
            
        tickets = query.all()
        
        # Beregn samlet statistik for hurtig overblik
        all_tickets = db.query(models.SupportTicket).all()
        stats = {
            "total": len(all_tickets),
            "new_count": sum(1 for t in all_tickets if t.status == "Ny"),
            "replied_count": sum(1 for t in all_tickets if t.status == "Modtaget svar"),
            "in_progress_count": sum(1 for t in all_tickets if t.status == "I gang"),
            "active_count": sum(1 for t in all_tickets if t.status in ["Ny", "I gang", "Modtaget svar"]),
            "resolved_count": sum(1 for t in all_tickets if t.status == "Løst"),
            "sources": sorted(list(set(t.source_system for t in all_tickets if t.source_system)))
        }
        
        ticket_items = []
        for t in tickets:
            msgs = []
            if t.messages and len(t.messages) > 0:
                for m in t.messages:
                    msgs.append({
                        "id": m.id,
                        "sender_type": m.sender_type,
                        "sender_name": m.sender_name,
                        "sender_email": m.sender_email,
                        "message": m.message,
                        "created_at": m.created_at.isoformat() if m.created_at else None
                    })
            else:
                msgs.append({
                    "id": 0,
                    "sender_type": "customer",
                    "sender_name": t.name,
                    "sender_email": t.email,
                    "message": t.message,
                    "created_at": t.created_at.isoformat() if t.created_at else None
                })

            days_until_del = None
            if t.attachment_path:
                if t.status == "Løst" and t.resolved_at:
                    elapsed = (datetime.utcnow() - t.resolved_at).total_seconds()
                    rem_sec = (8 * 86400) - elapsed
                    days_until_del = max(0, int(rem_sec // 86400))
                
            ticket_items.append({
                "id": t.id,
                "source_system": t.source_system,
                "name": t.name,
                "email": t.email,
                "subject": t.subject,
                "message": t.message,
                "club_name": t.club_name,
                "status": t.status,
                "priority": t.priority,
                "internal_notes": t.internal_notes,
                "attachment_filename": t.attachment_filename,
                "attachment_size": t.attachment_size,
                "attachment_mimetype": t.attachment_mimetype,
                "has_attachment": bool(t.attachment_path),
                "resolved_at": t.resolved_at.isoformat() if t.resolved_at else None,
                "days_until_file_deletion": days_until_del,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "updated_at": t.updated_at.isoformat() if t.updated_at else None,
                "messages": msgs
            })

        return {
            "tickets": ticket_items,
            "stats": stats
        }
    finally:
        db.close()

@router.patch("/tickets/{ticket_id}")
def update_support_ticket(ticket_id: int, req: UpdateTicketRequest, auth: bool = Depends(check_admin_access)):
    db = SessionLocal()
    try:
        ticket = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Opgave ikke fundet.")
            
        if req.status is not None:
            if req.status == "Løst" and ticket.status != "Løst":
                ticket.resolved_at = datetime.utcnow()
            elif req.status != "Løst":
                ticket.resolved_at = None
            ticket.status = req.status

        if req.priority is not None:
            ticket.priority = req.priority
        if req.internal_notes is not None:
            ticket.internal_notes = req.internal_notes
            # Hvis der skrives en intern note og status stadig er "Ny", rykkes sagen automatisk til "I gang"
            if req.status is None and ticket.status == "Ny":
                ticket.status = "I gang"
            
        ticket.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(ticket)
        return {
            "status": "success",
            "ticket": {
                "id": ticket.id,
                "status": ticket.status,
                "priority": ticket.priority,
                "internal_notes": ticket.internal_notes,
                "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None,
                "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None
            }
        }
    finally:
        db.close()

@router.delete("/tickets/{ticket_id}")
def delete_support_ticket(ticket_id: int, auth: bool = Depends(check_admin_access)):
    db = SessionLocal()
    try:
        ticket = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Opgave ikke fundet.")
        db.delete(ticket)
        db.commit()
        return {"status": "success", "message": "Opgaven er slettet."}
    finally:
        db.close()

@router.post("/tickets")
def create_manual_support_ticket(req: CreateManualTicketRequest, auth: bool = Depends(check_admin_access)):
    db = SessionLocal()
    try:
        ticket = models.SupportTicket(
            source_system=req.source_system or "EquiEvent",
            name=req.name,
            email=req.email,
            subject=req.subject,
            message=req.message,
            club_name=req.club_name,
            status=req.status or "Ny",
            priority=req.priority or "Normal",
            internal_notes=req.internal_notes
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)

        init_msg = models.SupportMessage(
            ticket_id=ticket.id,
            sender_type="admin" if (req.email == "arno@alkdata.dk" or req.name == "Arno") else "customer",
            sender_name=req.name,
            sender_email=req.email,
            message=req.message
        )
        db.add(init_msg)
        db.commit()
        return {"status": "success", "ticket_id": ticket.id}
    finally:
        db.close()

class TicketReplyRequest(BaseModel):
    reply_message: str
    mark_as_resolved: Optional[bool] = True

@router.post("/tickets/{ticket_id}/reply")
def reply_to_ticket(ticket_id: int, req: TicketReplyRequest, auth: bool = Depends(check_admin_access)):
    if not req.reply_message or not req.reply_message.strip():
        raise HTTPException(status_code=400, detail="Svarbesked må ikke være tom.")
        
    db = SessionLocal()
    try:
        ticket = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Opgave ikke fundet.")
            
        # 1. Send mail direkte via SMTP
        from email_service import send_ticket_reply_email
        send_ticket_reply_email(
            to_email=ticket.email,
            recipient_name=ticket.name,
            subject=ticket.subject,
            reply_text=req.reply_message.strip(),
            original_message=ticket.message,
            source_system=ticket.source_system or "EquiEvent",
            ticket_id=ticket.id
        )
        
        # 2. Opret SupportMessage i tråden
        admin_msg = models.SupportMessage(
            ticket_id=ticket.id,
            sender_type="admin",
            sender_name="Arno L. Kristiansen",
            sender_email="arno@alkdata.dk",
            message=req.reply_message.strip()
        )
        db.add(admin_msg)
        
        # 3. Opdater ticket
        if req.mark_as_resolved:
            ticket.status = "Løst"
            ticket.resolved_at = datetime.utcnow()
        else:
            if ticket.status in ["Ny", "Modtaget svar"]:
                ticket.status = "I gang"
            ticket.resolved_at = None
            
        timestamp_str = datetime.utcnow().strftime("%d. %b %H:%M")
        reply_log = f"\n\n[SVAR SENDT {timestamp_str}]:\n{req.reply_message.strip()}"
        if ticket.internal_notes:
            ticket.internal_notes += reply_log
        else:
            ticket.internal_notes = reply_log.strip()
            
        ticket.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(ticket)
        
        # Hent opdaterede beskeder
        all_msgs = [
            {
                "id": m.id,
                "sender_type": m.sender_type,
                "sender_name": m.sender_name,
                "sender_email": m.sender_email,
                "message": m.message,
                "created_at": m.created_at.isoformat() if m.created_at else None
            }
            for m in ticket.messages
        ]
        
        return {
            "status": "success",
            "message": f"Svar er sendt til {ticket.email}",
            "ticket": {
                "id": ticket.id,
                "status": ticket.status,
                "internal_notes": ticket.internal_notes,
                "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None,
                "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
                "messages": all_msgs
            }
        }
    except Exception as e:
        print(f"Fejl ved afsendelse af svar til kunde: {e}")
        raise HTTPException(status_code=500, detail=f"Kunne ikke sende e-mail: {str(e)}")
    finally:
        db.close()

@router.post("/sync-emails")
def sync_support_emails(auth: bool = Depends(check_admin_access)):
    db = SessionLocal()
    try:
        from imap_service import sync_inbound_emails
        res = sync_inbound_emails(db)
        return res
    finally:
        db.close()

class CustomerReplyRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    message: str

@router.post("/tickets/{ticket_id}/customer-reply")
def customer_reply_to_ticket(ticket_id: int, req: CustomerReplyRequest):
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Besked må ikke være tom.")
    db = SessionLocal()
    try:
        ticket = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Opgave ikke fundet.")
        
        new_msg = models.SupportMessage(
            ticket_id=ticket.id,
            sender_type="customer",
            sender_name=req.name.strip() if req.name else ticket.name,
            sender_email=req.email.strip() if req.email else ticket.email,
            message=req.message.strip()
        )
        db.add(new_msg)
        ticket.status = "Modtaget svar"
        ticket.updated_at = datetime.utcnow()
        db.commit()
        return {"status": "success", "message": "Dit svar er modtaget i sagen."}
    finally:
        db.close()

@router.get("/tickets/{ticket_id}/attachment")
def get_ticket_attachment(ticket_id: int, auth: bool = Depends(check_admin_access)):
    db = SessionLocal()
    try:
        cleanup_expired_attachments(db)
        ticket = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
        if not ticket or not ticket.attachment_path:
            raise HTTPException(status_code=404, detail="Ingen vedhæftet fil fundet for denne opgave.")

        file_path = os.path.join(UPLOAD_DIR, ticket.attachment_path)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Billedfilen er ikke længere tilgængelig (slettet jf. 8-dages reglen for løste sager).")

        return FileResponse(
            path=file_path,
            filename=ticket.attachment_filename or "skaermbillede.png",
            media_type=ticket.attachment_mimetype or "image/png"
        )
    finally:
        db.close()



