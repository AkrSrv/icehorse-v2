import os
import smtplib
from email.message import EmailMessage
from datetime import datetime

def load_env_fallback():
    paths = [".env", "../.env", "/app/.env"]
    for path in paths:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            os.environ[k.strip()] = v.strip()
                break
            except Exception:
                pass

load_env_fallback()

SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.simply.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.environ.get("SMTP_FROM_EMAIL", "equievent_support@alkdata.dk")

def send_judge_magic_link_email(to_email: str, judge_name: str, comp_name: str, magic_link: str):
    if not SMTP_USERNAME or not SMTP_PASSWORD or not SMTP_FROM_EMAIL:
        # Hvis vi mangler miljøvariablerne, kaster vi en fejl
        raise Exception("Mail-opsætningen mangler på serveren. Kontakt support eller tjek dine indstillinger.")

    msg = EmailMessage()
    msg['Subject'] = f'Dit dommer-link til {comp_name}'
    msg['From'] = f"EquiEvent <{SMTP_FROM_EMAIL}>"
    msg['To'] = to_email

    # Plain text version (fallback, hvis deres mail-klient ikke understøtter HTML)
    text_content = f"""Kære {judge_name},

Du er blevet tilføjet som dommer til stævnet {comp_name}.
Klik på nedenstående link på din smartphone eller tablet for at åbne dommerpanelet og starte din bedømmelse:

{magic_link}

Dette link er unikt for dig og fungerer automatisk uden kodeord. Del det ikke med andre.

Bedste hilsner,
EquiEvent Teamet
"""

    # HTML version (Ser super professionel ud i en rigtig indbakke)
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #10b981;">Velkommen som dommer til {comp_name}!</h2>
        <p>Kære {judge_name},</p>
        <p>Du er klar til at dømme! Vi har bygget et super nemt system, som du bare åbner direkte i browseren på din telefon.</p>
        <p>Klik på knappen nedenfor for at logge ind i dit personlige dommerpanel:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{magic_link}" style="background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Åbn Dommerpanel</a>
        </div>
        <p style="font-size: 12px; color: #666;">Virker knappen ikke? Kopiér dette link ind i din browser:<br>{magic_link}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999;">Dette link er personligt og kræver ikke kodeord. Del det venligst ikke med andre.</p>
      </body>
    </html>
    """

    msg.set_content(text_content)
    msg.add_alternative(html_content, subtype='html')

    try:
        # Simply.com (og de fleste andre) kræver STARTTLS på port 587
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"SMTP FEJL: {e}")
        raise Exception(f"Kunne ikke sende mailen. Fejl fra udbyder: {str(e)}")

def send_password_reset_email(to_email: str, reset_link: str):
    if not SMTP_USERNAME or not SMTP_PASSWORD or not SMTP_FROM_EMAIL:
        raise Exception("Mail-opsætningen mangler på serveren.")

    msg = EmailMessage()
    msg['Subject'] = 'Nulstil din adgangskode til EquiEvent'
    msg['From'] = f"EquiEvent <{SMTP_FROM_EMAIL}>"
    msg['To'] = to_email

    text_content = f"""
Du har anmodet om at nulstille din adgangskode.
Klik på linket herunder for at vælge en ny adgangskode:

{reset_link}

Hvis du ikke har anmodet om dette, kan du blot ignorere denne email.
Linket udløber om 1 time.
"""

    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #3b82f6;">Nulstil din adgangskode</h2>
        <p>Vi har modtaget en anmodning om at nulstille adgangskoden til din EquiEvent konto.</p>
        <p>Klik på knappen nedenfor for at vælge en ny adgangskode:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{reset_link}" style="background-color: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Nulstil adgangskode</a>
        </div>
        <p style="font-size: 12px; color: #666;">Virker knappen ikke? Kopiér dette link ind i din browser:<br>{reset_link}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999;">Hvis du ikke har anmodet om dette, kan du blot ignorere denne email. Linket udløber om 1 time.</p>
      </body>
    </html>
    """

    msg.set_content(text_content)
    msg.add_alternative(html_content, subtype='html')

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"SMTP FEJL: {e}")
        raise Exception(f"Kunne ikke sende mailen: {str(e)}")

def send_invoice_email(to_email: str, club_name: str, comp_name: str, price: float, discount_code: str = None):
    if not SMTP_USERNAME or not SMTP_PASSWORD or not SMTP_FROM_EMAIL:
        raise Exception("Mail-opsætningen mangler på serveren. Kontakt support.")

    msg = EmailMessage()
    msg['Subject'] = f'Faktura/Kvittering - Aktivering af {comp_name}'
    msg['From'] = f"EquiEvent <{SMTP_FROM_EMAIL}>"
    msg['To'] = to_email

    discount_str = f"Rabatkode anvendt: {discount_code}" if discount_code else "Rabatkode: Ingen"
    invoice_number = f"INV-{datetime.utcnow().strftime('%Y%m%d')}-{comp_name[:3].upper()}"

    text_content = f"""Kære {club_name},
    
Tak for dit køb af aktiveringslicens til stævnet: {comp_name}.

Faktura nummer: {invoice_number}
Pris: {price:.2f} DKK (moms 25% inkludert)
{discount_str}

Stævnet er nu aktiveret og klar til afvikling.

Bedste hilsner,
EquiEvent Teamet
"""

    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background-color: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 30px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h2 style="color: #f43f5e; margin: 0; font-size: 24px; font-weight: bold;">EquiEvent</h2>
              <p style="font-size: 12px; color: #64748b; margin: 5px 0 0 0;">Faktura / Kvittering</p>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 14px; font-weight: bold; color: #0f172a;">{invoice_number}</span><br>
              <span style="font-size: 12px; color: #64748b;">Dato: {datetime.utcnow().strftime('%d.%m.%Y')}</span>
            </div>
          </div>
          
          <p>Kære <strong>{club_name}</strong>,</p>
          <p>Tak fordi du bruger EquiEvent! Din betaling for stævneaktivering er modtaget, og stævnet er nu fuldt aktiveret til pointafgivelse.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 25px 0;">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: left;">
                <th style="padding: 10px; border-bottom: 1px solid #cbd5e1; font-size: 14px;">Beskrivelse</th>
                <th style="padding: 10px; border-bottom: 1px solid #cbd5e1; font-size: 14px; text-align: right;">Beløb</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">
                  <strong>Aktivering af stævne:</strong> {comp_name}<br>
                  <span style="font-size: 12px; color: #64748b;">{discount_str}</span>
                </td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-size: 14px; text-align: right; font-weight: bold;">
                  {price:.2f} DKK
                </td>
              </tr>
              <tr style="font-weight: bold; font-size: 16px;">
                <td style="padding: 15px 10px; text-align: right;">Total inkl. moms:</td>
                <td style="padding: 15px 10px; text-align: right; color: #fbbf24;">{price:.2f} DKK</td>
              </tr>
            </tbody>
          </table>
          
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px; text-align: center; margin-top: 20px;">
            <p style="color: #166534; font-weight: bold; margin: 0; font-size: 14px;">✓ Betaling gennemført - stævnet er nu aktivt i 14 dage efter afvikling</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0 20px 0;">
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
            EquiEvent • Support: equievent_support@alkdata.dk • Tak for din tillid!
          </p>
        </div>
      </body>
    </html>
    """

    msg.set_content(text_content)
    msg.add_alternative(html_content, subtype='html')

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"SMTP FEJL (Faktura): {e}")
        raise Exception(f"Kunne ikke sende faktura-mailen: {str(e)}")

def send_support_ticket_email(name: str, email: str, subject: str, message: str, club_name: str = ""):
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        print("Mail-opsætningen mangler, logger henvendelse til konsol.")
        return False

    msg = EmailMessage()
    msg['Subject'] = f"[EquiEvent Support] {subject} - fra {name}"
    msg['From'] = f"EquiEvent Support <{SMTP_FROM_EMAIL}>"
    msg['To'] = f"arno@alkdata.dk, {SMTP_FROM_EMAIL}"
    msg['Reply-To'] = email

    text_content = f"""Ny supporthenvendelse modtaget via EquiEvent:

Afsender: {name}
E-mail: {email}
Klub: {club_name or 'Ikke angivet / Forside'}
Emne: {subject}
Tidspunkt: {datetime.now().strftime('%d/%m/%Y %H:%M')}

Besked:
----------------------------------------
{message}
----------------------------------------

Tip: Du kan svare afsenderen direkte ved at besvare denne mail.
"""

    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #0f172a; color: white; padding: 20px; border-radius: 10px 10px 0 0; border-bottom: 3px solid #f43f5e;">
          <h2 style="margin: 0; color: #ffffff; font-size: 20px;">🎧 Ny Supporthenvendelse</h2>
          <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 13px;">EquiEvent Kontaktformular</p>
        </div>
        
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-top: none; padding: 20px; border-radius: 0 0 10px 10px;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 13px; width: 100px;">Afsender:</td>
              <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">{name}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 13px;">E-mail:</td>
              <td style="padding: 6px 0;"><a href="mailto:{email}" style="color: #2563eb; font-weight: bold;">{email}</a></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Klub:</td>
              <td style="padding: 6px 0; color: #0f172a;">{club_name or 'Forsidehenvendelse'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Emne:</td>
              <td style="padding: 6px 0; font-weight: bold; color: #f43f5e;">{subject}</td>
            </tr>
          </table>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #38bdf8; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
            <p style="font-weight: bold; margin: 0 0 8px 0; font-size: 13px; color: #475569;">Besked:</p>
            <p style="margin: 0; white-space: pre-wrap; font-size: 14px; color: #1e293b;">{message}</p>
          </div>
          
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">
            Tip: Du kan svare afsenderen direkte ved at besvare denne mail (Reply-To er sat til {email}).
          </p>
        </div>
      </body>
    </html>
    """

    msg.set_content(text_content)
    msg.add_alternative(html_content, subtype='html')

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        
        # Send også automatisk kvitteringsmail til kunden
        try:
            ack_msg = EmailMessage()
            ack_msg['Subject'] = f"Vi har modtaget din henvendelse: {subject} - EquiEvent"
            ack_msg['From'] = f"EquiEvent Support <{SMTP_FROM_EMAIL}>"
            ack_msg['To'] = email
            
            ack_text = f"""Kære {name},

Tak for din henvendelse til EquiEvent Support vedrørende '{subject}'.

Vi har modtaget din besked og undersøger sagen. Vi bestræber os på at svare hurtigst muligt, og senest inden for 3 arbejdsdage.

Har du i mellemtiden brug for hurtig hjælp?
Prøv vores indbyggede AI Support Assistent på https://equievent.dk – den sidder klar 24/7 og kan besvare de fleste spørgsmål om stævner, koefficienter og dommeropsætning på få sekunder.

Med venlig hilsen,
EquiEvent Support
equievent_support@alkdata.dk
"""
            ack_msg.set_content(ack_text)
            server.send_message(ack_msg)
        except Exception as ack_err:
            print(f"Kunne ikke sende bekræftelsesmail til bruger: {ack_err}")
            
        server.quit()
        return True
    except Exception as e:
        print(f"SMTP FEJL ved support-henvendelse: {e}")
        return False
