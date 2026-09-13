import os
import re
import imaplib
import email
from email.header import decode_header
from email.utils import parseaddr, parsedate_to_datetime
from datetime import datetime
import models

def get_env_val(key, default=""):
    val = os.environ.get(key)
    if val:
        return val
    # Fallback to .env files
    for p in [".env", "../.env", "/app/.env"]:
        if os.path.exists(p):
            try:
                with open(p) as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith(f"{key}="):
                            return line.split("=", 1)[1].strip().strip('"').strip("'")
            except Exception:
                pass
    return default

IMAP_SERVER = get_env_val("IMAP_SERVER", "mail.simply.com")
IMAP_PORT = int(get_env_val("IMAP_PORT", "993"))
IMAP_USERNAME = get_env_val("SMTP_USERNAME", "arno@alkdata.dk")
IMAP_PASSWORD = get_env_val("SMTP_PASSWORD", "Buster&&1234")

def decode_mime_words(s):
    if not s:
        return ""
    decoded_fragments = decode_header(s)
    pieces = []
    for fragment, encoding in decoded_fragments:
        if isinstance(fragment, bytes):
            try:
                pieces.append(fragment.decode(encoding or 'utf-8', errors='replace'))
            except Exception:
                pieces.append(fragment.decode('latin1', errors='replace'))
        else:
            pieces.append(str(fragment))
    return "".join(pieces)

def extract_clean_body(msg):
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))
            if content_type == "text/plain" and "attachment" not in content_disposition:
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or 'utf-8'
                body = payload.decode(charset, errors='replace')
                break
        if not body:
            # Fallback til html hvis ingen plain text
            for part in msg.walk():
                content_type = part.get_content_type()
                if content_type == "text/html":
                    payload = part.get_payload(decode=True)
                    charset = part.get_content_charset() or 'utf-8'
                    html = payload.decode(charset, errors='replace')
                    # Meget simpel tag stripper
                    body = re.sub(r'<[^>]+>', '', html)
                    break
    else:
        payload = msg.get_payload(decode=True)
        charset = msg.get_content_charset() or 'utf-8'
        body = payload.decode(charset, errors='replace')

    if not body:
        return ""

    # Fjern tidligere citeret historik (fx "> Citeret tekst" eller "Den søn. 13. sep. ... skrev:")
    lines = body.splitlines()
    clean_lines = []
    for line in lines:
        stripped = line.strip()
        # Typiske citat-start linjer
        if stripped.startswith(">"):
            continue
        if re.match(r'^(Den|On|Fra|From|---)\s.*(skrev|wrote|Oprindelig|Original):?', stripped, re.IGNORECASE):
            break
        if stripped == "----------------------------------------":
            break
        clean_lines.append(line)

    return "\n".join(clean_lines).strip()

def sync_inbound_emails(db):
    """
    Tjekker Simply.com IMAP indbakke for svar på support-sager
    og tilknytter dem direkte til den relevante sag.
    """
    if not IMAP_USERNAME or not IMAP_PASSWORD:
        return {"imported": 0, "message": "IMAP legitimationsoplysninger mangler."}

    imported_count = 0
    imported_details = []

    try:
        mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)
        mail.login(IMAP_USERNAME, IMAP_PASSWORD)
        mail.select("INBOX")

        # Søg efter alle beskeder eller de seneste 50
        status, search_data = mail.search(None, "ALL")
        if status != "OK" or not search_data[0]:
            mail.logout()
            return {"imported": 0, "message": "Ingen mails fundet i indbakken."}

        msg_ids = search_data[0].split()
        # Tjek de seneste 30 beskeder for effektivitet
        recent_ids = msg_ids[-30:]

        for m_id in reversed(recent_ids):
            try:
                res, data = mail.fetch(m_id, "(RFC822)")
                if res != "OK":
                    continue

                raw_email = data[0][1]
                msg = email.message_from_bytes(raw_email)

                subject = decode_mime_words(msg["Subject"])
                from_header = decode_mime_words(msg["From"])
                from_name, from_email = parseaddr(from_header)

                # Ignorer mails sendt af systemet selv
                if from_email.lower() in [IMAP_USERNAME.lower(), "equievent_support@alkdata.dk"]:
                    continue

                # Led efter Ticket ID i emnefeltet: fx "[Ticket #12]" eller "[#12]" eller "Ticket #12"
                ticket_match = re.search(r'(?:\[Ticket\s*#|\[#|Ticket\s*#)\s*(\d+)', subject, re.IGNORECASE)
                clean_text = extract_clean_body(msg)
                if not ticket_match and clean_text:
                    ticket_match = re.search(r'(?:\[Ticket\s*#|\[#|Ticket\s*#)\s*(\d+)', clean_text, re.IGNORECASE)

                if not ticket_match:
                    continue

                ticket_id = int(ticket_match.group(1))

                # Tjek om sagen findes i databasen
                ticket = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
                if not ticket:
                    continue

                if not clean_text:
                    continue

                # Tjek om beskeden allerede er importeret (undgå dubletter)
                existing_msg = db.query(models.SupportMessage).filter(
                    models.SupportMessage.ticket_id == ticket_id,
                    models.SupportMessage.message == clean_text
                ).first()

                if existing_msg:
                    continue

                # Bestem dato
                msg_date = datetime.utcnow()
                date_header = msg.get("Date")
                if date_header:
                    try:
                        parsed_dt = parsedate_to_datetime(date_header)
                        if parsed_dt:
                            msg_date = parsed_dt.replace(tzinfo=None)
                    except Exception:
                        pass

                # Opret support_message
                new_msg = models.SupportMessage(
                    ticket_id=ticket.id,
                    sender_type="customer",
                    sender_name=from_name or ticket.name or from_email,
                    sender_email=from_email,
                    message=clean_text,
                    created_at=msg_date
                )
                db.add(new_msg)

                # Opdater sagens status til 'Modtaget svar'
                ticket.status = "Modtaget svar"
                ticket.updated_at = datetime.utcnow()
                db.commit()

                imported_count += 1
                imported_details.append({
                    "ticket_id": ticket_id,
                    "sender": from_name or from_email,
                    "subject": subject
                })

                # Marker som læst på serveren
                mail.store(m_id, '+FLAGS', '\\Seen')

            except Exception as item_err:
                print(f"Fejl ved behandling af mail {m_id}: {item_err}")
                continue

        mail.logout()
        return {
            "imported": imported_count,
            "details": imported_details,
            "message": f"{imported_count} nye svar blev indlæst i sagerne." if imported_count > 0 else "Indbakken er synkroniseret – ingen nye svar fundet."
        }

    except Exception as e:
        print(f"IMAP SYNC FEJL: {e}")
        return {"imported": 0, "error": str(e), "message": f"Forbindelsesfejl til mailserver: {e}"}
