import os
import re
import json
import base64
import urllib.request
import urllib.error

def normalize_msisdn(phone: str) -> int:
    """
    Renser og normaliserer et telefonnummer til internationalt MSISDN-format uden '+' eller '00'.
    Hvis det er et 8-cifret dansk nummer, tilføjes automatisk landekode 45.
    """
    if not phone:
        raise ValueError("Telefonnummer mangler.")
        
    clean = re.sub(r'[\s\-\(\)\.]', '', str(phone).strip())
    if clean.startswith('+'):
        clean = clean[1:]
    elif clean.startswith('00'):
        clean = clean[2:]
        
    # Hvis 8-cifret dansk mobilnummer
    if len(clean) == 8 and clean.isdigit():
        clean = f"45{clean}"
        
    if not clean.isdigit() or len(clean) < 8 or len(clean) > 15:
        raise ValueError(f"Ugyldigt telefonnummer '{phone}'. Angiv et gyldigt mobilnummer (f.eks. 12345678 eller +4512345678).")
        
    return int(clean)

def send_judge_magic_link_sms(phone: str, judge_name: str, comp_name: str, magic_link: str) -> dict:
    """
    Sender et Magic Link til en dommer via GatewayAPI.com.
    """
    token = os.environ.get("GATEWAYAPI_TOKEN")
    if not token:
        raise Exception("GatewayAPI token mangler på serveren. Tilføj GATEWAYAPI_TOKEN i miljøvariablerne.")
        
    msisdn = normalize_msisdn(phone)
    
    # Forkort evt. comp_name hvis det er meget langt, så SMS'en forbliver overskuelig
    short_comp = (comp_name[:28] + '..') if comp_name and len(comp_name) > 30 else (comp_name or "stævnet")
    
    message = f"Hej {judge_name}! Dit dommerlink til {short_comp}: {magic_link} - Mvh EquiEvent"
    
    payload = {
        "sender": "EquiEvent",
        "message": message,
        "recipients": [{"msisdn": msisdn}]
    }
    
    auth_header = "Basic " + base64.b64encode(f"{token}:".encode("utf-8")).decode("utf-8")
    data = json.dumps(payload).encode("utf-8")
    
    req = urllib.request.Request(
        "https://gatewayapi.com/rest/mtsms",
        data=data,
        headers={
            "Authorization": auth_header,
            "Content-Type": "application/json"
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body)
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        try:
            err_json = json.loads(err_msg)
            detail = err_json.get("message") or err_json.get("error") or err_msg
        except Exception:
            detail = err_msg
        raise Exception(f"Kunne ikke sende SMS via GatewayAPI (fejl {e.code}): {detail}")
    except Exception as ex:
        raise Exception(f"Fejl ved afsendelse af SMS: {str(ex)}")
